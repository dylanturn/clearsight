class Telemetry {
    constructor() {
        this.sessionId = null;
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

        // Capture page content after a short delay to ensure everything is loaded
        setTimeout(() => {
            console.log('Capturing page content...');
            this.capturePageContent();
            console.log('Page content captured:', {
                htmlLength: this.data.pageHtml?.length || 0,
                stylesLength: this.data.pageStyles?.length || 0
            });
            
            // Send initial data
            this.sendData('session_start', this.data);
        }, 1000);
    }

    async sendData(type, data) {
        try {
            const requestData = {
                type: type,
                session_id: this.sessionId,
                ...data
            };
            
            console.log('Sending telemetry data:', {
                type: type,
                session_id: this.sessionId,
                dataKeys: Object.keys(data),
                url: '/api/telemetry/',
                csrfToken: this.getCSRFToken()
            });

            const response = await fetch('/api/telemetry/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
            }

            const result = await response.json();
            console.log('Data sent successfully:', result);
            
            // Store session ID from initial response
            if (type === 'session_start' && result.session_id) {
                this.sessionId = result.session_id;
                console.log('Session ID received:', this.sessionId);
                // Setup event listeners only after we have a session ID
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error sending data:', error);
        }
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

    setupEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', this.throttle((e) => {
            console.log('Mouse move:', { x: e.clientX, y: e.clientY });
            this.recordEvent('mousemove', {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            });
        }, 50));  // Reduced throttle time for smoother tracking

        // Mouse clicks
        document.addEventListener('click', (e) => {
            console.log('Click:', { x: e.clientX, y: e.clientY });
            this.recordEvent('click', {
                x: e.clientX,
                y: e.clientY,
                target: e.target.tagName,
                timestamp: Date.now()
            });
        });

        // Keyboard input
        document.addEventListener('keypress', (e) => {
            console.log('Keypress event');
            this.recordEvent('keypress', {
                timestamp: Date.now()
            });
        });

        // Scroll position
        document.addEventListener('scroll', this.throttle(() => {
            const scrollX = window.scrollX || document.documentElement.scrollLeft;
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            console.log('Scroll:', { x: scrollX, y: scrollY });
            this.recordEvent('scroll', {
                x: scrollX,
                y: scrollY,
                timestamp: Date.now()
            });
        }, 100));

        // Page visibility
        document.addEventListener('visibilitychange', () => {
            this.recordEvent('visibility', {
                state: document.visibilityState
            });
        });

        // Window resize
        window.addEventListener('resize', this.throttle(() => {
            this.recordEvent('resize', {
                width: window.innerWidth,
                height: window.innerHeight
            });
        }, 100));
    }

    recordEvent(type, data = {}) {
        const event = {
            type,
            timestamp: Date.now(),
            data
        };

        this.data.events.push(event);
        
        // Send event
        this.sendData('event', event);
    }

    // Utility function to throttle event frequency
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    capturePageContent() {
        try {
            // Create a deep clone of the document
            const docClone = document.documentElement.cloneNode(true);
            
            // Remove script tags
            const scripts = docClone.getElementsByTagName('script');
            while (scripts.length > 0) {
                scripts[0].parentNode.removeChild(scripts[0]);
            }
            
            // Remove sensitive input values
            const inputs = docClone.getElementsByTagName('input');
            for (const input of inputs) {
                if (input.type === 'password' || input.type === 'hidden') {
                    input.value = '';
                }
            }
            
            // Add base tag to handle relative URLs
            const head = docClone.querySelector('head') || docClone.appendChild(document.createElement('head'));
            const base = document.createElement('base');
            base.href = window.location.origin;
            head.insertBefore(base, head.firstChild);
            
            // Capture computed styles from all stylesheets
            let computedStyles = '';
            
            // Add default styles first
            computedStyles += `
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: system-ui, -apple-system, sans-serif; }
            `;
            
            // Process each stylesheet
            for (const sheet of document.styleSheets) {
                try {
                    if (!sheet.cssRules) continue;
                    
                    // Handle each rule
                    for (const rule of sheet.cssRules) {
                        // Skip problematic rules
                        if (rule.type !== CSSRule.STYLE_RULE && rule.type !== CSSRule.KEYFRAMES_RULE) {
                            continue;
                        }
                        computedStyles += rule.cssText + '\n';
                    }
                } catch (e) {
                    console.warn('Could not access stylesheet:', e);
                    // For cross-origin stylesheets, try to add them as links
                    if (sheet.href) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = sheet.href;
                        head.appendChild(link);
                    }
                }
            }
            
            // Store the captured content
            this.data.pageHtml = '<!DOCTYPE html>\n' + docClone.outerHTML;
            this.data.pageStyles = computedStyles;
            
            console.log('Page content captured:', {
                htmlLength: this.data.pageHtml.length,
                stylesLength: this.data.pageStyles.length,
                baseUrl: base.href
            });
            
        } catch (error) {
            console.error('Error capturing page content:', error);
            this.data.pageHtml = `
                <!DOCTYPE html>
                <html>
                <head><title>Error</title></head>
                <body>
                    <p>Error capturing page content: ${error.message}</p>
                </body>
                </html>
            `;
            this.data.pageStyles = '';
        }
    }
}

// Initialize telemetry when the page loads
window.addEventListener('load', () => {
    window.telemetry = new Telemetry();
});
