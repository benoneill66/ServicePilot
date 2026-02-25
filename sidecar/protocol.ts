// Commands (frontend → sidecar via stdin)
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
        favourite: boolean;
        alias?: string;
      }[];
    }
  | { type: "status"; id: string; status: string }
  | { type: "log"; id: string; text: string }
  | { type: "error"; message: string };
