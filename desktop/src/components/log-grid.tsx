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
              borderBottomWidth: panels.length > 2 && i < 2 ? 1 : 0,
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
