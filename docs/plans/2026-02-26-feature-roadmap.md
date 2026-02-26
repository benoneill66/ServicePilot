# ServicePilot Feature Roadmap

## 1. Log Level Highlighting

Parse log output and color-code lines by severity level (ERROR, WARN, INFO, DEBUG). Detect common log formats (plain prefixes, JSON structured logs, bracketed levels). Apply distinct background or text colors per level in the log viewer. Add a filter dropdown to show/hide specific levels.

**Scope:**
- Regex-based detection of log levels from stdout/stderr lines
- Color scheme: red for ERROR, yellow for WARN, blue/default for INFO, gray for DEBUG
- Optional filter toggles in the log viewer toolbar
- Configurable patterns for projects with non-standard log formats

---

## 2. Crash Count & Uptime Tracking

Track per-service runtime statistics: current uptime, total crash count per session, and last crash timestamp. Display this info in the sidebar or as a tooltip on status indicators.

**Scope:**
- Track `startedAt` timestamp when a service enters "running" state
- Increment crash counter when status transitions to "crashed"
- Store `lastCrashedAt` timestamp
- Display uptime as human-readable duration (e.g., "2h 14m")
- Show crash count badge on the status dot or in a tooltip
- Reset counters on app restart (session-scoped, not persisted)

---

## 3. System Notifications

Send native macOS notifications when key service events occur: crashes, ready state, or error pattern matches in logs.

**Scope:**
- Use Tauri's notification plugin for native OS notifications
- Notify on: service crash, service ready, matched error pattern in logs
- Global toggle to enable/disable notifications
- Per-service toggle to mute noisy services
- Configurable error pattern (regex) that triggers a notification when matched in logs
- Rate-limit notifications to avoid spam (e.g., max 1 per service per 10 seconds)

---

## 4. Split Log View

View logs from multiple services side-by-side in a split pane layout. Useful for debugging interactions between services.

**Scope:**
- Add a "split" button or drag-to-split gesture in the log viewer area
- Support 2-panel horizontal split (left/right)
- Each panel independently selects which service's logs to display
- Each panel has its own scroll position, search, and clear controls
- Close split to return to single-panel view
- Keyboard shortcut to toggle split mode

---

## 5. Drag-and-Drop Sidebar Reordering

Allow reordering of scripts and workflows in the sidebar via drag-and-drop. Persist custom ordering to config.

**Scope:**
- Drag handles on sidebar items (scripts within a repo, workflows in the workflow section)
- Visual feedback during drag (insertion indicator line, item opacity change)
- Reorder workflows relative to each other
- Reorder scripts within a repo group
- Persist custom sort order in `~/.servicepilot/config.json`
- Reset to default (alphabetical) option via context menu
