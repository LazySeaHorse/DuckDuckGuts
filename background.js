// background.js - MV3 service worker
// Ensures a duckduckgo.com tab exists (creates one in background if needed) and waits for load.

async function ensureDuckDuckGoTab() {
  const tabs = await chrome.tabs.query({ url: "*://duckduckgo.com/*" });
  if (tabs.length > 0) {
    // Prefer a non-discarded, fully loaded tab if possible
    const ready = tabs.find(t => t.status === "complete" && !t.discarded) || tabs[0];
    return ready.id;
  }

  const created = await chrome.tabs.create({
    url: "https://duckduckgo.com/?ai=1",
    active: false
  });

  // Wait until the tab is fully loaded
  const tabId = created.id;
  await waitForTabComplete(tabId, 15000); // wait up to 15s
  return tabId;
}

function waitForTabComplete(tabId, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check(tabIdCheck, changeInfo) {
      if (tabIdCheck === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(check);

    const timer = setInterval(async () => {
      const [tab] = await chrome.tabs.query({ active: false, lastFocusedWindow: false, url: "*://duckduckgo.com/*" });
      if (tab && tab.id === tabId && tab.status === "complete") {
        clearInterval(timer);
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        chrome.tabs.onUpdated.removeListener(check);
        resolve(); // resolve anyway; content script may still attach soon
      }
    }, 250);
  });
}

// Handle extension icon click to open window
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 600,
    height: 700,
    focused: true
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "ENSURE_DDG_TAB") {
    (async () => {
      try {
        const tabId = await ensureDuckDuckGoTab();
        sendResponse({ ok: true, tabId });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();

    return true; // keep the message channel open for async response
  }
});