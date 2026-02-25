import { execSync } from "node:child_process";
import { execa, type ResultPromise } from "execa";
import treeKill from "tree-kill";
import type { ServiceDef, ServiceStatus } from "./types.js";
import { LogBuffer } from "./log-buffer.js";
import { DEFAULT_READY_PATTERN } from "./constants.js";

// Resolve the user's full login shell PATH — macOS .app bundles get a
// minimal PATH from launchd that won't include bun, node, homebrew, etc.
function getLoginShellPath(): string {
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    return execSync(`${shell} -lic 'echo $PATH'`, { encoding: "utf-8" }).trim();
  } catch {
    return process.env.PATH ?? "";
  }
}

const shellPath = getLoginShellPath();

/** Time (ms) to wait before assuming a still-alive process is "running". */
const READY_TIMEOUT = 30_000;

export interface ManagedProcess {
  def: ServiceDef;
  status: ServiceStatus;
  proc: ResultPromise | null;
  adoptedPid: number | null;
  log: LogBuffer;
  readyTimer: ReturnType<typeof setTimeout> | null;
}

type StatusListener = (id: string, status: ServiceStatus) => void;
type LogListener = (id: string, line: string) => void;

class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private statusListeners: StatusListener[] = [];
  private logListeners: LogListener[] = [];

  onStatus(fn: StatusListener) {
    this.statusListeners.push(fn);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== fn);
    };
  }

  onLog(fn: LogListener) {
    this.logListeners.push(fn);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== fn);
    };
  }

  private emitStatus(id: string, status: ServiceStatus) {
    for (const fn of this.statusListeners) fn(id, status);
  }

  private emitLog(id: string, text: string) {
    for (const fn of this.logListeners) fn(id, text);
  }

  /** Adopt an externally-started process by PID (detected via port scan). */
  adopt(def: ServiceDef, pid: number) {
    const existing = this.processes.get(def.id);
    if (existing?.proc || existing?.adoptedPid) return;

    const log = existing?.log ?? new LogBuffer();
    log.push(`[ServicePilot] Adopted existing process (PID ${pid}) on port ${def.port}\n`);

    const managed: ManagedProcess = {
      def,
      status: "running",
      proc: null,
      adoptedPid: pid,
      log,
      readyTimer: null,
    };
    this.processes.set(def.id, managed);
    this.emitStatus(def.id, "running");
    this.emitLog(def.id, `[ServicePilot] Adopted existing process (PID ${pid}) on port ${def.port}\n`);
  }

  start(def: ServiceDef) {
    const existing = this.processes.get(def.id);
    if (existing?.proc) return;
    // If adopted, stop the external process first then start fresh
    if (existing?.adoptedPid) {
      this.stop(def.id).then(() => this._spawn(def));
      return;
    }
    this._spawn(def);
  }

  private _spawn(def: ServiceDef) {
    const existing = this.processes.get(def.id);
    const log = existing?.log ?? new LogBuffer();
    const [cmd, ...args] = def.command.split(" ");

    const proc = execa(cmd!, args, {
      cwd: def.cwd,
      env: { ...process.env, PATH: shellPath, FORCE_COLOR: "1" },
      reject: false,
      stdout: "pipe",
      stderr: "pipe",
    });

    const managed: ManagedProcess = {
      def,
      status: "starting",
      proc,
      adoptedPid: null,
      log,
      readyTimer: null,
    };
    this.processes.set(def.id, managed);
    this.emitStatus(def.id, "starting");

    const readyPattern = def.readyPattern ?? DEFAULT_READY_PATTERN;

    // Timeout: mark as running after READY_TIMEOUT if still starting
    managed.readyTimer = setTimeout(() => {
      if (managed.status === "starting") {
        managed.status = "running";
        this.emitStatus(def.id, "running");
      }
    }, READY_TIMEOUT);

    const handleData = (data: Buffer) => {
      const text = data.toString();
      log.push(text);
      this.emitLog(def.id, text);

      if (managed.status === "starting" && readyPattern.test(text)) {
        managed.status = "running";
        this.emitStatus(def.id, "running");
        if (managed.readyTimer) {
          clearTimeout(managed.readyTimer);
          managed.readyTimer = null;
        }
      }
    };

    proc.stdout?.on("data", handleData);
    proc.stderr?.on("data", handleData);

    proc.then((result) => {
      managed.proc = null;
      if (managed.readyTimer) {
        clearTimeout(managed.readyTimer);
        managed.readyTimer = null;
      }
      if (managed.status !== "stopped") {
        managed.status = result.exitCode === 0 ? "stopped" : "crashed";
        this.emitStatus(def.id, managed.status);
      }
    });
  }

  async stop(id: string): Promise<void> {
    const managed = this.processes.get(id);
    if (!managed) return;

    // Handle adopted process (no execa handle, just a PID)
    const pid = managed.proc?.pid ?? managed.adoptedPid;
    if (!pid && !managed.proc) return;

    managed.status = "stopped";
    this.emitStatus(id, "stopped");

    if (managed.readyTimer) {
      clearTimeout(managed.readyTimer);
      managed.readyTimer = null;
    }

    if (pid) {
      await new Promise<void>((resolve) => {
        treeKill(pid, "SIGTERM", () => resolve());
      });
    }
    managed.proc = null;
    managed.adoptedPid = null;
  }

  async restart(def: ServiceDef) {
    await this.stop(def.id);
    const managed = this.processes.get(def.id);
    if (managed) managed.log.clear();
    this._spawn(def);
  }

  getLog(id: string): string[] {
    return this.processes.get(id)?.log.getLines() ?? [];
  }

  getStatus(id: string): ServiceStatus {
    return this.processes.get(id)?.status ?? "stopped";
  }

  async stopAll() {
    await Promise.all(
      [...this.processes.keys()].map((id) => this.stop(id))
    );
  }
}

export const processManager = new ProcessManager();
