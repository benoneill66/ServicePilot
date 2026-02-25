export interface Workflow {
  id: string;
  name: string;
  scriptIds: string[];
  collapsed: boolean;
}

// Commands (frontend → sidecar via stdin)
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

// Events (sidecar → frontend via stdout)
export type Event =
  | {
      type: "services";
      services: {
        id: string;
        name: string;
        repo: string;
        repoPath: string;
        port?: number;
        color: string;
        alias?: string;
      }[];
    }
  | { type: "status"; id: string; status: string }
  | { type: "log"; id: string; text: string }
  | { type: "error"; message: string }
  | { type: "workflows"; workflows: Workflow[] };
