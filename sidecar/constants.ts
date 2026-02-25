import type { ServiceDef } from "./types.js";
import { loadConfig } from "./config.js";
import { scanRepoScripts, detectPackageManager } from "./repo-scanner.js";

const COLORS = [
  "green",
  "blue",
  "cyan",
  "magenta",
  "yellow",
  "red",
  "greenBright",
  "white",
];

/** Generic ready pattern matching common dev server outputs. */
export const DEFAULT_READY_PATTERN =
  /ready in|Local:|started|listening on|compiled|watching|Nest application successfully started|Welcome to Metro|success|BUILD SUCCEEDED|webpack compiled/i;

/** Build the services list dynamically from imported repos. */
export function buildServices(): ServiceDef[] {
  const config = loadConfig();
  const services: ServiceDef[] = [];
  let colorIdx = 0;

  for (const repoPath of config.repos) {
    const result = scanRepoScripts(repoPath);
    if (!result) continue;

    const pm = detectPackageManager(repoPath);
    const repoName = result.name;

    for (const script of result.scripts) {
      services.push({
        id: `${repoName}/${script}`,
        name: script,
        command: `${pm} run ${script}`,
        cwd: repoPath,
        readyPattern: DEFAULT_READY_PATTERN,
        color: COLORS[colorIdx % COLORS.length]!,
        repo: repoName,
      });
      colorIdx++;
    }
  }

  return services;
}
