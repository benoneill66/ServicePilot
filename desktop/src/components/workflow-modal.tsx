import { useState, useMemo, useEffect } from "react";
import type { ServiceInfo } from "../types";

interface Props {
  services: ServiceInfo[];
  existingWorkflow?: { id: string; name: string; scriptIds: string[] } | null;
  onSave: (name: string, scriptIds: string[]) => void;
  onCancel: () => void;
}

export function WorkflowModal({ services, existingWorkflow, onSave, onCancel }: Props) {
  const [name, setName] = useState(existingWorkflow?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(existingWorkflow?.scriptIds ?? [])
  );

  // Group services by repo
  const repos = useMemo(() => {
    const map = new Map<string, ServiceInfo[]>();
    for (const svc of services) {
      let group = map.get(svc.repo);
      if (!group) { group = []; map.set(svc.repo, group); }
      group.push(svc);
    }
    return [...map.entries()];
  }, [services]);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canSave = name.trim().length > 0 && selected.size > 0;

  return (
    // Backdrop
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      {/* Panel — stop propagation so clicking inside doesn't close */}
      <div className="bg-surface border border-border rounded-lg w-80 max-w-[90vw] p-4 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-[12px] font-bold text-text">
          {existingWorkflow ? "Edit Workflow" : "New Workflow"}
        </h2>

        {/* Name input */}
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workflow name..."
          className="w-full px-2 py-1 text-xs bg-bg border border-border rounded outline-none focus:border-accent text-text placeholder:text-text-dim/50"
        />

        {/* Script list */}
        <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
          {repos.map(([repoName, svcs]) => (
            <div key={repoName}>
              <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider px-1 py-0.5">
                {repoName}
              </div>
              {svcs.map(svc => (
                <label key={svc.id} className="flex items-center gap-2 px-1 py-0.5 hover:bg-surface-hover rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(svc.id)}
                    onChange={() => toggle(svc.id)}
                    className="accent-accent"
                  />
                  <span className="text-[11px] text-text truncate">
                    {svc.alias ?? svc.name}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-[11px] px-3 py-1 rounded bg-border text-text hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave(name.trim(), [...selected])}
            disabled={!canSave}
            className={`text-[11px] px-3 py-1 rounded transition-colors ${
              canSave ? "bg-accent text-bg hover:bg-accent/80" : "bg-accent/30 text-bg/50 cursor-not-allowed"
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
