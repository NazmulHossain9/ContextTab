// ContextTab — Content Script

let myTabId = null;

async function getTabId() {
  if (myTabId) return myTabId;
  const res = await chrome.runtime.sendMessage({ type: 'GET_MY_TAB_ID' });
  myTabId = res?.tabId;
  return myTabId;
}

// ── "Why did I open this?" prompt ────────────────────────────────────────────

let whyPromptShown = false;

function showWhyPrompt() {
  if (whyPromptShown || document.getElementById('ct-why-prompt')) return;
  whyPromptShown = true;

  const el = document.createElement('div');
  el.id = 'ct-why-prompt';
  el.innerHTML = `
    <span class="ct-why-icon">🔖</span>
    <span class="ct-why-label">Why did you open this?</span>
    <input id="ct-why-input" type="text" placeholder="e.g. fix auth bug" maxlength="60" />
    <button id="ct-why-save">Save</button>
    <button id="ct-why-dismiss" title="Dismiss">✕</button>
  `;
  document.body.appendChild(el);

  const input = el.querySelector('#ct-why-input');
  input.focus();

  async function save() {
    const reason = input.value.trim();
    const tabId = await getTabId();
    if (tabId) {
      await chrome.runtime.sendMessage({ type: 'SAVE_TAB_REASON', tabId, reason });
    }
    el.remove();
  }

  el.querySelector('#ct-why-save').addEventListener('click', save);
  el.querySelector('#ct-why-dismiss').addEventListener('click', () => el.remove());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') el.remove();
  });

  setTimeout(() => {
    if (el.parentNode && !input.value) el.remove();
  }, 15000);
}

// ── Stack Overflow copy buttons ───────────────────────────────────────────────

function injectSOCopyButtons() {
  if (!location.hostname.includes('stackoverflow.com') && !location.hostname.includes('stackexchange.com')) return;

  const inject = (pre) => {
    if (pre.dataset.ctInjected) return;
    pre.dataset.ctInjected = '1';
    pre.style.position = 'relative';

    const btn = document.createElement('button');
    btn.className = 'ct-so-copy';
    btn.textContent = 'Copy';
    btn.title = 'Copy clean code (ContextTab)';

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.innerText ?? pre.innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('ct-copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ct-copied'); }, 2000);
      });
    });

    pre.appendChild(btn);
  };

  document.querySelectorAll('pre').forEach(inject);

  const obs = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'PRE') inject(n);
      n.querySelectorAll?.('pre').forEach(inject);
    }));
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// ── Inline notes ──────────────────────────────────────────────────────────────

let pendingNoteText = null;

function showNoteForm(selectedText) {
  document.getElementById('ct-note-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ct-note-overlay';

  const sel = window.getSelection();
  const range = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
  const top = range ? range.bottom + window.scrollY + 8 : window.scrollY + 100;
  const left = range ? Math.min(range.left + window.scrollX, window.innerWidth - 340) : 20;

  overlay.style.cssText = `top:${top}px;left:${Math.max(8, left)}px`;
  overlay.innerHTML = `
    <div class="ct-note-header">
      <span>📌 Add Note</span>
      <button class="ct-note-close">✕</button>
    </div>
    <div class="ct-note-snippet">${escapeHtml(selectedText.substring(0, 120))}${selectedText.length > 120 ? '…' : ''}</div>
    <textarea class="ct-note-text" placeholder="Your note…" rows="3"></textarea>
    <button class="ct-note-save">Save Note</button>
  `;
  document.body.appendChild(overlay);

  const textarea = overlay.querySelector('.ct-note-text');
  textarea.focus();

  overlay.querySelector('.ct-note-close').addEventListener('click', () => overlay.remove());

  overlay.querySelector('.ct-note-save').addEventListener('click', async () => {
    const note = textarea.value.trim();
    if (!note) return;
    await chrome.runtime.sendMessage({
      type: 'SAVE_NOTE',
      note: {
        url: location.href,
        title: document.title,
        selectedText,
        note,
        createdAt: Date.now(),
      },
    });
    overlay.remove();
    renderNoteMarkers();
  });
}

async function renderNoteMarkers() {
  document.querySelectorAll('.ct-note-marker').forEach(el => el.remove());

  const notes = await chrome.runtime.sendMessage({ type: 'GET_NOTES_FOR_URL', url: location.href });
  if (!notes?.length) return;

  notes.forEach(note => {
    const text = note.selectedText;
    if (!text || text.length < 3) return;

    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.nodeValue?.indexOf(text.substring(0, 40));
        if (idx === undefined || idx < 0) continue;

        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, Math.min(idx + text.length, node.nodeValue.length));

        const mark = document.createElement('mark');
        mark.className = 'ct-note-marker';
        mark.title = note.note;
        mark.dataset.noteId = note.id;

        try {
          range.surroundContents(mark);
        } catch (_) { /* range spans multiple nodes */ }

        mark.addEventListener('click', () => showNotePopup(note, mark));
        break;
      }
    } catch (_) { /* skip */ }
  });
}

function showNotePopup(note, anchor) {
  document.getElementById('ct-note-popup')?.remove();
  const rect = anchor.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.id = 'ct-note-popup';
  popup.style.cssText = `top:${rect.bottom + window.scrollY + 6}px;left:${Math.max(8, rect.left + window.scrollX)}px`;
  popup.innerHTML = `
    <div class="ct-note-popup-body">${escapeHtml(note.note)}</div>
    <div class="ct-note-popup-actions">
      <button class="ct-note-delete" data-id="${note.id}">Delete</button>
      <button class="ct-note-popup-close">Close</button>
    </div>
  `;
  document.body.appendChild(popup);

  popup.querySelector('.ct-note-popup-close').addEventListener('click', () => popup.remove());
  popup.querySelector('.ct-note-delete').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'DELETE_NOTE', id: note.id });
    anchor.outerHTML = anchor.innerHTML;
    popup.remove();
  });
}

// ── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_WHY_PROMPT') showWhyPrompt();
  if (msg.type === 'SHOW_NOTE_FORM') showNoteForm(msg.selectedText || '');
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

injectSOCopyButtons();
renderNoteMarkers();
