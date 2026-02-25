# Sidebar Redesign: Workflow Launchpad

## Problem

The current sidebar is a flat list of favorites + collapsible repo groups. With ~80 scripts across 4 repos, it's hard to:
- Quickly see what's running vs stopped
- Launch a common set of scripts together (e.g., "Full Stack Dev")
- Prioritize the ~10-20 scripts that matter day-to-day over the 60+ that don't

## Design: Two-Tier Sidebar

### Top Section: Workflow Groups

User-defined groups like "Full Stack Dev", "Just Backend", "Deploy".

**Collapsed state (default):**
```
▶ Full Stack Dev    ●●●○○  3/5
  [▶ Start All]
```
- Row of status dots gives instant visual scan (green=running, yellow=starting, red=crashed, gray outline=stopped)
- Running count as fraction on the right
- Start All / Stop All button below the header

**Expanded state:**
```
▼ Just Backend      ●●     2/2
  [■ Stop All]
  ● API              ⟳  ■
  ● Worker           ⟳  ■
```
- Individual scripts with hover-revealed restart/stop actions
- Drag-to-reorder within group (determines display AND start order)

**Group management:**
- `[+]` button in WORKFLOWS header to create new group
- Creation: modal with name field + checkbox list of all scripts
- Right-click group header: Rename, Edit Scripts, Delete
- Scripts can appear in multiple groups
- Drag group headers to reorder groups

### Bottom Section: All Scripts

Lives below workflow groups, collapsed by default when workflows exist.

```
ALL SCRIPTS                🔍
▶ edge-server       ●●   2/29
▶ edge-frontend     ●●   2/22
▶ edge              ●    1/21
▶ arro-ads               0/8
```

- Same repo-based grouping as today
- Repo headers show status dots for running scripts only + running/total count
- Search icon toggles filter input
- Right-click script -> "Add to Workflow..." submenu
- Visually secondary: dimmer text, less visual weight

### Script Row Design

```
● API                    ⟳  ■
```

- **Status dot** (8px): green w/ glow (running), yellow pulsing (starting), gray outline (stopped), red w/ glow (crashed)
- **Name**: alias if set, otherwise script name. No repo prefix inside groups.
- **Actions**: hover-reveal restart and stop/start icons
- **Selected state**: light background + left accent border
- **Double-click**: inline rename (existing behavior)

The glow/pulse on status dots is the key visual upgrade for instant scanning.

## Data Model

### Config changes (`~/.servicepilot/config.json`)

```typescript
interface Config {
  repos: string[];
  aliases: Record<string, string>;
  workflows: Workflow[];  // replaces favourites
}

interface Workflow {
  id: string;           // uuid
  name: string;         // "Full Stack Dev"
  scriptIds: string[];  // ordered — determines display and start order
  collapsed: boolean;   // persisted collapse state
}
```

### Migration

On first launch with new format: if `favourites` exists, auto-create a "Favourites" workflow group from those IDs, remove `favourites` key.

### New commands

```typescript
| { type: "create-workflow"; name: string; scriptIds: string[] }
| { type: "update-workflow"; id: string; name?: string; scriptIds?: string[] }
| { type: "delete-workflow"; id: string }
| { type: "reorder-workflows"; ids: string[] }
| { type: "start-workflow"; id: string }   // starts scripts sequentially in order
| { type: "stop-workflow"; id: string }    // stops all running scripts
```

### Behaviour

- "Start All" starts scripts sequentially top-to-bottom (respects dependency order)
- "Stop All" stops all running scripts in the group
- `toggle-favourite` command removed (replaced by workflow membership)

## Scope

### In scope
- Workflow groups CRUD (create, read, update, delete)
- Start/stop all scripts in a workflow
- Drag reorder within groups and between group headers
- Status dot visualization with glow/pulse
- Config migration from favourites
- All Scripts section with repo grouping
- Right-click context menus

### Out of scope
- Dependency declarations between scripts (sequential start order is sufficient)
- Auto-detection of which scripts go together
- Workflow templates/presets
