import { useMemo, useState, useRef, useEffect } from "react";
import type { ServiceInfo, ServiceStatus, Workflow } from "../types";
import { WorkflowModal } from "./workflow-modal";

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const handler = () => onClose();
    // Use setTimeout to avoid the context menu's own event closing it
    const id = setTimeout(() => window.addEventListener("click", handler), 0);
    return () => { clearTimeout(id); window.removeEventListener("click", handler); };
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed bg-surface border border-border rounded shadow-lg py-1 z-50"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`block w-full text-left text-[11px] px-3 py-1 hover:bg-surface-hover transition-colors ${
            item.danger ? "text-red hover:bg-red/10" : "text-text"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_CONFIG: Record<ServiceStatus, { dotColor: string; glowClass: string }> = {
  stopped:  { dotColor: "border border-gray-500 bg-transparent", glowClass: "" },
  starting: { dotColor: "bg-yellow animate-pulse", glowClass: "dot-glow-yellow" },
  running:  { dotColor: "bg-green", glowClass: "dot-glow-green" },
  crashed:  { dotColor: "bg-red", glowClass: "dot-glow-red" },
};

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
  onCreateWorkflow: (name: string, scriptIds: string[]) => void;
  onUpdateWorkflow: (id: string, name?: string, scriptIds?: string[], collapsed?: boolean) => void;
  onDeleteWorkflow: (id: string) => void;
  onStartWorkflow: (id: string) => void;
  onStopWorkflow: (id: string) => void;
}

function ScriptRow({
  svc,
  status,
  isActive,
  onSelect,
  onToggle,
  onRename,
  showRepo,
  onContextMenu: onCtxMenu,
}: {
  svc: ServiceInfo;
  status: ServiceStatus;
  isActive: boolean;
  onSelect: () => void;
  onToggle: (id: string, running: boolean) => void;
  onRename: (id: string, alias: string) => void;
  showRepo?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const config = STATUS_CONFIG[status];
  const isRunning = status === "running" || status === "starting";
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = svc.alias ?? svc.name;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== displayName) {
      onRename(svc.id, trimmed);
    }
  };

  return (
    <div
      className={`group flex items-center gap-2 pr-2 py-[3px] cursor-pointer transition-colors ${
        isActive
          ? "bg-surface-hover border-l-2 border-l-accent pl-[14px]"
          : "hover:bg-surface-hover border-l-2 border-l-transparent pl-[14px]"
      }`}
      onClick={onSelect}
      onContextMenu={onCtxMenu}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${config.dotColor} ${config.glowClass}`} />

      {editing ? (
        <input
          ref={inputRef}
          className="text-[11px] flex-1 min-w-0 bg-bg border border-accent rounded px-1 py-0 outline-none text-text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="text-[11px] truncate flex-1 min-w-0"
          title={`${svc.name}${svc.alias ? ` (${svc.name})` : ""}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditValue(displayName);
            setEditing(true);
          }}
        >
          {showRepo && <span className="text-text-dim">{svc.repo}/</span>}
          {displayName}
          {svc.alias && (
            <span className="text-text-dim/40 ml-0.5 text-[9px]">({svc.name})</span>
          )}
        </span>
      )}

      <button
        className="opacity-0 group-hover:opacity-100 text-[10px] px-1 py-px rounded bg-border hover:bg-accent hover:text-bg transition-all shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(svc.id, isRunning);
        }}
      >
        {isRunning ? "Stop" : "Start"}
      </button>
    </div>
  );
}

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

export function Sidebar({
  width,
  services,
  statuses,
  workflows,
  activeId,
  onSelect,
  onToggle,
  onAddRepo,
  onRemoveRepo,
  onRenameScript,
  onCreateWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow,
  onStartWorkflow,
  onStopWorkflow,
}: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  // Default "All Scripts" to collapsed when workflows exist
  const [allScriptsCollapsed, setAllScriptsCollapsed] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const repos = useMemo(() => {
    const map = new Map<string, { name: string; path: string; services: ServiceInfo[] }>();
    for (const svc of services) {
      let group = map.get(svc.repoPath);
      if (!group) {
        group = { name: svc.repo, path: svc.repoPath, services: [] };
        map.set(svc.repoPath, group);
      }
      group.services.push(svc);
    }
    return [...map.values()];
  }, [services]);

  const query = search.toLowerCase().trim();

  const handleSaveWorkflow = (name: string, scriptIds: string[]) => {
    if (editingWorkflow) {
      onUpdateWorkflow(editingWorkflow.id, name, scriptIds);
    } else {
      onCreateWorkflow(name, scriptIds);
    }
    setShowModal(false);
    setEditingWorkflow(null);
  };

  return (
    <div
      className="flex flex-col border-r border-border bg-surface shrink-0"
      style={{ width }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">
          Repos
        </span>
        <button
          onClick={onAddRepo}
          className="text-[10px] px-1.5 py-0.5 rounded bg-border hover:bg-accent hover:text-bg transition-all"
        >
          + Import
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {repos.length === 0 && (
          <div className="px-3 py-8 text-center text-text-dim text-[11px]">
            No repos imported yet.
            <br />
            Click <strong>+ Import</strong> to add a project.
          </div>
        )}

        {/* ===== WORKFLOWS SECTION ===== */}
        {repos.length > 0 && (
          <div>
            <div className="flex items-center px-3 py-1.5 border-t border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex-1">
                Workflows
              </span>
              <button
                onClick={() => { setEditingWorkflow(null); setShowModal(true); }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-border hover:bg-accent hover:text-bg transition-all"
              >
                +
              </button>
            </div>

            {workflows.length === 0 && (
              <div className="px-4 py-3 text-[10px] text-text-dim">
                No workflows yet. Click <strong>+</strong> to create one.
              </div>
            )}

            {workflows.map((wf) => {
              const runningCount = wf.scriptIds.filter((id) => {
                const st = statuses[id];
                return st === "running" || st === "starting";
              }).length;
              const anyRunning = runningCount > 0;

              return (
                <div key={wf.id}>
                  {/* Workflow header */}
                  <div
                    className="group flex items-center gap-1.5 px-2 py-1.5 border-t border-border cursor-pointer hover:bg-surface-hover select-none"
                    onClick={() => onUpdateWorkflow(wf.id, undefined, undefined, !wf.collapsed)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          { label: "Edit Scripts...", onClick: () => { setEditingWorkflow(wf); setShowModal(true); } },
                          { label: "Delete", onClick: () => onDeleteWorkflow(wf.id), danger: true },
                        ],
                      });
                    }}
                  >
                    <span
                      className={`text-[10px] text-text-dim transition-transform ${
                        wf.collapsed ? "" : "rotate-90"
                      }`}
                    >
                      &#9654;
                    </span>
                    <span className="text-[11px] font-bold text-text flex-1 truncate">
                      {wf.name}
                    </span>
                    <StatusDotRow scriptIds={wf.scriptIds} statuses={statuses} />
                    <span className="text-[10px] text-text-dim ml-1">
                      {runningCount}/{wf.scriptIds.length}
                    </span>
                  </div>

                  {/* Start/Stop All + expanded scripts */}
                  {!wf.collapsed && (
                    <>
                      <div className="px-3 py-1 flex gap-1.5">
                        <button
                          onClick={() =>
                            anyRunning ? onStopWorkflow(wf.id) : onStartWorkflow(wf.id)
                          }
                          className={`text-[10px] px-2 py-0.5 rounded transition-all ${
                            anyRunning
                              ? "bg-red/20 text-red hover:bg-red/30"
                              : "bg-green/20 text-green hover:bg-green/30"
                          }`}
                        >
                          {anyRunning ? "\u25A0 Stop All" : "\u25B6 Start All"}
                        </button>
                        <button
                          onClick={() => { setEditingWorkflow(wf); setShowModal(true); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-border hover:bg-surface-hover text-text-dim transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteWorkflow(wf.id)}
                          className="text-[10px] px-2 py-0.5 rounded bg-border hover:bg-red/20 hover:text-red text-text-dim transition-all"
                        >
                          Delete
                        </button>
                      </div>

                      {wf.scriptIds.map((id) => {
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
                            onRename={onRenameScript}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== ALL SCRIPTS SECTION ===== */}
        {repos.length > 0 && (
          <div>
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border cursor-pointer hover:bg-surface-hover select-none"
              onClick={() => setAllScriptsCollapsed(!allScriptsCollapsed)}
            >
              <span
                className={`text-[10px] text-text-dim transition-transform ${
                  allScriptsCollapsed ? "" : "rotate-90"
                }`}
              >
                &#9654;
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim flex-1">
                All Scripts
              </span>
            </div>

            {!allScriptsCollapsed && (
              <>
                {/* Search */}
                <div className="px-2 pb-2 pt-1">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter scripts..."
                    className="w-full px-2 py-1 text-xs bg-bg border border-border rounded outline-none focus:border-accent text-text placeholder:text-text-dim/50"
                  />
                </div>

                {repos.map((repo) => {
                  const isCollapsed = collapsed[repo.path] && !query;
                  const filtered = query
                    ? repo.services.filter(
                        (s) =>
                          s.name.toLowerCase().includes(query) ||
                          (s.alias && s.alias.toLowerCase().includes(query))
                      )
                    : repo.services;

                  const runningCount = repo.services.filter((s) => {
                    const st = statuses[s.id];
                    return st === "running" || st === "starting";
                  }).length;

                  if (query && filtered.length === 0) return null;

                  return (
                    <div key={repo.path}>
                      <div
                        className="group flex items-center gap-1 px-2 py-1.5 border-t border-border cursor-pointer hover:bg-surface-hover select-none"
                        onClick={() =>
                          setCollapsed((prev) => ({
                            ...prev,
                            [repo.path]: !prev[repo.path],
                          }))
                        }
                      >
                        <span
                          className={`text-[10px] text-text-dim transition-transform ${
                            isCollapsed ? "" : "rotate-90"
                          }`}
                        >
                          &#9654;
                        </span>
                        <span
                          className="text-[11px] font-bold text-text-dim truncate flex-1"
                          title={repo.path}
                        >
                          {repo.name}
                        </span>
                        {/* Status dots for running scripts in this repo */}
                        <div className="flex gap-0.5 items-center">
                          {repo.services
                            .filter((s) => {
                              const st = statuses[s.id];
                              return st === "running" || st === "starting";
                            })
                            .map((s) => {
                              const cfg = STATUS_CONFIG[statuses[s.id]];
                              return (
                                <div
                                  key={s.id}
                                  className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`}
                                />
                              );
                            })}
                        </div>
                        {runningCount > 0 && (
                          <span className="text-[9px] px-1 py-px rounded-full bg-green/20 text-green font-bold">
                            {runningCount}
                          </span>
                        )}
                        <span className="text-[10px] text-text-dim/50">
                          {repo.services.length}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveRepo(repo.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[11px] text-text-dim hover:text-red transition-all px-0.5"
                          title="Remove repo"
                        >
                          &times;
                        </button>
                      </div>

                      {!isCollapsed &&
                        filtered.map((svc) => (
                          <ScriptRow
                            key={svc.id}
                            svc={svc}
                            status={statuses[svc.id] ?? "stopped"}
                            isActive={svc.id === activeId}
                            onSelect={() => onSelect(svc.id)}
                            onToggle={onToggle}
                            onRename={onRenameScript}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const menuItems: MenuItem[] = workflows.length > 0
                                ? workflows.map((wf) => ({
                                    label: `Add to "${wf.name}"`,
                                    onClick: () => {
                                      if (!wf.scriptIds.includes(svc.id)) {
                                        onUpdateWorkflow(wf.id, undefined, [...wf.scriptIds, svc.id]);
                                      }
                                    },
                                  }))
                                : [{ label: "No workflows yet", onClick: () => {} }];
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                items: menuItems,
                              });
                            }}
                          />
                        ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Workflow Modal */}
      {showModal && (
        <WorkflowModal
          services={services}
          existingWorkflow={editingWorkflow}
          onSave={handleSaveWorkflow}
          onCancel={() => { setShowModal(false); setEditingWorkflow(null); }}
        />
      )}
    </div>
  );
}
