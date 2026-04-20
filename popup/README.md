# popup — Browser Action Popup

Rendered when the user clicks the ContextTab toolbar icon. Communicates exclusively with `background.js` via `chrome.runtime.sendMessage` using the `msg()` helper.

## Files

| File | Role |
|---|---|
| `popup.html` | Shell with four `<section id="tab-*">` panels and a `<nav>` tab bar |
| `popup.js` | Tab switching, data loading, DOM rendering |
| `popup.css` | Scoped styles for the popup UI |

## Tabs

| Tab key | Load function | Background messages used |
|---|---|---|
| `groups` | `loadGroups()` | `GET_TAB_GROUPS`, `GROUP_ALL_TABS` |
| `sessions` | `loadSessions()` | `GET_SESSIONS`, `SAVE_SESSION`, `RESTORE_SESSION`, `DELETE_SESSION` |
| `why` | `loadWhy()` | `GET_TABS_WITH_REASONS`, `SAVE_TAB_REASON` |
| `cheatsheet` | `loadCheatSheet()` | `GET_CHEATSHEET`, `UPDATE_CHEAT_NOTE`, `DELETE_CHEAT_ENTRY` |

## Key behaviours

- Tab switching is handled by toggling `.active` on `.tab-btn` and `.tab-panel` elements; data is fetched lazily on each switch via `loadTab()`.
- The **Auto-group** button (`btn-autogroup`) sends `GROUP_ALL_TABS` then refreshes the groups list.
- The sidebar button (`btn-sidepanel`) sends `OPEN_SIDEPANEL` and closes the popup.
- All user-supplied strings are passed through `escHtml()` before insertion into innerHTML.

## Adding a new tab

1. Add `<button class="tab-btn" data-tab="<key>">` to the `<nav>` in `popup.html`.
2. Add `<section id="tab-<key>" class="tab-panel">` to `<main>`.
3. Add a branch in `loadTab()` and implement the corresponding `load<Key>()` function.
