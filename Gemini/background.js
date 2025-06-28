const WORK_MINUTES = 25;
const SHORT_BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;

let timerInterval;
let isRunning = false;
let minutes = WORK_MINUTES;
let seconds = 0;
let status = 'Focus';
let cycles = 0;

function updateTimer() {
    if (seconds === 0) {
        if (minutes === 0) {
            clearInterval(timerInterval);
            handleTimerEnd();
            return;
        }
        minutes--;
        seconds = 59;
    } else {
        seconds--;
    }
    sendTimerUpdate();
}

function handleTimerEnd() {
    isRunning = false;
    if (status === 'Focus') {
        cycles++;
        if (cycles % 4 === 0) {
            setMode('Long Break');
            showNotification("Time for a long break!");
        } else {
            setMode('Short Break');
            showNotification("Time for a short break!");
        }
    } else {
        setMode('Focus');
        showNotification("Time to focus!");
    }
    sendTimerUpdate();
}

function startPause() {
    isRunning = !isRunning;
    if (isRunning) {
        timerInterval = setInterval(updateTimer, 1000);
    } else {
        clearInterval(timerInterval);
    }
    sendTimerUpdate();
}

function reset() {
    clearInterval(timerInterval);
    isRunning = false;
    setMode(status);
}

function setMode(newStatus) {
    status = newStatus;
    switch (status) {
        case 'Focus':
            minutes = WORK_MINUTES;
            break;
        case 'Short Break':
            minutes = SHORT_BREAK_MINUTES;
            break;
        case 'Long Break':
            minutes = LONG_BREAK_MINUTES;
            break;
    }
    seconds = 0;
    if(isRunning){
        clearInterval(timerInterval);
        isRunning = false;
    }
    sendTimerUpdate();
}

function showNotification(message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Retro Pomodoro',
        message: message
    });
}

function sendTimerUpdate() {
    const duration = (status === 'Focus' ? WORK_MINUTES : (status === 'Short Break' ? SHORT_BREAK_MINUTES : LONG_BREAK_MINUTES)) * 60;
    // Send message to popup, ignoring errors if the popup is not open.
    chrome.runtime.sendMessage({
        command: 'update-timer',
        data: { minutes, seconds, status, isRunning, duration }
    }).catch(() => {});
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.command) {
        case 'start-pause':
            startPause();
            break;
        case 'reset':
            reset();
            break;
        case 'get-status':
            sendTimerUpdate();
            break;
        case 'set-mode':
            setMode(request.mode);
            break;
    }
});