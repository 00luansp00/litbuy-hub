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
const temporaryRoots: string[] = [];
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "commerce-architecture-"));
  temporaryRoots.push(root);
  for (const name of [
    ...authoritativeDocuments,
    ...legacyDocuments,
    "COMMERCE_IMPLEMENTATION_ROADMAP.md",
  ]) {
    cpSync(join(repositoryRoot, name), join(root, name));
  }
  return root;
}
function replace(root: string, name: string, from: string | RegExp, to: string): void {
  const path = join(root, name);
  writeFileSync(path, readFileSync(path, "utf8").replace(from, to));
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("commerce architecture audit", () => {
  it("accepts the valid fixture", () => {
    const result = auditCommerceArchitecture(fixture());
    expect(result).toEqual({
      ok: true,
      authoritativeDocuments: 3,
      architectureDecisions: 12,
      staleCommerceClaims: 0,
      failures: [],
    });
  });
  it("emits only safe summary fields", () => {
    const result = auditCommerceArchitecture(fixture());
    expect(Object.keys(result)).toEqual([
      "ok",
      "authoritativeDocuments",
      "architectureDecisions",
      "staleCommerceClaims",
      "failures",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/payload|secret|token/i);
  });
  it("rejects a missing document", () => {
    const root = fixture();
    rmSync(join(root, "COMMERCE_THREAT_MODEL.md"));
    expect(auditCommerceArchitecture(root).failures).toContain(
      "Documento ausente: COMMERCE_THREAT_MODEL.md",
    );
  });
  it.each([
    [
      "multivendor cart",
      /Cada carrinho ativo pertence[^\n]+/,
      "Carrinho multivendedor é permitido",
      "cart-per-seller",
    ],
    [
      "cart reservation",
      /Adicionar ao carrinho \*\*não reserva estoque\*\*/,
      "carrinho reserva estoque",
      "cart-no-reservation",
    ],
    [
      "frontend price",
      /O frontend jamais é autoridade de preço/,
      "frontend define preço",
      "frontend-price",
    ],
    ["missing snapshot", /snapshot imutável/gi, "registro copiável", "immutable-snapshot"],
    ["floating money", /BIGINT[^\n]+/, "float para dinheiro.", "minor-bigint"],
    [
      "monolithic state",
      /Máquinas de estado separadas/g,
      "Máquina de estado monolítica",
      "separate-states",
    ],
    ["missing idempotency", /Idempotency-Key/g, "chave de repetição", "idempotency"],
  ])("rejects %s", (_label, from, to, failure) => {
    const root = fixture();
    replace(root, "COMMERCE_ARCHITECTURE.md", from, to);
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain(failure);
  });
  it("rejects an unbalanced ledger", () => {
    const root = fixture();
    replace(
      root,
      "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md",
      /soma dos débitos = soma dos créditos/,
      "débitos podem divergir dos créditos",
    );
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain("balanced-ledger");
  });
  it("rejects a prematurely selected gateway", () => {
    const root = fixture();
    replace(
      root,
      "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md",
      "Nenhum gateway foi selecionado",
      "gateway escolhido: ExamplePay",
    );
    const result = auditCommerceArchitecture(root);
    expect(result.staleCommerceClaims).toBe(1);
    expect(result.failures.join(" ")).toMatch(/gateway/);
  });
  it("rejects the forbidden simple escrow claim", () => {
    const root = fixture();
    replace(
      root,
      "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md",
      "retenção operacional",
      "escrow simples e retenção operacional",
    );
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain("simple-escrow");
  });
  it("requires signed webhooks", () => {
    const root = fixture();
    replace(
      root,
      "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md",
      "Verificar assinatura",
      "Aceitar evento",
    );
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain("signed-webhooks");
  });
  it("keeps chargeback separate from refund", () => {
    const root = fixture();
    replace(
      root,
      "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md",
      "Reembolso versus chargeback",
      "Chargeback tratado como reembolso",
    );
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain(
      "refund-chargeback-separate",
    );
  });
  it("requires KYC for withdrawal", () => {
    const root = fixture();
    replace(root, "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md", "KYC aprovado", "cadastro básico");
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain("withdrawal-kyc");
  });
  it("requires every legacy document to reference the authority", () => {
    const root = fixture();
    replace(root, "ORDER_LIFECYCLE.md", /COMMERCE_ARCHITECTURE\.md/g, "old-contract.md");
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain("ORDER_LIFECYCLE.md");
  });
  it("refuses traversal and symlinks outside the root", () => {
    const root = fixture();
    expect(() => safeRead(root, "../outside.md")).toThrow("fora da raiz");
    const outside = join(tmpdir(), `outside-${Date.now()}.md`);
    writeFileSync(outside, "secret");
    rmSync(join(root, "COMMERCE_THREAT_MODEL.md"));
    symlinkSync(outside, join(root, "COMMERCE_THREAT_MODEL.md"));
    expect(auditCommerceArchitecture(root).failures.join(" ")).toContain("fora da raiz");
    rmSync(outside);
  });
});
