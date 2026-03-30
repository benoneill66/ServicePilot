import { useState, useCallback, useRef, useEffect } from "react";
import { XTermTerminal } from "./xterm-terminal";

export interface TerminalTab {
  id: number;
  name: string;
}

interface Props {
  open: boolean;
  tabs: TerminalTab[];
  activeTabId: number | null;
  onSetActiveTab: (id: number) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (id: number) => void;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.75;
const DEFAULT_HEIGHT = 300;

function loadDrawerHeight(): number {
  try {
    const v = localStorage.getItem("terminal-height");
    if (v) return Math.max(MIN_HEIGHT, parseInt(v, 10));
  } catch {}
  return DEFAULT_HEIGHT;
}

export function TerminalDrawer({
  open,
  tabs,
  activeTabId,
  onSetActiveTab,
  onNewTerminal,
  onCloseTerminal,
}: Props) {
  const [height, setHeight] = useState(loadDrawerHeight);
  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem("terminal-height", String(height));
  }, [height]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
      const newH = window.innerHeight - ev.clientY;
      setHeight(Math.max(MIN_HEIGHT, Math.min(maxH, newH)));
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

  if (!open || tabs.length === 0) return null;

  return (
    <div
      className="flex flex-col border-t border-border bg-bg shrink-0"
      style={{ height }}
    >
      {/* Drag handle */}
      <div
        className="h-1 cursor-row-resize hover:bg-accent/40 active:bg-accent/60 transition-colors shrink-0"
        onMouseDown={onDragStart}
      />
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-surface shrink-0 px-2 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSetActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition rounded-t ${
              tab.id === activeTabId
                ? "text-text bg-bg border-b-2 border-b-accent"
                : "text-text-dim hover:text-text hover:bg-surface-hover"
            }`}
          >
            <span className="text-[10px] opacity-60">&#9638;</span>
            {tab.name}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onCloseTerminal(tab.id);
              }}
              className="ml-1 text-text-dim hover:text-text rounded hover:bg-surface-hover px-0.5 transition"
            >
              ✕
            </span>
          </button>
        ))}
        <button
          onClick={onNewTerminal}
          className="text-text-dim hover:text-text text-xs px-2 py-1.5 rounded hover:bg-surface-hover transition ml-1"
        >
          +
        </button>
      </div>
      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <XTermTerminal
            key={tab.id}
            terminalId={tab.id}
            visible={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  );
}
