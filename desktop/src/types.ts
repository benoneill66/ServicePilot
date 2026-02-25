export type ServiceStatus = "stopped" | "starting" | "running" | "crashed";

export interface ServiceInfo {
  id: string;
  name: string;
  repo: string;
  repoPath: string;
  port?: number;
  color: string;
  favourite: boolean;
  alias?: string;
}

// Commands (frontend → sidecar)
export type Command =
  | { type: "list" }
  | { type: "start"; id: string }
  | { type: "stop"; id: string }
  | { type: "restart"; id: string }
  | { type: "stop-all" }
  | { type: "add-repo"; path: string }
  | { type: "remove-repo"; path: string }
  | { type: "toggle-favourite"; id: string }
  | { type: "rename-script"; id: string; alias: string };

// Events (sidecar → frontend)
export type SidecarEvent =
  | { type: "services"; services: ServiceInfo[] }
  | { type: "status"; id: string; status: ServiceStatus }
  | { type: "log"; id: string; text: string }
  | { type: "error"; message: string };
