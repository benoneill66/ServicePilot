# Log Level Highlighting & Split Log View Design

## Feature 1: Log Level Highlighting

### Detection

A utility function `detectLogLevel(line: string): LogLevel | null` strips ANSI codes then checks against ordered regexes (first match wins):

| Level | Patterns (case-insensitive) |
|-------|---------------------------|
| ERROR | `\b(ERROR|ERR|FATAL|PANIC)\b`, `\[error\]`, `error:` at line start |
| WARN  | `\b(WARN|WARNING)\b`, `\[warn\]` |
| DEBUG | `\b(DEBUG|TRACE|VERBOSE)\b`, `\[debug\]` |
| INFO  | `\b(INFO)\b`, `\[info\]` — detected but no special styling (default) |

Checked in that priority order so ERROR wins if a line contains both "ERROR" and "INFO".

### Visual Treatment

- A colored left border (3px) on the log row: red for ERROR, yellow for WARN, gray for DEBUG. INFO gets no border (clean default).
- A very subtle background tint (`bg-red/5`) for ERROR and WARN only — enough to catch the eye without clashing with existing ANSI colors.
- No change to the actual text rendering — `ansi-to-react` still handles all text coloring.

### Filter Toggles

- Small pill buttons in the toolbar row next to the existing search: ERR, WARN, INFO, DBG.
- Each pill is colored to match its level, with a filled/outline toggle state.
- All enabled by default. Click to disable (grayed out + strikethrough). Lines of that level are hidden from the list.
- Composable with text search — both filters apply: level filter first, then text search on the remaining lines.
- Line count in the header updates to reflect combined filtering.

### Data Flow

```
lines[] -> useMemo: detectLogLevel per line -> leveledLines: {text, level}[]
         -> useMemo: apply level filter + text search -> filteredLines[]
         -> Virtuoso renders filteredLines with level-based styling
```

No changes to useSidecar, the sidecar, or the IPC protocol.

---

## Feature 2: Split Log View

### Panel State

`App.tsx` gains a `panels` state — an array of 1-4 panel configs:

```ts
type Panel = {
  id: string;                  // unique key
  serviceId: string | null;    // which service's logs to show, null = "pick a service"
};
```

Default: single panel showing the currently selected service (current behavior). When a user clicks a service in the sidebar, it targets the last focused panel.

### Grid Layout

A `<LogGrid>` wrapper component handles layout with CSS grid:

| Panels | Layout |
|--------|--------|
| 1 | 1fr — full width (current behavior) |
| 2 | 1fr 1fr — side by side |
| 3 | Top row 1fr 1fr, bottom row 1fr spanning full width |
| 4 | 1fr 1fr / 1fr 1fr — 2x2 grid |

A 1px border-border divider between panels. Each panel gets a thin colored top-border matching its service color for quick identification.

### Panel Header

Each panel gets a compact header row containing:
- Service selector: a dropdown showing all available services, with the current service's color dot.
- Close button (x): removes this panel (disabled when only 1 panel remains).
- The existing toolbar controls (search, level filters, clear, copy, line count) all live inside each panel independently.

### Adding/Removing Panels

- "Add panel" button: appears in the toolbar area when < 4 panels. New panel opens with no service selected (shows "Select a service" prompt).
- Close button on each panel header removes it. Last panel can't be closed.
- Keyboard shortcut: Cmd+\ adds a panel. Cmd+Shift+\ removes the focused panel.

### Focus Tracking

A `focusedPanelId` state in `App.tsx`. Clicking anywhere inside a panel sets it as focused (subtle highlight on the panel border). Sidebar clicks route to the focused panel's serviceId.

### Independence

Each panel is a fully independent `<LogViewer>` instance — own scroll position, own search filter, own level filters, own clear. No shared state between panels except the available services list.
