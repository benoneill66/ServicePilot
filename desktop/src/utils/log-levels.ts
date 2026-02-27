// desktop/src/utils/log-levels.ts
export type LogLevel = "error" | "warn" | "info" | "debug";

// Strip ANSI escape codes for matching
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

const LEVEL_PATTERNS: [LogLevel, RegExp][] = [
  ["error", /\b(ERROR|ERR|FATAL|PANIC)\b/i],
  ["warn", /\b(WARN|WARNING)\b/i],
  ["debug", /\b(DEBUG|TRACE|VERBOSE)\b/i],
  ["info", /\b(INFO)\b/i],
];

export function detectLogLevel(line: string): LogLevel | null {
  const plain = stripAnsi(line);
  for (const [level, pattern] of LEVEL_PATTERNS) {
    if (pattern.test(plain)) return level;
  }
  return null;
}

export { stripAnsi };
