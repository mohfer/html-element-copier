// HTML Element Copier - Content Script
// Selection mode state
let isSelectionMode = false;
let highlightOverlay = null;
let tooltip = null;
let currentElement = null;
let clickListener = null;
let mouseMoveListener = null;
let keydownListener = null;

// Create overlay element for highlighting
function createOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'html-copier-overlay';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    background: rgba(111, 168, 220, 0.3);
    border: 2px solid rgb(111, 168, 220);
    display: none;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// Create tooltip element
function createTooltip() {
  const tip = document.createElement('div');
  tip.id = 'html-copier-tooltip';
  tip.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483648;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 4px 8px;
    border-radius: 3px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    display: none;
    max-width: 300px;
    word-wrap: break-word;
  `;
  document.body.appendChild(tip);
  return tip;
}

// Get element info for tooltip
function getElementInfo(element) {
  if (!element) return '';

  const tagName = element.tagName.toLowerCase();
  let selector = tagName;

  if (element.id) {
    selector += `#${element.id}`;
  }

  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).slice(0, 3);
    if (classes.length > 0 && classes[0]) {
      selector += '.' + classes.join('.');
    }
  }

  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  return `${selector}\n${width} × ${height}`;
}

// Update overlay position and visibility
function updateOverlay(element) {
  if (!highlightOverlay || !element) return;

  const rect = element.getBoundingClientRect();

  highlightOverlay.style.top = rect.top + 'px';
  highlightOverlay.style.left = rect.left + 'px';
  highlightOverlay.style.width = rect.width + 'px';
  highlightOverlay.style.height = rect.height + 'px';
  highlightOverlay.style.display = 'block';
}

// Update tooltip position and content
function updateTooltip(element, mouseX, mouseY) {
  if (!tooltip || !element) return;

  const info = getElementInfo(element);
  tooltip.textContent = info;

  // Position tooltip near cursor
  const offsetX = 15;
  const offsetY = 15;
  let x = mouseX + offsetX;
  let y = mouseY + offsetY;

  // Adjust if tooltip would go off-screen
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (x + tooltipRect.width > viewportWidth) {
    x = mouseX - tooltipRect.width - offsetX;
  }

  if (y + tooltipRect.height > viewportHeight) {
    y = mouseY - tooltipRect.height - offsetY;
  }

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  tooltip.style.display = 'block';
}

// Hide overlay and tooltip
function hideOverlay() {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// Copy HTML to clipboard
async function copyToClipboard(html) {
  try {
    // Modern Clipboard API
    await navigator.clipboard.writeText(html);
    return true;
  } catch (err) {
    // Fallback method
    try {
      const textarea = document.createElement('textarea');
      textarea.value = html;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (fallbackErr) {
      console.error('Clipboard copy failed:', fallbackErr);
      return false;
    }
  }
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease-out';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 2000);
}

// Mouse move handler
function onMouseMove(event) {
  if (!isSelectionMode) return;

  const element = document.elementFromPoint(event.clientX, event.clientY);

  if (element && element !== currentElement) {
    currentElement = element;
    updateOverlay(element);
    updateTooltip(element, event.clientX, event.clientY);
  }
}

// Click handler - CRITICAL: Must prevent all website interactions
function onClick(event) {
  if (!isSelectionMode) return;

  // STOP ALL EVENT PROPAGATION
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const element = event.target;

  if (element && element !== highlightOverlay && element !== tooltip) {
    const html = element.outerHTML;

    copyToClipboard(html).then(success => {
      if (success) {
        showToast('HTML copied to clipboard!');
        exitSelectionMode();
      } else {
        showToast('Failed to copy HTML');
      }
    });
  }
}

// Keydown handler for ESC
function onKeydown(event) {
  if (!isSelectionMode) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    exitSelectionMode();
  }
}

// Enter selection mode
function enterSelectionMode() {
  if (isSelectionMode) return;

  isSelectionMode = true;

  // Create overlay and tooltip if they don't exist
  if (!highlightOverlay) {
    highlightOverlay = createOverlay();
  }
  if (!tooltip) {
    tooltip = createTooltip();
  }

  // Change cursor to crosshair
  document.body.style.cursor = 'crosshair';

  // Add event listeners with capture phase for click
  mouseMoveListener = onMouseMove;
  document.addEventListener('mousemove', mouseMoveListener);

  // CRITICAL: Use capture phase to intercept clicks before website handlers
  clickListener = onClick;
  document.addEventListener('click', clickListener, true);

  keydownListener = onKeydown;
  document.addEventListener('keydown', keydownListener);
}

// Exit selection mode
function exitSelectionMode() {
  if (!isSelectionMode) return;

  isSelectionMode = false;
  currentElement = null;

  // Hide overlay and tooltip
  hideOverlay();

  // Restore cursor
  document.body.style.cursor = '';

  // Remove event listeners
  if (mouseMoveListener) {
    document.removeEventListener('mousemove', mouseMoveListener);
    mouseMoveListener = null;
  }

  if (clickListener) {
    document.removeEventListener('click', clickListener, true);
    clickListener = null;
  }

  if (keydownListener) {
    document.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SELECTION') {
    enterSelectionMode();
  }
});

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  exitSelectionMode();

  if (highlightOverlay && highlightOverlay.parentNode) {
    highlightOverlay.parentNode.removeChild(highlightOverlay);
  }

  if (tooltip && tooltip.parentNode) {
    tooltip.parentNode.removeChild(tooltip);
  }
});
