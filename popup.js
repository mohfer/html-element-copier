document.getElementById('startButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'START_SELECTION' });
  window.close();
});
