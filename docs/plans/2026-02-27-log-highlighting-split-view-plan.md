# Log Level Highlighting & Split Log View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add log level detection with color-coded highlighting and level filter toggles, plus a multi-panel split log view supporting up to 4 simultaneous service log panels.

**Architecture:** Frontend-only changes. Log level detection runs as a `useMemo` in `LogViewer`, parsing each raw line via regex after ANSI stripping. Split view replaces the single `LogViewer` in `App.tsx` with a `LogGrid` component managing 1-4 independent `LogViewer` panels in a CSS grid. No sidecar or IPC changes needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-virtuoso

---

## Task 1: Log Level Detection Utility

**Files:**
- Create: `desktop/src/utils/log-levels.ts`

**Step 1: Create the log level detection module**

```ts
// desktop/src/utils/log-levels.ts
export type LogLevel = "error" | "warn" | "info" | "debug";

// Strip ANSI escape codes for matching
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

const LEVEL_PATTERNS: [LogLevel, RegExp][] = [
  ["error", /\b(ERROR|ERR|FATAL|PANIC)\b/i],
  ["warn", /\b(WARN|WARNING)\b/i],
  ["debug", /\b(DEBUG|TRACE|VERBOSE)\b/i],
  ["info", /\b(INFO)\b/i],
];

export function detectLogLevel(line: string): LogLevel | null {
  const plain = stripAnsi(line);
  for (const [level, pattern] of LEVEL_PATTERNS) {
    if (pattern.test(plain)) return level;
  }
  return null;
}

export { stripAnsi };
```

**Step 2: Verify manually**

Run: `cd desktop && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add desktop/src/utils/log-levels.ts
git commit -m "feat: add log level detection utility"
```

---

## Task 2: Add Log Level Highlighting to LogViewer

**Files:**
- Modify: `desktop/src/components/log-viewer.tsx`

**Step 1: Import the detection utility and add level state**

At the top of `log-viewer.tsx`, replace the local `stripAnsi` function and add imports:

```ts
import { detectLogLevel, stripAnsi, type LogLevel } from "../utils/log-levels";
```

Remove the existing `stripAnsi` function (lines 13-15) since it's now imported.

**Step 2: Add level-aware data pipeline**

Inside the `LogViewer` component, after the existing `filter`/`showSearch` state declarations, add:

```ts
const [enabledLevels, setEnabledLevels] = useState<Record<LogLevel, boolean>>({
  error: true,
  warn: true,
  info: true,
  debug: true,
});

const toggleLevel = useCallback((level: LogLevel) => {
  setEnabledLevels((prev) => ({ ...prev, [level]: !prev[level] }));
}, []);
```

Replace the existing `filtered` useMemo (lines 24-28) with a two-stage pipeline:

```ts
const leveledLines = useMemo(
  () => lines.map((text) => ({ text, level: detectLogLevel(text) })),
  [lines]
);

const filtered = useMemo(() => {
  let result = leveledLines;
  // Level filter
  const anyDisabled = Object.values(enabledLevels).some((v) => !v);
  if (anyDisabled) {
    result = result.filter(
      (l) => l.level === null || enabledLevels[l.level]
    );
  }
  // Text search filter
  if (filter) {
    const lower = filter.toLowerCase();
    result = result.filter((l) =>
      stripAnsi(l.text).toLowerCase().includes(lower)
    );
  }
  return result;
}, [leveledLines, enabledLevels, filter]);
```

**Step 3: Update Virtuoso rendering with level-based styling**

Replace the `itemContent` prop on `<Virtuoso>` (lines 171-174):

```tsx
itemContent={(index) => {
  const { text, level } = filtered[index]!;
  const borderClass =
    level === "error"
      ? "border-l-3 border-l-red bg-red/5"
      : level === "warn"
        ? "border-l-3 border-l-yellow bg-yellow/5"
        : level === "debug"
          ? "border-l-3 border-l-text-dim"
          : "";
  return (
    <div
      className={`px-4 py-px hover:bg-surface-hover leading-5 select-text cursor-text ${borderClass}`}
    >
      <Ansi>{text}</Ansi>
    </div>
  );
}}
```

**Step 4: Update all references to `filtered`**

Since `filtered` is now `{text, level}[]` instead of `string[]`, update these references:

- `copyAll`: change `filtered.join("\n")` to `filtered.map(l => l.text).join("\n")`
- Line count display: `filtered.length` stays the same (no change needed)
- The `followOutput` ternary: still uses `filter` string state (no change needed)

**Step 5: Verify manually**

Run: `cd desktop && npx tsc --noEmit`
Expected: No type errors

Run: `cd desktop && npm run dev`
Expected: Log lines with ERROR/WARN/DEBUG show colored left borders. INFO and undetected lines render as before.

**Step 6: Commit**

```bash
git add desktop/src/components/log-viewer.tsx
git commit -m "feat: add log level highlighting with colored borders"
```

---

## Task 3: Add Level Filter Toggle Pills

**Files:**
- Modify: `desktop/src/components/log-viewer.tsx`

**Step 1: Add the filter toggle pills to the toolbar**

In the toolbar `<div>` (the row with service name, line count, Search, Copy All, Clear buttons), insert level filter pills just before the line count `<span>`. Place them after the "— logs" span (around line 107):

```tsx
<div className="flex items-center gap-1 ml-2">
  {(["error", "warn", "info", "debug"] as LogLevel[]).map((level) => {
    const enabled = enabledLevels[level];
    const colors: Record<LogLevel, string> = {
      error: "text-red border-red",
      warn: "text-yellow border-yellow",
      info: "text-accent border-accent",
      debug: "text-text-dim border-text-dim",
    };
    const labels: Record<LogLevel, string> = {
      error: "ERR",
      warn: "WARN",
      info: "INFO",
      debug: "DBG",
    };
    return (
      <button
        key={level}
        onClick={() => toggleLevel(level)}
        className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
          enabled
            ? `${colors[level]} bg-transparent`
            : "text-text-dim/40 border-text-dim/20 line-through"
        }`}
      >
        {labels[level]}
      </button>
    );
  })}
</div>
```

**Step 2: Update line count to reflect level filtering**

Update the line count span to show filtered count whenever any filter is active (level or text):

```tsx
<span className="text-xs text-text-dim ml-auto">
  {filter || Object.values(enabledLevels).some((v) => !v)
    ? `${filtered.length} / ${lines.length} lines`
    : `${lines.length} lines`}
</span>
```

**Step 3: Verify manually**

Run: `cd desktop && npm run dev`
Expected: ERR/WARN/INFO/DBG pills visible in toolbar. Clicking one grays it out and hides matching lines. Line count updates.

**Step 4: Commit**

```bash
git add desktop/src/components/log-viewer.tsx
git commit -m "feat: add log level filter toggle pills"
```

---

## Task 4: Add Panel Type and LogGrid Component

**Files:**
- Modify: `desktop/src/types.ts` (add Panel type)
- Create: `desktop/src/components/log-grid.tsx`

**Step 1: Add Panel type to types.ts**

Append to `desktop/src/types.ts`:

```ts
export interface Panel {
  id: string;
  serviceId: string | null;
}
```

**Step 2: Create the LogGrid component**

```tsx
// desktop/src/components/log-grid.tsx
import { useCallback } from "react";
import { LogViewer } from "./log-viewer";
import type { ServiceInfo, ServiceStatus, Panel } from "../types";

interface Props {
  panels: Panel[];
  focusedPanelId: string;
  services: ServiceInfo[];
  statuses: Record<string, ServiceStatus>;
  logs: Record<string, string[]>;
  colorMap: Record<string, string>;
  onFocusPanel: (panelId: string) => void;
  onChangePanelService: (panelId: string, serviceId: string) => void;
  onRemovePanel: (panelId: string) => void;
  onClearLog: (serviceId: string) => void;
}

export function LogGrid({
  panels,
  focusedPanelId,
  services,
  statuses,
  logs,
  colorMap,
  onFocusPanel,
  onChangePanelService,
  onRemovePanel,
  onClearLog,
}: Props) {
  const gridClass =
    panels.length === 1
      ? "grid-cols-1 grid-rows-1"
      : panels.length === 2
        ? "grid-cols-2 grid-rows-1"
        : panels.length === 3
          ? "grid-cols-2 grid-rows-2"
          : "grid-cols-2 grid-rows-2";

  return (
    <div className={`flex-1 grid ${gridClass} overflow-hidden`}>
      {panels.map((panel, i) => {
        const service = services.find((s) => s.id === panel.serviceId);
        const isFocused = panel.id === focusedPanelId;

        return (
          <div
            key={panel.id}
            className={`flex flex-col min-h-0 overflow-hidden border-border ${
              isFocused ? "ring-1 ring-accent/40 ring-inset" : ""
            } ${panels.length === 3 && i === 2 ? "col-span-2" : ""}`}
            style={{
              borderRightWidth: panels.length > 1 && i % 2 === 0 ? 1 : 0,
              borderBottomWidth:
                panels.length > 2 && i < 2 ? 1 : 0,
            }}
            onMouseDown={() => onFocusPanel(panel.id)}
          >
            {/* Service selector header */}
            <div
              className="px-3 py-1.5 border-b border-border flex items-center gap-2 bg-surface shrink-0"
              style={{
                borderTopWidth: 2,
                borderTopColor: service
                  ? colorMap[service.color] ?? "#e0e0e0"
                  : "transparent",
                borderTopStyle: "solid",
              }}
            >
              <select
                value={panel.serviceId ?? ""}
                onChange={(e) =>
                  onChangePanelService(panel.id, e.target.value)
                }
                className="bg-surface text-text text-xs border border-border rounded px-1.5 py-0.5 focus:border-accent focus:outline-none flex-1 min-w-0"
              >
                <option value="" disabled>
                  Select a service...
                </option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.repo} → {s.alias ?? s.name}
                  </option>
                ))}
              </select>
              {panels.length > 1 && (
                <button
                  onClick={() => onRemovePanel(panel.id)}
                  className="text-text-dim hover:text-text text-xs px-1 rounded hover:bg-surface-hover transition"
                >
                  ✕
                </button>
              )}
            </div>
            {/* Log viewer */}
            {service ? (
              <LogViewer
                serviceName={`${service.repo} → ${service.alias ?? service.name}`}
                serviceColor={colorMap[service.color] ?? "#e0e0e0"}
                lines={logs[service.id] ?? []}
                onClear={() => onClearLog(service.id)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
                Select a service to view logs
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Verify manually**

Run: `cd desktop && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add desktop/src/types.ts desktop/src/components/log-grid.tsx
git commit -m "feat: add Panel type and LogGrid component"
```

---

## Task 5: Integrate LogGrid into App.tsx

**Files:**
- Modify: `desktop/src/App.tsx`

**Step 1: Add panel state and imports**

Add import at the top:

```ts
import { LogGrid } from "./components/log-grid";
import type { Panel } from "./types";
```

Remove the `LogViewer` import (line 6).

Inside `App()`, after `activeId` (line 57), add panel state:

```ts
let panelCounter = useRef(1);
const [panels, setPanels] = useState<Panel[]>([
  { id: "panel-0", serviceId: null },
]);
const [focusedPanelId, setFocusedPanelId] = useState("panel-0");
```

**Step 2: Sync sidebar selection with focused panel**

Replace the `onSelect` handler in the `<Sidebar>` props. When a user clicks a service in the sidebar, it should both set it as the active service AND assign it to the focused panel:

```ts
onSelect={(id) => {
  const idx = services.findIndex((s) => s.id === id);
  if (idx !== -1) setActiveIndex(idx);
  // Also assign to focused panel
  setPanels((prev) =>
    prev.map((p) =>
      p.id === focusedPanelId ? { ...p, serviceId: id } : p
    )
  );
}}
```

**Step 3: Add panel management callbacks**

After the `handleAddRepo` callback:

```ts
const addPanel = useCallback(() => {
  setPanels((prev) => {
    if (prev.length >= 4) return prev;
    const newId = `panel-${panelCounter.current++}`;
    return [...prev, { id: newId, serviceId: null }];
  });
}, []);

const removePanel = useCallback(
  (panelId: string) => {
    setPanels((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p.id !== panelId);
      // If we removed the focused panel, focus the first remaining
      if (panelId === focusedPanelId) {
        setFocusedPanelId(next[0]!.id);
      }
      return next;
    });
  },
  [focusedPanelId]
);

const changePanelService = useCallback(
  (panelId: string, serviceId: string) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === panelId ? { ...p, serviceId } : p))
    );
    // Also update the active index for sidebar highlighting
    const idx = services.findIndex((s) => s.id === serviceId);
    if (idx !== -1) setActiveIndex(idx);
  },
  [services]
);
```

**Step 4: Also sync the initial panel when activeService changes**

Add an effect that keeps the first panel's serviceId in sync if there's only one panel and the user hasn't manually picked yet (backward compat with sidebar click):

```ts
// Keep single-panel synced with sidebar selection
useEffect(() => {
  if (panels.length === 1 && activeService) {
    setPanels((prev) => [{ ...prev[0]!, serviceId: activeService.id }]);
  }
}, [activeService?.id, panels.length]);
```

**Step 5: Replace the LogViewer JSX with LogGrid**

Replace lines 158-171 in the return JSX (the `activeService ? <LogViewer ...> : <div>` ternary) with:

```tsx
{services.length === 0 ? (
  <div className="flex-1 flex items-center justify-center text-text-dim">
    Import a repo to get started
  </div>
) : (
  <LogGrid
    panels={panels}
    focusedPanelId={focusedPanelId}
    services={services}
    statuses={statuses}
    logs={logs}
    colorMap={COLOR_MAP}
    onFocusPanel={setFocusedPanelId}
    onChangePanelService={changePanelService}
    onRemovePanel={removePanel}
    onClearLog={clearLog}
  />
)}
```

**Step 6: Add the "Add Panel" button**

Add a small floating button in the top-right of the log area, or add it to the status bar. Simplest approach: add it to `StatusBar` or as a floating element. Let's put it in the status bar alongside the existing hints. Modify the `StatusBar` component to accept `panelCount` and `onAddPanel`:

In `desktop/src/components/status-bar.tsx`, update to:

```tsx
interface Props {
  runningCount: number;
  totalCount: number;
  panelCount: number;
  onAddPanel: () => void;
}

export function StatusBar({ runningCount, totalCount, panelCount, onAddPanel }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-surface text-xs text-text-dim">
      <div className="flex gap-4">
        <span>[Tab] next</span>
        <span>[r] restart</span>
        <span>[s] stop</span>
        <span>[Enter] start</span>
        <span>[q] quit all</span>
        <span>[⌘\] split</span>
      </div>
      <div className="flex items-center gap-3">
        {panelCount < 4 && (
          <button
            onClick={onAddPanel}
            className="text-text-dim hover:text-text hover:bg-surface-hover px-1.5 py-0.5 rounded transition"
          >
            + Split
          </button>
        )}
        <span>
          {runningCount}/{totalCount} running
        </span>
      </div>
    </div>
  );
}
```

Update the `<StatusBar>` usage in `App.tsx`:

```tsx
<StatusBar
  runningCount={runningCount}
  totalCount={services.length}
  panelCount={panels.length}
  onAddPanel={addPanel}
/>
```

**Step 7: Verify manually**

Run: `cd desktop && npx tsc --noEmit`
Expected: No type errors

Run: `cd desktop && npm run dev`
Expected: App renders with single panel (backward-compatible). Sidebar clicks still work. The "+ Split" button appears in the status bar.

**Step 8: Commit**

```bash
git add desktop/src/App.tsx desktop/src/components/log-grid.tsx desktop/src/components/status-bar.tsx
git commit -m "feat: integrate split log view with panel management"
```

---

## Task 6: Add Keyboard Shortcuts for Split View

**Files:**
- Modify: `desktop/src/hooks/use-keyboard.ts`
- Modify: `desktop/src/App.tsx` (pass new callbacks)

**Step 1: Add split shortcuts to useKeyboard**

Update the `Opts` interface in `use-keyboard.ts` to add:

```ts
onAddPanel: () => void;
onRemovePanel: () => void;
```

Add these cases in the `handler` function, before the existing `if (e.target instanceof HTMLInputElement)` guard (since these should work even in inputs, like Cmd+K):

```ts
// Cmd+\: add split panel
if (e.metaKey && e.key === "\\") {
  e.preventDefault();
  onAddPanel();
  return;
}
// Cmd+Shift+\: remove focused panel
if (e.metaKey && e.shiftKey && e.key === "|") {
  e.preventDefault();
  onRemovePanel();
  return;
}
```

**Step 2: Pass the callbacks from App.tsx**

Update the `useKeyboard` call in `App.tsx` to include:

```ts
onAddPanel: addPanel,
onRemovePanel: () => removePanel(focusedPanelId),
```

**Step 3: Verify manually**

Run: `cd desktop && npx tsc --noEmit`
Expected: No type errors

Run: `cd desktop && npm run dev`
Expected: Cmd+\ adds a panel. Cmd+Shift+\ removes the focused panel.

**Step 4: Commit**

```bash
git add desktop/src/hooks/use-keyboard.ts desktop/src/App.tsx
git commit -m "feat: add keyboard shortcuts for split view (Cmd+\\ and Cmd+Shift+\\)"
```

---

## Task 7: Polish and Edge Cases

**Files:**
- Modify: `desktop/src/components/log-viewer.tsx` (remove duplicate header when inside LogGrid)
- Modify: `desktop/src/components/log-grid.tsx` (minor polish)

**Step 1: Deduplicate the service name header**

When `LogViewer` is inside `LogGrid`, the service name is shown in both the LogGrid's service selector bar AND the LogViewer's own header. Update `LogViewer` to accept an optional `hideHeader` prop (default false). When true, skip rendering the service name and "— logs" text but keep the toolbar buttons (search, level filters, copy, clear, line count).

Add to Props:

```ts
hideHeader?: boolean;
```

In the toolbar div, conditionally render the service name:

```tsx
{!hideHeader && (
  <>
    <span className="font-bold" style={{ color: serviceColor }}>
      {serviceName}
    </span>
    <span className="text-text-dim">— logs</span>
  </>
)}
```

Pass `hideHeader` from `LogGrid`:

```tsx
<LogViewer
  serviceName={...}
  serviceColor={...}
  lines={...}
  onClear={...}
  hideHeader
/>
```

Also update the empty state rendering in `LogViewer` to respect `hideHeader`.

**Step 2: Handle Cmd+K clear in split view**

Currently `onClearLog` in `useKeyboard` clears the active service. In split mode, it should clear the focused panel's service. Update in `App.tsx`:

```ts
onClearLog: () => {
  const focusedPanel = panels.find((p) => p.id === focusedPanelId);
  const targetId = focusedPanel?.serviceId ?? activeId;
  if (targetId) clearLog(targetId);
},
```

**Step 3: Verify manually**

Run: `cd desktop && npm run dev`
Expected: No duplicate service names. Split panels work cleanly. Cmd+K clears the focused panel's logs.

**Step 4: Commit**

```bash
git add desktop/src/components/log-viewer.tsx desktop/src/components/log-grid.tsx desktop/src/App.tsx
git commit -m "feat: polish split view — deduplicate headers, fix Cmd+K targeting"
```
