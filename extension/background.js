// Chess Trainer Pro - Background Service Worker Bridge (Bypasses HTTPS Mixed Content)
const DEFAULT_URL = 'http://127.0.0.1:3000';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_MOVE') {
    chrome.storage.local.get(['trainerUrl'], (res) => {
      const baseUrl = (res?.trainerUrl || DEFAULT_URL).trim().replace(/\/+$/, '');
      const syncUrl = `${baseUrl}/api/live-sync`;

      fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      })
        .then((r) => r.json())
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });

    return true; // async response
  }
});
