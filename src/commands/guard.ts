import { existsSync } from "node:fs";
import { makeReport } from "../core/report.js";

export type GuardKind = "env" | "files" | "network" | "schema" | string;

interface GuardCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

interface GuardData {
  kind: GuardKind;
  checks: GuardCheck[];
  passed: number;
  failed: number;
}

/**
 * Run pre-flight checks for the given guard kind.
 *
 * Supported built-in kinds:
 *   env     — verify that common required env vars are set
 *   files   — verify agent workspace files are present
 *   network — verify internet reachability via DNS
 *   schema  — verify JSON schema compliance (stub, always pass)
 *   <any>   — generic single check (passes)
 */
export async function guardCmd(kind: GuardKind): Promise<ReturnType<typeof makeReport<GuardData>>> {
  const started = Date.now();
  const checks: GuardCheck[] = [];

  switch (kind) {
    case "env": {
      const requiredVars = ["HOME", "PATH", "NODE_ENV"];
      for (const v of requiredVars) {
        checks.push({
          name: `env:${v}`,
          passed: Boolean(process.env[v]),
          detail: process.env[v] ? "set" : "missing",
        });
      }
      // Optional but useful
      const optionalVars = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "SUPABASE_URL"];
      for (const v of optionalVars) {
        checks.push({
          name: `env:${v} (optional)`,
          passed: true, // never fail on optional
          detail: process.env[v] ? "set" : "not set (optional)",
        });
      }
      break;
    }

    case "files": {
      const agentFiles = [
        process.env.HOME + "/.openclaw/workspace/SOUL.md",
        process.env.HOME + "/.openclaw/workspace/MEMORY.md",
        process.env.HOME + "/.openclaw/workspace/TOOLS.md",
      ];
      for (const f of agentFiles) {
        const exists = existsSync(f);
        checks.push({
          name: `file:${f.split("/").pop()}`,
          passed: exists,
          detail: exists ? "present" : "missing",
        });
      }
      break;
    }

    case "network": {
      // Non-blocking DNS check via built-in dns module
      try {
        const { Resolver } = await import("node:dns/promises");
        const resolver = new Resolver();
        resolver.setServers(["8.8.8.8"]);
        const addrs = await Promise.race([
          resolver.resolve4("api.anthropic.com"),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
        ]);
        checks.push({
          name: "dns:api.anthropic.com",
          passed: Array.isArray(addrs) && addrs.length > 0,
          detail: Array.isArray(addrs) ? `resolved: ${addrs[0]}` : "empty",
        });
      } catch (err) {
        checks.push({
          name: "dns:api.anthropic.com",
          passed: false,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case "schema": {
      // Schema validation guard — stub that always passes but signals intent
      checks.push({
        name: "schema:zod",
        passed: true,
        detail: "schema validation is runtime-dependent; pass --schema <path> to enable",
      });
      break;
    }

    default: {
      // Generic single check
      checks.push({
        name: kind,
        passed: true,
        detail: "generic guard passed",
      });
    }
  }

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  const status = failed === 0 ? "ok" : passed === 0 ? "fail" : "partial";

  const errors = checks
    .filter((c) => !c.passed)
    .map((c) => `Guard check failed: ${c.name} — ${c.detail ?? "no detail"}`);

  return makeReport<GuardData>(
    "guard",
    started,
    status,
    { kind, checks, passed, failed },
    [],
    errors
  );
}
