import fs from "node:fs";
import path from "node:path";

const CONFIG_DIR = path.join(process.env.HOME ?? "", ".servicepilot");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface Config {
  repos: string[]; // absolute paths
  favourites: string[]; // service ids
  aliases: Record<string, string>; // service id -> display name
}

function defaultConfig(): Config {
  return { repos: [], favourites: [], aliases: {} };
}

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
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

export function toggleFavourite(id: string): Config {
  const config = loadConfig();
  if (!config.favourites) config.favourites = [];
  const idx = config.favourites.indexOf(id);
  if (idx === -1) {
    config.favourites.push(id);
  } else {
    config.favourites.splice(idx, 1);
  }
  saveConfig(config);
  return config;
}

export function getFavourites(): string[] {
  const config = loadConfig();
  return config.favourites ?? [];
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
