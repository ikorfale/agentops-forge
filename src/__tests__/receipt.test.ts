/**
 * receipt.test.ts — Tests for receipt create / verify / list + receipt-store
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── Isolate the store to a temp dir per test run ────────────────────────────

// We patch homedir before importing the store module
const TEST_HOME = join(tmpdir(), `forge-test-${process.pid}`);
process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME; // Windows compat

import {
  storeReceipt,
  lookupReceipt,
  listReceipts,
  storePath,
} from "../core/receipt-store.js";

import { receiptCmd, receiptVerifyCmd, receiptListCmd } from "../commands/receipt.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanup() {
  const sp = storePath();
  if (existsSync(sp)) rmSync(sp);
}

// ─── receipt-store unit tests ─────────────────────────────────────────────────

describe("receipt-store", () => {
  beforeEach(cleanup);

  it("stores and retrieves a receipt by hash", () => {
    const entry = {
      receiptHash: "abc123",
      kind: "simple" as const,
      createdAt: new Date().toISOString(),
      label: "test → done",
      payload: { intent: "test", outcome: "done" },
    };
    storeReceipt(entry);
    const found = lookupReceipt("abc123");
    expect(found).not.toBeNull();
    expect(found!.label).toBe("test → done");
    expect(found!.kind).toBe("simple");
  });

  it("returns null for unknown hash", () => {
    expect(lookupReceipt("nonexistent_hash_xyz")).toBeNull();
  });

  it("lists receipts newest first", () => {
    storeReceipt({ receiptHash: "h1", kind: "simple", createdAt: "2026-01-01T00:00:00Z", label: "first", payload: {} });
    storeReceipt({ receiptHash: "h2", kind: "simple", createdAt: "2026-01-02T00:00:00Z", label: "second", payload: {} });
    const list = listReceipts(10);
    expect(list.length).toBe(2);
    // newest first (reversed)
    expect(list[0].receiptHash).toBe("h2");
    expect(list[1].receiptHash).toBe("h1");
  });

  it("respects limit in listReceipts", () => {
    for (let i = 0; i < 5; i++) {
      storeReceipt({ receiptHash: `h${i}`, kind: "simple", createdAt: "", label: `entry ${i}`, payload: {} });
    }
    expect(listReceipts(3).length).toBe(3);
  });

  it("storePath() ends with receipts.jsonl", () => {
    expect(storePath()).toMatch(/receipts\.jsonl$/);
  });
});

// ─── receiptCmd (create) ──────────────────────────────────────────────────────

describe("receiptCmd", () => {
  beforeEach(cleanup);

  it("returns status ok with correct hash", async () => {
    const result = await receiptCmd("deploy-api", "deployed successfully");
    expect(result.status).toBe("ok");
    expect(result.data.receiptHash).toBeTruthy();

    const expectedHash = createHash("sha256")
      .update("deploy-api::deployed successfully")
      .digest("hex");
    expect(result.data.receiptHash).toBe(expectedHash);
  });

  it("persists the receipt so it can be verified", async () => {
    const result = await receiptCmd("send-outreach", "email sent");
    const hash = result.data.receiptHash;

    const found = lookupReceipt(hash);
    expect(found).not.toBeNull();
    expect(found!.payload).toMatchObject({ intent: "send-outreach", outcome: "email sent" });
  });
});

// ─── receiptVerifyCmd ─────────────────────────────────────────────────────────

describe("receiptVerifyCmd", () => {
  beforeEach(cleanup);

  it("returns found=true for a known hash", async () => {
    const create = await receiptCmd("test-intent", "test-outcome");
    const hash = create.data.receiptHash;

    const verify = await receiptVerifyCmd(hash);
    expect(verify.status).toBe("ok");
    expect(verify.data.found).toBe(true);
    expect(verify.data.receipt?.receiptHash).toBe(hash);
    expect(verify.data.receipt?.kind).toBe("simple");
  });

  it("returns found=false and fail status for unknown hash", async () => {
    const verify = await receiptVerifyCmd("0000000000000000000000000000000000000000000000000000000000000000");
    expect(verify.status).toBe("fail");
    expect(verify.data.found).toBe(false);
    expect(verify.errors).toContain(
      "No receipt found for hash 0000000000000000000000000000000000000000000000000000000000000000"
    );
  });

  it("storePath is included in both found and not-found responses", async () => {
    const found = await receiptVerifyCmd("no-such-hash");
    expect(found.data.storePath).toMatch(/receipts\.jsonl$/);

    const create = await receiptCmd("i", "o");
    const verified = await receiptVerifyCmd(create.data.receiptHash);
    expect(verified.data.storePath).toMatch(/receipts\.jsonl$/);
  });
});

// ─── receiptListCmd ───────────────────────────────────────────────────────────

describe("receiptListCmd", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("returns empty list when store is empty", async () => {
    const result = await receiptListCmd(10);
    expect(result.status).toBe("ok");
    expect(result.data.count).toBe(0);
    expect(result.data.receipts).toHaveLength(0);
  });

  it("lists created receipts", async () => {
    await receiptCmd("intent-a", "outcome-a");
    await receiptCmd("intent-b", "outcome-b");
    const result = await receiptListCmd(10);
    expect(result.data.count).toBe(2);
    expect(result.data.receipts[0].kind).toBe("simple");
    // newest first
    expect(result.data.receipts[0].label).toContain("intent-b");
  });
});
