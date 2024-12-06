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
            timestamp: event.timestamp,
            cursorElement: this.cursor ? 'exists' : 'missing'
        });
        
        switch (event.type) {
            case 'mousemove':
                if (event.data && typeof event.data.x === 'number' && typeof event.data.y === 'number') {
                    console.log('Moving cursor to:', event.data);
                    this.moveCursor(event.data.x, event.data.y);
                }
                break;
                
            case 'click':
                if (event.data && typeof event.data.x === 'number' && typeof event.data.y === 'number') {
                    console.log('Showing click at:', event.data);
                    this.moveCursor(event.data.x, event.data.y);
                    this.showClick(event.data.x, event.data.y);
                }
                break;
                
            case 'keypress':
                console.log('Showing keypress');
                this.cursor.classList.add('typing');
                setTimeout(() => this.cursor.classList.remove('typing'), 100);
                break;
                
            case 'scroll':
                if (event.data) {
                    console.log('Scrolling to:', event.data);
                    const frame = document.getElementById('replay-frame');
                    if (frame && frame.contentWindow) {
                        frame.contentWindow.scrollTo(event.data.x || 0, event.data.y || 0);
                    }
                }
                break;
                
            default:
                console.log('Unhandled event type:', event.type);
        }
        
        // Update time display
        if (event.timestamp) {
            const elapsed = event.timestamp - this.events[0].timestamp;
            this.timeDisplay.textContent = this.formatTime(elapsed);
        }
    }
    
    moveCursor(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            console.warn('Invalid cursor coordinates:', { x, y });
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
        const scale = frameRect.width / window.innerWidth;
        
        // Calculate cursor position relative to the frame
        const cursorX = (x * scale);
        const cursorY = (y * scale);
        
        console.log('Moving cursor:', {
            original: { x, y },
            scaled: { x: cursorX, y: cursorY },
            scale: scale
        });
        
        // Update cursor position using transform
        if (this.cursor) {
            this.cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
            this.cursor.style.display = 'block';
        }
    }
    
    showClick(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            console.warn('Invalid click coordinates:', { x, y });
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
        const scale = frameRect.width / window.innerWidth;
        
        // Calculate click position
        const clickX = (x * scale);
        const clickY = (y * scale);
        
        // Create click animation
        const clickAnimation = document.createElement('div');
        clickAnimation.className = 'click-animation';
        clickAnimation.style.transform = `translate(${clickX}px, ${clickY}px)`;
        viewport.appendChild(clickAnimation);
        
        // Add clicking class to cursor
        if (this.cursor) {
            this.cursor.classList.add('clicking');
            setTimeout(() => this.cursor.classList.remove('clicking'), 200);
        }
        
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
        const frame = document.getElementById('replay-frame');
        if (!frame) {
            console.error('Replay frame not found');
            return;
        }
        
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            
            // Write the captured HTML to the iframe
            doc.open();
            doc.write(this.sessionData.page_html || '<!DOCTYPE html><html><body><p>No content available</p></body></html>');
            doc.close();
            
            // Add the captured styles
            if (this.sessionData.page_styles) {
                const styleSheet = doc.createElement('style');
                styleSheet.textContent = this.sessionData.page_styles;
                doc.head.appendChild(styleSheet);
            }
            
            // Add replay-specific styles
            const replayStyles = doc.createElement('style');
            replayStyles.textContent = `
                * { cursor: none !important; }
                a, button, input, textarea, select { pointer-events: none !important; }
                body { overflow: auto !important; }
                
                /* Hide any fixed position elements that might overlap */
                .fixed, [style*="position: fixed"] {
                    position: absolute !important;
                }
            `;
            doc.head.appendChild(replayStyles);
            
            // Disable all interactive elements
            const interactiveElements = doc.querySelectorAll('a, button, input, textarea, select');
            interactiveElements.forEach(el => {
                el.addEventListener('click', e => e.preventDefault());
                el.addEventListener('submit', e => e.preventDefault());
            });
            
            console.log('Replay frame setup complete:', {
                hasContent: doc.body.innerHTML.length > 0,
                hasStyles: doc.styleSheets.length > 0
            });
            
        } catch (error) {
            console.error('Error setting up replay frame:', error);
            const doc = frame.contentDocument || frame.contentWindow.document;
            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html>
                <head><title>Error</title></head>
                <body>
                    <p>Error setting up replay frame: ${error.message}</p>
                </body>
                </html>
            `);
            doc.close();
        }
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
