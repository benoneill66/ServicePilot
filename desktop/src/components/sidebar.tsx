import { useMemo, useState, useRef, useEffect } from "react";
import type { ServiceInfo, ServiceStatus } from "../types";

const STATUS_CONFIG: Record<ServiceStatus, { dotColor: string }> = {
  stopped: { dotColor: "bg-gray-500" },
  starting: { dotColor: "bg-yellow animate-pulse" },
  running: { dotColor: "bg-green" },
  crashed: { dotColor: "bg-red" },
};

interface RepoGroup {
  name: string;
  path: string;
  services: ServiceInfo[];
}

interface Props {
  width: number;
  services: ServiceInfo[];
  statuses: Record<string, ServiceStatus>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, running: boolean) => void;
  onRestart: (id: string) => void;
  onClearLog: (id: string) => void;
  onAddRepo: () => void;
  onRemoveRepo: (path: string) => void;
  onToggleFavourite: (id: string) => void;
  onRenameScript: (id: string, alias: string) => void;
}

function ScriptRow({
  svc,
  status,
  isActive,
  onSelect,
  onToggle,
  onToggleFavourite,
  onRename,
  showRepo,
}: {
  svc: ServiceInfo;
  status: ServiceStatus;
  isActive: boolean;
  onSelect: () => void;
  onToggle: (id: string, running: boolean) => void;
  onToggleFavourite: (id: string) => void;
  onRename: (id: string, alias: string) => void;
  showRepo?: boolean;
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
    // Only send if changed from current display
    if (trimmed !== displayName) {
      onRename(svc.id, trimmed);
    }
  };

  return (
    <div
      className={`group flex items-center gap-1.5 pl-5 pr-2 py-[3px] cursor-pointer transition-colors ${
        isActive ? "bg-surface-hover" : "hover:bg-surface-hover"
      }`}
      onClick={onSelect}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`} />

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
        className={`text-[10px] px-0.5 transition-all shrink-0 ${
          svc.favourite
            ? "opacity-100 text-yellow"
            : "opacity-0 group-hover:opacity-100 text-text-dim hover:text-yellow"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavourite(svc.id);
        }}
        title={svc.favourite ? "Remove from favourites" : "Add to favourites"}
      >
        {svc.favourite ? "★" : "☆"}
      </button>
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

export function Sidebar({
  width,
  services,
  statuses,
  activeId,
  onSelect,
  onToggle,
  onAddRepo,
  onRemoveRepo,
  onToggleFavourite,
  onRenameScript,
}: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const repos = useMemo(() => {
    const map = new Map<string, RepoGroup>();
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

  const favourites = useMemo(
    () => services.filter((s) => s.favourite),
    [services]
  );

  const query = search.toLowerCase().trim();

  const filteredFavourites = query
    ? favourites.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.alias && s.alias.toLowerCase().includes(query))
      )
    : favourites;

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

      {/* Search */}
      {services.length > 0 && (
        <div className="px-2 pb-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter scripts..."
            className="w-full px-2 py-1 text-xs bg-bg border border-border rounded outline-none focus:border-accent text-text placeholder:text-text-dim/50"
          />
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {repos.length === 0 && (
          <div className="px-3 py-8 text-center text-text-dim text-[11px]">
            No repos imported yet.
            <br />
            Click <strong>+ Import</strong> to add a project.
          </div>
        )}

        {/* Favourites section */}
        {filteredFavourites.length > 0 && (
          <div>
            <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border select-none">
              <span className="text-[10px] text-yellow">★</span>
              <span className="text-[11px] font-bold text-text-dim flex-1">
                Favourites
              </span>
              <span className="text-[10px] text-text-dim/50">
                {filteredFavourites.length}
              </span>
            </div>
            {filteredFavourites.map((svc) => (
              <ScriptRow
                key={`fav-${svc.id}`}
                svc={svc}
                status={statuses[svc.id] ?? "stopped"}
                isActive={svc.id === activeId}
                onSelect={() => onSelect(svc.id)}
                onToggle={onToggle}
                onToggleFavourite={onToggleFavourite}
                onRename={onRenameScript}
                showRepo
              />
            ))}
          </div>
        )}

        {/* Repo sections */}
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
                  setCollapsed((prev) => ({ ...prev, [repo.path]: !prev[repo.path] }))
                }
              >
                <span
                  className={`text-[10px] text-text-dim transition-transform ${
                    isCollapsed ? "" : "rotate-90"
                  }`}
                >
                  ▶
                </span>
                <span
                  className="text-[11px] font-bold text-text-dim truncate flex-1"
                  title={repo.path}
                >
                  {repo.name}
                </span>
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
                  ×
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
                    onToggleFavourite={onToggleFavourite}
                    onRename={onRenameScript}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
