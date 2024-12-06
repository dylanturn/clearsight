class SessionReplay {
    constructor(sessionData, events) {
        this.sessionData = sessionData;
        this.events = this.preprocessEvents(events);
        this.currentEventIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.startTime = this.events[0]?.timestamp;
        this.lastEventTime = this.events[this.events.length - 1]?.timestamp;
        this.currentTime = 0;
        
        // DOM Elements
        this.viewport = document.getElementById('replay-viewport');
        this.cursor = document.getElementById('cursor');
        this.playPauseBtn = document.getElementById('play-pause');
        this.playIcon = document.getElementById('play-icon');
        this.pauseIcon = document.getElementById('pause-icon');
        this.speedSelect = document.getElementById('playback-speed');
        this.progressBar = document.getElementById('progress-bar');
        this.currentTimeDisplay = document.getElementById('current-time');
        this.totalTimeDisplay = document.getElementById('total-time');
        this.eventType = document.getElementById('event-type');
        this.eventTime = document.getElementById('event-time');
        this.eventDetails = document.getElementById('event-details');

        this.setupViewport();
        this.setupEventListeners();
        this.updateTotalTime();
    }

    preprocessEvents(events) {
        return events.map(event => ({
            ...event,
            timestamp: new Date(event.timestamp).getTime()
        })).sort((a, b) => a.timestamp - b.timestamp);
    }

    setupViewport() {
        // Set viewport dimensions based on session data
        this.viewport.style.width = this.sessionData.window_width + 'px';
        this.viewport.style.height = this.sessionData.window_height + 'px';
        
        // Scale viewport if it's too large for the screen
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.6;
        const scale = Math.min(
            maxWidth / this.sessionData.window_width,
            maxHeight / this.sessionData.window_height
        );
        
        if (scale < 1) {
            this.viewport.style.transform = `scale(${scale})`;
            this.viewport.style.transformOrigin = 'top left';
        }
    }

    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.speedSelect.addEventListener('change', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
        });

        // Handle progress bar clicks
        this.progressBar.parentElement.addEventListener('click', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percentage = (e.clientX - rect.left) / rect.width;
            this.seekToPercentage(percentage);
        });
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        this.playIcon.classList.toggle('hidden');
        this.pauseIcon.classList.toggle('hidden');
        
        if (this.isPlaying) {
            this.play();
        }
    }

    play() {
        if (!this.isPlaying) return;

        const now = Date.now();
        const elapsed = now - this.lastFrameTime;
        this.lastFrameTime = now;

        if (this.currentEventIndex >= this.events.length) {
            this.stop();
            return;
        }

        this.currentTime += elapsed * this.playbackSpeed;
        this.processEvents();
        this.updateProgress();

        requestAnimationFrame(() => this.play());
    }

    processEvents() {
        while (this.currentEventIndex < this.events.length) {
            const event = this.events[this.currentEventIndex];
            const eventTime = event.timestamp - this.startTime;

            if (eventTime <= this.currentTime) {
                this.processEvent(event);
                this.currentEventIndex++;
            } else {
                break;
            }
        }
    }

    processEvent(event) {
        switch (event.type) {
            case 'mousemove':
                this.moveCursor(event.data.x, event.data.y);
                break;
            case 'click':
                this.showClickAnimation(event.data.x, event.data.y);
                break;
            case 'scroll':
                this.viewport.scrollTo(event.data.x, event.data.y);
                break;
            case 'resize':
                // Handle window resize events
                break;
        }

        this.updateEventInfo(event);
    }

    moveCursor(x, y) {
        this.cursor.style.left = x + 'px';
        this.cursor.style.top = y + 'px';
    }

    showClickAnimation(x, y) {
        const indicator = document.createElement('div');
        indicator.className = 'click-indicator';
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        this.viewport.appendChild(indicator);

        // Remove the indicator after animation
        setTimeout(() => {
            this.viewport.removeChild(indicator);
        }, 500);
    }

    updateProgress() {
        const totalDuration = this.lastEventTime - this.startTime;
        const progress = (this.currentTime / totalDuration) * 100;
        this.progressBar.style.width = progress + '%';
        this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
    }

    updateEventInfo(event) {
        this.eventType.textContent = event.type;
        this.eventTime.textContent = new Date(event.timestamp).toLocaleTimeString();
        this.eventDetails.textContent = JSON.stringify(event.data);
    }

    seekToPercentage(percentage) {
        const totalDuration = this.lastEventTime - this.startTime;
        this.currentTime = totalDuration * percentage;
        
        // Find the appropriate event index
        this.currentEventIndex = this.events.findIndex(event => 
            (event.timestamp - this.startTime) > this.currentTime
        );
        
        if (this.currentEventIndex === -1) {
            this.currentEventIndex = this.events.length;
        }

        this.updateProgress();
    }

    updateTotalTime() {
        const totalDuration = this.lastEventTime - this.startTime;
        this.totalTimeDisplay.textContent = this.formatTime(totalDuration);
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    stop() {
        this.isPlaying = false;
        this.playIcon.classList.remove('hidden');
        this.pauseIcon.classList.add('hidden');
    }
}

// Initialize the replay when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.replay = new SessionReplay(sessionData, events);
});
