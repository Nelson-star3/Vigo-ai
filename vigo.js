let activeTTS = null;
let currentCodeProjects = {};

const MODEL_MAP = {
  "vigo V1.2": "gemini-2.5-flash",
  "veder(deep think)": "gemini-2.5-flash",
  "vigo V1.0": "gemini-3.5-flash"
};
const MODEL_LABELS = { "vigo V1.2": "VIGO V1.2", "vigo V1.0": "VIGO V1.0", "veder(deep think)": "VENDER V0.1" };
const MODEL_THINKING = { "veder(deep think)": 8192 };
function buildGenConfig() {
  if ((MODEL_MAP[modelSelect.value] || "").startsWith("gemini-3")) return agenticMode ? { thinkingConfig: { includeThoughts: true } } : undefined;
  const budget = MODEL_THINKING[modelSelect.value];
  if (!agenticMode && budget === undefined) return undefined;
  return { thinkingConfig: { includeThoughts: agenticMode, thinkingBudget: budget ?? -1 } };
}

const SYSTEM_PROMPT = `
IDENTITY:
You are Vigo, created by Nelson Company, an anonymous company led by Nelson Vigorous Muyanga, sometimes called Vanderbilt. Nelson Company creates powerful LLM modules, including Nelson AI, VIGO, and VENDER. Anyone interested in talking to Nelson Vigorous Muyanga can contact him at +256747140742. People interested in using these models should visit nelsonai.netlify.app and nelson-main.netlify.app. Talk about yourself, your origin, Vigo, Nelson Company, or these related models when the user asks about them, when the information is relevant and needful to answer the user's request, or when introducing or explaining yourself. Do not unnecessarily provide this information when it is unrelated to the user's request.

GENERAL BEHAVIOR:
You know yourself as Vigo and are built for vigorous tasks. Answer clearly, helpfully, accurately, and confidently when the information is well-supported. Do not present uncertain information as certain. Answer briefly when a short answer is sufficient, and provide longer explanations when the user asks for them or when additional explanation is genuinely needed to make the answer useful, clear, or complete. Do not make answers unnecessarily long.

REASONING AND CLARIFICATION:
Understand the user's actual goal before answering. If the request is ambiguous, incomplete, or missing information that you genuinely need to answer well, ask for clarification instead of making an important unsupported assumption. However, do not ask unnecessary questions when a reasonable interpretation can produce a useful answer. When clarification is genuinely needed, end the reply with a line in exactly this format and nothing else on that line:
CLARIFY_QUESTION: {"question":"your clarifying question","options":["short option 1","short option 2","short option 3"]}
Keep the options short and relevant. Use this format only when clarification would meaningfully improve the answer.

FORMATTING:
Use Markdown headings (#, ##) to structure longer answers, and headings may be CAPITALIZED when appropriate. Use fenced code blocks for ordinary code. Use Markdown tables when they make comparisons or structured information easier to understand. Use Markdown links where useful. Use **bold** for important terms or key points. Use bullet points or numbered lists when listing items. use emojis to make texts more understandable and to make it look prettier and easy to read. You may use visuals, symbols, letters, diagrams made with text, or box-style designs such as ┌─────────────────────────────────────┐ when they make an explanation, design, example, or demonstration clearer. Prioritize readability and clear organization.

IMAGE GENERATION:
You have a connected image-generation tool. Your purpose is not only to respond to explicit image requests but also to make explanations and answers clearer when a visual would substantially improve understanding. When the user explicitly asks you to generate, create, draw, render, visualize, or otherwise make an image, never say you are unable to create images. Instead, write one short sentence introducing the image, then on the very last line of the reply write exactly:
IMAGE_PROMPT: a detailed English description of the image
The IMAGE_PROMPT line must contain nothing else on that line: no Markdown, asterisks, or emojis. You may also proactively decide that an image would substantially improve an explanation, demonstration, design, comparison, concept, process, or other answer, even when the user did not explicitly request an image. Do not generate or request an image merely for decoration when text is clearer. Include IMAGE_PROMPT only when an image is actually requested or when you have intentionally decided that generating an image would materially improve the answer. For ordinary explanations, do not include IMAGE_PROMPT merely because a visual could theoretically be used.

CODE:
For substantial code, especially code of approximately 25 or more lines, or for multi-file projects, consider whether the special project format would make the response easier to read, organize, save, or use. When the project format is genuinely useful, write one short sentence introducing it, then use exactly this format:
===CODE_PROJECT===
TITLE: short project title
LANGUAGE: appropriate programming language
===FILE: filename.ext===
the full file content
===ENDFILE===
===END_CODE_PROJECT===
You may repeat the FILE block for multiple files. Use the appropriate programming language in the LANGUAGE field rather than automatically using Python. The project format is intended to make long code easier to handle, distinguish multiple files, improve readability, and make projects easier to save or download. Use it when useful, including when the user explicitly asks for the project or downloadable format. Do not assume that every long piece of code must use this format; ordinary code may remain in normal fenced code blocks when that is clearer or more appropriate. Do not assume that code placed in a sandbox is required merely because it is long. Short code snippets under approximately 25 lines should remain normal fenced code blocks.

OUTPUT QUALITY:
Follow the user's requested format, purpose, and level of detail whenever possible. Prefer useful, direct answers over unnecessary explanation. When demonstrating an idea, choose the clearest representation available, which may be text, code, a table, symbols, or an image. When multiple approaches are possible, choose the one that best satisfies the user's actual goal and explain alternatives only when they are useful. Always prioritize clarity, usefulness, and faithful interpretation of the user's request.
`;
const modelDropdownBtn = document.getElementById("modelDropdownBtn");
const modelDropdownLabel = document.getElementById("modelDropdownLabel");

function buildModelDropdownList() {
  const list = document.createElement("div");
  list.className = "modelDropdownList";
  Array.from(modelSelect.options).forEach(opt => {
    const item = document.createElement("div");
    item.className = "modelDropdownOption" + (opt.value === modelSelect.value ? " selected" : "");
    item.textContent = opt.textContent;
    item.addEventListener("click", () => {
      modelSelect.value = opt.value;
      modelDropdownLabel.textContent = opt.textContent;
      list.remove();
    });
    list.appendChild(item);
  });
  return list;
}

modelDropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const existing = document.querySelector(".modelDropdownList");
  if (existing) { existing.remove(); return; }
  document.getElementById("modelDropdown").appendChild(buildModelDropdownList());
});

document.addEventListener("click", (e) => {
  const list = document.querySelector(".modelDropdownList");
  if (list && !document.getElementById("modelDropdown").contains(e.target)) list.remove();
});

const micBtn = document.getElementById("micBtn");
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let agenticMode = localStorage.getItem("vigo_agentic_mode") === "true";
const agenticModeOptions = document.getElementById("agenticModeOptions");

buildOptionPicker(agenticModeOptions, [
  { value: "on", label: "On" },
  { value: "off", label: "Off" }
], agenticMode ? "on" : "off", (value) => {
  agenticMode = value === "on";
  localStorage.setItem("vigo_agentic_mode", agenticMode);
});
let webSearchMode = localStorage.getItem("vigo_web_search") || "auto";
buildOptionPicker(document.getElementById("webSearchOptions"), [
  { value: "auto", label: "Auto" },
  { value: "on", label: "Always" },
  { value: "off", label: "Off" }
], webSearchMode, (value) => {
  webSearchMode = value;
  localStorage.setItem("vigo_web_search", value);
});

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = navigator.language || "en-US";

  recognition.addEventListener("result", (e) => {
    const transcript = e.results[0][0].transcript;
    chatInput.value = chatInput.value ? chatInput.value + " " + transcript : transcript;
    chatInput.dispatchEvent(new Event("input"));
  });

  recognition.addEventListener("end", () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  });

  recognition.addEventListener("error", (e) => {
    isRecording = false;
    micBtn.classList.remove("recording");
    showAppWarning("Voice input error: " + e.error);
  });

  micBtn.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
      return;
    }
    try { recognition.start(); isRecording = true; micBtn.classList.add("recording"); }
    catch { showAppWarning("Couldn't start voice input."); }
  });
} else {
  micBtn.addEventListener("click", () => {
    showAppWarning("Voice input isn't supported in this browser.");
  });
}

const chatInput = document.getElementById("chatInput");
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  const maxHeight = 120;
  chatInput.style.height = Math.min(chatInput.scrollHeight, maxHeight) + "px";

}); 
const sendBtn = document.getElementById("sendBtn");
const modelSelect = document.getElementById("select");
const inputArea = document.getElementById("InputArea");
//Recent messages.
let sessions = JSON.parse(localStorage.getItem("vigo_sessions")) || [];
let currentSessionId = null;
let isGenerating = false;
let currentAbortController = null;
let historySearchTerm = "";

const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.createElement("div");
historyPanel.id = "historyPanel";
document.body.appendChild(historyPanel);
function createOrbAnimation(canvasEl) {
  let ctx, width, height, cx, cy, time = 0, running = false, frameId;

  function resize() {
    const rect = canvasEl.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvasEl.width = rect.width * ratio;
    canvasEl.height = rect.height * ratio;
    ctx = canvasEl.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    width = rect.width;
    height = rect.height;
    cx = width / 2;
    cy = height / 2;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    time += 0.022;
    ctx.save();
    ctx.translate(cx, cy);

    const baseRadius = Math.min(width, height) * 0.24;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = baseRadius * (1.5 + ring * 0.35);
      const ringAlpha = 0.05 - ring * 0.012;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, ringRadius);
      grad.addColorStop(0, `rgba(255, 140, 60, ${ringAlpha})`);
      grad.addColorStop(1, `rgba(255, 90, 40, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const points = 120;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const n1 = Math.sin(angle * 3 + time * 1.4) * 0.10;
      const n2 = Math.cos(angle * 5 - time * 1.1) * 0.06;
      const n3 = Math.sin(angle * 2 + time * 0.6) * 0.05;
      const wobble = 1 + n1 + n2 + n3;
      const r = baseRadius * wobble;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const hueShift = Math.sin(time * 0.3) * 10;
    const coreGrad = ctx.createLinearGradient(-baseRadius, -baseRadius, baseRadius, baseRadius);
    coreGrad.addColorStop(0, `hsl(${28 + hueShift}, 95%, 68%)`);
    coreGrad.addColorStop(0.5, `hsl(${16 + hueShift}, 92%, 58%)`);
    coreGrad.addColorStop(1, `hsl(${6 + hueShift}, 88%, 50%)`);
    ctx.fillStyle = coreGrad;
    ctx.shadowColor = "rgba(255, 110, 50, 0.5)";
    ctx.shadowBlur = baseRadius * 0.3;
    ctx.fill();
    ctx.restore();

    ctx.save();
    const highlightGrad = ctx.createRadialGradient(-baseRadius * 0.35, -baseRadius * 0.4, 2, -baseRadius * 0.35, -baseRadius * 0.4, baseRadius * 0.9);
    highlightGrad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlightGrad;
    ctx.beginPath();
    ctx.arc(-baseRadius * 0.3, -baseRadius * 0.35, baseRadius * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const particleCount = 5;
    for (let p = 0; p < particleCount; p++) {
      const pAngle = time * (0.8 + p * 0.15) + p * (Math.PI * 2 / particleCount);
      const pRadius = baseRadius * (1.35 + Math.sin(time * 1.5 + p) * 0.15);
      const px = Math.cos(pAngle) * pRadius;
      const py = Math.sin(pAngle) * pRadius;
      const pSize = 1.6 + Math.sin(time * 2 + p) * 0.8;
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 170, 100, ${0.5 + Math.sin(time * 2 + p) * 0.3})`;
      ctx.fill();
    }

    ctx.restore();
    if (running) frameId = requestAnimationFrame(draw);
  }

  function start() {
    resize();
    running = true;
    draw();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  return { start, stop, resize };
}
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const defaultModelOptions = document.getElementById("defaultModelOptions");
const voiceOptions = document.getElementById("voiceOptions");

let defaultModel = localStorage.getItem("vigo_default_model") || "vigo V1.2";
let selectedVoice = localStorage.getItem("vigo_voice") || "nova";

modelSelect.value = defaultModel;
modelDropdownLabel.textContent = MODEL_LABELS[defaultModel] || "VIGO V1.2";

function buildOptionPicker(container, options, currentValue, onSelect) {
  container.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "optionPickerBtn" + (opt.value === currentValue ? " selected" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      onSelect(opt.value);
      buildOptionPicker(container, options, opt.value, onSelect);
    });
    container.appendChild(btn);
  });
}

buildOptionPicker(defaultModelOptions, [
  { value: "vigo V1.2", label: "VIGO V1.2" },
  { value: "vigo V1.0", label: "VIGO V1.0" },
  { value: "veder(deep think)", label: "VENDER V0.1" }
], defaultModel, (value) => {
  defaultModel = value;
  localStorage.setItem("vigo_default_model", defaultModel);
});

buildOptionPicker(voiceOptions, [
  { value: "nova", label: "Nova" },
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "shimmer", label: "Shimmer" }
], selectedVoice, (value) => {
  selectedVoice = value;
  localStorage.setItem("vigo_voice", selectedVoice);
});

function openSettings() {
  settingsPanel.classList.add("open");
  settingsBackdrop.classList.add("open");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsBackdrop.classList.remove("open");
}

settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);


const heroOrb = createOrbAnimation(document.getElementById("heroCanvas"));
heroOrb.start();

function showAppWarning(message) {
  const toast = document.createElement("div");
  toast.className = "appWarningToast";

  const icon = document.createElement("span");
  icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L1 21h22L12 2z" stroke="#e5484d" stroke-width="1.5" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#e5484d" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1" fill="#e5484d"/></svg>';

  const text = document.createElement("span");
  text.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "appWarningClose";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => toast.remove());

  toast.appendChild(icon);
  toast.appendChild(text);
  toast.appendChild(closeBtn);
  document.body.appendChild(toast);

  const inputRect = inputArea.getBoundingClientRect();
  toast.style.bottom = (window.innerHeight - inputRect.top + 10) + "px";

  setTimeout(() => toast.remove(), 4000);
}

function sanitizeHistoryForStorage(hist) {
  return hist.map(entry => ({
    role: entry.role,
    parts: entry.parts.map(part => part.inline_data ? { text: "[image attached]" } : part)
  }));
}

function persistSessions() {
  let trimmed = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const sanitized = sessions.map(s => ({ ...s, history: sanitizeHistoryForStorage(s.history) }));
      localStorage.setItem("vigo_sessions", JSON.stringify(sanitized));
      if (trimmed) showAppWarning("Storage was full, so the oldest chat was removed.");
      return;
    } catch (err) {
      let drop = -1;
      for (let i = sessions.length - 1; i >= 0; i--) if (!sessions[i].pinned && sessions[i].id !== currentSessionId) { drop = i; break; }
      if (drop === -1) { showAppWarning("Couldn't save chat history. Storage is full."); return; }
      sessions.splice(drop, 1); trimmed = true;
    }
  }
}

function startNewChat() {
  currentSessionId = null;
  history = [];
  currentImages = {};
  currentCodeProjects = {};
  messagesContainer.innerHTML = "";
  closeHistoryPanel();
}
const uploadBtn = document.getElementById("uploadBtn");

const cameraInput = document.createElement("input");
cameraInput.type = "file";
cameraInput.accept = "image/*";
cameraInput.capture = "environment";
cameraInput.style.display = "none";
document.body.appendChild(cameraInput);

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/*";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

function showUploadChoiceMenu() {
  document.querySelectorAll(".uploadChoiceOverlay").forEach(m => m.remove());
  const overlay = document.createElement("div");
  overlay.className = "uploadChoiceOverlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const sheet = document.createElement("div");
  sheet.className = "uploadChoiceSheet";

  const cameraBtn = document.createElement("button");
  cameraBtn.className = "uploadChoiceBtn";
  cameraBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v12H4z" stroke="#333" stroke-width="1.7" fill="none" stroke-linejoin="round"/><circle cx="12" cy="14" r="3.5" stroke="#333" stroke-width="1.7" fill="none"/></svg>Camera';
  cameraBtn.addEventListener("click", () => { overlay.remove(); cameraInput.click(); });

  const filesBtn = document.createElement("button");
  filesBtn.className = "uploadChoiceBtn";
  filesBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" stroke="#333" stroke-width="1.7" fill="none"/><circle cx="9" cy="10" r="1.5" fill="#333"/><path d="M4 16l5-5 4 4 3-3 4 4" stroke="#333" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>Upload Files';
  filesBtn.addEventListener("click", () => { overlay.remove(); fileInput.click(); });

  sheet.appendChild(cameraBtn);
  sheet.appendChild(filesBtn);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
let currentImages = {};
let pendingImage = null;
let pendingLongTexts = [];
const LONG_TEXT_THRESHOLD = 400;

const attachPreview = document.createElement("div");
attachPreview.id = "attachPreview";
inputArea.insertBefore(attachPreview, inputArea.firstChild);

uploadBtn.addEventListener("click", showUploadChoiceMenu);

function handleImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { showAppWarning("Only images are supported."); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const original = { mimeType: file.type, data: reader.result.split(",")[1] };
    pendingImage = original;
    const probe = new Image();
    probe.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(probe.width, probe.height));
      if (scale < 1 && pendingImage === original) {
        const c = document.createElement("canvas");
        c.width = Math.round(probe.width * scale); c.height = Math.round(probe.height * scale);
        c.getContext("2d").drawImage(probe, 0, 0, c.width, c.height);
        pendingImage = { mimeType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
      }
    };
    probe.src = reader.result;
    attachPreview.innerHTML = "";
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "attachThumbWrap";
    const thumb = document.createElement("img");
    thumb.src = reader.result;
    thumbWrap.appendChild(thumb);
    const removeBtn = document.createElement("button");
    removeBtn.className = "attachRemoveBtn";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      pendingImage = null;
      attachPreview.innerHTML = "";
    });
    thumbWrap.appendChild(removeBtn);
    attachPreview.appendChild(thumbWrap);
  };
  reader.onerror = () => {
    showAppWarning("Upload failed");
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener("change", () => {
  handleImageFile(fileInput.files[0]);
  fileInput.value = "";
});

cameraInput.addEventListener("change", () => {
  handleImageFile(cameraInput.files[0]);
  cameraInput.value = "";
});
//recent chats and new chats behavior 
function togglePinSession(id, event) {
  event.stopPropagation();
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  session.pinned = !session.pinned;
  persistSessions();
  renderSessionList();
}
function deleteSession(id, event) {
  event.stopPropagation();
  if (!confirm("Delete this chat?")) return;
  sessions = sessions.filter(s => s.id !== id);
  persistSessions();
  if (currentSessionId === id) startNewChat();
  renderSessionList();
}

function renameSession(id, event) {
  event.stopPropagation();
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  const newTitle = prompt("Rename chat:", session.title);
  if (newTitle && newTitle.trim()) {
    session.title = newTitle.trim();
    persistSessions();
    renderSessionList();
  }
}

function renderSessionList() {
  const listContainer = document.getElementById("historyList");
  if (!listContainer) return;
  listContainer.innerHTML = "";
  const filtered = sessions.filter(s => s.title.toLowerCase().includes(historySearchTerm.toLowerCase()));
  const sorted = filtered.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  sorted.forEach(session => {
    const item = document.createElement("div");
    item.className = "historyItem" + (session.id === currentSessionId ? " activeSession" : "");

    const titleSpan = document.createElement("span");
    titleSpan.className = "historyItemTitle";
    titleSpan.textContent = (session.pinned ? "📌 " : "") + session.title;
    titleSpan.addEventListener("click", () => loadSession(session.id));
    item.appendChild(titleSpan);

    const menuWrap = document.createElement("div");
    menuWrap.className = "historyMenuWrap";

    const menuBtn = document.createElement("button");
    menuBtn.className = "historyItemIcon";
    menuBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="#888"/><circle cx="12" cy="12" r="2" fill="#888"/><circle cx="19" cy="12" r="2" fill="#888"/></svg>';

    const dropdown = document.createElement("div");
    dropdown.className = "historyDropdown";

    const pinBtn = document.createElement("button");
    pinBtn.className = "msgActionBtn";
    pinBtn.textContent = session.pinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", (e) => { dropdown.classList.remove("open"); togglePinSession(session.id, e); });

    const renameBtn = document.createElement("button");
    renameBtn.className = "msgActionBtn";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", (e) => { dropdown.classList.remove("open"); renameSession(session.id, e); });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "msgActionBtn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => { dropdown.classList.remove("open"); deleteSession(session.id, e); });

    dropdown.appendChild(pinBtn);
    dropdown.appendChild(renameBtn);
    dropdown.appendChild(deleteBtn);
    menuBtn.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("open"); });

    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(dropdown);
    item.appendChild(menuWrap);

    listContainer.appendChild(item);
  });
}

function renderHistoryPanel() {
  historyPanel.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.id = "historyCloseBtn";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeHistoryPanel);
  historyPanel.appendChild(closeBtn);

  const newChatBtn = document.createElement("button");
  newChatBtn.id = "newChatBtn";
  newChatBtn.textContent = "+ New chat";
  newChatBtn.addEventListener("click", startNewChat);
  historyPanel.appendChild(newChatBtn);
  const clearAllBtn = document.createElement("button");
  clearAllBtn.className = "clearAllText";
  clearAllBtn.textContent = "Clear all chats";
  clearAllBtn.addEventListener("click", () => {
    if (!confirm("Delete all saved chats? This can't be undone.")) return;
    localStorage.removeItem("vigo_sessions");
    sessions = [];
    startNewChat();
    closeHistoryPanel();
    renderHistoryPanel();
  });
  historyPanel.appendChild(clearAllBtn);

  const searchInput = document.createElement("input");
  searchInput.id = "historySearch";
  searchInput.type = "text";
  searchInput.placeholder = "Search chats...";
  searchInput.value = historySearchTerm;
  searchInput.addEventListener("input", () => {
    historySearchTerm = searchInput.value;
    renderSessionList();
  });
  historyPanel.appendChild(searchInput);

  const heading = document.createElement("h3");
  heading.textContent = "Recent";
  heading.style.margin = "16px 0 10px";
  historyPanel.appendChild(heading);

  const listContainer = document.createElement("div");
  listContainer.id = "historyList";
  historyPanel.appendChild(listContainer);

  renderSessionList();
}

function loadSession(id) {
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  currentSessionId = id;
  history = session.history.slice();
  currentImages = { ...(session.images || {}) };
  currentCodeProjects = { ...(session.codeProjects || {}) };
  messagesContainer.innerHTML = "";
  history.forEach((entry, idx) => {
    const text = entry.parts[0].text;
    if (entry.role === "user") {
      appendMessage("user", text);
    } else {
      const msg = appendMessage("ai", "");
      const parsed = parseAiText(text);
      renderMarkdown(msg, parsed.cleanText);
      if (parsed.project) renderCodeProjectCard(parsed.project, msg);
      const savedImg = parsed.imagePrompt || currentImages[idx] || currentImages[idx - 1];
      if (savedImg) {
        const imgContainer = document.createElement("div");
        imgContainer.style.cssText = "margin:10px 0;";
        msg.appendChild(imgContainer);
        renderImageBlock(savedImg, imgContainer);
      }
      addMessageActions(msg, parsed.cleanText);
    }
  });
  closeHistoryPanel();
}

async function generateTitle(userText, aiText) {
  try {
    const url = "/api/chat?model=gemini-2.5-flash-lite";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Summarize this exchange in 3 to 6 words as a short title. No quotes, no ending punctuation.\n\nUser: ${userText}\nVigo: ${aiText}` }] }]
      })
    });
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userText.slice(0, 40);
  } catch {
    return userText.slice(0, 40);
  }
}

async function saveCurrentSession(userText, aiText) {
  if (!currentSessionId) {
    currentSessionId = Date.now().toString();
    const title = await generateTitle(userText, aiText);
    sessions.unshift({ id: currentSessionId, title, history: history.slice(), images: { ...currentImages }, codeProjects: { ...currentCodeProjects } });
  } else {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      session.history = history.slice();
      session.images = { ...currentImages };
      session.codeProjects = { ...currentCodeProjects };
    }
  }
  persistSessions();
  renderHistoryPanel();
}

const historyBackdrop = document.getElementById("historyBackdrop");

function closeHistoryPanel() {
  historyPanel.classList.remove("open");
  historyBackdrop.classList.remove("open");
}
//recent chats back behavior 
historyBtn.addEventListener("click", () => {
  renderHistoryPanel();
  historyPanel.classList.add("open");
  historyBackdrop.classList.add("open");
});

historyBackdrop.addEventListener("click", closeHistoryPanel);

const header = document.querySelector("header");
//Amoeba visualizer at response.
let flowCanvas, flowCtx, flowWidth, flowHeight, flowCenterX, flowCenterY, flowTime = 0, flowRunning = false, flowAnimationId;

function resizeFlowCanvas() {
  const rect = flowCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  flowCanvas.width = rect.width * pixelRatio;
  flowCanvas.height = rect.height * pixelRatio;
  flowCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  flowWidth = rect.width;
  flowHeight = rect.height;
  flowCenterX = flowWidth / 2;
  flowCenterY = flowHeight / 2;
}


function drawVigoFlow() {
  flowCtx.clearRect(0, 0, flowWidth, flowHeight);
  flowTime += 0.022;
  flowCtx.save();
  flowCtx.translate(flowCenterX, flowCenterY);

  const baseRadius = Math.min(flowWidth, flowHeight) * 0.24;

  flowCtx.save();
  flowCtx.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 3; ring++) {
    const ringRadius = baseRadius * (1.5 + ring * 0.35);
    const ringAlpha = 0.05 - ring * 0.012;
    const grad = flowCtx.createRadialGradient(0, 0, 0, 0, 0, ringRadius);
    grad.addColorStop(0, `rgba(255, 140, 60, ${ringAlpha})`);
    grad.addColorStop(1, `rgba(255, 90, 40, 0)`);
    flowCtx.fillStyle = grad;
    flowCtx.beginPath();
    flowCtx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    flowCtx.fill();
  }
  flowCtx.restore();

  const points = 120;
  flowCtx.save();
  flowCtx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (Math.PI * 2 * i) / points;
    const n1 = Math.sin(angle * 3 + flowTime * 1.4) * 0.10;
    const n2 = Math.cos(angle * 5 - flowTime * 1.1) * 0.06;
    const n3 = Math.sin(angle * 2 + flowTime * 0.6) * 0.05;
    const wobble = 1 + n1 + n2 + n3;
    const r = baseRadius * wobble;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) flowCtx.moveTo(px, py); else flowCtx.lineTo(px, py);
  }
  flowCtx.closePath();

  const hueShift = Math.sin(flowTime * 0.3) * 10;
  const coreGrad = flowCtx.createLinearGradient(-baseRadius, -baseRadius, baseRadius, baseRadius);
  coreGrad.addColorStop(0, `hsl(${28 + hueShift}, 95%, 68%)`);
  coreGrad.addColorStop(0.5, `hsl(${16 + hueShift}, 92%, 58%)`);
  coreGrad.addColorStop(1, `hsl(${6 + hueShift}, 88%, 50%)`);
  flowCtx.fillStyle = coreGrad;
  flowCtx.shadowColor = "rgba(255, 110, 50, 0.5)";
  flowCtx.shadowBlur = 22;
  flowCtx.fill();
  flowCtx.restore();

  flowCtx.save();
  const highlightGrad = flowCtx.createRadialGradient(-baseRadius * 0.35, -baseRadius * 0.4, 2, -baseRadius * 0.35, -baseRadius * 0.4, baseRadius * 0.9);
  highlightGrad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  flowCtx.fillStyle = highlightGrad;
  flowCtx.beginPath();
  flowCtx.arc(-baseRadius * 0.3, -baseRadius * 0.35, baseRadius * 0.85, 0, Math.PI * 2);
  flowCtx.fill();
  flowCtx.restore();

  const particleCount = 5;
  for (let p = 0; p < particleCount; p++) {
    const pAngle = flowTime * (0.8 + p * 0.15) + p * (Math.PI * 2 / particleCount);
    const pRadius = baseRadius * (1.35 + Math.sin(flowTime * 1.5 + p) * 0.15);
    const px = Math.cos(pAngle) * pRadius;
    const py = Math.sin(pAngle) * pRadius;
    const pSize = 1.6 + Math.sin(flowTime * 2 + p) * 0.8;
    flowCtx.beginPath();
    flowCtx.arc(px, py, pSize, 0, Math.PI * 2);
    flowCtx.fillStyle = `rgba(255, 170, 100, ${0.5 + Math.sin(flowTime * 2 + p) * 0.3})`;
    flowCtx.fill();
  }

  flowCtx.restore();

  if (flowRunning) {
    flowAnimationId = requestAnimationFrame(drawVigoFlow);
  }
}

function createVisualizer() {
  const visualizer = document.createElement("div");
  visualizer.className = "visualizer";
  const canvasEl = document.createElement("canvas");
  visualizer.appendChild(canvasEl);
  return { visualizer, canvasEl };
}

function startVigoFlow(canvasEl, visualizer) {
  flowCanvas = canvasEl;
  flowCtx = flowCanvas.getContext("2d");
  resizeFlowCanvas();
  visualizer.classList.add("active");
  flowRunning = true;
  cancelAnimationFrame(flowAnimationId);
  drawVigoFlow();
}

function stopVigoFlow(visualizer) {
  flowRunning = false;
  visualizer.classList.remove("active");
  cancelAnimationFrame(flowAnimationId);
}
function freezeVigoFlow() {
  flowRunning = false;
  cancelAnimationFrame(flowAnimationId);
}
//================================

document.body.style.paddingTop = header.offsetHeight + "px";
//Code blocks + copy button, headings, emoji support (JS)
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function inlineFormat(line) {
  const codes = [];
  let html = escapeHtml(line).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#1c7ed6;text-decoration:underline;">$1</a>');
  return html.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code class="inlineCode">' + codes[i] + "</code>");
}

function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
function isTableSeparator(line) { return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line); }
function parseTableRow(line) { return line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()); }

function renderTable(rows) {
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;width:100%;margin:10px 0;font-size:0.92em;";
  rows.forEach((cells, rowIndex) => {
    const tr = document.createElement("tr");
    cells.forEach(cellText => {
      const cell = document.createElement(rowIndex === 0 ? "th" : "td");
      cell.innerHTML = inlineFormat(cellText);
      cell.style.cssText = rowIndex === 0
        ? "border:1px solid #ddd;padding:8px 10px;background:#f0f0f0;text-align:left;font-weight:600;"
        : "border:1px solid #ddd;padding:8px 10px;text-align:left;";
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  });
  return table;
}

function renderTextBlock(text) {
  const wrap = document.createElement("div");
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isTableRow(line) && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      const rows = [parseTableRow(line)];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(parseTableRow(lines[i])); i++; }
      wrap.appendChild(renderTable(rows));
      continue;
    }

    const tag = trimmed.startsWith("#### ") ? "h4" : trimmed.startsWith("### ") ? "h3" : trimmed.startsWith("## ") ? "h2" : trimmed.startsWith("# ") ? "h1" : null;
    if (tag) {
      const h = document.createElement(tag);
      h.style.margin = "10px 0 4px";
      h.innerHTML = inlineFormat(trimmed.replace(/^#+\s*/, ""));
      wrap.appendChild(h);
    } else if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      const hr = document.createElement("hr");
      hr.style.cssText = "border:none;border-top:1px solid #ddd;margin:10px 0;";
      wrap.appendChild(hr);
    } else if (/^>\s?/.test(trimmed)) {
      const q = document.createElement("div");
      q.style.cssText = "margin:4px 0;padding:2px 12px;border-left:3px solid #E85D3D;color:#555;";
      q.innerHTML = inlineFormat(trimmed.replace(/^>\s?/, ""));
      wrap.appendChild(q);
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      const m = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
      const li = document.createElement("div");
      li.style.cssText = "margin:2px 0;padding-left:18px;";
      li.innerHTML = m[1] + ".&nbsp;&nbsp;" + inlineFormat(m[2]);
      wrap.appendChild(li);
    } else if (/^[-*]\s+/.test(trimmed)) {
      const li = document.createElement("div");
      li.style.cssText = "margin:2px 0;padding-left:18px;";
      li.innerHTML = "•&nbsp;&nbsp;" + inlineFormat(trimmed.replace(/^[-*]\s+/, ""));
      wrap.appendChild(li);
    } else {
      const p = document.createElement("p");
      p.style.margin = "4px 0";
      p.innerHTML = inlineFormat(line);
      wrap.appendChild(p);
    }
    i++;
  }
  return wrap;
}

//AI CODE STYLINGS FUNCTION.
const CODE_KEYWORDS = {
  python: ["def","return","if","elif","else","for","while","import","from","as","class","try","except","finally","with","in","is","not","and","or","None","True","False","lambda","pass","break","continue","yield","global","raise","async","await","self"],
  js: ["function","return","if","else","for","while","var","let","const","import","from","export","default","class","try","catch","finally","new","typeof","instanceof","in","of","null","undefined","true","false","async","await","switch","case","break","continue","this","extends","super","yield"],
  bash: ["if","then","else","fi","for","do","done","while","echo","function","export","return"],
  css: [], json: ["true","false","null"],
  java: ["public","private","protected","static","final","void","int","double","boolean","String","class","interface","extends","implements","new","return","if","else","for","while","try","catch","finally","throw","throws","import","package","this","null","true","false","switch","case","break","continue"],
  c: ["int","char","float","double","void","long","short","unsigned","struct","enum","typedef","static","const","return","if","else","for","while","do","switch","case","break","continue","sizeof","include","define","NULL","class","public","private","new","delete","namespace","using","template","bool","true","false"],
  go: ["func","package","import","var","const","type","struct","interface","return","if","else","for","range","switch","case","break","continue","go","defer","chan","map","nil","true","false"],
  rust: ["fn","let","mut","pub","use","mod","struct","enum","impl","trait","return","if","else","for","while","loop","match","break","continue","self","Self","true","false","const","static","async","await"]
};
CODE_KEYWORDS.python3 = CODE_KEYWORDS.py = CODE_KEYWORDS.python;
CODE_KEYWORDS.javascript = CODE_KEYWORDS.ts = CODE_KEYWORDS.typescript = CODE_KEYWORDS.js;
CODE_KEYWORDS.sh = CODE_KEYWORDS.bash;
CODE_KEYWORDS.html = CODE_KEYWORDS.xml = CODE_KEYWORDS.svg = CODE_KEYWORDS.vue = CODE_KEYWORDS.js;
CODE_KEYWORDS.cpp = CODE_KEYWORDS["c++"] = CODE_KEYWORDS.cs = CODE_KEYWORDS.c;

function highlightKeywords(escapedText, keywords) {
  if (!keywords || !keywords.length) return escapedText;
  const re = new RegExp("\\b(" + keywords.join("|") + ")\\b", "g");
  return escapedText.replace(re, '<span style="color:#8250df;font-weight:600;">$1</span>');
}

function highlightCode(code, lang) {
  const keywords = CODE_KEYWORDS[lang] || [];
  const escape = s => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
  const hashLang = ["python", "python3", "py", "bash", "sh", "yaml", "yml", "ruby", "rb"].includes(lang);
  const c1 = hashLang ? "(\\b\\B)" : "(\\/\\/.*$)";
  const c2 = hashLang ? "(#.*$)" : "(\\b\\B)";
  const htmlLike = ["html", "xml", "svg", "vue"].includes(lang);
  const c5 = htmlLike ? "(<!--[\\s\\S]*?-->)" : "(\\b\\B)";
  const c6 = htmlLike ? "(<\\/?[a-zA-Z][\\w:-]*|\\/?>)" : "(\\b\\B)";
  const pattern = new RegExp(c1 + "|" + c2 + "|(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')|(\\b\\d+(?:\\.\\d+)?\\b)|" + c5 + "|" + c6, "gm");
  let result = "", lastIndex = 0, match;
  while ((match = pattern.exec(code)) !== null) {
    result += highlightKeywords(escape(code.slice(lastIndex, match.index)), keywords);
    if (match[1] || match[2]) result += `<span style="color:#8a8a8a;">${escape(match[1] || match[2])}</span>`;
    else if (match[3]) result += `<span style="color:#c25a3f;">${escape(match[3])}</span>`;
    else if (match[4]) result += `<span style="color:#1c7ed6;">${escape(match[4])}</span>`;
    else if (match[5]) result += `<span style="color:#8a8a8a;">${escape(match[5])}</span>`;
    else if (match[6]) result += `<span style="color:#0b7285;font-weight:600;">${escape(match[6])}</span>`;
    lastIndex = pattern.lastIndex;
  }
  result += highlightKeywords(escape(code.slice(lastIndex)), keywords);
  return result;
}
function renderCodeBlock(code, lang) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "background:#f0f0f0;border-radius:10px;overflow:hidden;margin:10px 0;border:1px solid #ddd;";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#e6e6e6;font-family:monospace;font-size:0.85em;color:#555;";
  const label = document.createElement("span");
  label.textContent = lang || "code";
  bar.appendChild(label);
  const btn = document.createElement("button");
  btn.textContent = "Copy";
  btn.style.cssText = "background:none;border:none;color:#555;cursor:pointer;font-size:0.85em;padding:2px 6px;border-radius:4px;";
  btn.addEventListener("click", () => {
    copyText(code.trim());
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy"; }, 1500);
  });
  bar.appendChild(btn);
  wrap.appendChild(bar);
  const pre = document.createElement("pre");
  pre.style.cssText = "margin:0;padding:14px;overflow-x:auto;font-family:monospace;font-size:0.9em;color:#333;background:#f7f7f7;";
  pre.innerHTML = highlightCode(code.trim(), (lang || "").toLowerCase());
  wrap.appendChild(pre);
  return wrap;
}

function renderMarkdown(container, text) {
  const regex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before.trim()) container.appendChild(renderTextBlock(before));
    container.appendChild(renderCodeBlock(match[2], match[1]));
    lastIndex = regex.lastIndex;
  }
  const rest = text.slice(lastIndex);
  if (rest.trim()) container.appendChild(renderTextBlock(rest));
}
//===============================

document.documentElement.style.height = "auto";
document.documentElement.style.overflow = "auto";
document.body.style.height = "auto";
document.body.style.overflow = "auto";

const messagesContainer = document.createElement("div");
messagesContainer.id = "chatMessages";
messagesContainer.style.display = "flex";
messagesContainer.style.flexDirection = "column";
messagesContainer.style.gap = "16px";
messagesContainer.style.padding = "10px 2px";
messagesContainer.style.paddingBottom = "220px";
inputArea.parentNode.insertBefore(messagesContainer, inputArea);

const heroSection = document.getElementById("heroSection");
let heroOn = true;
function syncHero() {
  const hasChat = messagesContainer.children.length > 0;
  heroSection.classList.toggle("heroHidden", hasChat);
  if (hasChat && heroOn) { heroOrb.stop(); heroOn = false; }
  else if (!hasChat && !heroOn) { heroOrb.start(); heroOn = true; }
}
new MutationObserver(syncHero).observe(messagesContainer, { childList: true });

let history = [];

function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.style.whiteSpace = "pre-wrap";
  msg.style.wordWrap = "break-word";
  msg.style.lineHeight = "1.5";

  if (role === "user") {
    msg.style.width = "70%";
    msg.style.alignSelf = "flex-end";
    msg.style.backgroundColor = "#FAEBD7";
    msg.style.padding = "5px 7px"//"10px 14px";
    msg.style.borderRadius = "14px";
    msg.style.color = "#333";
  } else {
    msg.style.width = "100%";
    msg.style.alignSelf = "flex-start";
    msg.style.backgroundColor = "transparent";
    msg.style.padding = "4px 2px";
    msg.style.color = "#333";
  }
  
  msg.classList.add(role === "user" ? "user-message" : "ai-message");
  if (role === "user") attachLongPress(msg);
  msg.textContent = text;
  messagesContainer.appendChild(msg);
  window.scrollTo(0, document.body.scrollHeight);
  return msg;
}
function addMessageActions(container, fullText) {
  const row = document.createElement("div");
  row.className = "msgActions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "msgActionBtn";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    copyText(fullText);
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
  });

  const regenBtn = document.createElement("button");
  regenBtn.className = "msgActionBtn";
  regenBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" style="margin-right:6px;"><path d="M4 4v6h6" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20v-6h-6" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 10a8 8 0 00-14.5-4.5M4 14a8 8 0 0014.5 4.5" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Regenerate';
  regenBtn.addEventListener("click", regenerateResponse);

  const playIcon = '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z" fill="#555"/></svg>';
  const pauseIcon = '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="#555"/><rect x="14" y="4" width="4" height="16" fill="#555"/></svg>';

  const playBtn = document.createElement("button");
  playBtn.className = "msgActionBtn";
  playBtn.innerHTML = playIcon;

  let audioEl = null;
  let isPlaying = false;

  function resetToPlayIcon() {
    isPlaying = false;
    playBtn.innerHTML = playIcon;
  }

playBtn.addEventListener("click", async () => {
    if (isPlaying) {
      audioEl.pause();
      resetToPlayIcon();
      activeTTS = null;
      return;
    }

    if (activeTTS) {
      activeTTS.audio.pause();
      activeTTS.reset();
    }

    if (!audioEl) {
      playBtn.disabled = true;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: speechText(fullText),
            voice: selectedVoice
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        audioEl = new Audio(objectUrl);
        audioEl.addEventListener("ended", resetToPlayIcon);
        
      } catch (err) {
        playBtn.disabled = false;
        showAppWarning(`Voice error: ${err.message}`);
        return;
      }
      playBtn.disabled = false;
    }

    audioEl.play().catch(() => { resetToPlayIcon(); showAppWarning("Couldn't play audio."); });
    isPlaying = true;
    playBtn.innerHTML = pauseIcon;
    activeTTS = { audio: audioEl, reset: resetToPlayIcon };
  });

  row.appendChild(copyBtn);
  row.appendChild(regenBtn);
  row.appendChild(playBtn);
  container.appendChild(row);
}
function extractImagePrompt(text) {
  const match = text.match(/IMAGE_PROMPT:\s*(.+)/i);
  if (!match) return { cleanText: text, imagePrompt: null };
  const imagePrompt = match[1].trim();
  const cleanText = text.replace(match[0], "").trim();
  return { cleanText, imagePrompt };
}

function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function openImageFullscreen(imgUrl, altText) {
  const overlay = document.createElement("div");
  overlay.id = "imageFullscreenOverlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const closeBtn = document.createElement("button");
  closeBtn.className = "imageFullscreenClose";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());

  const img = document.createElement("img");
  img.src = imgUrl;
  img.alt = altText;
  img.className = "imageFullscreenImg";

  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

function renderImageBlock(promptText, container, attempt = 0) {
  container.innerHTML = "";
  const seed = hashSeed(promptText);
  const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=768&height=768&nologo=true&seed=${seed}${attempt ? "&r=" + attempt : ""}`;

  const img = document.createElement("img");
  img.src = imgUrl;
  img.alt = promptText;
  img.loading = "lazy";
  img.style.cssText = "width:100%;max-width:100%;border-radius:12px;display:block;cursor:pointer;";
  img.addEventListener("click", () => openImageFullscreen(imgUrl, promptText));
  img.addEventListener("error", () => {
    container.textContent = "Image couldn't be generated. ";
    const rb = document.createElement("button");
    rb.className = "msgActionBtn"; rb.textContent = "Retry";
    rb.addEventListener("click", () => renderImageBlock(promptText, container, attempt + 1));
    container.appendChild(rb);
  });
  container.appendChild(img);

  const actionsRow = document.createElement("div");
  actionsRow.className = "imageActionsRow";

  const downloadLink = document.createElement("a");
  downloadLink.href = imgUrl;
  downloadLink.target = "_blank";
  downloadLink.rel = "noopener";
  downloadLink.className = "imageDownloadBtn";
  downloadLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try { const r = await fetch(imgUrl); triggerBlobDownload(await r.blob(), "vigo-image.png"); }
    catch { window.open(imgUrl, "_blank"); }
  });
  downloadLink.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Save';
  actionsRow.appendChild(downloadLink);
  container.appendChild(actionsRow);
}

function extractClarifyQuestion(text) {
  const match = text.match(/CLARIFY_QUESTION:\s*(\{.*\})/i);
  if (!match) return { cleanText: text, clarify: null };
  let clarify = null;
  try { clarify = JSON.parse(match[1]); } catch { clarify = null; }
  const replacement = clarify && clarify.question ? clarify.question : "";
  const cleanText = text.replace(match[0], replacement).trim();
  return { cleanText, clarify };
}
  
  function createLongTextCard(text) {
  const card = document.createElement("div");
  card.className = "longTextCard";
  card.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" stroke="#888" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M9 13h6M9 17h6M9 9h2" stroke="#888" stroke-width="1.5" stroke-linecap="round"/></svg><span class="longTextCardBadge">' + text.length + '</span>';
  card.addEventListener("click", () => openLongTextModal(text));
  return card;
}

function addLongTextCardToPreview(text) {
  const wrap = document.createElement("div");
  wrap.className = "longTextCardWrap";
  const card = createLongTextCard(text);
  const removeBtn = document.createElement("button");
  removeBtn.className = "attachRemoveBtn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pendingLongTexts = pendingLongTexts.filter(t => t !== text);
    wrap.remove();
  });
  wrap.appendChild(card);
  wrap.appendChild(removeBtn);
  attachPreview.insertBefore(wrap, attachPreview.firstChild);
}

function openLongTextModal(text) {
  const overlay = document.createElement("div");
  overlay.id = "longTextOverlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const box = document.createElement("div");
  box.className = "longTextModalBox";

  const closeBtn = document.createElement("button");
  closeBtn.className = "clarifyClose";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());

  const pre = document.createElement("pre");
  pre.className = "longTextModalContent";
  pre.textContent = text;

  box.appendChild(closeBtn);
  box.appendChild(pre);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function closeClarifyModal() {
  const overlay = document.getElementById("clarifyOverlay");
  if (overlay) overlay.remove();
}

function renderClarifyCard(clarify) {
  const overlay = document.createElement("div");
  overlay.id = "clarifyOverlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeClarifyModal();
  });

  const card = document.createElement("div");
  card.className = "clarifyCard";

  const header = document.createElement("div");
  header.className = "clarifyHeader";
  const q = document.createElement("span");
  q.textContent = clarify.question;


  const closeBtn = document.createElement("button");
  closeBtn.className = "clarifyClose";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeClarifyModal);
  header.appendChild(q);
  header.appendChild(closeBtn);
  card.appendChild(header);

  (clarify.options || []).forEach((opt, i) => {
    const optBtn = document.createElement("button");
    optBtn.className = "clarifyOption";
    const num = document.createElement("span");
    num.className = "clarifyOptionNum";
    num.textContent = i + 1;
    const label = document.createElement("span");
    label.textContent = opt;
    optBtn.appendChild(num);
    optBtn.appendChild(label);
    optBtn.addEventListener("click", () => {
      closeClarifyModal();
      chatInput.value = opt;
      sendMessage();
    });
    card.appendChild(optBtn);
  });

  const inputRow = document.createElement("div");
  inputRow.className = "clarifyInputRow";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type your own answer...";
  const submitBtn = document.createElement("button");
  submitBtn.className = "clarifySendBtn";
  submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function submitCustom() {
    const val = input.value.trim();
    if (!val) return;
    closeClarifyModal();
    chatInput.value = val;
    sendMessage();
  }
  submitBtn.addEventListener("click", submitCustom);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitCustom(); });
  inputRow.appendChild(input);
  inputRow.appendChild(submitBtn);
  card.appendChild(inputRow);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function statusIcon(name) {
  const icons = {
    thinking: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.4 1 .8 1 1.3h6c0-.5.4-.9 1-1.3A7 7 0 0 0 12 2z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    researching: '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    coding: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    answering: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
    done: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 12l5 5 9-9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  return icons[name] || "";
}

function summarizeThoughtToBullets(thoughtText) {
  if (!thoughtText || !thoughtText.trim()) return ["No detailed reasoning was returned for this response."];
  const chunks = thoughtText.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 20);
  const bullets = chunks.slice(0, 4).map(chunk => {
    const firstSentence = chunk.split(/(?<=[.!?])\s/)[0];
    return firstSentence.length > 110 ? firstSentence.slice(0, 110).trim() + "..." : firstSentence;
  });
  return bullets.length ? bullets : [thoughtText.slice(0, 110)];
}

function openSummarySheet(bullets) {
  const overlay = document.createElement("div");
  overlay.id = "summaryOverlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const sheet = document.createElement("div");
  sheet.className = "summarySheet";

  const header = document.createElement("div");
  header.className = "summarySheetHeader";
  const closeBtn = document.createElement("button");
  closeBtn.className = "clarifyClose";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  const title = document.createElement("strong");
  title.textContent = "Summary";
  header.appendChild(closeBtn);
  header.appendChild(title);
  sheet.appendChild(header);

  bullets.forEach((text, i) => {
    const item = document.createElement("div");
    item.className = "summaryItem";
    const dot = document.createElement("span");
    dot.className = "summaryDot";
    const label = document.createElement("span");
    label.textContent = text;
    item.appendChild(dot);
    item.appendChild(label);
    sheet.appendChild(item);
  });

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

function createStatusIndicator() {
  const wrap = document.createElement("div");
  wrap.className = "statusIndicatorWrap";

  const pill = document.createElement("button");
  pill.className = "statusPill";
  let currentBullets = [];

  pill.addEventListener("click", () => openSummarySheet(currentBullets));

  wrap.appendChild(pill);

  function setStage(iconName, label) {
    pill.innerHTML = `<span class="statusIcon">${statusIcon(iconName)}</span><span>${label}</span>`;
  }

  function setBullets(bullets) {
    currentBullets = bullets;
  }

  function finish() {
    setTimeout(() => {
      wrap.style.opacity = "0";
      setTimeout(() => wrap.remove(), 400);
    }, 1200);
  }

  return { el: wrap, setStage, setBullets, finish };
}

function isNearBottom() {
  return (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 150);
}
function extractCodeProject(text) {
  const match = text.match(/===CODE_PROJECT===([\s\S]*?)===END_CODE_PROJECT===/);
  if (!match) return { cleanText: text, project: null };
  const block = match[1];
  const titleMatch = block.match(/TITLE:\s*(.+)/);
  const langMatch = block.match(/LANGUAGE:\s*(.+)/);
  const fileRegex = /===FILE:\s*(.+?)===([\s\S]*?)===ENDFILE===/g;
  const files = [];
  let fileMatch;
  while ((fileMatch = fileRegex.exec(block)) !== null) {
    files.push({ name: fileMatch[1].trim(), content: fileMatch[2].trim() });
  }
  const project = {
    title: titleMatch ? titleMatch[1].trim() : "Code Project",
    language: langMatch ? langMatch[1].trim() : "text",
    files
  };
  const cleanText = text.replace(match[0], "").trim();
  return { cleanText, project };
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openCodeProjectModal(project) {
  const overlay = document.createElement("div");
  overlay.id = "codeProjectOverlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const box = document.createElement("div");
  box.className = "codeProjectModalBox";

  const header = document.createElement("div");
  header.className = "codeProjectModalHeader";
  const titleEl = document.createElement("strong");
  titleEl.textContent = project.title;
  const closeBtn = document.createElement("button");
  closeBtn.className = "clarifyClose";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  box.appendChild(header);

  const tabs = document.createElement("div");
  tabs.className = "codeProjectTabs";
  const body = document.createElement("div");
  body.className = "codeProjectBody";

  function showFile(file) {
    body.innerHTML = "";
    const pre = document.createElement("pre");
    pre.className = "codeProjectPre";
    pre.innerHTML = highlightCode(file.content, project.language.toLowerCase());
    body.appendChild(pre);
  }

  project.files.forEach((file, i) => {
    const tab = document.createElement("button");
    tab.className = "codeProjectTab" + (i === 0 ? " active" : "");
    tab.textContent = file.name;
    tab.addEventListener("click", () => {
      tabs.querySelectorAll(".codeProjectTab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      showFile(file);
    });
    tabs.appendChild(tab);
  });
  box.appendChild(tabs);
  box.appendChild(body);
  if (project.files[0]) showFile(project.files[0]);

  const actions = document.createElement("div");
  actions.className = "codeProjectActions";
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "msgActionBtn";
  downloadBtn.textContent = project.files.length > 1 ? "Prepare ZIP" : "Prepare Download";
  downloadBtn.addEventListener("click", async () => {
    downloadBtn.textContent = "Preparing...";
    downloadBtn.disabled = true;
    try {
      let blob, filename;
      if (project.files.length > 1) {
        if (typeof JSZip === "undefined") throw new Error("JSZip didn't load");
        const zip = new JSZip();
        project.files.forEach(f => zip.file(f.name, f.content));
        blob = await zip.generateAsync({ type: "blob" });
        filename = project.title.replace(/\s+/g, "-").toLowerCase() + ".zip";
      } else {
        blob = new Blob([project.files[0].content], { type: "text/plain" });
        filename = project.files[0].name;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.className = "msgActionBtn";
      link.textContent = "Tap to save " + filename;
      downloadBtn.replaceWith(link);
    } catch (err) {
      showAppWarning("Download failed: " + err.message);
      downloadBtn.textContent = project.files.length > 1 ? "Prepare ZIP" : "Prepare Download";
      downloadBtn.disabled = false;
    }
  });
  actions.appendChild(downloadBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function renderCodeProjectCard(project, container) {
  const card = document.createElement("div");
  card.className = "codeProjectCard";
  const iconBox = document.createElement("div");
  iconBox.className = "codeProjectIconBox";
  iconBox.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" stroke="#E85D3D" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const textWrap = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.className = "codeProjectTitle";
  titleEl.textContent = project.title;
  const subEl = document.createElement("div");
  subEl.className = "codeProjectSub";
  subEl.textContent = project.files.length > 1
    ? `${project.files.length} files · ZIP`
    : `Code · ${project.language.toUpperCase()}`;
  textWrap.appendChild(titleEl);
  textWrap.appendChild(subEl);
  card.appendChild(iconBox);
  card.appendChild(textWrap);
  card.addEventListener("click", () => openCodeProjectModal(project));
  container.appendChild(card);
}

// ---------- WEB SEARCH ----------
const SEARCH_NOTE = "\nWEB SEARCH: A user message may start with WEB SEARCH RESULTS retrieved by the app. Treat them as current information, cite them as [1], [2], and never repeat the results block itself.";

function needsSearch(t) {
  if (webSearchMode === "off") return false;
  if (webSearchMode === "on") return true;
  return /\b(latest|current|currently|today|tonight|yesterday|this (week|month|year)|news|recent|right now|price of|stock|weather|score|who won|release date|202[5-9]|search|look up|google)\b/i.test(t);
}
async function webSearch(q, signal) {
  const r = await fetch("/api/search?q=" + encodeURIComponent(q), { signal });
  if (!r.ok) throw new Error("Search failed (" + r.status + ")");
  return await r.json();
}
function sourcesMarkdown(list) {
  return "\n\n**Sources:** " + list.map((s, i) => {
    let host = "";
    try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch {}
    return `[${i + 1} ${host}](${s.url.replace(/\)/g, "%29").replace(/\s/g, "%20")})`;
  }).join(" · ");
}
async function fetchWithRetry(url, opts, tries = 3) {
  for (let n = 0; ; n++) {
    let res = null;
    try { res = await fetch(url, opts); }
    catch (e) { if (e.name === "AbortError" || n >= tries - 1) throw e; }
    if (res && ![429, 500, 502, 503, 504].includes(res.status)) return res;
    if (n >= tries - 1) { if (res) return res; throw new Error("Network error. Check your connection."); }
    await new Promise((ok, no) => {
      const t = setTimeout(ok, 1000 * 2 ** n);
      opts.signal?.addEventListener("abort", () => { clearTimeout(t); no(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
  }
}
function friendlyError(status, msg) {
  if (status === 429) return "Rate limit reached. Wait a minute and try again.";
  if (status === 403) return "Access denied by the server. Check ALLOWED_ORIGIN.";
  if (status === 503) return "Gemini is overloaded right now. Try again shortly.";
  return msg || `HTTP ${status}`;
}
function parseAiText(raw) {
  const a = extractCodeProject(raw), b = extractImagePrompt(a.cleanText), c = extractClarifyQuestion(b.cleanText);
  return { cleanText: c.cleanText, project: a.project, imagePrompt: b.imagePrompt, clarify: c.clarify };
}
function copyText(t) {
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).catch(() => fallbackCopy(t)); }
  else fallbackCopy(t);
}
function fallbackCopy(t) {
  const a = document.createElement("textarea");
  a.value = t; a.style.cssText = "position:fixed;opacity:0;";
  document.body.appendChild(a); a.select();
  try { document.execCommand("copy"); } catch { showAppWarning("Copy failed."); }
  a.remove();
}
function speechText(t) {
  return t.replace(/```[\s\S]*?```/g, " code block omitted. ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]*)`/g, "$1")
    .replace(/[*_#>~|]/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim().slice(0, 3000);
}
async function runGeneration(promptText, userEl) {
  const modelId = MODEL_MAP[modelSelect.value] || "gemini-2.5-flash";
  const url = `/api/chat?model=${modelId}`;

const userParts = [{ text: promptText }];
  if (pendingImage) {
    userParts.push({ inline_data: pendingImage });
    pendingImage = null;
  }
  pendingLongTexts = [];
  attachPreview.innerHTML = "";
  history.push({ role: "user", parts: userParts });
 

  const thinkingMsg = appendMessage("ai", "");
  const streamTarget = document.createElement("div");
  streamTarget.style.whiteSpace = "pre-wrap";
  thinkingMsg.appendChild(streamTarget);

  const { visualizer, canvasEl } = createVisualizer();
  let statusIndicator = null;
  if (agenticMode) {
    statusIndicator = createStatusIndicator();
    statusIndicator.setStage("thinking", "Thinking...");
    thinkingMsg.appendChild(statusIndicator.el);
  }
  thinkingMsg.appendChild(visualizer);
  startVigoFlow(canvasEl, visualizer);

  isGenerating = true;
  sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="#333"/></svg>';
  currentAbortController = new AbortController();

  try {
    let searchSources = [];
    let contentsForModel = history;
    if (needsSearch(promptText)) {
      if (statusIndicator) statusIndicator.setStage("researching", "Searching the web...");
      streamTarget.textContent = "Searching the web...";
      try {
        searchSources = await webSearch(promptText.slice(0, 200), currentAbortController.signal);
      } catch (e) {
        if (e.name === "AbortError") throw e;
        showAppWarning("Web search unavailable, answering without it.");
      }
      if (searchSources.length) {
        const lines = searchSources.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet} (${s.url})`).join("\n");
        const augmented = `WEB SEARCH RESULTS (retrieved ${new Date().toDateString()}):\n${lines}\n\nUSER MESSAGE: ${promptText}`;
        const last = history[history.length - 1];
        contentsForModel = history.slice(0, -1).concat({ role: "user", parts: [{ text: augmented }, ...last.parts.slice(1)] });
      }
    }
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT + "\nCURRENT DATE/TIME: " + new Date().toString() + SEARCH_NOTE }] },
        contents: contentsForModel,
        generationConfig: buildGenConfig()
      }),
      signal: currentAbortController.signal
    });

const data = await response.json();

    if (!response.ok) {
      throw new Error(friendlyError(response.status, data?.error?.message));
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const thoughtParts = parts.filter(p => p.thought);
    const answerParts = parts.filter(p => !p.thought);
    let text = answerParts.map(p => p.text || "").join("");
    if (text && searchSources.length) text += sourcesMarkdown(searchSources);

    if (statusIndicator) {
      const thoughtText = thoughtParts.map(p => p.text || "").join("\n\n");
      statusIndicator.setBullets(summarizeThoughtToBullets(thoughtText));
      statusIndicator.setStage("answering", "Answering...");
    }

    const hasStructure = /```/.test(text) || /\|.*\|[\s\S]*?\n\s*\|?\s*:?-{2,}/.test(text) || /CLARIFY_QUESTION:|===CODE_PROJECT===|IMAGE_PROMPT:/i.test(text);

    if (!text) {
      stopVigoFlow(visualizer);
      const reason = data?.candidates?.[0]?.finishReason;
      thinkingMsg.remove();
      if (userEl) userEl.remove();
      history.pop();
      chatInput.value = promptText;
      showAppWarning(reason ? `No response (reason: ${reason})` : "No response received.");
      return;
    }

if (!hasStructure) {
      await new Promise((resolve, reject) => {
        let i = 0;
        const chunkSize = 8;
        function revealNext() {
          if (currentAbortController.signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
          i += chunkSize;
          streamTarget.innerHTML = "";
          streamTarget.appendChild(renderTextBlock(text.slice(0, i)));
          if (isNearBottom()) window.scrollTo(0, document.body.scrollHeight);
          if (i < text.length) {
            setTimeout(() => requestAnimationFrame(revealNext), 12);
          } else {
            resolve();
          }
        }
        revealNext();
      });
    }

    const { cleanText: afterCode, project } = extractCodeProject(text);
    const { cleanText: afterImage, imagePrompt } = extractImagePrompt(afterCode);
    const { cleanText, clarify } = extractClarifyQuestion(afterImage);
    thinkingMsg.innerHTML = "";
    renderMarkdown(thinkingMsg, cleanText);
    if (project) {
      renderCodeProjectCard(project, thinkingMsg);
    }
    if (imagePrompt) {
      const imgBox = document.createElement("div");
      imgBox.style.cssText = "margin:10px 0;";
      thinkingMsg.appendChild(imgBox);
      renderImageBlock(imagePrompt, imgBox);
    }
    if (clarify) {
      renderClarifyCard(clarify);
    }
    addMessageActions(thinkingMsg, cleanText);
    if (statusIndicator) {
      statusIndicator.setStage("done", "Done thinking");
      statusIndicator.finish();
    }
    freezeVigoFlow();
    const visualizerRow = document.createElement("div");
    visualizerRow.className = "visualizerRow";
    visualizerRow.appendChild(visualizer);
    if (imagePrompt) {
      const notice = document.createElement("span");
      notice.className = "imageNotice";
      notice.textContent = "This image won't be kept if you close the app — save it now to keep it.";
      visualizerRow.appendChild(notice);
    }
    thinkingMsg.appendChild(visualizerRow);
    history.push({ role: "model", parts: [{ text }] });
    if (isNearBottom()) window.scrollTo(0, document.body.scrollHeight);
    saveCurrentSession(promptText, cleanText);

  } catch (err) {
    stopVigoFlow(visualizer);
    thinkingMsg.remove();
    if (userEl) userEl.remove();
    history.pop();
    chatInput.value = promptText;
    chatInput.dispatchEvent(new Event("input"));
    if (err.name !== "AbortError") showAppWarning(err.message);
  } finally {
    isGenerating = false;
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#333" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    currentAbortController = null;
  }
}
function editUserMessage(msgEl) {
  const allMessages = Array.from(messagesContainer.children);
  const idx = allMessages.indexOf(msgEl);
  if (idx === -1 || !history[idx]) return;
  const originalText = history[idx].parts[0].text;
  history = history.slice(0, idx);
  Object.keys(currentImages).forEach(key => {
    if (Number(key) >= idx) delete currentImages[key];
  });
  for (let i = allMessages.length - 1; i >= idx; i--) {
    allMessages[i].remove();
  }
  chatInput.value = originalText;
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  chatInput.focus();
  saveCurrentSession("", "");
}

function showMessageContextMenu(msgEl, x, y) {
  document.querySelectorAll(".msgContextMenu").forEach(m => m.remove());

  const menu = document.createElement("div");
  menu.className = "msgContextMenu";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    copyText(msgEl.textContent);
    menu.remove();
  });

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => {
    editUserMessage(msgEl);
    menu.remove();
  });

  menu.appendChild(copyBtn);
  menu.appendChild(editBtn);
  document.body.appendChild(menu);

  const menuRect = menu.getBoundingClientRect();
  let left = x - menuRect.width / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - menuRect.width - 10));
  menu.style.left = left + "px";
  menu.style.top = (y - menuRect.height - 10) + "px";

  setTimeout(() => {
    document.addEventListener("click", function closeOnce(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeOnce);
      }
    });
  }, 0);
}

function attachLongPress(el) {
  let pressTimer;
  let longPressFired = false;
  el.addEventListener("touchstart", (e) => {
    longPressFired = false;
    const touch = e.touches[0];
    pressTimer = setTimeout(() => {
      longPressFired = true;
      showMessageContextMenu(el, touch.clientX, touch.clientY);
    }, 500);
  });
  el.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);
    if (longPressFired) {
      e.preventDefault();
    }
  });
  el.addEventListener("touchmove", () => clearTimeout(pressTimer));
}

async function sendMessage() {
  if (isGenerating) {
    if (currentAbortController) currentAbortController.abort();
    return;
  }

  const caption = chatInput.value.trim();
  const longTexts = pendingLongTexts.slice();
  const promptForModel = longTexts.length
    ? (caption ? caption + "\n\n" + longTexts.join("\n\n") : longTexts.join("\n\n"))
    : caption;

  if (!promptForModel) return;

  if (!navigator.onLine) { showAppWarning("You are offline."); return; }
  flowRunning = false;
  cancelAnimationFrame(flowAnimationId);
  document.querySelectorAll(".visualizer").forEach(v => v.remove());
  document.querySelectorAll(".imageNotice").forEach(n => n.remove());

  const attachedImage = pendingImage;
  const userMsg = appendMessage("user", caption);
  if (attachedImage) {
    const thumb = document.createElement("img");
    thumb.src = `data:${attachedImage.mimeType};base64,${attachedImage.data}`;
    thumb.style.cssText = "max-width:180px;border-radius:10px;display:block;margin-bottom:8px;";
    userMsg.prepend(thumb);
  }
  longTexts.slice().reverse().forEach(t => userMsg.prepend(createLongTextCard(t)));

  chatInput.value = "";
  chatInput.style.height = "auto";

  await runGeneration(promptForModel, userMsg);
}


async function regenerateResponse() {
  if (isGenerating) return;
  let lastUserIndex = history.length - 1;
  while (lastUserIndex >= 0 && history[lastUserIndex].role !== "user") lastUserIndex--;
  if (lastUserIndex < 0) return;
  const lastUserText = history[lastUserIndex].parts[0].text;
  history = history.slice(0, lastUserIndex);
  const aiEls = messagesContainer.querySelectorAll(":scope > .ai-message");
  if (aiEls.length) aiEls[aiEls.length - 1].remove();
  const userEls = messagesContainer.querySelectorAll(":scope > .user-message");
  await runGeneration(lastUserText, userEls[userEls.length - 1]);
}

sendBtn.addEventListener("click", sendMessage);
document.addEventListener("click", (e) => {
  document.querySelectorAll(".msgMenu.open").forEach(menu => {
    if (!menu.parentElement.contains(e.target)) menu.classList.remove("open");
  });
});
chatInput.addEventListener("paste", (e) => {
  const t = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  if (t.length > LONG_TEXT_THRESHOLD) { e.preventDefault(); pendingLongTexts.push(t); addLongTextCardToPreview(t); }
});
chatInput.addEventListener("keydown", (e) => {
  const desktop = !window.matchMedia("(pointer: coarse)").matches;
  if (e.key === "Enter" && !e.isComposing && (e.ctrlKey || e.metaKey || (desktop && !e.shiftKey))) {
    e.preventDefault();
    sendMessage();
  }
});