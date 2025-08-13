# Duck Duck Guts

A Chrome extension to view, edit, insert, delete, and export DuckDuckGo AI (duck.ai) chat history stored locally in your browser. DuckDuckGo saves chats in localStorage for privacy; this tool gives you a clean, friendly UI to manage that data.

Not affiliated with DuckDuckGo. All data stays on your device.

[![hujidrgzesrdfz.png](https://i.postimg.cc/GmkCC1nr/hujidrgzesrdfz.png)](https://postimg.cc/pmX7f4d1)

## Features

- View all DuckDuckGo AI chats (reads localStorage key savedAIChats on duckduckgo.com)
- Edit chat title, model, timestamps
- Add, edit, delete messages (role, content, timestamp)
- Insert new chats with sensible defaults
- Delete chats with confirmation
- Export entire dataset to JSON
- Modern, responsive popup UI (light mode, Teenage Engineering-inspired styling)
- Error handling for missing/invalid JSON

## How it works (architecture)

- content.js runs on https://duckduckgo.com/* and can read/write window.localStorage.savedAIChats
- popup.html + popup.js provide the UI. They cannot access localStorage directly, so they message the content script
- background.js (service worker) ensures there’s at least one duckduckgo.com tab available, so the content script can respond
- All persistence is done by writing back the JSON to localStorage under savedAIChats

Message flow:
- Popup → Background: ENSURE_DDG_TAB
- Popup → Content: DDG_PING, DDG_GET_SAVED_CHATS, DDG_SET_SAVED_CHATS_OBJECT

## Permissions

- host_permissions: https://duckduckgo.com/* (to inject content.js and access localStorage through it)
- storage: extension state bookkeeping
- scripting: MV3 script injection utils
- tabs: find/open a DuckDuckGo tab
- downloads: export JSON via chrome.downloads

## Install (from source)

1) Clone/download this repo
2) Open Chrome → chrome://extensions → enable Developer mode
3) Load unpacked → select the project folder
4) Pin the extension (optional), then click the toolbar icon to open the popup

Tested on Chrome 100+ (MV3). Also works on Chromium-based browsers that support MV3.

## Usage

- Refresh: Fetch latest savedAIChats from duckduckgo.com
- Insert New Chat: Creates a new chat with a user “Hi” and assistant “Hello!”
- Edit: Opens a detailed editor (chat title/model/timestamps and full message editing)
- Save: Writes your changes back to localStorage on duckduckgo.com
- Delete: Removes a chat (with confirmation)
- + User / + Assistant: Add new messages to the current chat
- Export JSON: Downloads the entire dataset as a JSON file for backup
- Open DuckDuckGo: Opens the duck.ai page (note: no official deep link to a specific chat)

Tip: If you edit data while a duckduckgo.com page is open, you may need to refresh that page to see changes reflected in their UI.

## Data format

Notes:
- The UI preserves assistant.parts[0].text if present
- The editor adds stable IDs to messages internally for reliable editing, but it won’t break DDG’s format

## Troubleshooting

- Buttons don’t work:
  - Ensure no remote JS is referenced in popup.html
  - Right-click the extension icon → Inspect popup → Console for errors
- “Content script did not respond”:
  - Open duckduckgo.com in a tab, then click Refresh in the popup
  - The background script tries to create an inactive tab automatically
- “Invalid JSON in savedAIChats”:
  - Export the data, fix JSON, then paste back via editing and Save
- Export doesn’t trigger:
  - Ensure downloads permission is present in manifest.json
- Changes not visible on duck.ai:
  - Refresh duckduckgo.com (the page reads from localStorage)

## Development

- The popup talks to content.js via chrome.tabs.sendMessage
- background.js listens for ENSURE_DDG_TAB and creates a ddg tab if none exists
- content.js is the only script with access to window.localStorage on duckduckgo.com
- No analytics or external network calls

Run locally:
- Make edits → chrome://extensions → Reload → reopen popup

Packaging:
- chrome://extensions → Pack extension… (or use your build pipeline)

## Roadmap

- Optional import from file
- Bulk operations (multi-select delete/export)
- Dark mode toggle
- More robust assistant.parts editing

## Privacy & Security

- No data leaves your device
- Operates only on duckduckgo.com localStorage under the key savedAIChats
- Minimal permissions; host access limited to https://duckduckgo.com/*
- Open source; review the code before use

## Disclaimer

This project is community-made and not affiliated with DuckDuckGo. The savedAIChats structure may change; use at your own risk and always back up via Export before making large edits.

## License

MIT — see LICENSE for details.

## Credits

- DuckDuckGo for keeping chats local by design
- UI inspired by Teenage Engineering’s clean aesthetic

Happy hacking with duck.ai!
