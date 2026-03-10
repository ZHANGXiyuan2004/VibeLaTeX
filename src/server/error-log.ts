import { randomUUID } from "node:crypto";

import type { ErrorLogEntry } from "@/shared/types";

const MAX_LOG_ENTRIES = 100;
const entries: ErrorLogEntry[] = [];

export function logError(scope: string, message: string, detail?: unknown): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    scope,
    message,
    detail,
  };

  entries.unshift(entry);
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.length = MAX_LOG_ENTRIES;
  }

  return entry;
}

export function getRecentErrors(limit = MAX_LOG_ENTRIES): ErrorLogEntry[] {
  const safeLimit = Math.max(0, Math.min(limit, MAX_LOG_ENTRIES));
  return entries.slice(0, safeLimit);
}

export function clearErrorsForTests(): void {
  entries.length = 0;
}
