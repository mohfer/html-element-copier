chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SELECTION') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return;

      const tab = tabs[0];

      // Check if tab URL is valid for content script injection
      if (tab.url.startsWith('chrome://') ||
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')) {
        console.warn('Cannot inject content script on this page:', tab.url);
        return;
      }

      try {
        // Try to send message to existing content script
        await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });
      } catch (error) {
        // Content script not loaded, inject it
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });

          // Inject CSS as well
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['overlay.css']
          });

          // Wait a bit for script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));

          // Try sending message again
          await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTION' });
        } catch (injectError) {
          console.error('Failed to inject content script:', injectError);
        }
      }
    });
  }
});
