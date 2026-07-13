# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome Manifest V3 extension that copies HTML of any element on a webpage. Pure vanilla JavaScript with no build tools or dependencies.

## Development Workflow

### Loading the Extension

```bash
# No build step required - load directly into Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this directory
```

### Testing Changes

After modifying code:
- **Popup changes** (`popup.html`, `popup.js`, `popup.css`): Close and reopen the popup
- **Content script changes** (`content.js`, `overlay.css`): Reload the extension and refresh the test page
- **Background script changes** (`background.js`): Reload the extension (click reload icon on `chrome://extensions/`)

### Debugging

- **Background script**: `chrome://extensions/` → "Service Worker" → inspect
- **Content script**: Open test page → F12 → Console
- **Popup**: Right-click extension icon → "Inspect popup"

## Architecture

### Component Communication Flow

```
User clicks extension icon
  ↓
popup.js sends message to background.js
  ↓
background.js forwards to content.js (injects if needed)
  ↓
content.js enters selection mode
  ↓
User clicks element
  ↓
HTML copied to clipboard
```

### File Responsibilities

- **manifest.json**: Extension configuration, permissions, entry points
- **popup.html/js/css**: Extension popup UI - sends `START_SELECTION` message
- **background.js**: Service worker - routes messages between popup and content script, handles content script injection for pages where it's not loaded
- **content.js**: Main logic - selection mode, overlay/tooltip rendering, click interception, clipboard operations
- **overlay.css**: CSS custom properties for styling (minimal - most styles are inline in content.js)

### Critical Implementation Details

#### Click Interception Strategy

The extension uses **event capture phase** to prevent clicks from triggering website functionality:

```javascript
// In content.js - onClick handler
event.preventDefault();
event.stopPropagation();
event.stopImmediatePropagation();
```

The click listener is registered with `capture: true`:
```javascript
document.addEventListener('click', clickListener, true);
```

This is essential - without capture phase, website handlers would execute before ours. Do not change this to bubble phase.

#### State Management

Selection mode state is managed via module-level variables in `content.js`:
- `isSelectionMode`: Boolean flag
- `highlightOverlay`, `tooltip`: DOM elements created once and reused
- `currentElement`: Last element under cursor
- Event listener references stored to enable cleanup

#### Dynamic Script Injection

`background.js` handles two scenarios:
1. Content script already loaded (persistent via manifest) - directly sends message
2. Content script not loaded (e.g., page loaded before extension) - injects script then sends message

The fallback injection is wrapped in try-catch because injection fails on restricted pages (`chrome://`, `chrome-extension://`, etc.).

### Browser Limitations

#### Restricted Pages
Cannot inject content scripts on:
- `chrome://` pages
- `chrome-extension://` pages  
- `edge://` pages
- `about:` pages

Check for these in `background.js` before injection attempts.

#### Cross-Origin Iframes
Cannot access iframe content from different origins due to Same-Origin Policy. The extension can only interact with same-origin iframes.

#### Shadow DOM
- Open shadow DOM: accessible
- Closed shadow DOM: not accessible (browser encapsulation)

## Permissions

Current permissions in `manifest.json`:
- `activeTab`: Access active tab only (minimal scope)
- `scripting`: Required for dynamic content script injection
- `clipboardWrite`: Required for copying HTML

These are minimal required permissions. Adding more requires justification for Chrome Web Store review.

## Manifest V3 Specifics

- Uses service worker (`background.js`) instead of background page
- Content scripts can be injected programmatically via `chrome.scripting.executeScript`
- Clipboard API requires `clipboardWrite` permission (different from V2)

## Common Modifications

### Adding Keyboard Shortcuts

Register in `manifest.json` under `commands`:
```json
"commands": {
  "start-selection": {
    "suggested_key": {
      "default": "Ctrl+Shift+S"
    },
    "description": "Start selection mode"
  }
}
```

Then handle in `background.js`:
```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === "start-selection") {
    // Forward to content script
  }
});
```

### Copying Additional Data

To copy CSS selector or XPath instead of HTML:
1. Add selection buttons in `popup.html`
2. Send different message types from `popup.js`
3. Handle message types in `content.js` and extract appropriate data from the selected element

### Adding Copy History

Store recent copies in `chrome.storage.local` (add `storage` permission):
```javascript
chrome.storage.local.get(['history'], (result) => {
  const history = result.history || [];
  history.unshift({ html, timestamp: Date.now() });
  chrome.storage.local.set({ history: history.slice(0, 10) });
});
```

## Testing Checklist

When making changes, test on:
- Static HTML pages
- Dynamic JavaScript-heavy sites (React, Vue apps)
- Nested elements (hover child, click parent, etc.)
- Pages with existing click handlers (buttons, links, forms)
- Pages with iframes (test both accessible and cross-origin)
- Different screen sizes (tooltip positioning)
- ESC key cancellation
- Rapid open/close of popup
