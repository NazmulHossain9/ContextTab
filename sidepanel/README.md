# sidepanel — Chrome Side Panel

Persistent panel pinned to the browser window. Shows GitHub PR/issue details for the active tab and displays/manages per-URL inline notes.

## Files

| File | Role |
|---|---|
| `sidepanel.html` | Four named state views (`idle`, `loading`, `error`, `pr`) plus a fixed notes panel |
| `sidepanel.js` | Tab change detection, PR rendering, notes CRUD |
| `sidepanel.css` | Scoped styles |

## State machine

`setState(name)` shows exactly one of the four `#state-*` divs by toggling `.hidden`:

```
idle ──(PR url detected)──► loading ──(fetch ok)──► pr
                                      └──(fetch fail)──► error
(non-PR url) ──────────────────────────────────────► idle
```

## PR data flow

1. `chrome.tabs.onActivated` / `chrome.tabs.onUpdated` fires `onTabChange(tabId, url)`.
2. If the URL matches `/github.com/.../pull|issues/\d+/`, sends `GET_PR_INFO` to background.
3. Background calls `fetchPRInfo()` which hits the GitHub REST API (unauthenticated; subject to rate limits on private repos).
4. `renderPR(pr)` builds the `#state-pr` innerHTML from the returned object.

## Notes panel

Always visible at the bottom of the panel regardless of PR state. `loadNotes(url)` fetches notes for the current URL via `GET_NOTES_FOR_URL`. The **+ Add** button inserts an inline form above the list; saving sends `SAVE_NOTE` to background.

## Extending

- **GitLab support**: add URL detection in `onTabChange`, a new `fetchGLInfo` function in `background.js`, a `GET_GL_INFO` message, and update `renderPR` or add a `renderGL` equivalent.
- **Auth token for private repos**: store a PAT in `chrome.storage.local` and pass it as a `Bearer` header inside `fetchPRInfo` in `background.js`.
