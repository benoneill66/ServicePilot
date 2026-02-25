import fs from "node:fs";
import path from "node:path";

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

export function detectPackageManager(repoPath: string): string {
  if (
    fs.existsSync(path.join(repoPath, "bun.lockb")) ||
    fs.existsSync(path.join(repoPath, "bun.lock"))
  )
    return "bun";
  if (fs.existsSync(path.join(repoPath, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(repoPath, "yarn.lock"))) return "yarn";
  return "npm";
}

export function scanRepoScripts(
  repoPath: string
): { name: string; scripts: string[] } | null {
  const pkgPath = path.join(repoPath, "package.json");
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return {
      name: pkg.name ?? path.basename(repoPath),
      scripts: Object.keys(pkg.scripts ?? {}),
    };
  } catch {
    return null;
  }
}
