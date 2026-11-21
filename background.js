const DEFAULT_PREFS = {
  dblClickEnabled: true,
  requireAlt: false,
  fontSize: 14,
  bubbleTheme: "dark"
};

chrome.runtime.onInstalled.addListener(async () => {
  const { lp_prefs } = await chrome.storage.local.get("lp_prefs");
  if (!lp_prefs) await chrome.storage.local.set({ lp_prefs: DEFAULT_PREFS });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "lexipop-define",
      title: 'LexiPop: Define "%s"',
      contexts: ["selection"]
    });
  });
});

async function lookupWord(rawWord) {
  const word = String(rawWord || "").trim().toLowerCase().replace(/^[^a-zA-Z'-]+|[^a-zA-Z'-]+$/g, "");
  if (!word || word.length > 48) {
    return { ok: false, error: "Select a single valid word." };
  }

  const { lp_cache = {} } = await chrome.storage.local.get("lp_cache");
  if (lp_cache[word]) {
    await pushHistory(lp_cache[word]);
    return { ok: true, entry: lp_cache[word], cached: true };
  }

  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!resp.ok) {
      return { ok: false, error: `No definition found for "${word}".` };
    }
    const data = await resp.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return { ok: false, error: `No definition found for "${word}".` };

    const audioObj = (first.phonetics || []).find(p => p.audio);
    const phonetic = first.phonetic || (first.phonetics || []).find(p => p.text)?.text || "";
    const meanings = (first.meanings || []).slice(0, 3).map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions || []).slice(0, 2).map(d => ({
        definition: d.definition,
        example: d.example || ""
      })),
      synonyms: (m.synonyms || []).slice(0, 5)
    }));

    const entry = {
      word: first.word || word,
      phonetic,
      audio: audioObj?.audio || "",
      meanings,
      lookedUpAt: Date.now()
    };

    // Keep lightweight offline cache (max 120 words)
    const keys = Object.keys(lp_cache);
    if (keys.length >= 120) delete lp_cache[keys[0]];
    lp_cache[word] = entry;
    await chrome.storage.local.set({ lp_cache });
    await pushHistory(entry);
    return { ok: true, entry };
  } catch (err) {
    return { ok: false, error: `Lookup error: ${err.message}` };
  }
}

async function pushHistory(entry) {
  const { lp_history = [] } = await chrome.storage.local.get("lp_history");
  const filtered = lp_history.filter(h => h.word.toLowerCase() !== entry.word.toLowerCase());
  filtered.unshift({
    word: entry.word,
    phonetic: entry.phonetic,
    summary: entry.meanings?.[0]?.definitions?.[0]?.definition || "",
    at: Date.now()
  });
  await chrome.storage.local.set({ lp_history: filtered.slice(0, 25) });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "LEXIPOP_LOOKUP") {
    lookupWord(msg.word).then(sendResponse);
    return true;
  }
  if (msg?.type === "LEXIPOP_SAVE_WORD") {
    (async () => {
      const { lp_wordbook = [], aris_pro_lexipop } = await chrome.storage.local.get(["lp_wordbook", "aris_pro_lexipop"]);
      const isPro = aris_pro_lexipop?.tier === "pro";
      if (!isPro && lp_wordbook.length >= 25 && !lp_wordbook.some(w => w.word === msg.entry.word)) {
        sendResponse({ ok: false, error: "Free Wordbook holds 25 words. Upgrade to LexiPop Pro for unlimited saves." });
        return;
      }
      const next = [msg.entry, ...lp_wordbook.filter(w => w.word.toLowerCase() !== msg.entry.word.toLowerCase())];
      await chrome.storage.local.set({ lp_wordbook: next });
      sendResponse({ ok: true, count: next.length });
    })();
    return true;
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lexipop-define" && tab?.id && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { type: "LEXIPOP_SHOW_SELECTION", word: info.selectionText }).catch(() => {});
  }
});
