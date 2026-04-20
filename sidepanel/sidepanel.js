// ContextTab Side Panel

const msg = (type, data = {}) => chrome.runtime.sendMessage({ type, ...data });

let currentUrl = null;
let currentTabId = null;

// ── State helpers ─────────────────────────────────────────────────────────────

function setState(name) {
  ['idle', 'loading', 'error', 'pr'].forEach(s => {
    const el = document.getElementById(`state-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
}

// ── Tab tracking ──────────────────────────────────────────────────────────────

async function onTabChange(tabId, url) {
  if (url === currentUrl && tabId === currentTabId) return;
  currentUrl = url;
  currentTabId = tabId;

  const isPR = /github\.com\/[^\/]+\/[^\/]+\/(pull|issues)\/\d+/.test(url);

  if (isPR) {
    setState('loading');
    const pr = await msg('GET_PR_INFO', { url });
    if (pr) {
      renderPR(pr);
      setState('pr');
    } else {
      document.getElementById('error-msg').textContent = 'Could not load PR info. The repo may be private or rate-limited.';
      setState('error');
    }
  } else {
    setState('idle');
  }

  loadNotes(url);
}

// ── PR rendering ──────────────────────────────────────────────────────────────

function renderPR(pr) {
  const container = document.getElementById('state-pr');

  const statusBadge = pr.merged
    ? `<span class="badge badge-merged">⊕ Merged</span>`
    : pr.draft
    ? `<span class="badge badge-draft">◎ Draft</span>`
    : pr.state === 'open'
    ? `<span class="badge badge-open">● Open</span>`
    : `<span class="badge badge-closed">✕ Closed</span>`;

  const ciBadge = pr.ci
    ? pr.ci === 'success'
      ? `<span class="badge badge-ci-pass">✓ CI passing</span>`
      : pr.ci === 'failure'
      ? `<span class="badge badge-ci-fail">✕ CI failing</span>`
      : `<span class="badge badge-ci-pending">⧖ CI running</span>`
    : '';

  const labelsHTML = pr.labels?.length
    ? `<div class="pr-section">
        <div class="pr-section-title">Labels</div>
        <div class="pr-section-body">
          <div class="label-list">
            ${pr.labels.map(l => `<span class="label-chip" style="background:#${l.color}22;color:#${l.color};border:1px solid #${l.color}55">${escHtml(l.name)}</span>`).join('')}
          </div>
        </div>
      </div>`
    : '';

  const reviewersHTML = pr.reviewers?.length
    ? `<div class="pr-section">
        <div class="pr-section-title">Reviewers Requested</div>
        <div class="pr-section-body">
          <div class="reviewer-list">
            ${pr.reviewers.map(r => `<div class="reviewer-item"><span class="reviewer-dot"></span>${escHtml(r)}</div>`).join('')}
          </div>
        </div>
      </div>`
    : '';

  const bodyHTML = pr.body?.trim()
    ? `<div class="pr-section">
        <div class="pr-section-title">Description</div>
        <div class="pr-section-body">
          <div class="pr-body">${escHtml(pr.body)}${pr.body.length >= 400 ? '…' : ''}</div>
        </div>
      </div>`
    : '';

  const createdDate = new Date(pr.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const updatedDate = new Date(pr.updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  container.innerHTML = `
    <div class="pr-header">
      <div class="pr-repo">
        <a href="https://github.com/${escHtml(pr.repo)}" target="_blank">${escHtml(pr.repo)}</a>
        <span class="pr-number">#${pr.number}</span>
      </div>
      <div class="pr-title">${escHtml(pr.title)}</div>
      <div class="status-row">
        ${statusBadge}
        ${ciBadge}
      </div>
    </div>

    <div class="pr-author">
      ${pr.authorAvatar ? `<img class="author-avatar" src="${escHtml(pr.authorAvatar)}" alt="">` : ''}
      <div>
        <div class="author-name">${escHtml(pr.author || 'unknown')}</div>
        <div class="author-date">Opened ${createdDate} · Updated ${updatedDate}</div>
      </div>
    </div>

    <div class="pr-stats">
      <div class="stat-item">
        <div class="stat-value">${pr.comments ?? 0}</div>
        <div class="stat-label">Comments</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${pr.reviewers?.length ?? 0}</div>
        <div class="stat-label">Reviewers</div>
      </div>
    </div>

    ${labelsHTML}
    ${reviewersHTML}
    ${bodyHTML}
  `;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

async function loadNotes(url) {
  if (!url) return;
  const notes = await msg('GET_NOTES_FOR_URL', { url });
  renderNotes(notes || []);
}

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  if (!notes.length) {
    container.innerHTML = `<div class="no-notes">No notes on this page yet.</div>`;
    return;
  }

  container.innerHTML = '';
  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      ${note.selectedText ? `<div class="note-snippet">${escHtml(note.selectedText.substring(0, 60))}…</div>` : ''}
      <div class="note-text">${escHtml(note.note)}</div>
      <div class="note-actions">
        <button class="note-delete" data-id="${note.id}">Delete</button>
      </div>
    `;
    card.querySelector('.note-delete').addEventListener('click', async () => {
      await msg('DELETE_NOTE', { id: note.id });
      loadNotes(currentUrl);
    });
    container.appendChild(card);
  });
}

// Add note button
document.getElementById('btn-add-note').addEventListener('click', () => {
  const existing = document.querySelector('.note-add-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'note-add-form';
  form.innerHTML = `
    <textarea class="note-add-input" rows="3" placeholder="Add a note for this page…"></textarea>
    <div class="note-add-actions">
      <button class="note-cancel-btn">Cancel</button>
      <button class="note-save-btn">Save</button>
    </div>
  `;
  document.getElementById('notes-list').before(form);
  form.querySelector('textarea').focus();

  form.querySelector('.note-cancel-btn').addEventListener('click', () => form.remove());
  form.querySelector('.note-save-btn').addEventListener('click', async () => {
    const note = form.querySelector('textarea').value.trim();
    if (!note) return;
    await msg('SAVE_NOTE', {
      note: {
        url: currentUrl,
        title: '',
        selectedText: '',
        note,
        createdAt: Date.now(),
      },
    });
    form.remove();
    loadNotes(currentUrl);
  });
});

// ── Tab change listener ───────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) onTabChange(tab.id, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    onTabChange(tab.id, tab.url);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  setState('idle');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) onTabChange(tab.id, tab.url);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
