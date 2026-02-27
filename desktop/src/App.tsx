import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSidecar } from "./hooks/use-sidecar";
import { useKeyboard } from "./hooks/use-keyboard";
import { Sidebar } from "./components/sidebar";
import { LogGrid } from "./components/log-grid";
import { StatusBar } from "./components/status-bar";
import type { Panel } from "./types";

// Map service color names to hex for the log header
const COLOR_MAP: Record<string, string> = {
  green: "#4caf50",
  greenBright: "#66bb6a",
  blue: "#42a5f5",
  cyan: "#4fc3f7",
  magenta: "#ce93d8",
  yellow: "#ffc107",
  red: "#f44336",
  white: "#e0e0e0",
};

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 480;
const DEFAULT_SIDEBAR = 224;

function loadSidebarWidth(): number {
  try {
    const v = localStorage.getItem("sidebar-width");
    if (v) return Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, parseInt(v, 10)));
  } catch {}
  return DEFAULT_SIDEBAR;
}

export default function App() {
  const {
    services,
    statuses,
    logs,
    error,
    workflows,
    startService,
    stopService,
    restartService,
    stopAll,
    clearLog,
    addRepo,
    removeRepo,
    renameScript,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    startWorkflow,
    stopWorkflow,
  } = useSidecar();

  const [activeIndex, setActiveIndex] = useState(0);
  const activeService = services[activeIndex];
  const activeId = activeService?.id ?? null;

  const panelCounter = useRef(1);
  const [panels, setPanels] = useState<Panel[]>([
    { id: "panel-0", serviceId: null },
  ]);
  const [focusedPanelId, setFocusedPanelId] = useState("panel-0");

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem("sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarWidth(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, ev.clientX)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const runningCount = useMemo(
    () => Object.values(statuses).filter((s) => s === "running").length,
    [statuses]
  );

  const handleToggle = useCallback(
    (id: string, isRunning: boolean) => {
      if (isRunning) stopService(id);
      else startService(id);
    },
    [startService, stopService]
  );

  const handleAddRepo = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Repository",
    });
    if (selected) {
      addRepo(selected);
    }
  }, [addRepo]);

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
      const idx = services.findIndex((s) => s.id === serviceId);
      if (idx !== -1) setActiveIndex(idx);
    },
    [services]
  );

  // Keep single-panel synced with sidebar selection
  useEffect(() => {
    if (panels.length === 1 && activeService) {
      setPanels((prev) => [{ ...prev[0]!, serviceId: activeService.id }]);
    }
  }, [activeService?.id, panels.length]);

  useKeyboard({
    serviceIds: services.map((s) => s.id),
    activeIndex,
    setActiveIndex,
    onRestart: () => activeId && restartService(activeId),
    onStop: () => activeId && stopService(activeId),
    onStart: () => activeId && startService(activeId),
    onQuit: () => stopAll(),
    onClearLog: () => activeId && clearLog(activeId),
  });

  return (
    <div className="flex flex-col h-screen">
      {error && (
        <div className="px-4 py-2 bg-red/20 text-red text-xs border-b border-red/30">
          {error}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          width={sidebarWidth}
          services={services}
          statuses={statuses}
          workflows={workflows}
          activeId={activeId}
          onSelect={(id) => {
            const idx = services.findIndex((s) => s.id === id);
            if (idx !== -1) setActiveIndex(idx);
            setPanels((prev) =>
              prev.map((p) =>
                p.id === focusedPanelId ? { ...p, serviceId: id } : p
              )
            );
          }}
          onToggle={handleToggle}
          onRestart={restartService}
          onClearLog={clearLog}
          onAddRepo={handleAddRepo}
          onRemoveRepo={removeRepo}
          onRenameScript={renameScript}
          onCreateWorkflow={createWorkflow}
          onUpdateWorkflow={updateWorkflow}
          onDeleteWorkflow={deleteWorkflow}
          onStartWorkflow={startWorkflow}
          onStopWorkflow={stopWorkflow}
        />
        {/* Drag handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors shrink-0"
          onMouseDown={onDragStart}
        />
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
      </div>
      <StatusBar
        runningCount={runningCount}
        totalCount={services.length}
        panelCount={panels.length}
        onAddPanel={addPanel}
      />
    </div>
  );
}
