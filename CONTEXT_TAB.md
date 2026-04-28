# CONTEXT_TAB.md — ContextTab Chrome Extension

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │  popup/      │   │  sidepanel/      │   │  content.js    │  │
│  │  popup.js    │   │  sidepanel.js    │   │  (every page)  │  │
│  │  popup.html  │   │  sidepanel.html  │   │                │  │
│  │  popup.css   │   │  sidepanel.css   │   │ • Why prompt   │  │
│  │              │   │                  │   │ • SO copy btns │  │
│  │ • Groups     │   │ • PR/issue view  │   │ • Note markers │  │
│  │ • Sessions   │   │ • Page notes UI  │   │ • Note form    │  │
│  │ • Why list   │   │                  │   │                │  │
│  │ • Cheat sheet│   │  Listens to      │   │  Sends:        │  │
│  └──────┬───────┘   │  tabs.onActivated│   │  GET_MY_TAB_ID │  │
│         │           │  tabs.onUpdated  │   │  SAVE_TAB_REA… │  │
│         │           └──────┬───────────┘   │  SAVE_NOTE     │  │
│         │                  │               │  GET_NOTES_…   │  │
│         └──────────────────┴───────────────┤                │  │
│                            │               └────────────────┘  │
│                   chrome.runtime.sendMessage                    │
│                            │                                    │
│              ┌─────────────▼──────────────┐                    │
│              │       background.js         │                    │
│              │    (Service Worker)         │                    │
│              │                             │                    │
│              │  Message Router             │                    │
│              │  Tab grouping engine        │                    │
│              │  Session manager            │                    │
│              │  Tab reasons store          │                    │
│              │  Cheat sheet recorder       │                    │
│              │  GitHub PR fetcher          │                    │
│              │  Inline notes store         │                    │
│              │  Context menus              │                    │
│              └─────────────┬───────────────┘                    │
│                            │                                    │
│              ┌─────────────▼───────────────┐                   │
│              │   chrome.storage.local       │                   │
│              │                             │                   │
│              │  sessions[]                 │                   │
│              │  tabReasons{}  (tabId→str)  │                   │
│              │  cheatsheet[]  (max 100)    │                   │
│              │  notes[]                    │                   │
│              └─────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Message flow summary

| Sender | Message type | Handler |
|---|---|---|
| background → content | `SHOW_WHY_PROMPT`, `SHOW_NOTE_FORM` | content.js listeners |
| popup → background | `GROUP_ALL_TABS`, `GET_TAB_GROUPS`, `SAVE/GET/RESTORE/DELETE_SESSION`, `SAVE_TAB_REASON`, `GET_TABS_WITH_REASONS`, `GET/UPDATE/DELETE_CHEAT*`, `OPEN_SIDEPANEL` | message router |
| sidepanel → background | `GET_PR_INFO`, `GET/SAVE/DELETE_NOTE` | message router |
| content → background | `GET_MY_TAB_ID`, `SAVE_TAB_REASON`, `SAVE_NOTE`, `GET_NOTES_FOR_URL` | message router |

### Context detection priority (background.js)

1. **DOMAIN_RULES** — exact regex on the full URL (highest confidence)
2. **TITLE_KEYWORD_RULES** — scored keyword matching on page title
3. **PATH_KEYWORD_RULES** — scored keyword matching on URL pathname
4. **Domain-name fallback** — extracts second-level domain as group name

---

## Actionable items for developers / agents

### Adding a new tab group category
- Add an entry to `DOMAIN_RULES` in [background.js](background.js) for domain-exact matches (highest priority).
- For title-based detection add to `TITLE_KEYWORD_RULES`; for path-based add to `PATH_KEYWORD_RULES`.
- Keep `DOMAIN_RULES` ordered — first match wins. Put narrow/specific rules before broad ones.

### Adding a new message type
1. Add a `case` in the `handle()` switch inside `chrome.runtime.onMessage.addListener` in [background.js](background.js).
2. Call it from the relevant UI module via the `msg()` helper.
3. Update the message flow table above.

### Adding a new popup tab
1. Add a `<button class="tab-btn" data-tab="<name>">` and `<section id="tab-<name>" class="tab-panel">` in [popup/popup.html](popup/popup.html).
2. Add a `loadTab` branch in [popup/popup.js](popup/popup.js).
3. Implement the `load<Name>()` function in popup.js following the pattern of existing tabs (request via `msg()`, render into a container div).

### Extending the cheat sheet
- `DOC_PATTERNS` in [background.js](background.js) controls which URLs are auto-recorded.
- Add regex patterns there; `recordDocVisit` handles deduplication and capping at 100 entries.

### Extending the side panel
- PR rendering lives in `renderPR()` in [sidepanel/sidepanel.js](sidepanel/sidepanel.js).
- GitLab support would require a new `fetchGLInfo()` function in background.js and a corresponding `GET_GL_INFO` message type, then updating `onTabChange()` in sidepanel.js to detect GitLab URLs.

### Storage schema
All data lives in `chrome.storage.local`. Keys:

| Key | Type | Notes |
|---|---|---|
| `sessions` | `Session[]` | Prepended on save; no max limit |
| `tabReasons` | `{ [tabId]: string }` | Cleaned up on `tabs.onRemoved` |
| `cheatsheet` | `CheatEntry[]` | Capped at 100; deduplicated by URL |
| `notes` | `Note[]` | Keyed by `id`; filtered by URL at read time |

### Running / loading locally
1. Go to `chrome://extensions`, enable Developer mode.
2. Click **Load unpacked**, select this directory.
3. After editing JS/CSS, click the refresh icon on the extension card (no rebuild step needed).

### Manifest permissions
Do not add broad host permissions without a clear feature requirement. Current host permissions are limited to GitHub, GitLab, and Stack Overflow families.
