/**
 * Key-id-only logger. NEVER log raw API keys.
 * Reference keys only by their SHA-256 hash (first 8 hex chars).
 */
type Level = "info" | "warn" | "error" | "debug";

const COLORS: Record<Level, string> = {
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",   // gray
};
const RESET = "\x1b[0m";

function ts() {
  return new Date().toISOString();
}

function fmt(level: Level, msg: string, meta?: Record<string, unknown>) {
  const metaStr = meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  return `${COLORS[level]}[${ts()}] [${level.toUpperCase()}]${RESET} ${msg}${metaStr}`;
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(fmt("info", msg, meta)),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(fmt("warn", msg, meta)),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(fmt("error", msg, meta)),
  debug: (msg: string, meta?: Record<string, unknown>) =>
    process.env.NODE_ENV !== "production" && console.debug(fmt("debug", msg, meta)),
};
