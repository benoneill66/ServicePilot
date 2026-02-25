import path from "node:path";
import { processManager } from "./process-manager.js";
import { buildServices } from "./constants.js";
import { addRepo, removeRepo, renameScript, getAliases, getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, reorderWorkflows } from "./config.js";
import { scanRepoScripts } from "./repo-scanner.js";
import type { Command, Event } from "./protocol.js";
import type { ServiceDef } from "./types.js";

let services: ServiceDef[] = [];

function emit(event: Event) {
  process.stdout.write(JSON.stringify(event) + "\n");
}

function refreshServices() {
  services = buildServices();
}

function emitServiceList() {
  const aliases = getAliases();
  emit({
    type: "services",
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      repo: s.repo,
      repoPath: s.cwd,
      port: s.port,
      color: s.color,
      alias: aliases[s.id],
    })),
  });
}

function emitWorkflows() {
  emit({ type: "workflows", workflows: getWorkflows() });
}

// Wire up status and log events
processManager.onStatus((id, status) => {
  emit({ type: "status", id, status });
});

processManager.onLog((id, text) => {
  emit({ type: "log", id, text });
});

// Handle a single command (may be async for stop operations)
async function handleCommand(cmd: Command) {
  switch (cmd.type) {
    case "list":
      refreshServices();
      emitServiceList();
      emitWorkflows();
      break;

    case "start": {
      const svc = services.find((s) => s.id === cmd.id);
      if (svc) processManager.start(svc);
      break;
    }

    case "stop":
      processManager.stop(cmd.id);
      break;

    case "restart": {
      const svc = services.find((s) => s.id === cmd.id);
      if (svc) processManager.restart(svc);
      break;
    }

    case "stop-all":
      await processManager.stopAll();
      break;

    case "add-repo": {
      const resolved = path.resolve(cmd.path);
      const result = scanRepoScripts(resolved);
      if (!result) {
        emit({ type: "error", message: `No package.json found at ${resolved}` });
        break;
      }
      addRepo(resolved);
      refreshServices();
      emitServiceList();
      break;
    }

    case "remove-repo": {
      const resolved = path.resolve(cmd.path);
      // Stop all running services from this repo before removing
      const repoSvcs = services.filter((s) => s.cwd === resolved);
      await Promise.all(repoSvcs.map((s) => processManager.stop(s.id)));
      removeRepo(resolved);
      refreshServices();
      emitServiceList();
      break;
    }

    case "rename-script": {
      renameScript(cmd.id, cmd.alias);
      emitServiceList();
      break;
    }

    case "get-workflows":
      emitWorkflows();
      break;

    case "create-workflow":
      createWorkflow(cmd.name, cmd.scriptIds);
      emitWorkflows();
      break;

    case "update-workflow":
      updateWorkflow(cmd.id, { name: cmd.name, scriptIds: cmd.scriptIds, collapsed: cmd.collapsed });
      emitWorkflows();
      break;

    case "delete-workflow":
      deleteWorkflow(cmd.id);
      emitWorkflows();
      break;

    case "reorder-workflows":
      reorderWorkflows(cmd.ids);
      emitWorkflows();
      break;

    case "start-workflow": {
      const wfs = getWorkflows();
      const wf = wfs.find((w) => w.id === cmd.id);
      if (wf) {
        for (const scriptId of wf.scriptIds) {
          const svc = services.find((s) => s.id === scriptId);
          if (svc) processManager.start(svc);
        }
      }
      break;
    }

    case "stop-workflow": {
      const wfs = getWorkflows();
      const wf = wfs.find((w) => w.id === cmd.id);
      if (wf) {
        for (const scriptId of wf.scriptIds) {
          processManager.stop(scriptId);
        }
      }
      break;
    }
  }
}

// Read commands from stdin
let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop()!;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cmd: Command = JSON.parse(line);
    handleCommand(cmd);
  }
});

// Clean shutdown
process.on("SIGTERM", async () => {
  await processManager.stopAll();
  process.exit(0);
});
