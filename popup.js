// popup.js - popup UI logic: list, edit, delete, insert, export.
// Communicates with content.js via message passing and ensures a duckduckgo.com tab exists.

// Global-ish state
let state = {
  ddgTabId: null,
  data: null, // parsed {version, chats}
  raw: null,  // original raw string
  currentChatIndex: null
};

const els = {};
document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  wireEvents();
  setStatus("Connecting...");

  const ensured = await ensureDuckDuckGoTab();
  if (!ensured.ok) {
    showAlert("danger", "Could not open or find duckduckgo.com tab: " + ensured.error);
    setStatus("Error");
    return;
  }
  state.ddgTabId = ensured.tabId;

  // Wait for content script to be ready
  const ready = await waitForContentScript(state.ddgTabId);
  if (!ready) {
    showAlert("danger", "Content script did not respond. Try opening duckduckgo.com manually and refresh.");
    setStatus("Error");
    return;
  }

  await loadData();
}

function cacheElements() {
  els.statusBadge = document.getElementById("statusBadge");
  els.alerts = document.getElementById("alerts");

  els.listView = document.getElementById("listView");
  els.noData = document.getElementById("noData");
  els.chatList = document.getElementById("chatList");

  els.btnRefresh = document.getElementById("btnRefresh");
  els.btnAddChat = document.getElementById("btnAddChat");
  els.btnExport = document.getElementById("btnExport");

  els.editorView = document.getElementById("editorView");
  els.btnBack = document.getElementById("btnBack");
  els.btnSaveChat = document.getElementById("btnSaveChat");
  els.btnDeleteChat = document.getElementById("btnDeleteChat");

  els.editTitle = document.getElementById("editTitle");
  els.editChatId = document.getElementById("editChatId");
  els.editModel = document.getElementById("editModel");
  els.editLastEdit = document.getElementById("editLastEdit");

  els.messagesContainer = document.getElementById("messagesContainer");
}

function wireEvents() {
  els.btnRefresh.addEventListener("click", () => loadData());
  els.btnAddChat.addEventListener("click", onInsertNewChat);
  els.btnExport.addEventListener("click", onExport);

  els.btnBack.addEventListener("click", () => {
    state.currentChatIndex = null;
    showList();
  });
  els.btnSaveChat.addEventListener("click", onSaveCurrentChat);
  els.btnDeleteChat.addEventListener("click", onDeleteCurrentChat);

  document.getElementById("openDDG").addEventListener("click", () => {
    // no-op; just a link
  });
}

// Status UI
function setStatus(text, tone = "secondary") {
  els.statusBadge.className = "badge text-bg-" + tone;
  els.statusBadge.textContent = text;
}

function showAlert(type, text, timeout = 4500) {
  const id = "alert-" + Math.random().toString(36).slice(2);
  const div = document.createElement("div");
  div.id = id;
  div.className = `alert alert-${type} py-2 small`;
  div.textContent = text;
  els.alerts.appendChild(div);
  if (timeout) setTimeout(() => div.remove(), timeout);
}

// Background coordination
function ensureDuckDuckGoTab() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "ENSURE_DDG_TAB" }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(res || { ok: false, error: "Unknown error" });
    });
  });
}

async function waitForContentScript(tabId, attempts = 30, delayMs = 250) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await sendToContent(tabId, { type: "DDG_PING" });
      if (res && res.ok) {
        return true;
      }
    } catch (e) {
      // ignore, try again
    }
    await sleep(delayMs);
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sendToContent(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(res);
    });
  });
}

// Data flow
async function loadData() {
  setStatus("Loading...", "secondary");
  try {
    const res = await sendToContent(state.ddgTabId, { type: "DDG_GET_SAVED_CHATS" });

    if (!res.ok && res.error) {
      showAlert("warning", "savedAIChats JSON is invalid on the site. You can still export and fix it: " + res.error, 8000);
      // we still show raw for export
    }

    state.raw = res.raw || null;
    state.data = res.data || { version: "0.7", chats: [] };

    renderList();
    setStatus("Ready", "success");
  } catch (e) {
    showAlert("danger", "Failed to load data: " + e.message);
    setStatus("Error", "danger");
  }
}

function renderList() {
  els.listView.classList.remove("d-none");
  els.editorView.classList.add("d-none");

  const chats = (state.data && Array.isArray(state.data.chats)) ? state.data.chats : [];

  els.noData.classList.toggle("d-none", chats.length > 0);
  els.chatList.innerHTML = "";

  if (!Array.isArray(chats)) {
    showAlert("danger", "Data format error: chats is not an array.");
    return;
  }

  chats.forEach((chat, index) => {
    const title = chat.title || "(untitled)";
    const model = chat.model || "";
    const lastEdit = chat.lastEdit ? formatDateShort(chat.lastEdit) : "";
    const msgCount = Array.isArray(chat.messages) ? chat.messages.length : 0;

    const item = document.createElement("div");
    item.className = "list-group-item bg-white";

    item.innerHTML = `
      <div class="d-flex align-items-center justify-content-between">
        <div class="flex-grow-1 me-2">
          <div class="fw-semibold">${escapeHTML(title)}</div>
          <div class="small text-muted">
            <span>${escapeHTML(model)}</span>
            <span class="mx-1">•</span>
            <span>${msgCount} msg</span>
            ${lastEdit ? `<span class="mx-1">•</span><span>${escapeHTML(lastEdit)}</span>` : ""}
          </div>
        </div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-icon" data-action="edit" data-index="${index}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon btn-danger" data-action="delete" data-index="${index}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon" data-action="open" data-index="${index}" title="Open">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15,3 21,3 21,9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    els.chatList.appendChild(item);
  });

  els.chatList.addEventListener("click", onListClick, { once: true });
}

function onListClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const index = parseInt(btn.dataset.index, 10);

  if (action === "edit") {
    openEditor(index);
  } else if (action === "delete") {
    onDeleteChatAtIndex(index);
  } else if (action === "open") {
    const chat = state.data.chats[index];
    window.open("https://duckduckgo.com/?q=ai", "_blank", "noopener");
    showAlert("info", "Opened DuckDuckGo. Note: There's no official deep link to a specific chat; this opens the AI page.");
  }
}

function onDeleteChatAtIndex(index) {
  const chat = state.data.chats[index];
  if (!confirm(`Delete chat "${chat.title || "(untitled)"}"? This cannot be undone.`)) return;
  state.data.chats.splice(index, 1);
  persistAll("Chat deleted.");
}

function onInsertNewChat() {
  const now = new Date();
  const chatId = genId();
  const model = "gpt-4o-mini";

  const newChat = {
    chatId,
    title: "New chat",
    model,
    messages: [
      { role: "user", content: "Hi", createdAt: now.toISOString() },
      { role: "assistant", content: "Hello!", status: "active", model, createdAt: (new Date(now.getTime() + 1000)).toISOString() }
    ],
    lastEdit: now.toISOString()
  };

  if (!state.data || typeof state.data !== "object") {
    state.data = { version: "0.7", chats: [] };
  }
  if (!Array.isArray(state.data.chats)) {
    state.data.chats = [];
  }

  state.data.chats.unshift(newChat);
  persistAll("New chat inserted.");
}

function openEditor(index) {
  state.currentChatIndex = index;

  const chat = state.data.chats[index];
  if (!chat) {
    showAlert("danger", "Chat not found.");
    return;
  }

  // Fill fields
  els.editTitle.value = chat.title || "";
  els.editChatId.value = chat.chatId || "";
  els.editModel.value = chat.model || "";
  els.editLastEdit.value = isoToLocalInput(chat.lastEdit || new Date().toISOString());

  // Messages
  els.messagesContainer.innerHTML = "";
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  messages.forEach((msg, mIdx) => {
    els.messagesContainer.appendChild(renderMessageCard(msg, mIdx));
  });

  showEditor();
}

function renderMessageCard(msg, mIdx) {
  const role = msg.role || "user";
  const createdAt = msg.createdAt ? isoToLocalInput(msg.createdAt) : "";
  const content = msg.content || "";

  const wrapper = document.createElement("div");
  wrapper.className = "card message-card";
  wrapper.dataset.mIndex = mIdx;

  wrapper.innerHTML = `
    <div class="card-header d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2">
        <span class="role-pill ${escapeHTML(role)} text-uppercase small">${escapeHTML(role)}</span>
        <span class="small text-muted small-mono">${escapeHTML(msg.model || "")}</span>
      </div>
      <div class="d-flex gap-1">
        <button class="btn btn-sm btn-icon btn-danger" data-msg-action="delete" title="Delete message">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="card-body">
      <div class="row g-2">
        <div class="col-md-3">
          <label class="form-label">Role</label>
          <select class="form-select form-select-sm" data-field="role">
            ${["user", "assistant", "system"].map(r => `<option value="${r}" ${r===role?"selected":""}>${r}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-9">
          <label class="form-label">Timestamp</label>
          <input type="datetime-local" class="form-control form-control-sm" data-field="createdAt" value="${escapeAttr(createdAt)}"/>
        </div>
        <div class="col-12">
          <label class="form-label">Content</label>
          <textarea class="form-control form-control-sm" data-field="content" rows="3" placeholder="Message text...">${escapeHTML(content)}</textarea>
        </div>
      </div>
      ${Array.isArray(msg.parts) && msg.parts.length > 0 && msg.parts[0].type === "text" ? `
      <div class="mt-2">
        <label class="form-label">Assistant parts[0].text (preserved)</label>
        <textarea class="form-control form-control-sm" data-field="parts0text" rows="2" placeholder="Optional assistant parts text...">${escapeHTML(msg.parts[0].text || "")}</textarea>
        <div class="form-text">If you change this, it updates parts[0].text while keeping other fields.</div>
      </div>
      ` : ""}
    </div>
  `;

  wrapper.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-msg-action]");
    if (!btn) return;
    if (btn.dataset.msgAction === "delete") {
      if (!confirm("Delete this message?")) return;
      const chat = state.data.chats[state.currentChatIndex];
      chat.messages.splice(mIdx, 1);
      wrapper.remove();
      showAlert("warning", "Message deleted.");
    }
  });

  // Keep two-way binding on change for this message
  wrapper.addEventListener("change", (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const chat = state.data.chats[state.currentChatIndex];
    const msgObj = chat.messages[mIdx];
    if (!msgObj) return;

    if (field === "role") {
      msgObj.role = e.target.value;
      // update pill
      wrapper.querySelector(".role-pill").textContent = e.target.value;
      wrapper.querySelector(".role-pill").className = `role-pill ${e.target.value} text-uppercase small`;
    } else if (field === "createdAt") {
      msgObj.createdAt = inputToIso(e.target.value);
    } else if (field === "content") {
      msgObj.content = e.target.value;
    } else if (field === "parts0text") {
      if (!Array.isArray(msgObj.parts)) msgObj.parts = [{ type: "text", text: "" }];
      if (!msgObj.parts[0]) msgObj.parts[0] = { type: "text", text: "" };
      msgObj.parts[0].text = e.target.value;
    }
  });

  return wrapper;
}

function showEditor() {
  els.listView.classList.add("d-none");
  els.editorView.classList.remove("d-none");
}

function showList() {
  els.editorView.classList.add("d-none");
  els.listView.classList.remove("d-none");
  renderList();
}

// Save current chat edits
async function onSaveCurrentChat() {
  const idx = state.currentChatIndex;
  if (idx == null) return;

  const chat = state.data.chats[idx];
  if (!chat) return;

  chat.title = els.editTitle.value.trim();
  chat.chatId = els.editChatId.value.trim() || chat.chatId || genId();
  chat.model = els.editModel.value.trim() || chat.model || "";
  chat.lastEdit = inputToIso(els.editLastEdit.value) || new Date().toISOString();

  // Basic normalization
  if (!Array.isArray(chat.messages)) chat.messages = [];

  await persistAll("Chat saved.");
}

async function onDeleteCurrentChat() {
  const idx = state.currentChatIndex;
  if (idx == null) return;

  const chat = state.data.chats[idx];
  if (!chat) return;

  if (!confirm(`Delete the entire chat "${chat.title || "(untitled)"}"? This cannot be undone.`)) return;

  state.data.chats.splice(idx, 1);
  state.currentChatIndex = null;
  await persistAll("Chat deleted.");
  showList();
}

// Add messages
document.getElementById("btnAddUserMsg").addEventListener("click", () => addMessage("user"));
document.getElementById("btnAddAssistantMsg").addEventListener("click", () => addMessage("assistant"));

function addMessage(role) {
  const chat = state.data.chats[state.currentChatIndex];
  if (!chat) return;

  const msg = {
    role,
    content: role === "assistant" ? "Hello!" : "Hi",
    createdAt: new Date().toISOString()
  };
  if (!Array.isArray(chat.messages)) chat.messages = [];
  chat.messages.push(msg);

  // Re-render messages quickly
  els.messagesContainer.appendChild(renderMessageCard(msg, chat.messages.length - 1));
}

// Persist to duckduckgo.com localStorage
async function persistAll(okMsg = "Saved.") {
  try {
    // Validate before saving
    const valid = validateDataShape(state.data);
    if (!valid.ok) {
      showAlert("danger", "Cannot save: " + valid.error);
      return;
    }

    const res = await sendToContent(state.ddgTabId, {
      type: "DDG_SET_SAVED_CHATS_OBJECT",
      data: state.data
    });

    if (res && res.ok) {
      showAlert("success", okMsg);
      setStatus("Saved", "success");
      await loadData(); // reload from source of truth
    } else {
      showAlert("danger", "Failed to save: " + (res && res.error ? res.error : "Unknown error"));
    }
  } catch (e) {
    showAlert("danger", "Error saving: " + e.message);
  }
}

// Export
function onExport() {
  try {
    const json = JSON.stringify(state.data || { version: "0.7", chats: [] }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `ddg_savedAIChats_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    showAlert("danger", "Export failed: " + e.message);
  }
}

// Helpers
function genId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function escapeAttr(str) {
  return escapeHTML(str).replaceAll("'", "&#39;");
}

function isoToLocalInput(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  } catch {
    return "";
  }
}

function inputToIso(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d)) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function formatDateShort(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString();
}

function validateDataShape(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "Root is not an object." };
  if (!("version" in data)) data.version = "0.7";
  if (!Array.isArray(data.chats)) return { ok: false, error: "chats must be an array." };

  // Lightweight checks for each chat/message
  for (const chat of data.chats) {
    if (!chat || typeof chat !== "object") return { ok: false, error: "Chat entry is not an object." };
    if (!Array.isArray(chat.messages)) chat.messages = [];
    for (const msg of chat.messages) {
      if (!msg || typeof msg !== "object") return { ok: false, error: "Message is not an object." };
      if (!msg.role) msg.role = "user";
      if (!msg.createdAt) msg.createdAt = new Date().toISOString();
      if (!("content" in msg)) msg.content = "";
    }
    if (!chat.lastEdit) chat.lastEdit = new Date().toISOString();
    if (!chat.chatId) chat.chatId = genId();
  }
  return { ok: true };
}