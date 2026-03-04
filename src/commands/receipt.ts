import { createHash } from "node:crypto";
import { makeReport } from "../core/report.js";
import { storeReceipt, lookupReceipt, listReceipts, storePath } from "../core/receipt-store.js";

// ─── Create ───────────────────────────────────────────────────────────────────

export async function receiptCmd(intent: string, outcome: string) {
  const started = Date.now();
  const receiptHash = createHash("sha256").update(`${intent}::${outcome}`).digest("hex");
  const now = new Date().toISOString();

  // Persist to store
  storeReceipt({
    receiptHash,
    kind: "simple",
    createdAt: now,
    label: `${intent} → ${outcome}`,
    payload: { intent, outcome },
  });

  return makeReport("receipt", started, "ok", { intent, outcome, receiptHash });
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export interface ReceiptVerifyData {
  hash: string;
  found: boolean;
  receipt?: {
    receiptHash: string;
    kind: string;
    createdAt: string;
    label: string;
    payload: Record<string, unknown>;
    requestId?: string;
  };
  storePath: string;
}

export async function receiptVerifyCmd(hash: string) {
  const started = Date.now();
  const entry = lookupReceipt(hash);

  if (!entry) {
    return makeReport<ReceiptVerifyData>(
      "receipt:verify",
      started,
      "fail",
      { hash, found: false, storePath: storePath() },
      [],
      [`No receipt found for hash ${hash}`]
    );
  }

  return makeReport<ReceiptVerifyData>("receipt:verify", started, "ok", {
    hash,
    found: true,
    receipt: {
      receiptHash: entry.receiptHash,
      kind: entry.kind,
      createdAt: entry.createdAt,
      label: entry.label,
      payload: entry.payload,
      requestId: entry.requestId,
    },
    storePath: storePath(),
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ReceiptListData {
  count: number;
  receipts: Array<{
    receiptHash: string;
    kind: string;
    createdAt: string;
    label: string;
  }>;
  storePath: string;
}

export async function receiptListCmd(limit = 20) {
  const started = Date.now();
  const entries = listReceipts(limit);
  return makeReport<ReceiptListData>("receipt:list", started, "ok", {
    count: entries.length,
    receipts: entries.map((e) => ({
      receiptHash: e.receiptHash,
      kind: e.kind,
      createdAt: e.createdAt,
      label: e.label,
    })),
    storePath: storePath(),
  });
}
