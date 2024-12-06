class Telemetry {
    constructor() {
        this.sessionId = null;
        this.lastHtml = null;
        this.eventQueue = [];
        this.isInitialized = false;
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

        this.setupSession();
    }

    getCSRFToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
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

            // Initialize session
            const response = await this.sendData('session_start', sessionData);
            const result = await response.json();
            
            if (result.session_id) {
                this.sessionId = result.session_id;
                this.isInitialized = true;
                console.log('Session initialized:', this.sessionId);
                
                // Process any queued events
                while (this.eventQueue.length > 0) {
                    const { type, data } = this.eventQueue.shift();
                    await this.sendData(type, data);
                }
                
                // Setup event listeners only after session is initialized
                this.setupEventListeners();
            } else {
                throw new Error('No session ID received from server');
            }
        } catch (error) {
            console.error('Error setting up session:', error);
            // Retry setup after a delay
            setTimeout(() => this.setupSession(), 5000);
        }
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

    captureHtmlDiff() {
        const currentHtml = document.documentElement.outerHTML;
        if (this.lastHtml === currentHtml) {
            return null;
        }

        // Create temporary elements to normalize HTML
        const oldDiv = document.createElement('div');
        const newDiv = document.createElement('div');
        oldDiv.innerHTML = this.lastHtml || '';
        newDiv.innerHTML = currentHtml;

        // Clean up elements (remove scripts, comments, etc)
        this.cleanupElement(oldDiv);
        this.cleanupElement(newDiv);

        // Compare and generate diff
        const diff = {
            added: [],
            removed: [],
            modified: []
        };

        this.compareElements(oldDiv, newDiv, diff);

        // Update last HTML state
        this.lastHtml = currentHtml;

        // Only return diff if there are changes
        if (diff.added.length || diff.removed.length || diff.modified.length) {
            return JSON.stringify(diff);
        }
        return null;
    }

    cleanupElement(element) {
        // Remove scripts
        const scripts = element.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            scripts[i].remove();
        }

        // Remove comments
        const iterator = document.createNodeIterator(
            element,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );
        let node;
        while (node = iterator.nextNode()) {
            node.remove();
        }

        // Remove dynamic attributes
        const allElements = element.getElementsByTagName('*');
        for (const el of allElements) {
            // Remove event handlers
            const attrs = el.attributes;
            for (let i = attrs.length - 1; i >= 0; i--) {
                const attr = attrs[i];
                if (attr.name.startsWith('on') || attr.name === 'data-reactid') {
                    el.removeAttribute(attr.name);
                }
            }
        }
    }

    compareElements(oldEl, newEl, diff) {
        const oldNodes = Array.from(oldEl.childNodes);
        const newNodes = Array.from(newEl.childNodes);

        // Compare text content directly for text nodes
        if (oldEl.nodeType === Node.TEXT_NODE && newEl.nodeType === Node.TEXT_NODE) {
            if (oldEl.textContent.trim() !== newEl.textContent.trim()) {
                diff.modified.push({
                    oldText: oldEl.textContent.trim(),
                    newText: newEl.textContent.trim()
                });
            }
            return;
        }

        // Compare attributes
        if (oldEl.nodeType === Node.ELEMENT_NODE && newEl.nodeType === Node.ELEMENT_NODE) {
            const oldAttrs = Array.from(oldEl.attributes || []);
            const newAttrs = Array.from(newEl.attributes || []);

            // Check for modified attributes
            for (const oldAttr of oldAttrs) {
                const newAttr = newEl.getAttribute(oldAttr.name);
                if (newAttr !== oldAttr.value) {
                    diff.modified.push({
                        element: oldEl.tagName.toLowerCase(),
                        attribute: oldAttr.name,
                        oldValue: oldAttr.value,
                        newValue: newAttr
                    });
                }
            }

            // Check for added attributes
            for (const newAttr of newAttrs) {
                if (!oldEl.hasAttribute(newAttr.name)) {
                    diff.added.push({
                        element: newEl.tagName.toLowerCase(),
                        attribute: newAttr.name,
                        value: newAttr.value
                    });
                }
            }
        }

        // Compare child nodes recursively
        const maxLength = Math.max(oldNodes.length, newNodes.length);
        for (let i = 0; i < maxLength; i++) {
            const oldNode = oldNodes[i];
            const newNode = newNodes[i];

            if (!oldNode && newNode) {
                // Node was added
                diff.added.push({
                    html: newNode.outerHTML || newNode.textContent
                });
            } else if (oldNode && !newNode) {
                // Node was removed
                diff.removed.push({
                    html: oldNode.outerHTML || oldNode.textContent
                });
            } else if (oldNode && newNode) {
                // Compare existing nodes
                this.compareElements(oldNode, newNode, diff);
            }
        }
    }

    async sendData(type, data) {
        try {
            // If not initialized and not a session_start event, queue the event
            if (!this.isInitialized && type !== 'session_start') {
                this.eventQueue.push({ type, data });
                console.log('Event queued:', type);
                return;
            }

            // Add HTML diff for relevant events
            if (['input', 'change'].includes(type)) {
                const htmlDiff = this.captureHtmlDiff();
                if (htmlDiff) {
                    data.htmlDiff = htmlDiff;
                }
            }

            // Ensure data is an object
            const eventData = typeof data === 'object' ? { ...data } : { value: data };

            // Add additional context based on event type
            switch (type) {
                case 'mousemove':
                    eventData.x = data.clientX;
                    eventData.y = data.clientY;
                    eventData.pageX = data.pageX;
                    eventData.pageY = data.pageY;
                    break;
                case 'click':
                    eventData.x = data.clientX;
                    eventData.y = data.clientY;
                    eventData.target = this.getElementPath(data.target);
                    break;
                case 'scroll':
                    eventData.scrollX = window.scrollX;
                    eventData.scrollY = window.scrollY;
                    break;
                case 'input':
                case 'change':
                    eventData.target = this.getElementPath(data.target);
                    eventData.value = data.target.value;
                    break;
                case 'fetch':
                case 'xhr':
                    eventData.url = data.url;
                    eventData.method = data.method;
                    eventData.status = data.status;
                    break;
            }

            const requestData = {
                type: type,
                session_id: this.sessionId,
                timestamp: Date.now(),
                data: eventData,
                html_diff: data.htmlDiff || null
            };

            const response = await fetch('/api/telemetry/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error('Error sending telemetry data:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', this.throttle((e) => {
            this.sendData('mousemove', {
                clientX: e.clientX,
                clientY: e.clientY,
                pageX: e.pageX,
                pageY: e.pageY,
                timestamp: Date.now()
            });
        }, 50));

        // Clicks
        document.addEventListener('click', (e) => {
            const target = e.target;
            this.sendData('click', {
                clientX: e.clientX,
                clientY: e.clientY,
                target: target,
                timestamp: Date.now()
            });
        });

        // Input changes
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                this.sendData('input', {
                    target: target,
                    value: target.value,
                    type: target.type || 'text',
                    timestamp: Date.now()
                });
            }
        });

        // Form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const formData = new FormData(form);
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            this.sendData('form_submit', {
                form: form,
                data: data,
                timestamp: Date.now()
            });
        });

        // Scroll events
        document.addEventListener('scroll', this.throttle((e) => {
            const target = e.target === document ? document.documentElement : e.target;
            this.sendData('scroll', {
                target: target,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                timestamp: Date.now()
            });
        }, 100));

        // DOM mutations
        const observer = new MutationObserver(this.throttle((mutations) => {
            const changes = mutations.map(mutation => ({
                type: mutation.type,
                target: this.getElementPath(mutation.target),
                addedNodes: Array.from(mutation.addedNodes).map(node => 
                    node.outerHTML || node.textContent
                ),
                removedNodes: Array.from(mutation.removedNodes).map(node => 
                    node.outerHTML || node.textContent
                ),
                attributeName: mutation.attributeName,
                oldValue: mutation.oldValue
            }));

            this.sendData('dom_mutation', {
                changes: changes,
                timestamp: Date.now()
            });
        }, 100));

        observer.observe(document.body, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });

        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.sendData('visibility_change', {
                visible: !document.hidden,
                timestamp: Date.now()
            });
        });

        // Window resize
        window.addEventListener('resize', this.throttle(() => {
            this.sendData('window_resize', {
                width: window.innerWidth,
                height: window.innerHeight,
                timestamp: Date.now()
            });
        }, 100));

        // Error tracking
        window.addEventListener('error', (e) => {
            this.sendData('error', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                timestamp: Date.now()
            });
        });

        // Network requests
        this.setupXHRInterceptor();
        this.setupFetchInterceptor();
    }

    throttle(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            if (!timeout) {
                timeout = setTimeout(() => {
                    timeout = null;
                    func.apply(context, args);
                }, wait);
            }
        }
    }

    setupXHRInterceptor() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const self = this;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    self.sendData('xhr', {
                        method: method,
                        url: url,
                        status: this.status,
                        statusText: this.statusText,
                        timestamp: Date.now()
                    });
                }
            });
            originalOpen.apply(this, arguments);
        };
    }

    setupFetchInterceptor() {
        const originalFetch = window.fetch;
        const self = this;
        window.fetch = function(url, options = {}) {
            const startTime = Date.now();
            return originalFetch.apply(this, arguments).then(response => {
                self.sendData('fetch', {
                    method: options.method || 'GET',
                    url: typeof url === 'string' ? url : url.url,
                    status: response.status,
                    statusText: response.statusText,
                    duration: Date.now() - startTime,
                    timestamp: Date.now()
                });
                return response;
            }).catch(error => {
                self.sendData('fetch', {
                    method: options.method || 'GET',
                    url: typeof url === 'string' ? url : url.url,
                    error: error.message,
                    duration: Date.now() - startTime,
                    timestamp: Date.now()
                });
                throw error;
            });
        };
    }

    recordEvent(type, data) {
        const event = {
            type,
            timestamp: Date.now(),
            data
        };

        this.data.events.push(event);
        
        // Send event
        this.sendData('event', event);
    }
}

// Initialize telemetry when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.telemetry = new Telemetry();
});
