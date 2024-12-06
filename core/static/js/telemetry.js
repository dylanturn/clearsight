class Telemetry {
    constructor() {
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
        const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsScheme}://${window.location.host}/ws/telemetry/`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connection established');
            // Send initial session data
            this.ws.send(JSON.stringify({
                type: 'session_start',
                ...this.data
            }));
            this.setupEventListeners();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket connection closed:', event.code, event.reason);
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };
    }

    setupEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', this.throttle((e) => {
            this.recordEvent('mousemove', {
                x: e.clientX,
                y: e.clientY
            });
        }, 100));

        // Mouse clicks
        document.addEventListener('click', (e) => {
            this.recordEvent('click', {
                x: e.clientX,
                y: e.clientY,
                target: e.target.tagName
            });
        });

        // Keyboard input (only record key type, not actual keys)
        document.addEventListener('keypress', () => {
            this.recordEvent('keypress');
        });

        // Scroll position
        document.addEventListener('scroll', this.throttle(() => {
            this.recordEvent('scroll', {
                x: window.scrollX,
                y: window.scrollY
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
        
        // Send event through WebSocket if connected
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(event));
        }
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
}

// Initialize telemetry when the page loads
window.addEventListener('load', () => {
    window.telemetry = new Telemetry();
});
