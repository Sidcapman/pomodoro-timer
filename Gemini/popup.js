const timeDisplay = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const pomodoroBtn = document.getElementById('pomodoro-btn');
const shortBreakBtn = document.getElementById('short-break-btn');
const longBreakBtn = document.getElementById('long-break-btn');

function updateModeButtons(activeMode) {
    [pomodoroBtn, shortBreakBtn, longBreakBtn].forEach(btn => {
        btn.classList.remove('active');
    });
    switch (activeMode) {
        case 'Focus':
            pomodoroBtn.classList.add('active');
            break;
        case 'Short Break':
            shortBreakBtn.classList.add('active');
            break;
        case 'Long Break':
            longBreakBtn.classList.add('active');
            break;
    }
}

startPauseBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'start-pause' });
});

resetBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'reset' });
});

pomodoroBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'set-mode', mode: 'Focus' });
});

shortBreakBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'set-mode', mode: 'Short Break' });
});

longBreakBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'set-mode', mode: 'Long Break' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'update-timer') {
        const { minutes, seconds, status, isRunning } = request.data;
        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        startPauseBtn.textContent = isRunning ? 'Pause' : 'Play';
        updateModeButtons(status);
    }
});

// Request initial state when popup opens
chrome.runtime.sendMessage({ command: 'get-status' });