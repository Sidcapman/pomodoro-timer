// Background Service Worker for Pomodoro Timer
class PomodoroTimer {
    constructor() {
        // Timer state
        this.isRunning = false;
        this.timeLeft = 25 * 60; // 25 minutes in seconds
        this.totalTime = 25 * 60;
        this.currentSession = 'work';
        this.cycleCount = 1;
        this.intervalId = null;
        this.startTime = null;
        
        // Session durations (in seconds)
        this.sessionDurations = {
            work: 25 * 60,      // 25 minutes
            short: 5 * 60,      // 5 minutes  
            long: 15 * 60       // 15 minutes
        };
        
        this.init();
    }
    
    init() {
        // Load saved state on startup
        this.loadState();
        
        // Set up message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
        
        // Handle extension startup/install
        chrome.runtime.onStartup.addListener(() => {
            this.loadState();
        });
        
        chrome.runtime.onInstalled.addListener(() => {
            this.setupNotifications();
        });
    }
    
    // Handle messages from popup
    async handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'START_TIMER':
                this.startTimer(message);
                sendResponse({success: true});
                break;
                
            case 'PAUSE_TIMER':
                this.pauseTimer();
                sendResponse({success: true});
                break;
                
            case 'RESET_TIMER':
                this.resetTimer();
                sendResponse({success: true});
                break;
                
            case 'GET_TIMER_STATE':
                sendResponse({
                    isRunning: this.isRunning,
                    timeLeft: this.timeLeft,
                    totalTime: this.totalTime,
                    currentSession: this.currentSession,
                    cycleCount: this.cycleCount
                });
                break;
                
            default:
                sendResponse({error: 'Unknown message type'});
        }
    }
    
    // Start the timer
    startTimer(data) {
        console.log('Background: Starting timer with data:', data);
        
        // Update state from popup data
        this.timeLeft = data.timeLeft;
        this.currentSession = data.currentSession;
        this.totalTime = data.totalTime;
        this.cycleCount = data.cycleCount;
        this.isRunning = true;
        this.startTime = Date.now();
        
        // Clear any existing interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        // Start countdown
        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);
        
        console.log('Background: Timer started, interval ID:', this.intervalId);
        
        this.saveState();
        this.updatePopup();
    }
    
    // Pause the timer
    pauseTimer() {
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.saveState();
        this.updatePopup();
    }
    
    // Reset the timer
    resetTimer() {
        this.isRunning = false;
        this.timeLeft = this.sessionDurations[this.currentSession];
        this.totalTime = this.timeLeft;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.saveState();
        this.updatePopup();
    }
    
    // Timer tick - called every second
    tick() {
        if (!this.isRunning) return;
        
        this.timeLeft--;
        
        // Check if session is complete
        if (this.timeLeft <= 0) {
            this.completeSession();
            return;
        }
        
        // Update popup every second for real-time display
        this.updatePopup();
        
        // Save state every 10 seconds to reduce storage writes
        if (this.timeLeft % 10 === 0) {
            this.saveState();
        }
    }
    
    // Handle session completion
    completeSession() {
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Show notification
        this.showNotification();
        
        // Auto-advance to next session
        this.advanceSession();
        
        // Notify popup
        this.sendMessageToPopup({type: 'SESSION_COMPLETE'});
        
        this.saveState();
        this.updatePopup();
    }
    
    // Advance to next session
    advanceSession() {
        if (this.currentSession === 'work') {
            this.cycleCount++;
            // After 4 work sessions, take a long break
            if (this.cycleCount > 4) {
                this.currentSession = 'long';
                this.cycleCount = 1;
            } else {
                this.currentSession = 'short';
            }
        } else {
            // After any break, go back to work
            this.currentSession = 'work';
        }
        
        this.timeLeft = this.sessionDurations[this.currentSession];
        this.totalTime = this.timeLeft;
    }
    
    // Show notification
    showNotification() {
        const sessionNames = {
            work: 'Focus',
            short: 'Short Break',
            long: 'Long Break'
        };
        
        let title, message;
        
        if (this.currentSession === 'work') {
            title = 'Focus Session Complete!';
            message = 'Great work! Time for a break.';
        } else {
            title = 'Break Time Over!';
            message = 'Ready to focus again?';
        }
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: title,
            message: message,
            priority: 2
        });
        
        // Play notification sound (if permissions allow)
        try {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.executeScript(tabs[0].id, {
                        code: `
                            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiS2PPMdSsBJIfN9N2TOQkVYrLp7KpSEQlBmuD3qGIbBjiS2/DHdSsBJnjK9t6QOgkUYrLl7atVEgxBnuf0qWMcBj6Wy+/KeDUCKYnN9N2SPgkVXrPl76pUEQxHmub0p2IbBz6UyO/JdSsBKojO9d6RPgkUYbLk7qxUEgxAneH3qWMcBj+Sy/LJeOsGFWzG5OOmXRkNeJPZ3rCDBhZsxuTjpl0ZDXeT2d6wgwYWbMbk46ZdGQ13k9nesIMGFmzG5OOmXRkNeJPZ3rCDBhZsxuTjpl0ZDXiT2d6wgwYWbMbk46ZdGQ14k9nesIMGFmzG5OOmXRkNeJPZ3rCDBhZsxuTjpl0ZDXiT2d6wgwYWbMbk46ZdGQ14k9nesIMGFmzG5OOmXRkNeJPZ3rCDBhZsxuTjpl0ZDXiT2d6wgwYWbMbk46ZdGQ14k9nesIMGFmzG5OOmXRkNeJPZ3rCDBhZsxuTjpl0ZDXiT2d6wgwYWbMbk46ZdGQ1'); audio.play();
                        `
                    });
                }
            });
        } catch (error) {
            console.log('Could not play notification sound');
        }
    }
    
    // Set up notification permissions
    setupNotifications() {
        chrome.notifications.getPermissionLevel((level) => {
            if (level !== 'granted') {
                console.log('Notification permission not granted');
            }
        });
    }
    
    // Update popup with current state
    updatePopup() {
        this.sendMessageToPopup({
            type: 'TIMER_UPDATE',
            timeLeft: this.timeLeft,
            isRunning: this.isRunning,
            currentSession: this.currentSession,
            cycleCount: this.cycleCount
        });
    }
    
    // Send message to popup
    sendMessageToPopup(message) {
        try {
            chrome.runtime.sendMessage(message);
        } catch (error) {
            // Popup might be closed, ignore error
            console.log('Could not send message to popup:', error);
        }
    }
    
    // Save state to storage
    async saveState() {
        const state = {
            isRunning: this.isRunning,
            timeLeft: this.timeLeft,
            totalTime: this.totalTime,
            currentSession: this.currentSession,
            cycleCount: this.cycleCount,
            startTime: this.startTime,
            lastSaveTime: Date.now()
        };
        
        try {
            await chrome.storage.local.set({pomodoroTimerState: state});
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }
    
    // Load state from storage
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['pomodoroTimerState']);
            
            if (result.pomodoroTimerState) {
                const state = result.pomodoroTimerState;
                
                this.currentSession = state.currentSession || 'work';
                this.cycleCount = state.cycleCount || 1;
                this.totalTime = state.totalTime || this.sessionDurations[this.currentSession];
                
                // Calculate elapsed time if timer was running
                if (state.isRunning && state.lastSaveTime) {
                    const elapsedTime = Math.floor((Date.now() - state.lastSaveTime) / 1000);
                    this.timeLeft = Math.max(0, state.timeLeft - elapsedTime);
                    
                    // If time expired while extension was closed
                    if (this.timeLeft <= 0) {
                        this.completeSession();
                    } else {
                        // Resume timer
                        this.isRunning = true;
                        this.startTime = Date.now() - ((state.totalTime - this.timeLeft) * 1000);
                        
                        this.intervalId = setInterval(() => {
                            this.tick();
                        }, 1000);
                    }
                } else {
                    this.timeLeft = state.timeLeft || this.sessionDurations[this.currentSession];
                    this.isRunning = false;
                }
            }
        } catch (error) {
            console.log('No saved state found, using defaults');
            this.timeLeft = this.sessionDurations[this.currentSession];
        }
    }
}

// Initialize the timer
const pomodoroTimer = new PomodoroTimer();