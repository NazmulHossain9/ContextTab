// ContextTab Popup

const msg = (type, data = {}) => chrome.runtime.sendMessage({ type, ...data });

async function getCurrentWindow() {
  return chrome.windows.getCurrent();
}

// ── Tab navigation ──────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    loadTab(btn.dataset.tab);
  });
});

function loadTab(name) {
  if (name === 'groups') loadGroups();
  if (name === 'sessions') loadSessions();
  if (name === 'why') loadWhy();
  if (name === 'cheatsheet') loadCheatSheet();
}

// ── Sidebar button ──────────────────────────────────────────────────────────

document.getElementById('btn-sidepanel').addEventListener('click', async () => {
  const win = await getCurrentWindow();
  await msg('OPEN_SIDEPANEL', { windowId: win.id });
  window.close();
});

// ── Groups tab ──────────────────────────────────────────────────────────────

document.getElementById('btn-autogroup').addEventListener('click', async () => {
  const btn = document.getElementById('btn-autogroup');
  btn.textContent = '…';
  btn.disabled = true;
  const win = await getCurrentWindow();
  await msg('GROUP_ALL_TABS', { windowId: win.id });
  btn.textContent = '⚡ Auto-group';
  btn.disabled = false;
  loadGroups();
});

async function loadGroups() {
  const container = document.getElementById('groups-list');
  const win = await getCurrentWindow();
  const groups = await msg('GET_TAB_GROUPS', { windowId: win.id });

  if (!groups?.length) {
    container.innerHTML = `<div class="empty-state">No tab groups yet.<br>Click <strong>Auto-group</strong> to cluster your tabs by context.</div>`;
    return;
  }

  container.innerHTML = '';
  groups.forEach(group => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-header">
        <span class="group-dot dot-${group.color || 'grey'}"></span>
        <span class="group-name">${escHtml(group.title || 'Unnamed')}</span>
        <span class="group-count">${group.tabs.length}</span>
        <span class="group-chevron">▾</span>
      </div>
      <div class="group-tabs">
        ${group.tabs.map(t => `
          <div class="group-tab-item" data-tab-id="${t.id}">
            <img class="tab-favicon" src="${t.favIconUrl || ''}" onerror="this.style.visibility='hidden'">
            <span class="tab-title">${escHtml(t.title || t.url)}</span>
          </div>
        `).join('')}
      </div>
    `;

    card.querySelector('.group-header').addEventListener('click', () => {
      card.classList.toggle('open');
    });

    card.querySelectorAll('.group-tab-item').forEach(item => {
      item.addEventListener('click', () => {
        chrome.tabs.update(parseInt(item.dataset.tabId), { active: true });
        window.close();
      });
    });

    container.appendChild(card);
  });
}

// ── Sessions tab ─────────────────────────────────────────────────────────────

document.getElementById('btn-save-session').addEventListener('click', async () => {
  const input = document.getElementById('session-name-input');
  const name = input.value.trim();
  const win = await getCurrentWindow();
  await msg('SAVE_SESSION', { name, windowId: win.id });
  input.value = '';
  loadSessions();
});

document.getElementById('session-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-save-session').click();
});

async function loadSessions() {
  const container = document.getElementById('sessions-list');
  const sessions = await msg('GET_SESSIONS');

  if (!sessions?.length) {
    container.innerHTML = `<div class="empty-state">No saved sessions.<br>Save a session to snapshot all your open tabs.</div>`;
    return;
  }

  container.innerHTML = '';
  sessions.forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-card';

    const date = new Date(session.createdAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    card.innerHTML = `
      <div class="session-info">
        <div class="session-name">${escHtml(session.name)}</div>
        <div class="session-meta">${session.tabs.length} tabs · ${date}</div>
      </div>
      <div class="session-actions">
        <button class="btn-ghost btn-restore">Restore</button>
        <button class="btn-danger btn-delete-session" title="Delete">✕</button>
      </div>
    `;

    card.querySelector('.btn-restore').addEventListener('click', async () => {
      await msg('RESTORE_SESSION', { sessionId: session.id });
      window.close();
    });

    card.querySelector('.btn-delete-session').addEventListener('click', async () => {
      await msg('DELETE_SESSION', { sessionId: session.id });
      loadSessions();
    });

    container.appendChild(card);
  });
}

// ── Why tab ──────────────────────────────────────────────────────────────────

async function loadWhy() {
  const container = document.getElementById('why-list');
  const tabs = await msg('GET_TABS_WITH_REASONS');

  if (!tabs?.length) {
    container.innerHTML = `<div class="empty-state">No open tabs found.</div>`;
    return;
  }

  container.innerHTML = '';
  tabs.forEach(tab => {
    const item = document.createElement('div');
    item.className = 'why-item';

    item.innerHTML = `
      <img class="tab-favicon" src="${tab.favIconUrl || ''}" onerror="this.style.visibility='hidden'" width="14" height="14">
      <div class="why-tab-info">
        <div class="why-tab-title">${escHtml(tab.title || tab.url)}</div>
        <div class="why-reason">
          ${tab.reason
            ? `<span class="why-reason-badge">${escHtml(tab.reason)}</span>`
            : `<span class="why-no-reason">No context set</span>`
          }
        </div>
        <div class="why-input-row">
          <input class="why-input" type="text" placeholder="5-word reason…" value="${escHtml(tab.reason || '')}" maxlength="60">
          <button class="why-set-btn">Set</button>
        </div>
      </div>
    `;

    const input = item.querySelector('.why-input');
    const setBtn = item.querySelector('.why-set-btn');

    async function setReason() {
      const reason = input.value.trim();
      await msg('SAVE_TAB_REASON', { tabId: tab.id, reason });
      loadWhy();
    }

    setBtn.addEventListener('click', setReason);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') setReason(); });

    container.appendChild(item);
  });
}

// ── Cheat sheet tab ──────────────────────────────────────────────────────────

async function loadCheatSheet() {
  const container = document.getElementById('cheatsheet-list');
  const entries = await msg('GET_CHEATSHEET');

  if (!entries?.length) {
    container.innerHTML = `<div class="empty-state">Visit MDN, DevDocs, or official docs pages to build your cheat sheet.</div>`;
    return;
  }

  container.innerHTML = '';
  entries
    .sort((a, b) => b.visits - a.visits)
    .forEach(entry => {
      const card = document.createElement('div');
      card.className = 'cheat-card';

      const domain = (() => { try { return new URL(entry.url).hostname; } catch { return ''; } })();
      const date = new Date(entry.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      card.innerHTML = `
        <div class="cheat-header">
          <img class="tab-favicon" src="${entry.favIconUrl || ''}" onerror="this.style.visibility='hidden'" width="14" height="14">
          <div class="cheat-info">
            <div class="cheat-title"><a href="${escHtml(entry.url)}" target="_blank">${escHtml(entry.title)}</a></div>
            <div class="cheat-meta">
              <span>${escHtml(domain)}</span>
              <span class="cheat-visits">↩ ${entry.visits}×</span>
              <span>${date}</span>
            </div>
          </div>
          <button class="btn-danger btn-delete-cheat" title="Remove">✕</button>
        </div>
        <div class="cheat-note-area">
          <textarea class="cheat-note-input" rows="2" placeholder="Add a personal note…">${escHtml(entry.note || '')}</textarea>
          <button class="cheat-note-save">Save</button>
        </div>
      `;

      card.querySelector('.cheat-note-save').addEventListener('click', async () => {
        const note = card.querySelector('.cheat-note-input').value.trim();
        await msg('UPDATE_CHEAT_NOTE', { id: entry.id, note });
      });

      card.querySelector('.btn-delete-cheat').addEventListener('click', async () => {
        await msg('DELETE_CHEAT_ENTRY', { id: entry.id });
        loadCheatSheet();
      });

      container.appendChild(card);
    });
}

// ── Utils ────────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────────────────

loadGroups();
