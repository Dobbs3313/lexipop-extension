(() => {
  const HOST_ID = "lexipop-bubble-host";
  let prefs = { dblClickEnabled: true, requireAlt: false, fontSize: 14, bubbleTheme: "dark" };

  chrome.storage.local.get("lp_prefs", ({ lp_prefs }) => {
    if (lp_prefs) prefs = { ...prefs, ...lp_prefs };
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.lp_prefs?.newValue) {
      prefs = { ...prefs, ...changes.lp_prefs.newValue };
    }
  });

  function removeBubble() {
    document.getElementById(HOST_ID)?.remove();
  }

  function speak(entry) {
    if (entry.audio) {
      const a = new Audio(entry.audio);
      a.play().catch(() => {
        if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance(entry.word));
      });
    } else if (window.speechSynthesis) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(entry.word));
    }
  }

  function renderBubble(x, y, state) {
    removeBubble();
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.left = `${Math.min(Math.max(12, x), window.innerWidth - 340)}px`;
    host.style.top = `${Math.min(Math.max(12, y + 14), window.innerHeight - 260)}px`;

    const shadow = host.attachShadow({ mode: "open" });
    const dark = prefs.bubbleTheme !== "light";
    const fs = Number(prefs.fontSize || 14);

    const style = document.createElement("style");
    style.textContent = `
      .card {
        width: 320px; max-height: 280px; overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: ${fs}px; line-height: 1.45;
        background: ${dark ? "#0f172a" : "#ffffff"};
        color: ${dark ? "#f8fafc" : "#0f172a"};
        border: 1px solid ${dark ? "rgba(56,189,248,0.4)" : "#cbd5e1"};
        border-radius: 12px; padding: 12px 14px;
        box-shadow: 0 14px 36px rgba(0,0,0,0.35);
      }
      .hdr { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
      .word { font-weight:800; font-size: ${fs + 3}px; }
      .phon { color: #38bdf8; font-size: ${Math.max(11, fs - 1)}px; margin-left:6px; }
      .acts { display:flex; gap:5px; }
      button {
        border: 1px solid ${dark ? "rgba(148,163,184,0.3)" : "#cbd5e1"};
        background: ${dark ? "#1e293b" : "#f1f5f9"};
        color: ${dark ? "#f8fafc" : "#0f172a"};
        border-radius: 6px; padding: 3px 7px; font-size: 11px; cursor: pointer;
      }
      button:hover { border-color: #38bdf8; }
      .pos { color: #38bdf8; font-weight:700; font-style: italic; font-size: ${Math.max(11, fs - 2)}px; margin-top:7px; }
      .def { margin: 3px 0; }
      .ex { color: ${dark ? "#94a3b8" : "#475569"}; font-size: ${Math.max(11, fs - 1)}px; font-style: italic; margin-left:8px; }
      .syns { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
      .syn { font-size: 11px; padding: 2px 6px; border-radius:999px; background: rgba(56,189,248,0.14); color:#38bdf8; cursor:pointer; }
      .msg { color: ${dark ? "#94a3b8" : "#475569"}; }
    `;

    const card = document.createElement("div");
    card.className = "card";

    if (state.loading) {
      card.innerHTML = `<div class="msg">Looking up <strong>${state.word}</strong>...</div>`;
    } else if (!state.ok) {
      card.innerHTML = `<div class="hdr"><span class="word">${state.word}</span><button id="closeBtn">✕</button></div><div class="msg">${state.error}</div>`;
    } else {
      const e = state.entry;
      const meaningsHtml = (e.meanings || []).map(m => `
        <div class="pos">${m.partOfSpeech}</div>
        ${(m.definitions || []).map(d => `
          <div class="def">• ${d.definition}</div>
          ${d.example ? `<div class="ex">"${d.example}"</div>` : ""}
        `).join("")}
        ${m.synonyms?.length ? `<div class="syns">${m.synonyms.map(s => `<span class="syn" data-syn="${s}">${s}</span>`).join("")}</div>` : ""}
      `).join("");

      card.innerHTML = `
        <div class="hdr">
          <div><span class="word">${e.word}</span><span class="phon">${e.phonetic || ""}</span></div>
          <div class="acts">
            <button id="audioBtn" title="Pronounce">🔊</button>
            <button id="saveBtn" title="Save to Wordbook">★</button>
            <button id="closeBtn" title="Close">✕</button>
          </div>
        </div>
        ${meaningsHtml}
      `;
    }

    shadow.append(style, card);
    document.documentElement.appendChild(host);

    shadow.getElementById("closeBtn")?.addEventListener("click", removeBubble);
    shadow.getElementById("audioBtn")?.addEventListener("click", () => speak(state.entry));
    shadow.getElementById("saveBtn")?.addEventListener("click", (ev) => {
      chrome.runtime.sendMessage({ type: "LEXIPOP_SAVE_WORD", entry: state.entry }, (res) => {
        ev.target.textContent = res?.ok ? "✓ Saved" : "Pro";
        if (!res?.ok && res?.error) ev.target.title = res.error;
      });
    });
    shadow.querySelectorAll("[data-syn]").forEach(el => {
      el.addEventListener("click", () => triggerLookup(el.getAttribute("data-syn"), x, y));
    });
  }

  function triggerLookup(word, x, y) {
    renderBubble(x, y, { loading: true, word });
    chrome.runtime.sendMessage({ type: "LEXIPOP_LOOKUP", word }, (res) => {
      if (chrome.runtime.lastError) return removeBubble();
      renderBubble(x, y, { word, ...(res || { ok: false, error: "Lookup unavailable." }) });
    });
  }

  document.addEventListener("dblclick", (ev) => {
    if (!prefs.dblClickEnabled) return;
    if (prefs.requireAlt && !ev.altKey) return;
    const tag = ev.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || ev.target?.isContentEditable) return;
    const sel = String(window.getSelection() || "").trim();
    if (!sel || /\s/.test(sel) || sel.length < 2) return;
    triggerLookup(sel, ev.clientX, ev.clientY);
  });

  document.addEventListener("mousedown", (ev) => {
    const host = document.getElementById(HOST_ID);
    if (host && !host.contains(ev.target)) removeBubble();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") removeBubble();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "LEXIPOP_SHOW_SELECTION" && msg.word) {
      triggerLookup(msg.word, window.innerWidth / 2 - 160, 80);
    }
  });
})();
