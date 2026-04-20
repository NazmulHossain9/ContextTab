# ContextTab

**AI-Powered Tab & Research Manager for developers.**

ContextTab automatically organizes your browser tabs by context, tracks why you opened each tab, saves research sessions, and surfaces PR details alongside page notes — all without leaving your browser.

## Features

| Feature | Description |
|---|---|
| **Auto Tab Grouping** | Tabs are clustered automatically by domain, tech stack, or keyword (GitHub repos, Stack Overflow, AI tools, docs, CI/CD, etc.) |
| **Sessions** | Snapshot all open tabs into a named session and restore them later |
| **Why did I open this?** | A lightweight prompt lets you attach a short intent note to any tab; visible in the popup and as a badge |
| **Cheat Sheet** | Docs pages you visit repeatedly (MDN, DevDocs, package registries, framework docs) are automatically collected into a personal reference list |
| **PR & Issue Sidebar** | Navigate to any GitHub pull request or issue and the side panel shows status, CI results, labels, reviewers, and description |
| **Inline Notes** | Select text on any page and pin a note to it via right-click → "Add ContextTab Note"; notes persist per URL and are highlighted on revisit |

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the project folder.
5. The ContextTab icon appears in your toolbar.

## Usage

- **Toolbar icon** → opens the popup with Groups, Sessions, Why?, and Cheat Sheet tabs.
- **⊞ sidebar icon** (in popup header) → opens the side panel for PR details and page notes.
- **Right-click on any page** → "Add ContextTab Note" (on selected text) or "Open ContextTab Sidebar".
- **Auto-group button** → groups all open tabs in the current window by detected context.

## Permissions

| Permission | Reason |
|---|---|
| `tabs`, `tabGroups` | Read tab URLs/titles; create and manage tab groups |
| `storage` | Persist sessions, reasons, cheat sheet, and notes locally |
| `sidePanel` | Open the side panel |
| `contextMenus` | Right-click menu entries |
| `scripting`, `activeTab` | Inject content script actions |
| `api.github.com` | Fetch public PR/issue data (no auth required) |
