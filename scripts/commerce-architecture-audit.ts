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
const historicalDocuments = new Set([
  "ORDER_LIFECYCLE.md",
  "DATABASE_SCHEMA.md",
  "API_CONTRACTS_DRAFT.md",
]);
const startMarker = "<!-- HISTORICAL_SNAPSHOT_START -->";
const endMarker = "<!-- HISTORICAL_SNAPSHOT_END -->";

type AuditResult = {
  ok: boolean;
  authoritativeDocuments: number;
  architectureDecisions: number;
  staleCommerceClaims: number;
  failures: string[];
};
type Check = [
  string,
  RegExp,
  "architecture" | "boundary" | "roadmap" | "paymentPlan" | "wallet" | "database" | "api",
];

const checks: Check[] = [
  ["cart-per-seller", /buyerUserId\s*\+\s*sellerProfileId/i, "architecture"],
  ["cart-no-reservation", /carrinho[^\n]*não reserva estoque/i, "architecture"],
  ["server-checkout", /checkout server-side/i, "architecture"],
  ["immutable-snapshot", /snapshot imutável/i, "architecture"],
  ["separate-states", /máquinas de estado separadas/i, "architecture"],
  ["reservation-ttl", /TTL[^\n]*15 minutos/i, "architecture"],
  ["idempotency", /Idempotency-Key/i, "architecture"],
  ["outbox", /transactional outbox/i, "architecture"],
  ["cancel-pre-payment-only", /CANCELLED[^\n]*exclusivamente pré-pagamento/i, "architecture"],
  [
    "refund-model",
    /modelo conceitual futuro `Refund`[\s\S]*providerRefundId[\s\S]*requestedByUserId/i,
    "architecture",
  ],
  ["partial-refund", /PARTIALLY_REFUNDED/i, "architecture"],
  [
    "over-refund-limit",
    /soma dos refunds `SUCCEEDED` não pode superar o valor capturado/i,
    "architecture",
  ],
  [
    "late-payment",
    /Pedido `EXPIRED` não volta automaticamente para `ACTIVE`[\s\S]*incidente de reconciliação/i,
    "architecture",
  ],
  ["money-bigint", /PostgreSQL `BIGINT`[\s\S]*TypeScript usa `bigint`/i, "architecture"],
  [
    "money-json-string",
    /JSON autoritativa[^\n]*sempre uma string decimal canônica/i,
    "architecture",
  ],
  ["gateway-not-selected", /Nenhum gateway foi selecionado/i, "boundary"],
  ["balanced-ledger", /soma dos débitos = soma dos créditos/i, "boundary"],
  ["signed-webhook", /Verificar assinatura/i, "boundary"],
  ["withdrawal-kyc", /KYC aprovado/i, "boundary"],
  ["incremental", /PR #36[\s\S]*PR #37[\s\S]*PR #38/i, "roadmap"],
  ["payment-journal", /journal imutável[\s\S]*entries balanceadas/i, "paymentPlan"],
  ["wallet-journal", /journal imutável[\s\S]*entries balanceadas/i, "wallet"],
  ["wallet-kyc-all", /KYC aprovado é obrigatório para qualquer saque real/i, "wallet"],
  [
    "database-baseline",
    /backend NestJS[\s\S]*PostgreSQL e Prisma[\s\S]*Autenticação real/i,
    "database",
  ],
  [
    "api-baseline",
    /REST em `\/api\/v1`[\s\S]*Home, categoria e detalhe público já o consomem/i,
    "api",
  ],
];

const forbidden: Array<[string, RegExp]> = [
  ["post-payment-cancel", /ACTIVE\s*(?:→|->)\s*CANCELLED|pedido pago[^\n]*pode ser cancelado/i],
  ["mandatory-seven-years", /retenção[^\n]*(?:7|sete) anos[^\n]*(?:obrigat|mínim)/i],
  ["raw-ninety-days", /raw payload[^\n]*(?:90|noventa) dias[^\n]*(?:mínim|obrigat)/i],
  ["optional-kyc", /KYC pode ser requerido conforme valor/i],
  [
    "single-line-ledger",
    /cada mutação\s*=\s*1 linha|toda movimentação[^\n]*gera (?:uma )?entrada/i,
  ],
  ["no-database", /nenhuma tabela existe hoje/i],
  ["future-supabase", /integração futura com Supabase/i],
  ["supabase-auth-current", /Auth[^\n]*auth\.users[^\n]*Supabase/i],
  ["no-public-consumer", /nenhum consumidor frontend[^\n]*conectado/i],
  ["api-style-choice", /REST\/RPC\/GraphQL(?:\/tRPC)?[^\n]*escolha/i],
  [
    "ambiguous-money",
    /amountMinor[^\n]*(?:como|aceita)[^\n]*(?:número|number)\s+ou\s+(?:string|texto)/i,
  ],
  ["numeric-amount", /"amountMinor"\s*:\s*-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i],
  [
    "invalid-money-string",
    /"amountMinor"\s*:\s*"(?:[-+]|\s|0\d|\d+\.\d+|\d+e[+-]?\d+|[^"\d])[^"]*"/i,
  ],
  ["late-reactivation", /pagamento tardio[^\n]*(?:reativa|volta)[^\n]*ACTIVE/i],
  ["simple-escrow", /escrow simples/i],
];

export function safeRead(root: string, name: string): string {
  if (isAbsolute(name) || relative(root, resolve(root, name)).startsWith(".."))
    throw new Error(`Leitura fora da raiz recusada: ${name}`);
  const target = resolve(root, name);
  if (!existsSync(target)) throw new Error(`Documento ausente: ${name}`);
  const canonicalRoot = realpathSync(root);
  const canonicalTarget = realpathSync(target);
  if (relative(canonicalRoot, canonicalTarget).startsWith(".."))
    throw new Error(`Leitura fora da raiz recusada: ${name}`);
  return readFileSync(canonicalTarget, "utf8");
}

function currentContent(
  name: string,
  text: string,
  authoritative: boolean,
  failures: string[],
): string {
  const starts = text.split(startMarker).length - 1;
  const ends = text.split(endMarker).length - 1;
  if (authoritative && (starts || ends))
    failures.push(`Documento autoritativo não pode conter snapshot: ${name}`);
  if (starts !== ends) failures.push(`Marcadores históricos desbalanceados: ${name}`);
  if (historicalDocuments.has(name)) {
    if (starts !== 1 || ends !== 1)
      failures.push(`Snapshot histórico obrigatório inválido: ${name}`);
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker);
    if (
      start < 0 ||
      end < start ||
      !/Snapshot histórico não autoritativo/i.test(text.slice(0, Math.max(start, 0)))
    )
      failures.push(`Snapshot sem seção atual não autoritativa: ${name}`);
  }
  return text.replace(
    /<!-- HISTORICAL_SNAPSHOT_START -->[\s\S]*?<!-- HISTORICAL_SNAPSHOT_END -->/g,
    "",
  );
}

export function auditCommerceArchitecture(rootInput: string): AuditResult {
  const root = resolve(rootInput);
  const failures: string[] = [];
  const current = new Map<string, string>();
  const names = [
    ...authoritativeDocuments,
    "COMMERCE_IMPLEMENTATION_ROADMAP.md",
    ...legacyDocuments,
  ];
  for (const name of names)
    try {
      const text = safeRead(root, name);
      current.set(
        name,
        currentContent(name, text, authoritativeDocuments.includes(name as never), failures),
      );
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  const architecture = current.get("COMMERCE_ARCHITECTURE.md") ?? "";
  if (
    !architecture.startsWith(
      "Status: arquitetura aprovada para implementação incremental\nEscopo: carrinho, checkout, pedidos, estoque e fronteira financeira\nImplementação: ainda não iniciada",
    )
  )
    failures.push("Status explícito de planejamento inválido");
  const corpora = {
    architecture,
    boundary: current.get("FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md") ?? "",
    roadmap: current.get("COMMERCE_IMPLEMENTATION_ROADMAP.md") ?? "",
    paymentPlan: current.get("PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md") ?? "",
    wallet: current.get("WALLET_AND_ESCROW_RULES.md") ?? "",
    database: current.get("DATABASE_SCHEMA.md") ?? "",
    api: current.get("API_CONTRACTS_DRAFT.md") ?? "",
  };
  let passed = 0;
  for (const [label, pattern, source] of checks)
    if (pattern.test(corpora[source])) passed += 1;
    else failures.push(`Decisão ausente: ${label}`);
  for (const name of legacyDocuments)
    if (!(current.get(name) ?? "").includes("COMMERCE_ARCHITECTURE.md"))
      failures.push(`Documento antigo sem fonte autoritativa: ${name}`);
  const corpus = [...current.values()].join("\n");
  let staleCommerceClaims = 0;
  for (const [label, pattern] of forbidden)
    if (pattern.test(corpus)) {
      staleCommerceClaims += 1;
      failures.push(`Afirmação proibida: ${label}`);
    }
  return {
    ok: failures.length === 0,
    authoritativeDocuments: authoritativeDocuments.filter((name) => current.has(name)).length,
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
