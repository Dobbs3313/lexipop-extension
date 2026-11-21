import { BillingManager } from "./lib/billing.js";
import { BILLING_CONFIG } from "./lib/billing-config.js";

const billing = new BillingManager(BILLING_CONFIG);
let prefs = { dblClickEnabled: true, requireAlt: false, fontSize: 14, bubbleTheme: "dark" };
let lastEntry = null;
let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
}

function renderResult(res) {
  const card = document.getElementById("resultCard");
  if (!res?.ok) {
    card.innerHTML = `<div class="muted">${res?.error || "Word not found."}</div>`;
    return;
  }
  const e = res.entry;
  lastEntry = e;
  const meanings = (e.meanings || []).map(m => `
    <div style="color:var(--accent);font-weight:700;font-size:11px;margin-top:6px;">${m.partOfSpeech}</div>
    ${(m.definitions || []).map(d => `<div style="margin:2px 0;">• ${d.definition}</div>${d.example ? `<div class="muted" style="font-style:italic;margin-left:8px;">"${d.example}"</div>` : ""}`).join("")}
  `).join("");
  card.innerHTML = `
    <div class="row">
      <div><strong style="font-size:16px;">${e.word}</strong> <span class="muted">${e.phonetic || ""}</span></div>
      <div style="display:flex;gap:5px;">
        <button class="btn btn-sm" id="popAudioBtn">🔊</button>
        <button class="btn btn-primary btn-sm" id="popSaveBtn">★ Save</button>
      </div>
    </div>
    ${meanings}
  `;
  document.getElementById("popAudioBtn").addEventListener("click", () => {
    if (e.audio) new Audio(e.audio).play().catch(() => speechSynthesis.speak(new SpeechSynthesisUtterance(e.word)));
    else speechSynthesis.speak(new SpeechSynthesisUtterance(e.word));
  });
  document.getElementById("popSaveBtn").addEventListener("click", async () => {
    const r = await chrome.runtime.sendMessage({ type: "LEXIPOP_SAVE_WORD", entry: e });
    if (r?.ok) {
      showToast(`Saved "${e.word}" to Wordbook.`);
      loadLists();
    } else {
      showToast(r?.error || "Upgrade to Pro for unlimited Wordbook.");
      switchTab("pro");
    }
  });
}

async function doLookup(word) {
  if (!word.trim()) return;
  document.getElementById("resultCard").innerHTML = `<div class="muted">Looking up "${word}"...</div>`;
  const res = await chrome.runtime.sendMessage({ type: "LEXIPOP_LOOKUP", word });
  renderResult(res);
  loadLists();
}

async function loadLists() {
  const { lp_history = [], lp_wordbook = [] } = await chrome.storage.local.get(["lp_history", "lp_wordbook"]);
  const hEl = document.getElementById("historyList");
  hEl.innerHTML = lp_history.length ? "" : `<div class="muted">No lookups yet.</div>`;
  for (const h of lp_history.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "list-item";
    row.style.cursor = "pointer";
    row.innerHTML = `<div class="list-item-main"><div style="font-weight:600;">${h.word} <span class="muted">${h.phonetic || ""}</span></div><div class="muted truncate">${h.summary || ""}</div></div>`;
    row.addEventListener("click", () => {
      document.getElementById("wordInput").value = h.word;
      doLookup(h.word);
    });
    hEl.appendChild(row);
  }

  document.getElementById("wbCount").textContent = String(lp_wordbook.length);
  const wbEl = document.getElementById("wordbookList");
  wbEl.innerHTML = lp_wordbook.length ? "" : `<div class="card muted" style="text-align:center;">Star any looked-up word to build your study Wordbook.</div>`;
  for (const w of lp_wordbook) {
    const row = document.createElement("div");
    row.className = "list-item";
    const def = w.meanings?.[0]?.definitions?.[0]?.definition || "";
    row.innerHTML = `
      <div class="list-item-main">
        <div style="font-weight:700;">${w.word} <span class="muted">${w.phonetic || ""}</span></div>
        <div class="muted truncate">${def}</div>
      </div>
      <button class="btn btn-danger btn-sm">✕</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      const next = lp_wordbook.filter(item => item.word !== w.word);
      await chrome.storage.local.set({ lp_wordbook: next });
      loadLists();
    });
    wbEl.appendChild(row);
  }
}

function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function init() {
  await billing.init();
  const { lp_prefs } = await chrome.storage.local.get("lp_prefs");
  if (lp_prefs) prefs = { ...prefs, ...lp_prefs };

  const syncTier = () => {
    const pill = document.getElementById("tierPill");
    pill.textContent = billing.isPro() ? "PRO" : "FREE";
    pill.classList.toggle("pro", billing.isPro());
  };
  syncTier();

  document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  document.getElementById("tierPill").addEventListener("click", () => switchTab("pro"));
  billing.mountProPanel(document.getElementById("panel-pro"), { onToast: showToast, onTierChange: syncTier });

  document.getElementById("searchBtn").addEventListener("click", () => doLookup(document.getElementById("wordInput").value));
  document.getElementById("wordInput").addEventListener("keydown", e => {
    if (e.key === "Enter") doLookup(e.target.value);
  });

  document.getElementById("dblClickToggle").checked = prefs.dblClickEnabled;
  document.getElementById("requireAltToggle").checked = prefs.requireAlt;
  document.getElementById("bubbleThemeSelect").value = prefs.bubbleTheme;
  document.getElementById("fontSizeRange").value = prefs.fontSize;
  document.getElementById("fontSizeVal").textContent = `${prefs.fontSize}px`;

  const savePrefs = () => chrome.storage.local.set({ lp_prefs: prefs });
  document.getElementById("dblClickToggle").addEventListener("change", e => { prefs.dblClickEnabled = e.target.checked; savePrefs(); });
  document.getElementById("requireAltToggle").addEventListener("change", e => { prefs.requireAlt = e.target.checked; savePrefs(); });
  document.getElementById("bubbleThemeSelect").addEventListener("change", e => { prefs.bubbleTheme = e.target.value; savePrefs(); });
  document.getElementById("fontSizeRange").addEventListener("input", e => {
    prefs.fontSize = Number(e.target.value);
    document.getElementById("fontSizeVal").textContent = `${prefs.fontSize}px`;
    savePrefs();
  });

  async function exportWordbook(fmt) {
    if (!billing.isPro()) {
      showToast("Wordbook export is a Pro feature.");
      return switchTab("pro");
    }
    const { lp_wordbook = [] } = await chrome.storage.local.get("lp_wordbook");
    if (!lp_wordbook.length) return showToast("Wordbook is empty.");
    if (fmt === "anki") {
      const lines = lp_wordbook.map(w => `${w.word}\t${(w.phonetic || "")} — ${(w.meanings?.[0]?.definitions?.[0]?.definition || "").replace(/\t/g, " ")}`);
      downloadFile("lexipop-anki.tsv", lines.join("\n"), "text/tab-separated-values");
    } else {
      const esc = s => `"${String(s || "").replace(/"/g, '""')}"`;
      const lines = ["Word,Phonetic,PartOfSpeech,Definition", ...lp_wordbook.map(w => [w.word, w.phonetic, w.meanings?.[0]?.partOfSpeech, w.meanings?.[0]?.definitions?.[0]?.definition].map(esc).join(","))];
      downloadFile("lexipop-wordbook.csv", lines.join("\n"), "text/csv");
    }
    showToast(`Exported ${lp_wordbook.length} words.`);
  }

  document.getElementById("exportAnkiBtn").addEventListener("click", () => exportWordbook("anki"));
  document.getElementById("exportCsvBtn").addEventListener("click", () => exportWordbook("csv"));

  await loadLists();
}

init();
