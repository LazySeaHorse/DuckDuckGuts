// content.js - runs on https://duckduckgo.com/*
// Provides safe access to localStorage.savedAIChats via message passing.

function getRaw() {
  try {
    return window.localStorage.getItem("savedAIChats");
  } catch (e) {
    return null;
  }
}

function parseRaw(raw) {
  if (!raw) return { ok: true, data: null, raw: null };
  try {
    const data = JSON.parse(raw);
    return { ok: true, data, raw };
  } catch (e) {
    return { ok: false, error: "Invalid JSON in localStorage.savedAIChats", raw };
  }
}

function setRaw(rawString) {
  try {
    if (typeof rawString !== "string") {
      return { ok: false, error: "setRaw expects a JSON string" };
    }
    // Basic validation: ensure it parses
    JSON.parse(rawString);
    window.localStorage.setItem("savedAIChats", rawString);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function setObject(obj) {
  try {
    if (!obj || typeof obj !== "object") return { ok: false, error: "setObject expects an object" };
    const raw = JSON.stringify(obj);
    window.localStorage.setItem("savedAIChats", raw);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "DDG_PING") {
    sendResponse({ ok: true, host: location.host });
    return;
  }

  if (msg.type === "DDG_GET_SAVED_CHATS") {
    const raw = getRaw();
    const res = parseRaw(raw);
    sendResponse(res);
    return;
  }

  if (msg.type === "DDG_SET_SAVED_CHATS_RAW") {
    const { raw } = msg;
    const res = setRaw(raw);
    sendResponse(res);
    return;
  }

  if (msg.type === "DDG_SET_SAVED_CHATS_OBJECT") {
    const { data } = msg;
    const res = setObject(data);
    sendResponse(res);
    return;
  }

  // Fallback
  sendResponse({ ok: false, error: "Unknown message type" });
});