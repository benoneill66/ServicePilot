import fs from "node:fs";
import path from "node:path";
import type { Workflow } from "./protocol.js";

const CONFIG_DIR = path.join(process.env.HOME ?? "", ".servicepilot");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface Config {
  repos: string[];
  aliases: Record<string, string>;
  workflows: Workflow[];
  favourites?: string[]; // kept optional for migration detection
}

function defaultConfig(): Config {
  return { repos: [], aliases: {}, workflows: [] };
}

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      // Migrate favourites -> workflow
      if (raw.favourites && !raw.workflows) {
        raw.workflows = raw.favourites.length > 0
          ? [{ id: crypto.randomUUID(), name: "Favourites", scriptIds: raw.favourites, collapsed: false }]
          : [];
        delete raw.favourites;
        saveConfig(raw);
      }
      if (!raw.workflows) raw.workflows = [];
      return raw;
    }
  } catch {}
  return defaultConfig();
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function addRepo(repoPath: string): Config {
  const abs = path.resolve(repoPath);
  const config = loadConfig();
  if (!config.repos.includes(abs)) {
    config.repos.push(abs);
    saveConfig(config);
  }
  return config;
}

export function removeRepo(repoPath: string): Config {
  const abs = path.resolve(repoPath);
  const config = loadConfig();
  config.repos = config.repos.filter((r) => r !== abs);
  saveConfig(config);
  return config;
}

export function renameScript(id: string, alias: string): Config {
  const config = loadConfig();
  if (!config.aliases) config.aliases = {};
  const trimmed = alias.trim();
  if (trimmed === "" || trimmed === id.split("/").pop()) {
    // Empty or same as original script name — remove alias
    delete config.aliases[id];
  } else {
    config.aliases[id] = trimmed;
  }
  saveConfig(config);
  return config;
}

export function getAliases(): Record<string, string> {
  const config = loadConfig();
  return config.aliases ?? {};
}

export function getWorkflows(): Workflow[] {
  return loadConfig().workflows;
}

export function createWorkflow(name: string, scriptIds: string[]): Config {
  const config = loadConfig();
  config.workflows.push({ id: crypto.randomUUID(), name, scriptIds, collapsed: false });
  saveConfig(config);
  return config;
}

export function updateWorkflow(id: string, updates: { name?: string; scriptIds?: string[]; collapsed?: boolean }): Config {
  const config = loadConfig();
  const wf = config.workflows.find((w) => w.id === id);
  if (wf) {
    if (updates.name !== undefined) wf.name = updates.name;
    if (updates.scriptIds !== undefined) wf.scriptIds = updates.scriptIds;
    if (updates.collapsed !== undefined) wf.collapsed = updates.collapsed;
    saveConfig(config);
  }
  return config;
}

export function deleteWorkflow(id: string): Config {
  const config = loadConfig();
  config.workflows = config.workflows.filter((w) => w.id !== id);
  saveConfig(config);
  return config;
}

export function reorderWorkflows(ids: string[]): Config {
  const config = loadConfig();
  const map = new Map(config.workflows.map((w) => [w.id, w]));
  config.workflows = ids.map((id) => map.get(id)!).filter(Boolean);
  saveConfig(config);
  return config;
}
