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
}: Opts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K: clear logs (works even in inputs)
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        onClearLog();
        return;
      }

      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
  }, [serviceIds, activeIndex, setActiveIndex, onRestart, onStop, onStart, onQuit, onClearLog]);
}
