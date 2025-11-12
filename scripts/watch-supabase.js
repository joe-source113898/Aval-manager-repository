#!/usr/bin/env node
/**
 * Watches SQL sources and automatically runs `supabase db push --yes`
 * whenever a change is detected. Intended to be launched via
 * `pnpm supabase:watch` (included in `pnpm dev`).
 */

const { spawn } = require("node:child_process");
const { existsSync, watch } = require("node:fs");
const path = require("node:path");

const WATCH_FOLDERS = [
  "supabase/migrations",
  "infra",
];

const SQL_EXTENSION = ".sql";
const DEBOUNCE_MS = 750;

let debounceTimer = null;
let pushInProgress = false;
let pushQueued = false;
let queuedReason = "";

const watchers = [];

function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[supabase-watch] ${message}`);
}

function watchFolder(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    log(`Skipping ${relativePath} (folder not found).`);
    return;
  }

  log(`Watching ${relativePath} for SQL changes...`);

  const watcher = watch(
    absolutePath,
    { persistent: true },
    (eventType, filename) => {
      if (!filename) return;
      const ext = path.extname(filename).toLowerCase();
      if (ext !== SQL_EXTENSION) return;
      const relativeFile = path.join(relativePath, filename);
      handleSqlChange(`${eventType} -> ${relativeFile}`);
    }
  );

  watcher.on("error", (error) => {
    log(`Watcher error on ${relativePath}: ${error.message}`);
  });

  watchers.push(watcher);
}

function handleSqlChange(reason) {
  log(`Detected change (${reason}); scheduling Supabase push...`);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    queuePush(reason);
  }, DEBOUNCE_MS);
}

function queuePush(reason) {
  if (pushInProgress) {
    pushQueued = true;
    queuedReason = reason;
    return;
  }
  startPush(reason);
}

function startPush(reason) {
  pushInProgress = true;
  log(`Running "supabase db push --yes" (${reason || "manual trigger"})`);
  const child = spawn("supabase", ["db", "push", "--yes"], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (error) => {
    pushInProgress = false;
    log(`Failed to execute Supabase CLI: ${error.message}`);
  });

  child.on("exit", (code) => {
    pushInProgress = false;
    if (code === 0) {
      log("Supabase schema synced successfully.");
    } else {
      log(`supabase db push exited with code ${code}.`);
    }
    if (pushQueued) {
      pushQueued = false;
      const nextReason = queuedReason || "batched SQL changes";
      queuedReason = "";
      queuePush(nextReason);
    }
  });
}

function cleanupAndExit(signal) {
  log(`Received ${signal}. Shutting down watchers...`);
  watchers.forEach((watcher) => watcher.close());
  process.exit(0);
}

// Start watchers
WATCH_FOLDERS.forEach(watchFolder);

process.on("SIGINT", () => cleanupAndExit("SIGINT"));
process.on("SIGTERM", () => cleanupAndExit("SIGTERM"));

const skipInitialPush = process.env.SKIP_INITIAL_SUPABASE_PUSH === "1";
if (skipInitialPush) {
  log("SKIP_INITIAL_SUPABASE_PUSH=1 detected. Waiting for changes...");
} else {
  queuePush("initial sync");
}
