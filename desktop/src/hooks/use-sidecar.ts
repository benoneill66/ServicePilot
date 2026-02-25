import { useEffect, useRef, useCallback, useState } from "react";
import { Command as ShellCommand, Child } from "@tauri-apps/plugin-shell";
import type { ServiceInfo, ServiceStatus, Command, SidecarEvent } from "../types";

const MAX_LOG_LINES = 2000;

export function useSidecar() {
  const childRef = useRef<Child | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (cmd: Command) => {
    const child = childRef.current;
    if (child) {
      await child.write(JSON.stringify(cmd) + "\n");
    }
  }, []);

  useEffect(() => {
    const command = ShellCommand.sidecar("binaries/servicepilot-sidecar");

    command.stdout.on("data", (line: string) => {
      if (!line.trim()) return;
      try {
        const event: SidecarEvent = JSON.parse(line);
        switch (event.type) {
          case "services":
            setServices(event.services);
            break;
          case "status":
            setStatuses((prev) => ({ ...prev, [event.id]: event.status }));
            break;
          case "log":
            setLogs((prev) => {
              const existing = prev[event.id] ?? [];
              const newLines = event.text.split("\n");
              const combined = [...existing, ...newLines];
              return {
                ...prev,
                [event.id]: combined.length > MAX_LOG_LINES
                  ? combined.slice(-MAX_LOG_LINES)
                  : combined,
              };
            });
            break;
          case "error":
            setError(event.message);
            setTimeout(() => setError(null), 5000);
            break;
        }
      } catch {
        // ignore malformed lines
      }
    });

    command.stderr.on("data", (line: string) => {
      console.error("[sidecar]", line);
    });

    command.spawn().then(async (child) => {
      childRef.current = child;
      // Request the services list on connect
      await child.write(JSON.stringify({ type: "list" } satisfies Command) + "\n");
    });

    return () => {
      childRef.current?.kill();
    };
  }, []);

  const startService = useCallback((id: string) => send({ type: "start", id }), [send]);
  const stopService = useCallback((id: string) => send({ type: "stop", id }), [send]);
  const restartService = useCallback((id: string) => send({ type: "restart", id }), [send]);
  const stopAll = useCallback(() => send({ type: "stop-all" }), [send]);
  const clearLog = useCallback((id: string) => {
    setLogs((prev) => ({ ...prev, [id]: [] }));
  }, []);

  const addRepo = useCallback(
    (path: string) => send({ type: "add-repo", path }),
    [send]
  );

  const removeRepo = useCallback(
    (path: string) => send({ type: "remove-repo", path }),
    [send]
  );

  const toggleFavourite = useCallback(
    (id: string) => send({ type: "toggle-favourite", id }),
    [send]
  );

  const renameScript = useCallback(
    (id: string, alias: string) => send({ type: "rename-script", id, alias }),
    [send]
  );

  return {
    services,
    statuses,
    logs,
    error,
    startService,
    stopService,
    restartService,
    stopAll,
    clearLog,
    addRepo,
    removeRepo,
    toggleFavourite,
    renameScript,
  };
}
