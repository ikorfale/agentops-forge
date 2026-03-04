/**
 * receipt-store.ts — Persistent JSONL receipt log for AgentOps Forge
 *
 * Every receipt emitted by `receipt create`, `workflow`, or `dag` is
 * appended to ~/.forge/receipts.jsonl so it can be retrieved later via
 * `receipt verify <hash>`.
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredReceipt {
  receiptHash: string;
  kind: "simple" | "step" | "dag_step" | "workflow";
  /** ISO-8601 timestamp when the receipt was created */
  createdAt: string;
  /** The forge requestId (if available) */
  requestId?: string;
  /** Human-readable label: intent/outcome for simple, stepId+name for steps */
  label: string;
  /** All fields that were hashed to produce receiptHash */
  payload: Record<string, unknown>;
}

const FORGE_DIR = join(homedir(), ".forge");
const STORE_PATH = join(FORGE_DIR, "receipts.jsonl");

function ensureStore(): void {
  if (!existsSync(FORGE_DIR)) {
    mkdirSync(FORGE_DIR, { recursive: true });
  }
}

/** Append a single receipt to the persistent store. */
export function storeReceipt(entry: StoredReceipt): void {
  ensureStore();
  appendFileSync(STORE_PATH, JSON.stringify(entry) + "\n", "utf8");
}

/** Look up a receipt by its SHA-256 hash. Returns null if not found. */
export function lookupReceipt(hash: string): StoredReceipt | null {
  if (!existsSync(STORE_PATH)) return null;
  const lines = readFileSync(STORE_PATH, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const entry: StoredReceipt = JSON.parse(line);
      if (entry.receiptHash === hash) return entry;
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

/** Return all receipts in the store (newest first). */
export function listReceipts(limit = 50): StoredReceipt[] {
  if (!existsSync(STORE_PATH)) return [];
  const lines = readFileSync(STORE_PATH, "utf8").split("\n").filter(Boolean);
  return lines
    .map((l) => {
      try { return JSON.parse(l) as StoredReceipt; } catch { return null; }
    })
    .filter(Boolean)
    .reverse()
    .slice(0, limit) as StoredReceipt[];
}

/** Return the path to the store file (for diagnostics). */
export function storePath(): string {
  return STORE_PATH;
}
