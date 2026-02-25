# Sidebar Workflow Launchpad Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat favorites + repo list sidebar with a two-tier "Workflow Launchpad" — user-defined workflow groups on top, all scripts below.

**Architecture:** The sidecar gets new workflow CRUD commands and a config migration from favourites to workflows. The frontend sidebar is rewritten with a WorkflowSection (top) and AllScriptsSection (bottom), sharing a redesigned ScriptRow with glowing status dots. A modal component handles workflow creation/editing.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tauri sidecar protocol (JSON over stdin/stdout)

---

### Task 1: Add Workflow type and new commands to sidecar protocol

**Files:**
- Modify: `sidecar/protocol.ts:1-31`
- Modify: `desktop/src/types.ts:1-31`

**Step 1: Update sidecar protocol types**

In `sidecar/protocol.ts`, add Workflow interface and new command types:

```typescript
// Add after existing imports/types
export interface Workflow {
  id: string;
  name: string;
  scriptIds: string[];
  collapsed: boolean;
}
```

Add to the `Command` union:

```typescript
  | { type: "get-workflows" }
  | { type: "create-workflow"; name: string; scriptIds: string[] }
  | { type: "update-workflow"; id: string; name?: string; scriptIds?: string[]; collapsed?: boolean }
  | { type: "delete-workflow"; id: string }
  | { type: "reorder-workflows"; ids: string[] }
  | { type: "start-workflow"; id: string }
  | { type: "stop-workflow"; id: string }
```

Add to the `Event` union:

```typescript
  | { type: "workflows"; workflows: Workflow[] }
```

**Step 2: Mirror the types in the frontend**

In `desktop/src/types.ts`, add matching `Workflow` interface, update `Command` and `SidecarEvent` unions identically.

**Step 3: Commit**

```bash
git add sidecar/protocol.ts desktop/src/types.ts
git commit -m "feat: add workflow types and commands to sidecar protocol"
```

---

### Task 2: Update sidecar config to support workflows + migration

**Files:**
- Modify: `sidecar/config.ts:1-85`

**Step 1: Update Config interface and add workflow functions**

Update the `Config` interface:

```typescript
export interface Config {
  repos: string[];
  aliases: Record<string, string>;
  workflows: Workflow[];
  // favourites is kept optional for migration detection
  favourites?: string[];
}

interface Workflow {
  id: string;
  name: string;
  scriptIds: string[];
  collapsed: boolean;
}
```

Update `defaultConfig`:

```typescript
function defaultConfig(): Config {
  return { repos: [], aliases: {}, workflows: [] };
}
```

**Step 2: Add migration logic to loadConfig**

After parsing the JSON, check if `favourites` exists and `workflows` doesn't. If so, create a "Favourites" workflow from the favourite IDs, delete the `favourites` key, and save:

```typescript
export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      // Migrate favourites -> workflow
      if (raw.favourites && !raw.workflows) {
        raw.workflows = raw.favourites.length > 0
          ? [{ id: crypto.randomUUID(), name: "Favourites", scriptIds: raw.favourites, collapsed: false }]
          : [];
        delete raw.favourites;
        saveConfig(raw);
      }
      if (!raw.workflows) raw.workflows = [];
      return raw;
    }
  } catch {}
  return defaultConfig();
}
```

**Step 3: Add workflow CRUD functions**

```typescript
export function getWorkflows(): Workflow[] {
  return loadConfig().workflows;
}

export function createWorkflow(name: string, scriptIds: string[]): Config {
  const config = loadConfig();
  config.workflows.push({ id: crypto.randomUUID(), name, scriptIds, collapsed: false });
  saveConfig(config);
  return config;
}

export function updateWorkflow(id: string, updates: { name?: string; scriptIds?: string[]; collapsed?: boolean }): Config {
  const config = loadConfig();
  const wf = config.workflows.find((w) => w.id === id);
  if (wf) {
    if (updates.name !== undefined) wf.name = updates.name;
    if (updates.scriptIds !== undefined) wf.scriptIds = updates.scriptIds;
    if (updates.collapsed !== undefined) wf.collapsed = updates.collapsed;
    saveConfig(config);
  }
  return config;
}

export function deleteWorkflow(id: string): Config {
  const config = loadConfig();
  config.workflows = config.workflows.filter((w) => w.id !== id);
  saveConfig(config);
  return config;
}

export function reorderWorkflows(ids: string[]): Config {
  const config = loadConfig();
  const map = new Map(config.workflows.map((w) => [w.id, w]));
  config.workflows = ids.map((id) => map.get(id)!).filter(Boolean);
  saveConfig(config);
  return config;
}
```

**Step 4: Remove `toggleFavourite` and `getFavourites` functions**

Delete the `toggleFavourite` and `getFavourites` functions entirely. Keep `renameScript` and `getAliases`.

**Step 5: Commit**

```bash
git add sidecar/config.ts
git commit -m "feat: add workflow CRUD to config with favourites migration"
```

---

### Task 3: Handle new workflow commands in sidecar main

**Files:**
- Modify: `sidecar/main.ts:1-132`

**Step 1: Update imports**

Replace `toggleFavourite, getFavourites` with `getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, reorderWorkflows`:

```typescript
import { addRepo, removeRepo, renameScript, getAliases, getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, reorderWorkflows } from "./config.js";
```

**Step 2: Add emitWorkflows helper**

```typescript
function emitWorkflows() {
  emit({ type: "workflows", workflows: getWorkflows() });
}
```

**Step 3: Update emitServiceList**

Remove `getFavourites()` call and `favourite` field from the mapped services. The `favourite` field is no longer needed — workflows replace it:

```typescript
function emitServiceList() {
  const aliases = getAliases();
  emit({
    type: "services",
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      repo: s.repo,
      repoPath: s.cwd,
      port: s.port,
      color: s.color,
      alias: aliases[s.id],
    })),
  });
}
```

**Step 4: Update `list` command handler to also emit workflows**

```typescript
case "list":
  refreshServices();
  emitServiceList();
  emitWorkflows();
  break;
```

**Step 5: Remove `toggle-favourite` case, add workflow command handlers**

```typescript
case "get-workflows":
  emitWorkflows();
  break;

case "create-workflow":
  createWorkflow(cmd.name, cmd.scriptIds);
  emitWorkflows();
  break;

case "update-workflow":
  updateWorkflow(cmd.id, { name: cmd.name, scriptIds: cmd.scriptIds, collapsed: cmd.collapsed });
  emitWorkflows();
  break;

case "delete-workflow":
  deleteWorkflow(cmd.id);
  emitWorkflows();
  break;

case "reorder-workflows":
  reorderWorkflows(cmd.ids);
  emitWorkflows();
  break;

case "start-workflow": {
  const wfs = getWorkflows();
  const wf = wfs.find((w) => w.id === cmd.id);
  if (wf) {
    for (const scriptId of wf.scriptIds) {
      const svc = services.find((s) => s.id === scriptId);
      if (svc) processManager.start(svc);
    }
  }
  break;
}

case "stop-workflow": {
  const wfs = getWorkflows();
  const wf = wfs.find((w) => w.id === cmd.id);
  if (wf) {
    for (const scriptId of wf.scriptIds) {
      processManager.stop(scriptId);
    }
  }
  break;
}
```

**Step 6: Commit**

```bash
git add sidecar/main.ts
git commit -m "feat: handle workflow commands in sidecar main"
```

---

### Task 4: Update frontend types and useSidecar hook

**Files:**
- Modify: `desktop/src/types.ts:1-31`
- Modify: `desktop/src/hooks/use-sidecar.ts:1-117`

**Step 1: Update ServiceInfo — remove `favourite` field**

In `desktop/src/types.ts`, remove the `favourite: boolean` field from `ServiceInfo`. (Already added `Workflow` and new commands in Task 1.)

**Step 2: Update useSidecar hook**

Add `workflows` state:

```typescript
const [workflows, setWorkflows] = useState<Workflow[]>([]);
```

Handle the new `"workflows"` event in the stdout listener:

```typescript
case "workflows":
  setWorkflows(event.workflows);
  break;
```

Add new action functions:

```typescript
const createWorkflow = useCallback(
  (name: string, scriptIds: string[]) => send({ type: "create-workflow", name, scriptIds }),
  [send]
);
const updateWorkflow = useCallback(
  (id: string, name?: string, scriptIds?: string[], collapsed?: boolean) =>
    send({ type: "update-workflow", id, name, scriptIds, collapsed }),
  [send]
);
const deleteWorkflow = useCallback(
  (id: string) => send({ type: "delete-workflow", id }),
  [send]
);
const reorderWorkflows = useCallback(
  (ids: string[]) => send({ type: "reorder-workflows", ids }),
  [send]
);
const startWorkflow = useCallback(
  (id: string) => send({ type: "start-workflow", id }),
  [send]
);
const stopWorkflow = useCallback(
  (id: string) => send({ type: "stop-workflow", id }),
  [send]
);
```

Remove `toggleFavourite`. Add all new functions to the return object along with `workflows`.

**Step 3: Commit**

```bash
git add desktop/src/types.ts desktop/src/hooks/use-sidecar.ts
git commit -m "feat: add workflow state and actions to useSidecar hook"
```

---

### Task 5: Add glowing status dot styles to CSS

**Files:**
- Modify: `desktop/src/index.css:1-28`

**Step 1: Add glow utility classes**

After the existing CSS, add custom styles for the status dot glow effects:

```css
/* Status dot glow effects */
.dot-glow-green {
  box-shadow: 0 0 6px 1px rgba(76, 175, 80, 0.6);
}
.dot-glow-red {
  box-shadow: 0 0 6px 1px rgba(244, 67, 54, 0.6);
}
.dot-glow-yellow {
  box-shadow: 0 0 6px 1px rgba(255, 193, 7, 0.5);
}
```

**Step 2: Commit**

```bash
git add desktop/src/index.css
git commit -m "feat: add status dot glow CSS utilities"
```

---

### Task 6: Create the WorkflowModal component

**Files:**
- Create: `desktop/src/components/workflow-modal.tsx`

**Step 1: Build the modal**

This is a simple modal for creating/editing workflows. It needs:
- A text input for the workflow name
- A scrollable checkbox list of all available scripts (grouped by repo)
- Save and Cancel buttons
- When editing, pre-populate with existing name + selected scripts

Props:

```typescript
interface Props {
  services: ServiceInfo[];
  existingWorkflow?: { id: string; name: string; scriptIds: string[] } | null;
  onSave: (name: string, scriptIds: string[]) => void;
  onCancel: () => void;
}
```

The modal is a fixed overlay with a centered dark panel. The script list shows checkboxes with `repo/scriptName` format. The save button is disabled if name is empty or no scripts are selected.

Style it consistently with the existing app: `bg-surface`, `border-border`, `text-text`, same `text-[11px]` sizing, monospace font. Use accent color for the save button.

**Step 2: Commit**

```bash
git add desktop/src/components/workflow-modal.tsx
git commit -m "feat: add WorkflowModal component for creating/editing workflows"
```

---

### Task 7: Rewrite the Sidebar component

**Files:**
- Modify: `desktop/src/components/sidebar.tsx:1-333` (full rewrite)

This is the largest task. The sidebar becomes two sections with a redesigned ScriptRow.

**Step 1: Update Props interface**

Replace the current Props with:

```typescript
interface Props {
  width: number;
  services: ServiceInfo[];
  statuses: Record<string, ServiceStatus>;
  workflows: Workflow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, running: boolean) => void;
  onRestart: (id: string) => void;
  onClearLog: (id: string) => void;
  onAddRepo: () => void;
  onRemoveRepo: (path: string) => void;
  onRenameScript: (id: string, alias: string) => void;
  // Workflow actions
  onCreateWorkflow: (name: string, scriptIds: string[]) => void;
  onUpdateWorkflow: (id: string, name?: string, scriptIds?: string[], collapsed?: boolean) => void;
  onDeleteWorkflow: (id: string) => void;
  onStartWorkflow: (id: string) => void;
  onStopWorkflow: (id: string) => void;
}
```

**Step 2: Redesign STATUS_CONFIG with glow classes**

```typescript
const STATUS_CONFIG: Record<ServiceStatus, { dotColor: string; glowClass: string }> = {
  stopped:  { dotColor: "border border-gray-500 bg-transparent", glowClass: "" },
  starting: { dotColor: "bg-yellow animate-pulse", glowClass: "dot-glow-yellow" },
  running:  { dotColor: "bg-green", glowClass: "dot-glow-green" },
  crashed:  { dotColor: "bg-red", glowClass: "dot-glow-red" },
};
```

**Step 3: Redesign ScriptRow**

Larger status dot (8px = `w-2 h-2`), glow effect, active state with left accent border. Remove the favourite star button. Keep hover-reveal restart/stop actions:

```tsx
function ScriptRow({ svc, status, isActive, onSelect, onToggle, onRename, showRepo }: { ... }) {
  const config = STATUS_CONFIG[status];
  const isRunning = status === "running" || status === "starting";
  // ... existing editing state ...

  return (
    <div
      className={`group flex items-center gap-2 pl-4 pr-2 py-1 cursor-pointer transition-colors ${
        isActive ? "bg-surface-hover border-l-2 border-l-accent" : "hover:bg-surface-hover border-l-2 border-l-transparent"
      }`}
      onClick={onSelect}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${config.dotColor} ${config.glowClass}`} />
      {/* name + inline edit (same as before minus favourite star) */}
      {/* hover action buttons: restart icon + stop/start */}
    </div>
  );
}
```

**Step 4: Build StatusDotRow component**

A compact row of mini dots summarizing a workflow's script statuses:

```tsx
function StatusDotRow({ scriptIds, statuses }: { scriptIds: string[]; statuses: Record<string, ServiceStatus> }) {
  return (
    <div className="flex gap-0.5 items-center">
      {scriptIds.map((id) => {
        const st = statuses[id] ?? "stopped";
        const cfg = STATUS_CONFIG[st];
        return <div key={id} className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />;
      })}
    </div>
  );
}
```

**Step 5: Build WorkflowSection**

The top section showing workflow groups:

```tsx
function WorkflowSection({ workflows, services, statuses, activeId, onSelect, onToggle, onRename, onUpdateWorkflow, onDeleteWorkflow, onStartWorkflow, onStopWorkflow, onShowModal }: { ... }) {
  return (
    <div>
      <div className="flex items-center px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex-1">Workflows</span>
        <button onClick={onShowModal} className="text-[10px] px-1.5 py-0.5 rounded bg-border hover:bg-accent hover:text-bg transition-all">+</button>
      </div>

      {workflows.map((wf) => {
        const runningCount = wf.scriptIds.filter((id) => {
          const st = statuses[id];
          return st === "running" || st === "starting";
        }).length;
        const anyRunning = runningCount > 0;

        return (
          <div key={wf.id}>
            {/* Header row: chevron, name, status dots, fraction count */}
            <div
              className="group flex items-center gap-1.5 px-2 py-1.5 border-t border-border cursor-pointer hover:bg-surface-hover select-none"
              onClick={() => onUpdateWorkflow(wf.id, undefined, undefined, !wf.collapsed)}
            >
              <span className={`text-[10px] text-text-dim transition-transform ${wf.collapsed ? "" : "rotate-90"}`}>▶</span>
              <span className="text-[11px] font-bold text-text flex-1 truncate">{wf.name}</span>
              <StatusDotRow scriptIds={wf.scriptIds} statuses={statuses} />
              <span className="text-[10px] text-text-dim ml-1">{runningCount}/{wf.scriptIds.length}</span>
            </div>

            {/* Start All / Stop All button */}
            <div className="px-3 pb-1">
              <button
                onClick={() => anyRunning ? onStopWorkflow(wf.id) : onStartWorkflow(wf.id)}
                className={`text-[10px] px-2 py-0.5 rounded transition-all ${
                  anyRunning ? "bg-red/20 text-red hover:bg-red/30" : "bg-green/20 text-green hover:bg-green/30"
                }`}
              >
                {anyRunning ? "■ Stop All" : "▶ Start All"}
              </button>
            </div>

            {/* Expanded script list */}
            {!wf.collapsed && wf.scriptIds.map((id) => {
              const svc = services.find((s) => s.id === id);
              if (!svc) return null;
              return (
                <ScriptRow
                  key={id}
                  svc={svc}
                  status={statuses[id] ?? "stopped"}
                  isActive={id === activeId}
                  onSelect={() => onSelect(id)}
                  onToggle={onToggle}
                  onRename={onRename}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 6: Build AllScriptsSection**

The bottom section with repo groups. Same structure as current repo sections but with the `favourite` star removed and status dots on the repo header:

```tsx
function AllScriptsSection({ repos, statuses, activeId, search, onSearch, onSelect, onToggle, onRename, onRemoveRepo }: { ... }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Default to all collapsed when there are workflow groups
  // Show status dots + running/total on repo headers
  // Filter by search query
  // Same ScriptRow component for individual scripts
}
```

**Step 7: Compose the Sidebar**

The main `Sidebar` component manages modal state and composes the sections:

```tsx
export function Sidebar({ width, services, statuses, workflows, ... }: Props) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  const repos = useMemo(() => { /* group services by repoPath */ }, [services]);

  return (
    <div className="flex flex-col border-r border-border bg-surface shrink-0" style={{ width }}>
      {/* Header with Import button */}
      {/* WorkflowSection */}
      {/* Divider */}
      {/* AllScriptsSection header with search toggle */}
      {/* AllScriptsSection */}

      {/* WorkflowModal (conditionally rendered) */}
      {showModal && <WorkflowModal ... />}
    </div>
  );
}
```

**Step 8: Commit**

```bash
git add desktop/src/components/sidebar.tsx
git commit -m "feat: rewrite sidebar with workflow launchpad layout"
```

---

### Task 8: Update App.tsx to wire up workflow props

**Files:**
- Modify: `desktop/src/App.tsx:1-165`

**Step 1: Destructure new workflow functions from useSidecar**

```typescript
const {
  services, statuses, logs, error, workflows,
  startService, stopService, restartService, stopAll, clearLog,
  addRepo, removeRepo, renameScript,
  createWorkflow, updateWorkflow, deleteWorkflow, startWorkflow, stopWorkflow,
} = useSidecar();
```

**Step 2: Pass new props to Sidebar**

Add to the `<Sidebar>` JSX:

```tsx
workflows={workflows}
onCreateWorkflow={createWorkflow}
onUpdateWorkflow={updateWorkflow}
onDeleteWorkflow={deleteWorkflow}
onStartWorkflow={startWorkflow}
onStopWorkflow={stopWorkflow}
```

Remove `onToggleFavourite={toggleFavourite}`.

**Step 3: Commit**

```bash
git add desktop/src/App.tsx
git commit -m "feat: wire workflow props through App to Sidebar"
```

---

### Task 9: Build sidecar and smoke test

**Step 1: Build the sidecar binary**

```bash
cd /Users/benoneill/Desktop/ServicePilot && bash scripts/build-sidecar.sh
```

**Step 2: Run the dev server**

```bash
cd /Users/benoneill/Desktop/ServicePilot/desktop && npm run tauri dev
```

**Step 3: Verify**

- App launches without errors
- If existing config had favourites, they appear as a "Favourites" workflow group
- Can create a new workflow group via [+] button
- Can expand/collapse workflow groups
- Start All / Stop All buttons work
- All Scripts section shows repos with status dots
- Status dot glow effects are visible on running scripts
- Selecting a script shows its logs in the right panel

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```

---

### Task 10: Add right-click context menus

**Files:**
- Modify: `desktop/src/components/sidebar.tsx`

**Step 1: Add a simple ContextMenu component**

A positioned dropdown that appears on right-click. Takes `x, y, items: { label, onClick }[]` and renders at the mouse position. Closes on click-outside or Escape.

**Step 2: Add context menu to workflow group headers**

Right-click a workflow header shows: "Rename", "Edit Scripts...", "Delete"

- Rename: inline edit on the name (similar to ScriptRow rename)
- Edit Scripts: opens the WorkflowModal in edit mode
- Delete: calls `onDeleteWorkflow` directly

**Step 3: Add context menu to script rows in All Scripts section**

Right-click a script shows: "Add to Workflow >" with a submenu listing all workflow groups. Clicking one calls `onUpdateWorkflow` with the script ID appended to that workflow's `scriptIds`.

**Step 4: Commit**

```bash
git add desktop/src/components/sidebar.tsx
git commit -m "feat: add right-click context menus for workflow and script management"
```
