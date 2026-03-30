import { useRef, useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

interface Props {
  terminalId: number;
  visible: boolean;
}

export function XTermTerminal({ terminalId, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", ui-monospace, monospace',
      theme: {
        background: "#1a1a2e",
        foreground: "#e0e0e0",
        cursor: "#4fc3f7",
        selectionBackground: "#4fc3f740",
        black: "#1a1a2e",
        brightBlack: "#6b7280",
        red: "#f44336",
        brightRed: "#ef5350",
        green: "#4caf50",
        brightGreen: "#66bb6a",
        yellow: "#ffc107",
        brightYellow: "#ffca28",
        blue: "#42a5f5",
        brightBlue: "#64b5f6",
        magenta: "#ce93d8",
        brightMagenta: "#e1bee7",
        cyan: "#4fc3f7",
        brightCyan: "#80deea",
        white: "#e0e0e0",
        brightWhite: "#ffffff",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Send user input to PTY
    const dataDisposable = term.onData((data) => {
      invoke("write_terminal", { id: terminalId, data }).catch(() => {});
    });

    // Send resize events to PTY
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      invoke("resize_terminal", { id: terminalId, rows, cols }).catch(() => {});
    });

    // Listen for PTY output
    const unlistenOutput = listen<string>(
      `terminal-output-${terminalId}`,
      (event) => {
        term.write(event.payload);
      }
    );

    // Listen for PTY exit
    const unlistenExit = listen(`terminal-exit-${terminalId}`, () => {
      term.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
    });

    // ResizeObserver to re-fit when container changes
    const observer = new ResizeObserver(() => {
      fit.fit();
    });
    observer.observe(containerRef.current);

    // Initial resize to match actual dimensions
    requestAnimationFrame(() => {
      fit.fit();
      const dims = fit.proposeDimensions();
      if (dims) {
        invoke("resize_terminal", {
          id: terminalId,
          rows: dims.rows,
          cols: dims.cols,
        }).catch(() => {});
      }
    });

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [terminalId]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitRef.current) {
      requestAnimationFrame(() => fitRef.current?.fit());
    }
  }, [visible]);

  // Focus terminal when visible
  useEffect(() => {
    if (visible && termRef.current) {
      requestAnimationFrame(() => termRef.current?.focus());
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}
