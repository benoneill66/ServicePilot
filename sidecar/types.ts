export type ServiceStatus = "stopped" | "starting" | "running" | "crashed";

export interface ServiceDef {
  id: string;
  name: string;
  command: string;
  cwd: string;
  port?: number;
  readyPattern?: RegExp;
  color: string;
  repo: string;
}
