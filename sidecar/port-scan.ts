import { execSync } from "node:child_process";

/** Check if a port is in use and return the PID, or null. */
export function getPidOnPort(port: number): number | null {
  try {
    // lsof -ti :PORT returns PIDs listening on that port
    const output = execSync(`lsof -ti :${port}`, { encoding: "utf-8", timeout: 2000 }).trim();
    if (!output) return null;
    // May return multiple PIDs (parent + children), take the first
    const pid = parseInt(output.split("\n")[0]!, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    // lsof exits non-zero when nothing is listening
    return null;
  }
}
