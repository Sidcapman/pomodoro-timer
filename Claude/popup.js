// Beautiful Retro Pomodoro UI Controller
class PomodoroUI {
    constructor() {
        // DOM elements
        this.timeDisplayEl = document.getElementById('timeDisplay');
        this.startPauseBtn = document.getElementById('startPauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.sessionButtons = document.querySelectorAll('.session-btn');
        this.footerTextEl = document.querySelector('.retro-text');
        
        // Timer state
        this.currentSession = 'work';
        this.isRunning = false;
        this.timeLeft = 25 * 60; // 25 minutes in seconds
        this.totalTime = 25 * 60;
        this.intervalId = null;
        this.backgroundConnected = false;
        
        // Session durations (in seconds)
        this.sessionDurations = {
            work: 25 * 60,      // 25 minutes
            short: 5 * 60,      // 5 minutes
            long: 15 * 60       // 15 minutes
        };
        
        this.init();
    }
    
    init() {
        // Load saved state
        this.loadState();
        
        // Event listeners
        this.startPauseBtn.addEventListener('click', () => this.toggleTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());
        
        this.sessionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sessionType = e.target.dataset.session;
                this.switchSession(sessionType);
            });
        });
        
        // Update display initially
        this.updateDisplay(this.timeLeft, this.isRunning);
        this.updateSessionDisplay();
        
        // Try to connect to background script (optional)
        this.tryConnectToBackground();
    }
    
    // Optional background connection
    tryConnectToBackground() {
        try {
            chrome.runtime.sendMessage({type: 'GET_TIMER_STATE'}, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background script not available, running in standalone mode');
                    return;
                }
                if (response) {
                    console.log('Connected to background script');
                    this.backgroundConnected = true;
                    this.updateFromState(response);
                    this.setupBackgroundListeners();
                }
            });
        } catch (error) {
            console.log('Running in standalone mode');
            this.backgroundConnected = false;
        }
    }
    
    // Setup background listeners only if connected
    setupBackgroundListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Received message:', message);
            if (message.type === 'TIMER_UPDATE') {
                this.updateDisplay(message.timeLeft, message.isRunning);
            } else if (message.type === 'SESSION_COMPLETE') {
                this.handleSessionComplete();
            }
        });
    }
    
    // Load saved state from storage
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['pomodoroTimerState']);
            if (result.pomodoroTimerState) {
                const state = result.pomodoroTimerState;
                this.currentSession = state.currentSession || 'work';
                this.timeLeft = state.timeLeft || this.sessionDurations[this.currentSession];
                this.totalTime = this.sessionDurations[this.currentSession];
                this.isRunning = state.isRunning || false;
                
                this.updateSessionDisplay();
                this.updateDisplay(this.timeLeft, this.isRunning);
            }
        } catch (error) {
            console.log('No saved state found');
        }
    }
    
    // Update UI from background script state
    updateFromState(state) {
        this.currentSession = state.currentSession;
        this.timeLeft = state.timeLeft;
        this.totalTime = state.totalTime;
        this.isRunning = state.isRunning;
        
        this.updateSessionDisplay();
        this.updateDisplay(this.timeLeft, this.isRunning);
    }
    
    // Toggle timer start/pause
    toggleTimer() {
        if (this.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }
    
    // Start the timer
    startTimer() {
        console.log('Starting timer with timeLeft:', this.timeLeft);
        this.isRunning = true;
        this.startPauseBtn.innerHTML = '<span class="btn-text">PAUSE</span>';
        document.body.classList.add('timer-running');
        
        // Start local timer if background not connected
        if (!this.backgroundConnected) {
            this.startLocalTimer();
        }
        
        // Try to send message to background script
        this.sendToBackground('START_TIMER', {
            timeLeft: this.timeLeft,
            currentSession: this.currentSession,
            totalTime: this.totalTime
        });
    }
    
    // Local timer implementation
    startLocalTimer() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.intervalId = setInterval(() => {
            if (!this.isRunning) return;
            
            this.timeLeft--;
            this.updateDisplay(this.timeLeft, this.isRunning);
            
            if (this.timeLeft <= 0) {
                this.handleSessionComplete();
            }
            
            // Save state every 10 seconds
            if (this.timeLeft % 10 === 0) {
                this.saveState();
            }
        }, 1000);
    }
    
    // Pause the timer
    pauseTimer() {
        this.isRunning = false;
        this.startPauseBtn.innerHTML = '<span class="btn-text">START</span>';
        document.body.classList.remove('timer-running');
        
        // Stop local timer
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Try to send message to background script
        this.sendToBackground('PAUSE_TIMER');
    }
    
    // Reset the timer
    resetTimer() {
        this.isRunning = false;
        this.timeLeft = this.sessionDurations[this.currentSession];
        this.totalTime = this.timeLeft;
        this.startPauseBtn.innerHTML = '<span class="btn-text">START</span>';
        document.body.classList.remove('timer-running');
        
        // Stop local timer
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Try to send message to background script
        this.sendToBackground('RESET_TIMER');
        
        this.updateDisplay(this.timeLeft, this.isRunning);
    }
    
    // Switch session type
    switchSession(sessionType) {
        if (this.isRunning) return; // Don't allow switching while running
        
        this.currentSession = sessionType;
        this.timeLeft = this.sessionDurations[sessionType];
        this.totalTime = this.timeLeft;
        
        // Update active button
        this.sessionButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-session="${sessionType}"]`).classList.add('active');
        
        this.updateSessionDisplay();
        this.updateDisplay(this.timeLeft, this.isRunning);
        
        // Save state
        this.saveState();
    }
    
    // Handle session completion
    handleSessionComplete() {
        this.isRunning = false;
        this.startPauseBtn.innerHTML = '<span class="btn-text">START</span>';
        document.body.classList.remove('timer-running');
        document.body.classList.add('session-complete');
        
        // Stop local timer
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Show simple notification
        this.showSimpleNotification();
        
        // Remove completion animation after delay
        setTimeout(() => {
            document.body.classList.remove('session-complete');
        }, 1500);
    }
    
    // Simple notification for standalone mode
    showSimpleNotification() {
        const sessionNames = {
            work: 'Focus Session Complete!',
            short: 'Short Break Complete!',
            long: 'Long Break Complete!'
        };
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(sessionNames[this.currentSession], {
                body: 'Time to switch sessions!',
                icon: 'icon48.png'
            });
        }
    }
    
    // Helper method to send messages to background
    sendToBackground(type, data = {}) {
        if (!this.backgroundConnected) return;
        
        try {
            chrome.runtime.sendMessage({type, ...data}, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background script disconnected');
                    this.backgroundConnected = false;
                }
            });
        } catch (error) {
            console.log('Background communication error:', error);
            this.backgroundConnected = false;
        }
    }
    
    // Update session type display
    updateSessionDisplay() {
        // Update body class for color scheme
        document.body.className = '';
        document.body.classList.add(`${this.currentSession === 'short' ? 'short-break' : this.currentSession === 'long' ? 'long-break' : 'work'}-mode`);
        
        if (this.isRunning) {
            document.body.classList.add('timer-running');
        }
        
        // Update active session button
        this.sessionButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-session="${this.currentSession}"]`).classList.add('active');
    }
    
    // Update time display
    updateDisplay(timeLeft, isRunning) {
        this.timeLeft = timeLeft;
        this.isRunning = isRunning;
        
        // Update digital display
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        this.timeDisplayEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update button state
        if (isRunning) {
            this.startPauseBtn.innerHTML = '<span class="btn-text">PAUSE</span>';
            document.body.classList.add('timer-running');
        } else {
            this.startPauseBtn.innerHTML = '<span class="btn-text">START</span>';
            document.body.classList.remove('timer-running');
        }
    }
    
    // Save current state to storage
    saveState() {
        const state = {
            currentSession: this.currentSession,
            timeLeft: this.timeLeft,
            totalTime: this.totalTime,
            isRunning: this.isRunning
        };
        
        chrome.storage.local.set({pomodoroTimerState: state});
    }
}

// Initialize the UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroUI();
});

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}