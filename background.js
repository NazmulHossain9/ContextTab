// ContextTab — Background Service Worker

// ── Grouping config ──────────────────────────────────────────────────────────

// Priority 1 — exact domain/URL rules. Matched against the ORIGINAL (cased) URL.
// Each entry: [regex, labelFn]. labelFn receives the match array.
const DOMAIN_RULES = [
  // ── AI Tools (must come first — gemini.google.com would match "Google" otherwise) ──
  [/claude\.ai/,                                          () => '🤖 AI Tools'],
  [/chat\.openai\.com|chatgpt\.com/,                     () => '🤖 AI Tools'],
  [/gemini\.google\.com/,                                () => '🤖 AI Tools'],
  [/copilot\.microsoft\.com/,                            () => '🤖 AI Tools'],
  [/perplexity\.ai/,                                     () => '🤖 AI Tools'],
  [/poe\.com/,                                           () => '🤖 AI Tools'],
  [/mistral\.ai/,                                        () => '🤖 AI Tools'],
  [/you\.com/,                                           () => '🤖 AI Tools'],
  [/huggingface\.co/,                                    () => '🤖 AI Tools'],
  [/grok\.com|grok\.x\.ai/,                             () => '🤖 AI Tools'],
  [/aistudio\.google\.com/,                              () => '🤖 AI Tools'],

  // Dev platforms — group by repo name so all tabs for one project stay together
  [/github\.com\/[^\/]+\/([^\/?\s#]+)/, m => `GH: ${m[1]}`],
  [/gitlab\.com\/[^\/]+\/([^\/?\s#]+)/, m => `GL: ${m[1]}`],

  // Q&A
  [/stackoverflow\.com|stackexchange\.com/, () => 'Stack Overflow'],

  // Package registries
  [/npmjs\.com/, () => 'npm'],
  [/crates\.io/,  () => 'Crates.io'],
  [/pypi\.org/,   () => 'PyPI'],
  [/pkg\.go\.dev/,() => 'pkg.go.dev'],
  [/rubygems\.org/,() => 'RubyGems'],
  [/hub\.docker\.com/,() => 'Docker Hub'],

  // Doc sites
  [/developer\.mozilla\.org/, () => 'MDN'],
  [/devdocs\.io/,             () => 'DevDocs'],
  [/docs\.github\.com/,       () => 'GitHub Docs'],
  [/learn\.microsoft\.com/,   () => 'MS Learn'],
  [/docs\.(python|rs|rust|go|microsoft|aws|google|docker|oracle)\./,() => 'Docs'],
  [/react\.dev|reactjs\.org/, () => 'React Docs'],
  [/vuejs\.org/,              () => 'Vue Docs'],
  [/angular\.io/,             () => 'Angular Docs'],

  // CI / cloud
  [/app\.circleci\.com|circleci\.com\/docs/, () => 'CI/CD'],
  [/jenkins\.|buildkite\.com/,               () => 'CI/CD'],
  [/console\.aws\.amazon\.com/,              () => 'AWS'],
  [/console\.cloud\.google\.com/,            () => 'GCP'],
  [/portal\.azure\.com/,                     () => 'Azure'],

  // Project management
  [/jira\.[a-z]+\.com|atlassian\.net/, () => 'Project Mgmt'],
  [/linear\.app/,                      () => 'Project Mgmt'],
  [/trello\.com/,                      () => 'Project Mgmt'],
  [/notion\.so/,                       () => 'Notion'],
  [/figma\.com/,                       () => 'Design'],
];

// Priority 2 — keyword rules applied to the page TITLE (word-boundary matched).
// Each entry: [keywords[], label, score]. Higher score = stronger signal.
const TITLE_KEYWORD_RULES = [
  // AI Tools — high score so it beats generic keyword matches
  [['chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'gpt-4', 'llm', 'prompt engineering', 'langchain', 'rag', 'fine-tuning', 'ai assistant'], '🤖 AI Tools', 95],

  [['authentication', 'authorization', 'oauth', 'jwt', 'saml', 'sso', 'login'], 'Auth', 90],
  [['testing', 'unit test', 'integration test', 'jest', 'pytest', 'cypress', 'playwright', 'vitest'], 'Testing', 90],
  [['docker', 'kubernetes', 'helm', 'k8s', 'terraform', 'ansible', 'deployment'], 'DevOps', 85],
  [['graphql', 'openapi', 'swagger', 'rest api', 'grpc', 'webhook'], 'API', 85],
  [['typescript', 'eslint', 'webpack', 'vite', 'rollup', 'esbuild', 'babel'], 'JS Tooling', 80],
  [['performance', 'profiling', 'benchmark', 'optimization', 'latency'], 'Performance', 80],
  [['security', 'vulnerability', 'cve', 'owasp', 'penetration', 'exploit'], 'Security', 80],
  [['postgres', 'postgresql', 'mysql', 'mongodb', 'sqlite', 'redis', 'prisma', 'drizzle'], 'Database', 80],
  [['rust', 'cargo', 'tokio', 'async rust', 'rustacean'], 'Rust', 75],
  [['python', 'django', 'fastapi', 'flask', 'pandas', 'numpy', 'asyncio'], 'Python', 75],
  [['react', 'nextjs', 'remix', 'gatsby'], 'React', 75],
  [['vue', 'nuxt', 'vuex', 'pinia'], 'Vue', 75],
  [['angular', 'rxjs', 'ngrx'], 'Angular', 75],
  [['svelte', 'sveltekit'], 'Svelte', 75],
  [['ci', 'cd', 'github actions', 'jenkins', 'pipeline', 'workflow'], 'CI/CD', 70],
  [['git', 'commit', 'branch', 'merge', 'rebase', 'pull request'], 'Git', 65],
];

// Priority 3 — URL PATH keyword rules (lower confidence, word-boundary matched).
// Only the pathname is checked, not the domain (avoids domain pollution).
const PATH_KEYWORD_RULES = [
  [['auth', 'oauth', 'login', 'signin', 'token', 'session'], 'Auth', 50],
  [['test', 'spec', 'testing'], 'Testing', 45],
  [['docker', 'kubernetes', 'k8s', 'helm', 'deploy'], 'DevOps', 45],
  [['graphql', 'swagger', 'openapi'], 'API', 45],
  [['webpack', 'vite', 'eslint', 'typescript'], 'JS Tooling', 40],
  [['security', 'vulnerability', 'cve'], 'Security', 40],
  [['database', 'postgres', 'mysql', 'mongodb', 'redis'], 'Database', 40],
  [['rust', 'cargo'], 'Rust', 40],
  [['python', 'django', 'flask', 'fastapi'], 'Python', 40],
  [['react', 'nextjs'], 'React', 35],
  [['ci', 'pipeline', 'workflow'], 'CI/CD', 35],
];

const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

const DOC_PATTERNS = [
  /developer\.mozilla\.org/,
  /devdocs\.io/,
  /docs\.(python|rs|rust|go|microsoft|aws|google|docker)\./,
  /npmjs\.com\/package/,
  /crates\.io\/crates/,
  /pkg\.go\.dev/,
  /learn\.microsoft\.com/,
  /docs\.github\.com/,
  /react\.dev|reactjs\.org/,
  /vuejs\.org/,
  /angular\.io\/docs/,
];

// ── Context detection ────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns true if `text` contains `keyword` as a whole word (case-insensitive).
function wordMatch(text, keyword) {
  // Multi-word keywords (e.g. "github actions") — check all words present in order
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  return new RegExp(`(?<![a-z])${escapeRegex(keyword)}(?![a-z])`, 'i').test(text);
}

function detectContext(tab) {
  const url    = tab.url   || '';
  const title  = (tab.title || '').toLowerCase();

  // --- Priority 1: domain/URL exact rules ---
  for (const [pattern, getCtx] of DOMAIN_RULES) {
    const m = url.match(pattern);
    if (m) return getCtx(m);
  }

  // --- Priority 2: title keyword scoring ---
  let best = { label: null, score: 0 };

  for (const [keywords, label, score] of TITLE_KEYWORD_RULES) {
    // Count how many keywords from this category match the title
    const hits = keywords.filter(kw => wordMatch(title, kw)).length;
    if (hits > 0) {
      // Bonus for multiple keyword hits (max +15)
      const finalScore = score + Math.min(hits - 1, 3) * 5;
      if (finalScore > best.score) {
        best = { label, score: finalScore };
      }
    }
  }
  if (best.label) return best.label;

  // --- Priority 3: URL path keyword scoring ---
  let parsedPath = '';
  try {
    parsedPath = new URL(url).pathname.toLowerCase();
  } catch (_) {
    parsedPath = url.toLowerCase();
  }

  best = { label: null, score: 0 };
  for (const [keywords, label, score] of PATH_KEYWORD_RULES) {
    const hits = keywords.filter(kw => wordMatch(parsedPath, kw)).length;
    if (hits > 0) {
      const finalScore = score + Math.min(hits - 1, 2) * 5;
      if (finalScore > best.score) {
        best = { label, score: finalScore };
      }
    }
  }
  if (best.label) return best.label;

  // --- Priority 4: domain-name fallback (group by website) ---
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const domain = hostname.split('.').slice(-2, -1)[0]; // e.g. "vercel" from "vercel.com"
    if (domain && domain.length > 2) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  } catch (_) {}

  return null;
}

function colorFor(label) {
  const hash = [...label].reduce((a, c) => a + c.charCodeAt(0), 0);
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

function isDocPage(url) {
  return DOC_PATTERNS.some(p => p.test(url));
}

// ── Tab grouping ────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;

  const ctx = detectContext(tab);
  if (ctx) await assignToGroup(tab, ctx);

  if (isDocPage(tab.url)) {
    await recordDocVisit(tab);
  }

  // Notify content script to show "why" prompt if no reason set
  const { tabReasons = {} } = await chrome.storage.local.get('tabReasons');
  if (!tabReasons[tabId]) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_WHY_PROMPT' });
    } catch (_) { /* content script may not be ready */ }
  }
});

async function assignToGroup(tab, ctx) {
  try {
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
    const existing = groups.find(g => g.title === ctx);
    if (existing) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: existing.id });
    } else {
      const gid = await chrome.tabs.group({ tabIds: [tab.id] });
      await chrome.tabGroups.update(gid, { title: ctx, color: colorFor(ctx) });
    }
  } catch (_) { /* tab may already be grouped or window unavailable */ }
}

async function groupAllTabs(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const map = new Map();

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://')) continue;
    const ctx = detectContext(tab) || 'General';
    if (!map.has(ctx)) map.set(ctx, []);
    map.get(ctx).push(tab.id);
  }

  for (const [ctx, ids] of map) {
    try {
      const groups = await chrome.tabGroups.query({ windowId });
      const existing = groups.find(g => g.title === ctx);
      if (existing) {
        await chrome.tabs.group({ tabIds: ids, groupId: existing.id });
      } else {
        const gid = await chrome.tabs.group({ tabIds: ids });
        await chrome.tabGroups.update(gid, { title: ctx, color: colorFor(ctx) });
      }
    } catch (_) { /* skip */ }
  }
  return { ok: true };
}

// ── Sessions ────────────────────────────────────────────────────────────────

async function saveSession(name, windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  const session = {
    id: Date.now().toString(),
    name: name || `Session ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    createdAt: Date.now(),
    tabs: tabs
      .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:'))
      .map(t => ({ url: t.url, title: t.title, pinned: t.pinned, favIconUrl: t.favIconUrl })),
  };

  const { sessions = [] } = await chrome.storage.local.get('sessions');
  sessions.unshift(session);
  await chrome.storage.local.set({ sessions });
  return { ok: true, session };
}

async function restoreSession(sessionId) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return { ok: false };

  for (const tab of session.tabs) {
    chrome.tabs.create({ url: tab.url, pinned: tab.pinned || false });
  }
  return { ok: true };
}

async function deleteSession(sessionId) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  await chrome.storage.local.set({ sessions: sessions.filter(s => s.id !== sessionId) });
  return { ok: true };
}

// ── Tab reasons ("Why did I open this?") ────────────────────────────────────

async function saveTabReason(tabId, reason) {
  const { tabReasons = {} } = await chrome.storage.local.get('tabReasons');
  if (reason) {
    tabReasons[tabId] = reason;
    chrome.action.setBadgeText({ text: '●', tabId }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: '#7c3aed', tabId }).catch(() => {});
  } else {
    delete tabReasons[tabId];
    chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
  }
  await chrome.storage.local.set({ tabReasons });
  return { ok: true };
}

async function getTabsWithReasons() {
  const [tabs, { tabReasons = {} }] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.storage.local.get('tabReasons'),
  ]);
  return tabs
    .filter(t => t.url && !t.url.startsWith('chrome://'))
    .map(t => ({ id: t.id, url: t.url, title: t.title, favIconUrl: t.favIconUrl, reason: tabReasons[t.id] || null }));
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabReasons = {} } = await chrome.storage.local.get('tabReasons');
  if (tabReasons[tabId]) {
    delete tabReasons[tabId];
    await chrome.storage.local.set({ tabReasons });
  }
});

// ── Cheat sheet ─────────────────────────────────────────────────────────────

async function recordDocVisit(tab) {
  if (!tab.url || !tab.title) return;
  const { cheatsheet = [] } = await chrome.storage.local.get('cheatsheet');
  const i = cheatsheet.findIndex(e => e.url === tab.url);
  if (i >= 0) {
    cheatsheet[i].visits = (cheatsheet[i].visits || 1) + 1;
    cheatsheet[i].lastVisit = Date.now();
  } else {
    cheatsheet.unshift({
      id: Date.now().toString(),
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl || '',
      visits: 1,
      lastVisit: Date.now(),
      note: '',
    });
    if (cheatsheet.length > 100) cheatsheet.pop();
  }
  await chrome.storage.local.set({ cheatsheet });
}

async function updateCheatNote(id, note) {
  const { cheatsheet = [] } = await chrome.storage.local.get('cheatsheet');
  const entry = cheatsheet.find(e => e.id === id);
  if (entry) {
    entry.note = note;
    await chrome.storage.local.set({ cheatsheet });
  }
  return { ok: true };
}

async function deleteCheatEntry(id) {
  const { cheatsheet = [] } = await chrome.storage.local.get('cheatsheet');
  await chrome.storage.local.set({ cheatsheet: cheatsheet.filter(e => e.id !== id) });
  return { ok: true };
}

// ── AI tab grouping (Gemini) ─────────────────────────────────────────────────

async function aiGroupTabs(windowId) {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  if (!geminiApiKey) return { ok: false, error: 'NO_KEY' };

  const tabs = await chrome.tabs.query({ windowId });
  const validTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:'));
  if (!validTabs.length) return { ok: false, error: 'NO_TABS' };

  const tabList = validTabs.map(t => ({ id: t.id, title: t.title || '', url: t.url }));

  const prompt = `Group these browser tabs by content similarity or topic.
Return ONLY a JSON object where keys are short group names (max 3 words) and values are arrays of numeric tab IDs.
Every tab ID must appear in exactly one group. Use clear, specific names.
Tabs: ${JSON.stringify(tabList)}`;

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      }
    );
  } catch (e) {
    return { ok: false, error: 'Network error: ' + e.message };
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    return { ok: false, error: errData.error?.message || `HTTP ${res.status}` };
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let groupMap;
  try {
    groupMap = JSON.parse(text);
  } catch {
    // Gemini sometimes wraps JSON in a code block — strip it
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    try { groupMap = JSON.parse(m?.[1] || text); }
    catch { return { ok: false, error: 'AI returned invalid JSON' }; }
  }

  for (const [label, tabIds] of Object.entries(groupMap)) {
    const validIds = tabIds.filter(id => validTabs.some(t => t.id === id));
    if (!validIds.length) continue;
    try {
      const existingGroups = await chrome.tabGroups.query({ windowId });
      const existing = existingGroups.find(g => g.title === label);
      if (existing) {
        await chrome.tabs.group({ tabIds: validIds, groupId: existing.id });
      } else {
        const gid = await chrome.tabs.group({ tabIds: validIds });
        await chrome.tabGroups.update(gid, { title: label, color: colorFor(label) });
      }
    } catch (_) { /* skip ungroupable tabs */ }
  }

  return { ok: true };
}

// ── GitHub PR info ───────────────────────────────────────────────────────────

async function fetchPRInfo(url) {
  const m = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(pull|issues)\/(\d+)/);
  if (!m) return null;
  const [, owner, repo, type, num] = m;

  try {
    const ep = type === 'pull'
      ? `https://api.github.com/repos/${owner}/${repo}/pulls/${num}`
      : `https://api.github.com/repos/${owner}/${repo}/issues/${num}`;

    const res = await fetch(ep, { headers: { Accept: 'application/vnd.github.v3+json' } });
    if (!res.ok) return null;
    const d = await res.json();

    let ci = null;
    if (type === 'pull' && d.head?.sha) {
      const cr = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${d.head.sha}/check-runs`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );
      if (cr.ok) {
        const { check_runs: runs = [] } = await cr.json();
        if (runs.length) {
          ci = runs.some(r => r.conclusion === 'failure') ? 'failure'
            : runs.some(r => r.status !== 'completed') ? 'pending'
            : 'success';
        }
      }
    }

    return {
      title: d.title,
      state: d.state,
      merged: d.merged,
      draft: d.draft,
      author: d.user?.login,
      authorAvatar: d.user?.avatar_url,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      body: (d.body || '').substring(0, 400),
      labels: (d.labels || []).map(l => ({ name: l.name, color: l.color })),
      reviewers: (d.requested_reviewers || []).map(r => r.login),
      comments: d.comments,
      ci,
      type,
      number: num,
      repo: `${owner}/${repo}`,
    };
  } catch (_) {
    return null;
  }
}

// ── Inline notes ─────────────────────────────────────────────────────────────

async function saveNote(note) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const existing = notes.findIndex(n => n.id === note.id);
  if (existing >= 0) {
    notes[existing] = note;
  } else {
    notes.unshift({ ...note, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  }
  await chrome.storage.local.set({ notes });
  return { ok: true };
}

async function getNotesForUrl(url) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  return notes.filter(n => n.url === url);
}

async function deleteNote(id) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  await chrome.storage.local.set({ notes: notes.filter(n => n.id !== id) });
  return { ok: true };
}

// ── Context menus ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ct-add-note',
    title: 'Add ContextTab Note',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'ct-open-panel',
    title: 'Open ContextTab Sidebar',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ct-add-note') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_NOTE_FORM',
      selectedText: info.selectionText,
    });
  }
  if (info.menuItemId === 'ct-open-panel') {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// ── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  const handle = async () => {
    switch (msg.type) {
      case 'GET_MY_TAB_ID':       return { tabId };
      case 'GROUP_ALL_TABS':      return groupAllTabs(msg.windowId);
      case 'AI_GROUP_TABS':       return aiGroupTabs(msg.windowId);
      case 'SAVE_GEMINI_KEY':     await chrome.storage.local.set({ geminiApiKey: msg.key }); return { ok: true };
      case 'GET_GEMINI_KEY':      { const { geminiApiKey = '' } = await chrome.storage.local.get('geminiApiKey'); return { key: geminiApiKey }; }
      case 'SAVE_SESSION':        return saveSession(msg.name, msg.windowId);
      case 'GET_SESSIONS':        { const { sessions = [] } = await chrome.storage.local.get('sessions'); return sessions; }
      case 'RESTORE_SESSION':     return restoreSession(msg.sessionId);
      case 'DELETE_SESSION':      return deleteSession(msg.sessionId);
      case 'SAVE_TAB_REASON':     return saveTabReason(msg.tabId ?? tabId, msg.reason);
      case 'GET_TABS_WITH_REASONS': return getTabsWithReasons();
      case 'GET_CHEATSHEET':      { const { cheatsheet = [] } = await chrome.storage.local.get('cheatsheet'); return cheatsheet; }
      case 'UPDATE_CHEAT_NOTE':   return updateCheatNote(msg.id, msg.note);
      case 'DELETE_CHEAT_ENTRY':  return deleteCheatEntry(msg.id);
      case 'GET_PR_INFO':         return fetchPRInfo(msg.url);
      case 'SAVE_NOTE':           return saveNote(msg.note);
      case 'GET_NOTES_FOR_URL':   return getNotesForUrl(msg.url);
      case 'DELETE_NOTE':         return deleteNote(msg.id);
      case 'OPEN_SIDEPANEL':      chrome.sidePanel.open({ windowId: msg.windowId }); return { ok: true };
      case 'GET_TAB_GROUPS': {
        const groups = await chrome.tabGroups.query({ windowId: msg.windowId });
        const tabs = await chrome.tabs.query({ windowId: msg.windowId });
        return groups.map(g => ({
          ...g,
          tabs: tabs.filter(t => t.groupId === g.id).map(t => ({
            id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl,
          })),
        }));
      }
      default: return null;
    }
  };

  handle().then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true;
});
