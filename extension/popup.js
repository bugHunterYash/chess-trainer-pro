const DEFAULT_URL = 'http://127.0.0.1:3000';
const input = document.getElementById('trainerUrl');
const saveBtn = document.getElementById('saveBtn');
const setLocalBtn = document.getElementById('setLocalBtn');
const statusMsg = document.getElementById('statusMsg');

function showMsg(text) {
  statusMsg.textContent = text;
  setTimeout(() => {
    statusMsg.textContent = '';
  }, 2500);
}

// Load saved URL
if (chrome?.storage?.local) {
  chrome.storage.local.get(['trainerUrl'], (res) => {
    input.value = res?.trainerUrl || DEFAULT_URL;
  });
} else {
  input.value = DEFAULT_URL;
}

saveBtn.addEventListener('click', () => {
  const val = input.value.trim().replace(/\/+$/, '') || DEFAULT_URL;
  if (chrome?.storage?.local) {
    chrome.storage.local.set({ trainerUrl: val }, () => {
      showMsg('Saved! Syncing to: ' + val);
    });
  } else {
    showMsg('Saved: ' + val);
  }
});

setLocalBtn.addEventListener('click', () => {
  input.value = DEFAULT_URL;
  if (chrome?.storage?.local) {
    chrome.storage.local.set({ trainerUrl: DEFAULT_URL }, () => {
      showMsg('Reset to Local (3000)');
    });
  }
});

