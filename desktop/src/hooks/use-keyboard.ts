import { useEffect } from "react";

interface Opts {
  serviceIds: string[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onRestart: () => void;
  onStop: () => void;
  onStart: () => void;
  onQuit: () => void;
  onClearLog: () => void;
  onAddPanel: () => void;
  onRemovePanel: () => void;
  onToggleTerminal: () => void;
}

export function useKeyboard({
  serviceIds,
  activeIndex,
  setActiveIndex,
  onRestart,
  onStop,
  onStart,
  onQuit,
  onClearLog,
  onAddPanel,
  onRemovePanel,
  onToggleTerminal,
}: Opts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K: clear logs (works even in inputs)
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        onClearLog();
        return;
      }

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

      // Cmd+`: toggle terminal
      if (e.metaKey && e.key === "`") {
        e.preventDefault();
        onToggleTerminal();
        return;
      }

      // Ignore if user is typing in an input or terminal
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.closest(".xterm"))
      ) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= serviceIds.length) {
        setActiveIndex(num - 1);
        return;
      }

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          setActiveIndex((activeIndex + 1) % serviceIds.length);
          break;
        case "r":
          onRestart();
          break;
        case "s":
          onStop();
          break;
        case "Enter":
          onStart();
          break;
        case "q":
          onQuit();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [serviceIds, activeIndex, setActiveIndex, onRestart, onStop, onStart, onQuit, onClearLog, onAddPanel, onRemovePanel, onToggleTerminal]);
}
