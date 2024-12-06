class Telemetry {
    constructor() {
        this.sessionId = null;
        this.lastHtml = null;
        this.eventQueue = [];
        this.isInitialized = false;
        this.lastMouseEvent = null;
        this.mouseRateLimit = 50; // Rate limit in milliseconds
        this.lastDomSnapshot = null;
        this.ws = null;
        this.data = {
            pageUrl: window.location.href,
            pageTitle: document.title,
            userAgent: navigator.userAgent,
            screenResolution: {
                width: window.screen.width,
                height: window.screen.height
            },
            windowSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            events: [],
            startTime: Date.now()
        };

        this.setupWebSocket();
    }

    setupWebSocket() {
        // Use wss for production, ws for development
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/telemetry/`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.setupSession();
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            if (response.type === 'session_started') {
                this.sessionId = response.session_id;
                this.isInitialized = true;
                console.log('Session initialized:', this.sessionId);
                this.setupEventListeners();
            }
        };
    }

    async setupSession() {
        try {
            // Capture initial page state
            const bodyContent = document.body.innerHTML;
            this.lastHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${document.title}</title>
            </head>
            <body>
                ${bodyContent}
            </body>
            </html>`.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
            
            // Get computed styles for all elements
            const styleMap = new Map();
            const elements = document.getElementsByTagName('*');
            for (let element of elements) {
                const computedStyle = window.getComputedStyle(element);
                const relevantStyles = {
                    position: computedStyle.position,
                    display: computedStyle.display,
                    visibility: computedStyle.visibility,
                    opacity: computedStyle.opacity,
                    zIndex: computedStyle.zIndex,
                    transform: computedStyle.transform,
                    transition: computedStyle.transition,
                    backgroundColor: computedStyle.backgroundColor,
                    color: computedStyle.color,
                    width: computedStyle.width,
                    height: computedStyle.height,
                    margin: computedStyle.margin,
                    padding: computedStyle.padding,
                    border: computedStyle.border,
                    borderRadius: computedStyle.borderRadius,
                    boxShadow: computedStyle.boxShadow,
                    font: computedStyle.font,
                    textAlign: computedStyle.textAlign,
                    overflow: computedStyle.overflow
                };
                styleMap.set(this.getElementPath(element), relevantStyles);
            }

            const sessionData = {
                type: 'session_start',
                pageUrl: window.location.href,
                pageTitle: document.title,
                userAgent: navigator.userAgent,
                screenResolution: {
                    width: window.screen.width,
                    height: window.screen.height
                },
                windowSize: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                pageHtml: this.lastHtml,
                pageStyles: Object.fromEntries(styleMap)
            };

            // Send session start data through WebSocket
            this.sendData('session_start', sessionData);
            this.lastDomSnapshot = document.documentElement.innerHTML;
        } catch (error) {
            console.error('Error setting up session:', error);
            // Retry setup after a delay
            setTimeout(() => this.setupSession(), 5000);
        }
    }

    sendData(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // If not initialized and not a session_start event, queue the event
            if (!this.isInitialized && type !== 'session_start') {
                this.eventQueue.push({ type, data });
                console.log('Event queued:', type);
                return;
            }

            const requestData = {
                type: type,
                session_id: this.sessionId,
                timestamp: Date.now(),
                data: data
            };

            this.ws.send(JSON.stringify(requestData));
        } else {
            console.warn('WebSocket not ready, queueing event:', type);
            this.eventQueue.push({ type, data });
        }
    }

    setupEventListeners() {
        // Mouse movement with rate limiting
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (!this.lastMouseEvent || (now - this.lastMouseEvent) >= this.mouseRateLimit) {
                this.lastMouseEvent = now;
                this.sendData('mousemove', {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    pageX: e.pageX,
                    pageY: e.pageY,
                    timestamp: now
                });
            }
        });

        // Clicks
        document.addEventListener('click', (e) => {
            const target = e.target;
            this.sendData('click', {
                clientX: e.clientX,
                clientY: e.clientY,
                target: this.getElementPath(target),
                timestamp: Date.now()
            });
        });

        // Input changes
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                this.sendData('input', {
                    target: this.getElementPath(target),
                    value: target.value,
                    type: target.type || 'text',
                    timestamp: Date.now()
                });
            }
        });

        // Form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            this.sendData('form_submit', {
                form: this.getElementPath(form),
                timestamp: Date.now()
            });
        });

        // Scroll events with rate limiting
        let scrollTimeout;
        document.addEventListener('scroll', (e) => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(() => {
                this.sendData('scroll', {
                    scrollX: window.scrollX,
                    scrollY: window.scrollY,
                    timestamp: Date.now()
                });
            }, 100); // Rate limit scroll events to 100ms
        });

        // DOM mutations
        const observer = new MutationObserver((mutations) => {
            const currentSnapshot = document.documentElement.innerHTML;
            if (currentSnapshot !== this.lastDomSnapshot) {
                this.lastDomSnapshot = currentSnapshot;
                this.sendData('dom_change', {
                    mutations: mutations.map(mutation => ({
                        type: mutation.type,
                        target: this.getElementPath(mutation.target),
                        addedNodes: Array.from(mutation.addedNodes).map(node => 
                            node.nodeType === Node.ELEMENT_NODE ? this.getElementPath(node) : null
                        ).filter(Boolean),
                        removedNodes: Array.from(mutation.removedNodes).map(node => 
                            node.nodeType === Node.ELEMENT_NODE ? this.getElementPath(node) : null
                        ).filter(Boolean),
                        timestamp: Date.now()
                    }))
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        // Network requests
        this.setupXHRInterceptor();
        this.setupFetchInterceptor();
    }

    getElementPath(element) {
        const path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            if (element.id) {
                selector += '#' + element.id;
            } else {
                let sibling = element;
                let nth = 1;
                while (sibling.previousElementSibling) {
                    sibling = sibling.previousElementSibling;
                    if (sibling.nodeName === element.nodeName) nth++;
                }
                if (nth > 1) selector += `:nth-of-type(${nth})`;
            }
            path.unshift(selector);
            element = element.parentNode;
        }
        return path.join(' > ');
    }

    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = function() {
            const url = arguments[0];
            const options = arguments[1] || {};
            
            // Skip all telemetry-related requests to avoid infinite loops
            const urlString = typeof url === 'string' ? url : url.url;
            if (urlString.includes('telemetry') || // Matches any URL containing 'telemetry'
                urlString.includes('/ws/') ||      // Matches WebSocket connections
                urlString.includes('/api/')) {     // Matches API endpoints
                return originalFetch.apply(this, arguments);
            }

            return originalFetch.apply(this, arguments)
                .then(response => {
                    self.sendData('fetch', {
                        url: urlString,
                        method: options.method || 'GET',
                        status: response.status,
                        timestamp: Date.now()
                    });
                    return response;
                })
                .catch(error => {
                    self.sendData('fetch_error', {
                        url: urlString,
                        method: options.method || 'GET',
                        error: error.message,
                        timestamp: Date.now()
                    });
                    throw error;
                });
        };
    }

    setupXHRInterceptor() {
        const originalXHR = window.XMLHttpRequest;
        const self = this;

        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;

            xhr.open = function() {
                this._url = arguments[1];
                this._method = arguments[0];
                return originalOpen.apply(this, arguments);
            };

            xhr.send = function() {
                // Skip all telemetry-related requests to avoid infinite loops
                if (this._url.includes('telemetry') || // Matches any URL containing 'telemetry'
                    this._url.includes('/ws/') ||      // Matches WebSocket connections
                    this._url.includes('/api/')) {     // Matches API endpoints
                    return originalSend.apply(this, arguments);
                }

                this.addEventListener('load', function() {
                    self.sendData('xhr', {
                        url: this._url,
                        method: this._method,
                        status: this.status,
                        timestamp: Date.now()
                    });
                });
                return originalSend.apply(this, arguments);
            };

            return xhr;
        };
    }
}

// Initialize telemetry when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.telemetry = new Telemetry();
});
