export type ServiceStatus = "stopped" | "starting" | "running" | "crashed";

export interface ServiceInfo {
  id: string;
  name: string;
  repo: string;
  repoPath: string;
  port?: number;
  color: string;
  alias?: string;
}

export interface Workflow {
  id: string;
  name: string;
  scriptIds: string[];
  collapsed: boolean;
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
  | { type: "rename-script"; id: string; alias: string }
  | { type: "get-workflows" }
  | { type: "create-workflow"; name: string; scriptIds: string[] }
  | { type: "update-workflow"; id: string; name?: string; scriptIds?: string[]; collapsed?: boolean }
  | { type: "delete-workflow"; id: string }
  | { type: "reorder-workflows"; ids: string[] }
  | { type: "start-workflow"; id: string }
  | { type: "stop-workflow"; id: string };

// Events (sidecar → frontend)
export type SidecarEvent =
  | { type: "services"; services: ServiceInfo[] }
  | { type: "status"; id: string; status: ServiceStatus }
  | { type: "log"; id: string; text: string }
  | { type: "error"; message: string }
  | { type: "workflows"; workflows: Workflow[] };
