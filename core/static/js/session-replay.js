class SessionReplay {
    constructor(sessionData) {
        if (!sessionData) {
            console.error('No session data provided');
            return;
        }
        
        console.log('Initializing session replay with data:', {
            events: sessionData.events?.length || 0,
            firstEvent: sessionData.events?.[0],
            lastEvent: sessionData.events?.[sessionData.events?.length - 1]
        });
        
        this.sessionData = sessionData;
        this.events = sessionData.events || [];
        this.currentEventIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        this.startTime = null;
        this.lastTimestamp = null;
        
        // Create cursor if it doesn't exist
        this.cursor = document.getElementById('cursor');
        if (!this.cursor) {
            this.cursor = document.createElement('div');
            this.cursor.id = 'cursor';
            document.querySelector('.viewport').appendChild(this.cursor);
        }
        
        // Initialize DOM elements
        this.initializeElements();
        
        // Setup the replay frame and event listeners
        this.setupReplayFrame();
        this.setupEventListeners();
        
        // Log first few events for debugging
        console.log('First few events:', this.events.slice(0, 3));
    }
    
    initializeElements() {
        this.playPauseBtn = document.getElementById('play-pause');
        this.speedSelect = document.getElementById('speed');
        this.progressBar = document.getElementById('progress');
        this.timeDisplay = document.getElementById('time-display');
        this.viewport = document.querySelector('.viewport');
        
        if (!this.playPauseBtn || !this.speedSelect || !this.progressBar || !this.timeDisplay || !this.viewport) {
            throw new Error('Required DOM elements not found');
        }
    }
    
    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.speedSelect.addEventListener('change', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
        });
        this.progressBar.addEventListener('input', (e) => {
            const progress = e.target.value / 100;
            this.seekToProgress(progress);
        });
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.currentEventIndex >= this.events.length) {
            this.currentEventIndex = 0;
        }
        
        this.isPlaying = true;
        this.playPauseBtn.textContent = 'Pause';
        this.startTime = Date.now() - (this.currentEventIndex > 0 ? this.events[this.currentEventIndex].timestamp : 0);
        this.playNextEvent();
    }
    
    pause() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = 'Play';
        if (this.nextEventTimeout) {
            clearTimeout(this.nextEventTimeout);
        }
    }
    
    playNextEvent() {
        if (!this.isPlaying || this.currentEventIndex >= this.events.length) {
            if (this.currentEventIndex >= this.events.length) {
                this.pause();
                this.currentEventIndex = 0;
                this.updateProgress();
            }
            return;
        }
        
        const currentEvent = this.events[this.currentEventIndex];
        const nextEvent = this.events[this.currentEventIndex + 1];
        
        this.playEvent(currentEvent);
        
        if (nextEvent) {
            const delay = (nextEvent.timestamp - currentEvent.timestamp) / this.playbackSpeed;
            this.nextEventTimeout = setTimeout(() => {
                this.currentEventIndex++;
                this.playNextEvent();
            }, delay);
        } else {
            this.currentEventIndex++;
            this.playNextEvent();
        }
        
        this.updateProgress();
    }
    
    playEvent(event) {
        if (!event || !event.type) {
            console.warn('Invalid event:', event);
            return;
        }
        
        console.log('Playing event:', {
            type: event.type,
            data: event.data,
            timestamp: event.timestamp
        });
        
        switch (event.type) {
            case 'mousemove':
                if (event.data && typeof event.data.x === 'number' && typeof event.data.y === 'number') {
                    this.moveCursor(event.data.x, event.data.y);
                }
                break;
                
            case 'click':
                if (event.data && typeof event.data.x === 'number' && typeof event.data.y === 'number') {
                    this.moveCursor(event.data.x, event.data.y);
                    this.showClick(event.data.x, event.data.y);
                    
                    if (event.data.target) {
                        this.highlightElement(event.data.target);
                    }
                }
                break;
                
            case 'input':
                if (event.data && event.data.target && event.data.value !== undefined) {
                    this.updateInputValue(event.data.target, event.data.value);
                }
                break;
                
            case 'scroll':
                if (event.data) {
                    this.scrollViewport(event.data.scrollX || 0, event.data.scrollY || 0);
                }
                break;
                
            case 'fetch':
            case 'xhr':
                this.showNetworkRequest(event.data);
                break;
                
            case 'dom_mutation':
                if (event.data && event.data.changes) {
                    this.applyDomMutations(event.data.changes);
                }
                break;
                
            case 'form_submit':
                if (event.data && event.data.form) {
                    this.highlightElement(event.data.form, 'submit');
                }
                break;
                
            case 'error':
                if (event.data) {
                    this.showError(event.data);
                }
                break;
                
            case 'visibility_change':
            case 'window_resize':
                // These events don't need visual representation
                break;
                
            default:
                console.log('Unhandled event type:', event.type);
        }
        
        // Handle HTML diff if present
        if (event.data && event.data.htmlDiff) {
            this.applyHtmlDiff(event.data.htmlDiff);
        }
        
        // Update time display
        if (event.timestamp) {
            const elapsed = event.timestamp - this.events[0].timestamp;
            this.timeDisplay.textContent = this.formatTime(elapsed);
        }
    }
    
    applyHtmlDiff(diffData) {
        try {
            const diff = JSON.parse(diffData);
            const frame = document.getElementById('replay-frame');
            if (!frame || !frame.contentDocument) {
                throw new Error('Replay frame not available');
            }
            
            const doc = frame.contentDocument;
            
            // Create a container for visual feedback
            const feedbackContainer = doc.createElement('div');
            feedbackContainer.className = 'diff-feedback';
            feedbackContainer.style.position = 'fixed';
            feedbackContainer.style.bottom = '20px';
            feedbackContainer.style.right = '20px';
            feedbackContainer.style.zIndex = '9999';
            doc.body.appendChild(feedbackContainer);
            
            const showFeedback = (message, type = 'info') => {
                const feedback = doc.createElement('div');
                feedback.className = `diff-message ${type}`;
                feedback.textContent = message;
                feedbackContainer.appendChild(feedback);
                setTimeout(() => feedback.remove(), 3000);
            };
            
            let appliedChanges = 0;
            let failedChanges = 0;

            // Apply added elements
            if (diff.added && Array.isArray(diff.added)) {
                diff.added.forEach(addition => {
                    try {
                        if (addition.html) {
                            const temp = doc.createElement('div');
                            temp.innerHTML = this.sanitizeHTML(addition.html);
                            const newNode = temp.firstChild;
                            
                            if (!newNode) {
                                throw new Error('Invalid HTML content');
                            }

                            // Handle external resources
                            const tagName = newNode.tagName ? newNode.tagName.toUpperCase() : '';
                            if (tagName === 'LINK' && newNode.getAttribute('rel') === 'stylesheet') {
                                // Handle external stylesheets
                                const href = newNode.getAttribute('href');
                                if (href) {
                                    console.log('Processing external stylesheet:', href);
                                    // Add the stylesheet to the frame's head
                                    const link = doc.createElement('link');
                                    link.rel = 'stylesheet';
                                    link.href = href;
                                    doc.head.appendChild(link);
                                }
                                return;
                            } else if (tagName === 'SCRIPT') {
                                // Handle external scripts
                                const src = newNode.getAttribute('src');
                                if (src) {
                                    console.log('Processing external script:', src);
                                    // Add the script to the frame's head
                                    const script = doc.createElement('script');
                                    script.src = src;
                                    script.async = true;
                                    doc.head.appendChild(script);
                                }
                                return;
                            }
                            
                            // Add other nodes to body
                            doc.body.appendChild(newNode);
                            
                            // Add highlight animation class
                            if (newNode.style) {
                                newNode.classList.add('highlight-new');
                                setTimeout(() => newNode.classList.remove('highlight-new'), 1000);
                            }
                            
                            appliedChanges++;
                            const elementType = tagName.toLowerCase() || 'element';
                            showFeedback(`Added: ${elementType}`, 'success');
                        }
                    } catch (error) {
                        console.error('Error adding element:', error);
                        failedChanges++;
                        showFeedback(`Failed to add element: ${error.message}`, 'error');
                    }
                });
            }
            
            // Apply removed elements
            if (diff.removed && Array.isArray(diff.removed)) {
                diff.removed.forEach(removal => {
                    try {
                        if (removal.html) {
                            const temp = doc.createElement('div');
                            temp.innerHTML = removal.html;
                            const selector = this.createSelector(temp.firstChild);
                            const element = doc.querySelector(selector);
                            
                            if (element) {
                                // Fade out removed content
                                element.style.animation = 'fade-out 0.5s ease-out';
                                setTimeout(() => {
                                    try {
                                        element.remove();
                                        appliedChanges++;
                                        showFeedback(`Removed: ${element.tagName.toLowerCase()}`, 'success');
                                    } catch (error) {
                                        failedChanges++;
                                        showFeedback(`Failed to remove element: ${error.message}`, 'error');
                                    }
                                }, 500);
                            }
                        }
                    } catch (error) {
                        console.error('Error removing element:', error);
                        failedChanges++;
                        showFeedback(`Failed to process removal: ${error.message}`, 'error');
                    }
                });
            }
            
            // Apply modified elements
            if (diff.modified && Array.isArray(diff.modified)) {
                diff.modified.forEach(modification => {
                    try {
                        if (modification.element) {
                            const elements = doc.getElementsByTagName(modification.element);
                            for (const element of elements) {
                                try {
                                    if (modification.attribute) {
                                        // Highlight attribute changes
                                        const oldValue = element.getAttribute(modification.attribute);
                                        if (oldValue !== modification.newValue) {
                                            element.setAttribute(modification.attribute, modification.newValue);
                                            this.highlightElement(element);
                                            appliedChanges++;
                                            showFeedback(`Modified attribute: ${modification.attribute}`, 'success');
                                        }
                                    } else if (modification.oldText !== undefined && modification.newText !== undefined) {
                                        // Highlight text changes
                                        if (element.textContent === modification.oldText) {
                                            element.textContent = modification.newText;
                                            this.highlightElement(element);
                                            appliedChanges++;
                                            showFeedback(`Modified text content`, 'success');
                                        }
                                    }
                                } catch (error) {
                                    failedChanges++;
                                    showFeedback(`Failed to modify element: ${error.message}`, 'error');
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error modifying element:', error);
                        failedChanges++;
                        showFeedback(`Failed to process modification: ${error.message}`, 'error');
                    }
                });
            }
            
            // Show summary feedback
            if (appliedChanges > 0 || failedChanges > 0) {
                const summary = `Applied ${appliedChanges} changes${failedChanges > 0 ? `, ${failedChanges} failed` : ''}`;
                showFeedback(summary, failedChanges > 0 ? 'warning' : 'success');
            }
            
            // Cleanup feedback container after all animations
            setTimeout(() => feedbackContainer.remove(), 3500);
            
        } catch (error) {
            console.error('Error applying HTML diff:', error);
            const frame = document.getElementById('replay-frame');
            if (frame && frame.contentDocument) {
                const doc = frame.contentDocument;
                const errorMessage = doc.createElement('div');
                errorMessage.className = 'diff-error';
                errorMessage.textContent = `Failed to apply changes: ${error.message}`;
                doc.body.appendChild(errorMessage);
                setTimeout(() => errorMessage.remove(), 3000);
            }
        }
    }
    
    highlightElement(targetPath, action = 'highlight') {
        const frame = document.getElementById('replay-frame');
        if (!frame || !frame.contentDocument) return;
        
        try {
            const element = this.findElementByPath(frame.contentDocument, targetPath);
            if (!element) return;
            
            // Add highlight styles
            const highlight = document.createElement('div');
            highlight.className = `replay-highlight ${action}`;
            highlight.style.position = 'absolute';
            
            const rect = element.getBoundingClientRect();
            highlight.style.left = rect.left + 'px';
            highlight.style.top = rect.top + 'px';
            highlight.style.width = rect.width + 'px';
            highlight.style.height = rect.height + 'px';
            
            frame.contentDocument.body.appendChild(highlight);
            setTimeout(() => highlight.remove(), 1000);
        } catch (error) {
            console.error('Error highlighting element:', error);
        }
    }
    
    updateInputValue(targetPath, value) {
        const frame = document.getElementById('replay-frame');
        if (!frame || !frame.contentDocument) return;
        
        try {
            const element = this.findElementByPath(frame.contentDocument, targetPath);
            if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
                element.value = value;
                this.highlightElement(element);
                
                // Show typing indicator
                this.cursor.classList.add('typing');
                setTimeout(() => this.cursor.classList.remove('typing'), 200);
            }
        } catch (error) {
            console.error('Error updating input value:', error);
        }
    }
    
    findElementByPath(doc, path) {
        if (!doc || !path || typeof path !== 'string') {
            console.warn('Invalid arguments to findElementByPath:', { doc: !!doc, path });
            return null;
        }

        try {
            // Handle direct selectors (e.g., "div.class-name")
            const directElement = doc.querySelector(path);
            if (directElement) {
                return directElement;
            }

            // Fall back to path-based lookup
            const parts = path.split(' > ');
            let element = doc;
            
            for (const part of parts) {
                const [tag, ...classes] = part.split('.');
                if (!tag) continue;
                
                const candidates = element.getElementsByTagName(tag);
                
                element = Array.from(candidates).find(el => 
                    classes.every(cls => el.classList && el.classList.contains(cls))
                );
                
                if (!element) return null;
            }
            
            return element;
        } catch (error) {
            console.error('Error in findElementByPath:', error);
            return null;
        }
    }
    
    createSelector(element) {
        if (!element.tagName) return null;
        
        let selector = element.tagName.toLowerCase();
        if (element.id) {
            selector += `#${element.id}`;
        } else if (element.className) {
            selector += `.${element.className.split(' ').join('.')}`;
        }
        
        return selector;
    }
    
    moveCursor(x, y) {
        if (!this.cursor || typeof x !== 'number' || typeof y !== 'number') {
            console.warn('Invalid cursor move:', { cursor: !!this.cursor, x, y });
            return;
        }
        
        // Get the viewport and frame elements
        const viewport = document.querySelector('.viewport');
        const frame = document.getElementById('replay-frame');
        if (!viewport || !frame) {
            console.error('Required elements not found');
            return;
        }
        
        // Get the frame's dimensions and position
        const frameRect = frame.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        
        // Calculate the scale and offset
        const scaleX = frameRect.width / window.innerWidth;
        const scaleY = frameRect.height / window.innerHeight;
        
        // Calculate cursor position relative to the frame
        const cursorX = (x * scaleX) + frameRect.left - viewportRect.left;
        const cursorY = (y * scaleY) + frameRect.top - viewportRect.top;
        
        // Update cursor position
        this.cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        this.cursor.style.display = 'block';
        
        console.log('Cursor moved:', {
            input: { x, y },
            scaled: { x: cursorX, y: cursorY },
            scale: { x: scaleX, y: scaleY },
            frame: frameRect,
            viewport: viewportRect
        });
    }
    
    showClick(x, y) {
        if (!this.cursor || typeof x !== 'number' || typeof y !== 'number') {
            console.warn('Invalid click:', { cursor: !!this.cursor, x, y });
            return;
        }
        
        // Move cursor to click position
        this.moveCursor(x, y);
        
        // Get the viewport and frame elements
        const viewport = document.querySelector('.viewport');
        const frame = document.getElementById('replay-frame');
        if (!viewport || !frame) {
            console.error('Required elements not found');
            return;
        }
        
        // Get the frame's dimensions and position
        const frameRect = frame.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        
        // Calculate the scale and offset
        const scaleX = frameRect.width / window.innerWidth;
        const scaleY = frameRect.height / window.innerHeight;
        
        // Calculate click position
        const clickX = (x * scaleX) + frameRect.left - viewportRect.left;
        const clickY = (y * scaleY) + frameRect.top - viewportRect.top;
        
        // Create click animation
        const clickAnimation = document.createElement('div');
        clickAnimation.className = 'click-animation';
        clickAnimation.style.transform = `translate(${clickX}px, ${clickY}px)`;
        viewport.appendChild(clickAnimation);
        
        // Add clicking class to cursor
        this.cursor.classList.add('clicking');
        setTimeout(() => this.cursor.classList.remove('clicking'), 200);
        
        // Remove click animation after animation ends
        setTimeout(() => viewport.removeChild(clickAnimation), 500);
    }
    
    scrollViewport(x, y) {
        const frame = document.getElementById('replay-frame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.scrollTo(x, y);
        }
    }
    
    setupReplayFrame() {
        try {
            const frame = document.getElementById('replay-frame');
            if (!frame) {
                throw new Error('Replay frame not found');
            }

            // Get the session data
            const sessionDataElement = document.getElementById('session-data');
            if (!sessionDataElement) {
                throw new Error('Session data element not found');
            }

            let sessionData;
            try {
                const rawData = sessionDataElement.textContent.trim();
                if (!rawData) {
                    throw new Error('Session data is empty');
                }
                sessionData = JSON.parse(rawData);
            } catch (parseError) {
                console.error('Failed to parse session data:', parseError);
                throw new Error(`Failed to parse session data: ${parseError.message}`);
            }

            // Check if we have valid session data
            if (!sessionData || !sessionData.page_html) {
                throw new Error('Invalid session data structure');
            }

            // Create the document content
            const doc = frame.contentDocument;
            doc.open();
            
            try {
                // Create a parser to properly parse the HTML
                const parser = new DOMParser();
                const parsedDoc = parser.parseFromString(sessionData.page_html, 'text/html');
                
                // Add CSP meta tag to the iframe content
                const cspMeta = doc.createElement('meta');
                cspMeta.httpEquiv = 'Content-Security-Policy';
                cspMeta.content = "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
                    "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com " +
                    "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; " +
                    "img-src 'self' data: blob: https:; " +
                    "font-src 'self' data: https://fonts.gstatic.com; " +
                    "connect-src 'self' https:; " +
                    "frame-src 'self'; " +
                    "object-src 'none'; " +
                    "base-uri 'self'";
                parsedDoc.head.insertBefore(cspMeta, parsedDoc.head.firstChild);
                
                // Copy the parsed content to the iframe
                doc.write('<!DOCTYPE html>');
                doc.write(parsedDoc.documentElement.outerHTML);
                doc.close();
                
                // Add base styles
                const styleSheet = doc.createElement('style');
                styleSheet.textContent = `
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    body {
                        max-width: 100%;
                        box-sizing: border-box;
                        padding: 20px;
                        line-height: 1.5;
                    }
                    * { cursor: none !important; }
                    a, button, input, textarea, select { pointer-events: none !important; }
                `;
                doc.head.appendChild(styleSheet);
                
                // Add user styles if any
                if (sessionData.page_styles) {
                    const userStyles = doc.createElement('style');
                    userStyles.textContent = sessionData.page_styles;
                    doc.head.appendChild(userStyles);
                }
                
                // Add base target to prevent navigation
                const base = doc.createElement('base');
                base.target = '_blank';
                doc.head.insertBefore(base, doc.head.firstChild);
                
                console.log('Replay frame setup complete');
            } catch (contentError) {
                doc.close();
                throw new Error(`Failed to write content to frame: ${contentError.message}`);
            }
        } catch (error) {
            console.error('Error initializing replay:', error);
            this.showError({
                title: 'Initialization Error',
                message: error.message
            });
        }
    }
    
    sanitizeHTML(html) {
        try {
            // Remove any script tags for security
            html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            // Ensure proper HTML structure
            if (!html.includes('<!DOCTYPE html>')) {
                html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
            }
            
            return html;
        } catch (error) {
            console.error('Error sanitizing HTML:', error);
            return '<html><body><p>Error: Failed to sanitize HTML content</p></body></html>';
        }
    }
    
    processStyles(styles) {
        if (typeof styles === 'string') {
            return styles;
        }
        
        // Convert object-based styles to CSS string
        try {
            const styleStr = Object.entries(styles).map(([selector, rules]) => {
                const ruleStr = Object.entries(rules)
                    .map(([prop, value]) => `${prop}: ${value};`)
                    .join(' ');
                return `${selector} { ${ruleStr} }`;
            }).join('\n');
            return styleStr;
        } catch (error) {
            console.error('Error processing styles:', error);
            return '';
        }
    }
    
    showNetworkRequest(data) {
        // Create network request indicator
        const indicator = document.createElement('div');
        indicator.className = `network-request ${data.error ? 'error' : (data.status >= 400 ? 'failed' : 'success')}`;
        
        const method = document.createElement('span');
        method.className = 'method';
        method.textContent = data.method;
        
        const url = document.createElement('span');
        url.className = 'url';
        url.textContent = data.url;
        
        const status = document.createElement('span');
        status.className = 'status';
        status.textContent = data.error ? 'Error' : `${data.status} ${data.statusText}`;
        
        const duration = document.createElement('span');
        duration.className = 'duration';
        duration.textContent = data.duration ? `${data.duration}ms` : '';

        // Add retry button for failed requests
        if (data.error || data.status >= 400) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'retry-btn';
            retryBtn.textContent = 'Retry';
            retryBtn.onclick = async () => {
                try {
                    const startTime = Date.now();
                    const response = await fetch(data.url, {
                        method: data.method,
                        headers: data.headers || {},
                        body: data.body
                    });
                    
                    const newData = {
                        ...data,
                        status: response.status,
                        statusText: response.statusText,
                        duration: Date.now() - startTime,
                        error: null
                    };
                    
                    // Remove old indicator and show new one
                    indicator.remove();
                    this.showNetworkRequest(newData);
                } catch (error) {
                    console.error('Retry failed:', error);
                    const errorSpan = document.createElement('span');
                    errorSpan.className = 'retry-error';
                    errorSpan.textContent = `Retry failed: ${error.message}`;
                    indicator.appendChild(errorSpan);
                }
            };
            indicator.appendChild(retryBtn);
        }
        
        indicator.appendChild(method);
        indicator.appendChild(url);
        indicator.appendChild(status);
        if (data.duration) {
            indicator.appendChild(duration);
        }
        
        const container = document.querySelector('.network-requests') || this.createNetworkContainer();
        container.appendChild(indicator);
        
        // Auto-remove after animation
        setTimeout(() => {
            indicator.classList.add('fade-out');
            setTimeout(() => indicator.remove(), 500);
        }, 3000);
    }
    
    showError(data) {
        const errorIndicator = document.createElement('div');
        errorIndicator.className = 'error-indicator';
        errorIndicator.innerHTML = `
            <div class="error-content">
                <span class="error-title">Error</span>
                <span class="error-message">${data.message}</span>
                ${data.filename ? `<span class="error-location">${data.filename}:${data.lineno}:${data.colno}</span>` : ''}
            </div>
        `;
        
        document.querySelector('.viewport').appendChild(errorIndicator);
        
        setTimeout(() => {
            errorIndicator.classList.add('fade-out');
            setTimeout(() => errorIndicator.remove(), 500);
        }, 3000);
    }
    
    createNetworkContainer() {
        const container = document.createElement('div');
        container.className = 'network-requests';
        document.querySelector('.viewport').appendChild(container);
        return container;
    }
    
    seekToProgress(progress) {
        if (!this.events.length) return;
        
        const totalDuration = this.events[this.events.length - 1].timestamp - this.events[0].timestamp;
        const targetTime = this.events[0].timestamp + (totalDuration * progress);
        
        this.currentEventIndex = this.events.findIndex(event => event.timestamp > targetTime);
        if (this.currentEventIndex === -1) {
            this.currentEventIndex = this.events.length;
        }
        
        this.updateProgress();
    }
    
    updateProgress() {
        if (!this.events.length) return;
        
        const currentTime = this.events[this.currentEventIndex]?.timestamp || 0;
        const totalTime = this.events[this.events.length - 1].timestamp;
        const progress = ((currentTime - this.events[0].timestamp) / (totalTime - this.events[0].timestamp)) * 100;
        
        this.progressBar.value = progress;
        this.timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(totalTime)}`;
    }
    
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}
