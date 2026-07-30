import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const authoritativeDocuments = [
  "COMMERCE_ARCHITECTURE.md",
  "FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md",
  "COMMERCE_THREAT_MODEL.md",
] as const;
export const legacyDocuments = [
  "ORDER_LIFECYCLE.md",
  "PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md",
  "WALLET_AND_ESCROW_RULES.md",
  "DATABASE_SCHEMA.md",
  "API_CONTRACTS_DRAFT.md",
  "BACKEND_ROADMAP.md",
  "DEVELOPER_HANDOFF.md",
  "PUBLIC_FOUNDATION_FINAL_AUDIT.md",
] as const;

type AuditResult = {
  ok: boolean;
  authoritativeDocuments: number;
  architectureDecisions: number;
  staleCommerceClaims: number;
  failures: string[];
};

const decisions: Array<[string, RegExp]> = [
  ["cart-per-seller", /buyerUserId\s*\+\s*sellerProfileId|comprador[^\n]+único vendedor/i],
  ["cart-no-reservation", /carrinho[^\n]*não reserva estoque/i],
  ["server-checkout", /checkout server-side/i],
  ["server-price", /backend (?:converte|recalcula)[^\n]*preço/i],
  ["minor-bigint", /BIGINT[^\n]*centavos/i],
  ["immutable-snapshot", /snapshot imutável/i],
  ["separate-states", /máquinas de estado separadas/i],
  ["reservation-ttl", /TTL[^\n]*15 minutos/i],
  ["idempotency", /Idempotency-Key/i],
  ["outbox", /transactional outbox/i],
  ["double-entry", /partidas dobradas/i],
  ["incremental", /PR #36[\s\S]*PR #37[\s\S]*PR #38/i],
];

const requiredBoundary: Array<[string, RegExp]> = [
  ["gateway-not-selected", /Nenhum gateway foi selecionado/i],
  ["retention-versus-escrow", /retenção operacional[\s\S]*escrow regulado\/contratual/i],
  ["signed-webhooks", /Verificar assinatura/i],
  ["refund-chargeback-separate", /Reembolso versus chargeback/i],
  ["withdrawal-kyc", /KYC aprovado/i],
  ["balanced-ledger", /soma dos débitos = soma dos créditos/i],
];

const forbidden: Array<[string, RegExp]> = [
  ["simple-escrow", /escrow simples/i],
  ["frontend-price", /frontend (?:define|determina|é autoridade d[eo]) (?:o )?preço/i],
  ["cart-reserves", /carrinho reserva estoque/i],
  ["direct-balance-update", /(?:permitir|usar|faz(?:er)?) (?:um )?UPDATE direto (?:do|de) saldo/i],
  ["single-entry-ledger", /ledger (?:de|com) uma única entrada sem contrapartida/i],
  ["payment-implemented", /pagamento (?:já |está )implementado/i],
  ["real-money-ready", /(?:projeto|sistema) (?:está )?pronto para (?:aceitar )?dinheiro real/i],
  ["gateway-chosen", /gateway escolhido:\s*\S+/i],
];

export function safeRead(root: string, name: string): string {
  if (isAbsolute(name) || relative(root, resolve(root, name)).startsWith("..")) {
    throw new Error(`Leitura fora da raiz recusada: ${name}`);
  }
  const target = resolve(root, name);
  if (!existsSync(target)) throw new Error(`Documento ausente: ${name}`);
  const canonicalRoot = realpathSync(root);
  const canonicalTarget = realpathSync(target);
  if (relative(canonicalRoot, canonicalTarget).startsWith("..")) {
    throw new Error(`Leitura fora da raiz recusada: ${name}`);
  }
  return readFileSync(canonicalTarget, "utf8");
}

export function auditCommerceArchitecture(rootInput: string): AuditResult {
  const root = resolve(rootInput);
  const failures: string[] = [];
  const contents = new Map<string, string>();
  for (const name of [...authoritativeDocuments, "COMMERCE_IMPLEMENTATION_ROADMAP.md"] as const) {
    try {
      contents.set(name, safeRead(root, name));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  const architecture = contents.get("COMMERCE_ARCHITECTURE.md") ?? "";
  const boundary = contents.get("FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md") ?? "";
  const roadmap = contents.get("COMMERCE_IMPLEMENTATION_ROADMAP.md") ?? "";
  if (
    !architecture.startsWith(
      "Status: arquitetura aprovada para implementação incremental\nEscopo: carrinho, checkout, pedidos, estoque e fronteira financeira\nImplementação: ainda não iniciada",
    )
  ) {
    failures.push("Status explícito de planejamento inválido");
  }
  let passed = 0;
  for (const [label, pattern] of decisions) {
    const corpus = label === "incremental" ? roadmap : architecture;
    if (pattern.test(corpus)) passed += 1;
    else failures.push(`Decisão ausente: ${label}`);
  }
  for (const [label, pattern] of requiredBoundary) {
    if (!pattern.test(boundary)) failures.push(`Fronteira ausente: ${label}`);
  }
  const audited = [...contents.values()];
  for (const name of legacyDocuments) {
    try {
      const text = safeRead(root, name);
      audited.push(text);
      if (!/COMMERCE_ARCHITECTURE\.md/.test(text))
        failures.push(`Documento antigo sem fonte autoritativa: ${name}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  const corpus = audited.join("\n");
  let staleCommerceClaims = 0;
  for (const [label, pattern] of forbidden) {
    if (pattern.test(corpus)) {
      staleCommerceClaims += 1;
      failures.push(`Afirmação proibida: ${label}`);
    }
  }
  return {
    ok: failures.length === 0,
    authoritativeDocuments: authoritativeDocuments.filter((name) => contents.has(name)).length,
    architectureDecisions: passed,
    staleCommerceClaims,
    failures,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(fileURLToPath(new URL("..", import.meta.url)));
  const result = auditCommerceArchitecture(root);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
