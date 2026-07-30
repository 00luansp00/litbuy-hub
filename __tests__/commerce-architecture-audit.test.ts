import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditCommerceArchitecture,
  authoritativeDocuments,
  legacyDocuments,
  safeRead,
} from "../scripts/commerce-architecture-audit";

const repositoryRoot = resolve(import.meta.dirname, "..");
const roots: string[] = [];
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "commerce-architecture-"));
  roots.push(root);
  for (const name of [
    ...authoritativeDocuments,
    ...legacyDocuments,
    "COMMERCE_IMPLEMENTATION_ROADMAP.md",
  ])
    cpSync(join(repositoryRoot, name), join(root, name));
  return root;
}
function replace(root: string, name: string, from: string | RegExp, to: string): void {
  const path = join(root, name);
  writeFileSync(path, readFileSync(path, "utf8").replace(from, to));
}
function append(root: string, name: string, text: string): void {
  const path = join(root, name);
  writeFileSync(path, `${readFileSync(path, "utf8")}\n${text}\n`);
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function expectFailure(root: string, label: string): void {
  expect(auditCommerceArchitecture(root).failures.join(" ")).toContain(label);
}

describe("commerce architecture audit", () => {
  it("accepts the real valid fixture and safe output", () => {
    expect(auditCommerceArchitecture(fixture())).toEqual({
      ok: true,
      authoritativeDocuments: 3,
      architectureDecisions: 25,
      staleCommerceClaims: 0,
      failures: [],
    });
  });
  it("rejects a missing authoritative document", () => {
    const root = fixture();
    rmSync(join(root, "COMMERCE_THREAT_MODEL.md"));
    expectFailure(root, "Documento ausente");
  });
  it.each([
    ["post-payment edge", "ACTIVE → CANCELLED", "post-payment-cancel"],
    ["post-payment prose", "Pedido pago pode ser cancelado pela operação.", "post-payment-cancel"],
    ["seven-year retention", "Retenção: sete anos, mínimo obrigatório.", "mandatory-seven-years"],
    ["raw webhook retention", "Logs de webhook raw payload por 90 dias mínimo.", "raw-ninety-days"],
    ["optional KYC", "KYC pode ser requerido conforme valor.", "optional-kyc"],
    ["single line mutation", "Cada mutação = 1 linha.", "single-line-ledger"],
    ["single ledger entry", "Toda movimentação gera uma entrada.", "single-line-ledger"],
    ["no database", "Nenhuma tabela existe hoje.", "no-database"],
    ["future Supabase", "Integração futura com Supabase.", "future-supabase"],
    ["no frontend consumer", "Nenhum consumidor frontend está conectado.", "no-public-consumer"],
    ["API style choice", "REST/RPC/GraphQL como escolha futura.", "api-style-choice"],
    ["ambiguous money", "amountMinor aceita número ou string.", "ambiguous-money"],
    [
      "late activation",
      "Pagamento tardio reativa automaticamente o pedido para ACTIVE.",
      "late-reactivation",
    ],
  ])("rejects current claim: %s", (_name, claim, failure) => {
    const root = fixture();
    append(root, "BACKEND_ROADMAP.md", claim);
    expectFailure(root, failure);
  });
  it.each([
    ["numeric integer", `{ "amountMinor": 4990 }`],
    ["numeric decimal", `{ "amountMinor": 49.90 }`],
    ["numeric exponent", `{ "amountMinor": 4.99e3 }`],
    ["negative string", `{ "amountMinor": "-4990" }`],
    ["leading-zero string", `{ "amountMinor": "04990" }`],
    ["decimal string", `{ "amountMinor": "49.90" }`],
    ["exponent string", `{ "amountMinor": "4e3" }`],
    ["spaced string", `{ "amountMinor": " 4990" }`],
  ])("rejects noncanonical money: %s", (_name, claim) => {
    const root = fixture();
    append(root, "BACKEND_ROADMAP.md", claim);
    expect(auditCommerceArchitecture(root).staleCommerceClaims).toBeGreaterThan(0);
  });
  it.each([
    ["Refund model", /## Modelo conceitual futuro `Refund`/, "## Registro omitido", "refund-model"],
    ["PARTIALLY_REFUNDED", /PARTIALLY_REFUNDED/g, "PARTIAL_DONE", "partial-refund"],
    [
      "aggregate refund ceiling",
      /A soma dos refunds `SUCCEEDED` não pode superar o valor capturado/,
      "O limite não foi definido",
      "over-refund-limit",
    ],
    [
      "late-payment handling",
      /Pedido `EXPIRED` não volta automaticamente para `ACTIVE`/,
      "Pedido expirado não tem regra",
      "late-payment",
    ],
    [
      "JSON string contract",
      /JSON autoritativa[^.]+string decimal canônica/,
      "JSON autoritativa não definida",
      "money-json-string",
    ],
  ])("requires %s", (_name, from, to, failure) => {
    const root = fixture();
    replace(root, "COMMERCE_ARCHITECTURE.md", from, to);
    expectFailure(root, failure);
  });
  it("accepts forbidden historical prose inside a valid snapshot", () => {
    const root = fixture();
    replace(
      root,
      "ORDER_LIFECYCLE.md",
      "<!-- HISTORICAL_SNAPSHOT_END -->",
      "ACTIVE → CANCELLED\n<!-- HISTORICAL_SNAPSHOT_END -->",
    );
    expect(auditCommerceArchitecture(root).ok).toBe(true);
  });
  it("rejects an unclosed historical marker", () => {
    const root = fixture();
    replace(root, "ORDER_LIFECYCLE.md", "<!-- HISTORICAL_SNAPSHOT_END -->", "");
    expectFailure(root, "desbalanceados");
  });
  it("rejects forbidden prose outside a historical snapshot", () => {
    const root = fixture();
    append(root, "ORDER_LIFECYCLE.md", "ACTIVE → CANCELLED");
    expectFailure(root, "post-payment-cancel");
  });
  it("prevents authoritative documents from hiding contradictions", () => {
    const root = fixture();
    append(
      root,
      "COMMERCE_ARCHITECTURE.md",
      "<!-- HISTORICAL_SNAPSHOT_START -->\nACTIVE → CANCELLED\n<!-- HISTORICAL_SNAPSHOT_END -->",
    );
    expectFailure(root, "autoritativo não pode conter snapshot");
  });
  it("requires current database and API baselines", () => {
    const root = fixture();
    replace(root, "DATABASE_SCHEMA.md", "O backend NestJS", "O protótipo");
    replace(
      root,
      "API_CONTRACTS_DRAFT.md",
      "A arquitetura atual usa REST",
      "A arquitetura é indefinida",
    );
    const failures = auditCommerceArchitecture(root).failures.join(" ");
    expect(failures).toContain("database-baseline");
    expect(failures).toContain("api-baseline");
  });
  it("refuses traversal and symlinks outside root", () => {
    const root = fixture();
    expect(() => safeRead(root, "../outside.md")).toThrow("fora da raiz");
    const outside = join(tmpdir(), `outside-${Date.now()}.md`);
    writeFileSync(outside, "secret");
    rmSync(join(root, "COMMERCE_THREAT_MODEL.md"));
    symlinkSync(outside, join(root, "COMMERCE_THREAT_MODEL.md"));
    expectFailure(root, "fora da raiz");
    rmSync(outside);
  });
});
