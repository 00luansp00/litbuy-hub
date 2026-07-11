// ==================================================
// Sprint 18.15 — Denúncias / Reports (mock)
//
// Todo o service é 100% mockado. Nenhum dado é
// persistido. Nenhuma denúncia real é enviada.
// Em produção esta camada exigirá backend, moderação,
// storage para evidências e audit log.
// ==================================================

import type {
  Report,
  ReportPayload,
  ReportReason,
  ReportSeverity,
  ReportSource,
  ReportStatus,
  ReportTargetType,
} from "@/types";

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const TARGET_LABEL: Record<ReportTargetType, string> = {
  product: "Anúncio",
  seller: "Vendedor",
  message: "Mensagem",
  conversation: "Conversa",
  order: "Pedido",
  sale: "Venda",
  user: "Usuário",
  payment: "Pagamento",
  other: "Outro",
};

const SEVERITY_OPTIONS: { value: ReportSeverity; label: string; hint: string }[] = [
  { value: "low", label: "Baixa", hint: "Situação leve ou dúvida." },
  { value: "medium", label: "Média", hint: "Comportamento incorreto." },
  { value: "high", label: "Alta", hint: "Golpe, contato externo ou fraude." },
  {
    value: "critical",
    label: "Crítica",
    hint: "Risco imediato à comunidade ou segurança.",
  },
];

const REASONS_BY_TARGET: Record<ReportTargetType, ReportReason[]> = {
  product: [
    { value: "misleading_listing", label: "Anúncio enganoso", severity: "medium" },
    { value: "prohibited_item", label: "Produto proibido", severity: "high" },
    { value: "suspicious_price", label: "Preço suspeito", severity: "medium" },
    { value: "false_info", label: "Informação falsa", severity: "medium" },
    { value: "scam_attempt", label: "Tentativa de golpe", severity: "critical" },
    { value: "inappropriate_media", label: "Imagem/descrição inadequada", severity: "medium" },
    { value: "wrong_category", label: "Item não corresponde à categoria", severity: "low" },
  ],
  seller: [
    { value: "suspicious_behavior", label: "Comportamento suspeito", severity: "medium" },
    { value: "external_contact_attempt", label: "Tentativa de contato externo", severity: "high" },
    { value: "recurring_no_delivery", label: "Não entrega recorrente", severity: "high" },
    { value: "scam", label: "Golpe", severity: "critical" },
    { value: "abuse", label: "Abuso", severity: "high" },
    { value: "fraud", label: "Fraude", severity: "critical" },
    { value: "reputation_faking", label: "Falsificação de reputação", severity: "high" },
  ],
  message: [
    { value: "external_contact_attempt", label: "Tentativa de contato externo", severity: "high" },
    { value: "external_channels", label: "Envio de WhatsApp/Discord/Telegram/telefone/e-mail", severity: "high" },
    { value: "spam", label: "Spam", severity: "low" },
    { value: "offensive_language", label: "Linguagem ofensiva", severity: "medium" },
    { value: "threat", label: "Ameaça", severity: "critical" },
    { value: "scam", label: "Golpe", severity: "critical" },
    { value: "suspicious_link", label: "Link suspeito", severity: "high" },
  ],
  conversation: [
    { value: "external_contact_attempt", label: "Tentativa de contato externo", severity: "high" },
    { value: "spam", label: "Spam recorrente", severity: "low" },
    { value: "harassment", label: "Assédio", severity: "high" },
    { value: "scam", label: "Golpe", severity: "critical" },
    { value: "other", label: "Outro problema", severity: "low" },
  ],
  order: [
    { value: "not_received", label: "Produto não recebido", severity: "high" },
    { value: "different_from_listing", label: "Produto diferente do anunciado", severity: "medium" },
    { value: "invalid_credentials", label: "Dados inválidos", severity: "high" },
    { value: "account_recovered", label: "Conta recuperada", severity: "critical" },
    { value: "external_contact_requested", label: "Vendedor pediu contato externo", severity: "high" },
    { value: "automatic_delivery_issue", label: "Problema com entrega automática", severity: "medium" },
    { value: "other", label: "Outro problema", severity: "low" },
  ],
  sale: [
    { value: "buyer_external_contact", label: "Comprador pediu contato externo", severity: "high" },
    { value: "suspicious_receipt", label: "Comprovante suspeito", severity: "high" },
    { value: "abusive_behavior", label: "Comportamento abusivo", severity: "high" },
    { value: "scam_attempt", label: "Tentativa de golpe", severity: "critical" },
    { value: "improper_dispute", label: "Disputa indevida", severity: "medium" },
  ],
  user: [
    { value: "abusive_behavior", label: "Comportamento abusivo", severity: "high" },
    { value: "fraud", label: "Fraude", severity: "critical" },
    { value: "fee_bypass", label: "Tentativa de burlar taxas", severity: "high" },
    { value: "harassment", label: "Assédio", severity: "high" },
    { value: "spam", label: "Spam", severity: "low" },
  ],
  payment: [
    { value: "suspicious_charge", label: "Cobrança suspeita", severity: "high" },
    { value: "fake_receipt", label: "Comprovante falso", severity: "critical" },
    { value: "manipulation_attempt", label: "Tentativa de manipulação", severity: "high" },
    { value: "other", label: "Outro problema", severity: "low" },
  ],
  other: [
    { value: "other", label: "Outro problema", severity: "low" },
  ],
};

const GUIDELINES: string[] = [
  "Mantenha toda negociação dentro da LIT Buy.",
  "Não compartilhe WhatsApp, Discord, Telegram, telefone ou e-mail.",
  "Denúncias falsas podem gerar penalidades em produção.",
  "A equipe da LIT Buy poderá usar mensagens e evidências para análise.",
  "Envio real de evidências exigirá backend e armazenamento seguro.",
];

// Denúncias mockadas exibidas no Admin
const now = Date.now();
function iso(offsetH: number): string {
  return new Date(now - offsetH * 3_600_000).toISOString();
}

const MOCK_REPORTS: Report[] = [
  {
    id: "rep_001",
    code: "REP-000123",
    targetType: "seller",
    targetId: "seller_topgamer",
    targetLabel: "TopGamerBR",
    reason: "external_contact_attempt",
    reasonLabel: "Tentativa de contato externo",
    severity: "high",
    status: "under_review",
    description:
      "Vendedor tentou trocar contato via WhatsApp durante a negociação.",
    reporterId: "user_ana",
    reporterName: "Ana Souza",
    reportedUserId: "seller_topgamer",
    reportedUserName: "TopGamerBR",
    context: {
      sellerId: "seller_topgamer",
      sellerSlug: "topgamerbr",
      conversationId: "conv_001",
    },
    evidence: [
      { id: "ev1", kind: "message", label: "Mensagem sinalizada como contato externo" },
      { id: "ev2", kind: "image", label: "Print da conversa (mock)" },
    ],
    source: "message_thread",
    assignedTo: "Moderação LIT",
    createdAt: iso(2),
    updatedAt: iso(1),
    internalNotes: ["Priorizar — vendedor com histórico anterior."],
  },
  {
    id: "rep_002",
    code: "REP-000124",
    targetType: "product",
    targetId: "prod_valorant_skin",
    targetLabel: "Skin rara Valorant — instantânea",
    reason: "misleading_listing",
    reasonLabel: "Anúncio enganoso",
    severity: "medium",
    status: "submitted",
    description: "Anúncio promete item que não existe no jogo.",
    reporterId: "user_bruno",
    reporterName: "Bruno Lima",
    context: {
      productId: "prod_valorant_skin",
      sellerId: "seller_skinsplus",
    },
    evidence: [{ id: "ev3", kind: "link", label: "Link para o anúncio" }],
    source: "product_page",
    createdAt: iso(6),
    updatedAt: iso(6),
  },
  {
    id: "rep_003",
    code: "REP-000125",
    targetType: "order",
    targetId: "order_ABC-9821",
    targetLabel: "Pedido #ABC-9821 — Conta Steam",
    reason: "account_recovered",
    reasonLabel: "Conta recuperada",
    severity: "critical",
    status: "action_required",
    description:
      "Comprador reporta que a conta foi recuperada pelo dono original após 3 dias.",
    reporterId: "user_carla",
    reporterName: "Carla Nunes",
    context: {
      orderId: "order_ABC-9821",
      orderCode: "ABC-9821",
      sellerId: "seller_accspro",
      conversationId: "conv_003",
    },
    evidence: [
      { id: "ev4", kind: "image", label: "Screenshot Steam Guard" },
      { id: "ev5", kind: "text", label: "Descrição detalhada" },
    ],
    source: "order_page",
    assignedTo: "Moderação LIT",
    createdAt: iso(10),
    updatedAt: iso(3),
    internalNotes: ["Encaminhado para mediação — abrir disputa formal."],
  },
  {
    id: "rep_004",
    code: "REP-000126",
    targetType: "message",
    targetId: "msg_9182",
    targetLabel: "Mensagem em conversa #conv_004",
    reason: "external_channels",
    reasonLabel: "Envio de WhatsApp",
    severity: "high",
    status: "resolved",
    description: "Mensagem sanitizada automaticamente. Reforço com aviso.",
    reporterId: "user_daniel",
    reporterName: "Daniel Rocha",
    context: { conversationId: "conv_004", messageId: "msg_9182" },
    evidence: [{ id: "ev6", kind: "message", label: "Mensagem removida" }],
    source: "message_thread",
    createdAt: iso(48),
    updatedAt: iso(24),
    resolution: {
      action: "warning_issued",
      note: "Aviso automático aplicado. Sem penalidade adicional.",
      actor: "Moderação LIT",
      at: iso(24),
    },
  },
  {
    id: "rep_005",
    code: "REP-000127",
    targetType: "user",
    targetId: "user_scammer42",
    targetLabel: "@scammer42",
    reason: "fraud",
    reasonLabel: "Fraude",
    severity: "critical",
    status: "submitted",
    description: "Múltiplos relatos de golpe em anúncios diferentes.",
    reporterId: "user_elisa",
    reporterName: "Elisa Prado",
    reportedUserId: "user_scammer42",
    reportedUserName: "@scammer42",
    evidence: [],
    source: "admin",
    createdAt: iso(1),
    updatedAt: iso(1),
  },
  {
    id: "rep_006",
    code: "REP-000128",
    targetType: "sale",
    targetId: "sale_XYZ-4412",
    targetLabel: "Venda #XYZ-4412",
    reason: "improper_dispute",
    reasonLabel: "Disputa indevida",
    severity: "medium",
    status: "under_review",
    description: "Comprador abriu disputa após confirmar entrega.",
    reporterId: "seller_fabio",
    reporterName: "Fábio Costa (vendedor)",
    context: { saleId: "sale_XYZ-4412", orderCode: "XYZ-4412" },
    evidence: [{ id: "ev7", kind: "text", label: "Histórico da venda" }],
    source: "sale_page",
    createdAt: iso(30),
    updatedAt: iso(12),
  },
];

let RUNTIME_REPORTS: Report[] = [...MOCK_REPORTS];

function generateReport(payload: ReportPayload): Report {
  const id = `rep_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  return {
    id,
    code: `REP-${Math.floor(100000 + Math.random() * 900000)}`,
    targetType: payload.targetType,
    targetId: payload.targetId,
    targetLabel: payload.targetLabel,
    reason: payload.reason,
    reasonLabel: payload.reasonLabel,
    severity: payload.severity,
    status: "submitted",
    description: payload.description,
    reporterId: "user_current",
    reporterName: "Você",
    context: payload.context,
    evidence: payload.evidence,
    source: payload.source ?? "other",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export const reportService = {
  getReportTargetTypes(): { value: ReportTargetType; label: string }[] {
    return (Object.keys(TARGET_LABEL) as ReportTargetType[]).map((v) => ({
      value: v,
      label: TARGET_LABEL[v],
    }));
  },

  getReportReasons(targetType: ReportTargetType): Promise<ReportReason[]> {
    return delay(REASONS_BY_TARGET[targetType] ?? REASONS_BY_TARGET.other);
  },

  getReportSeverityOptions(): Promise<
    { value: ReportSeverity; label: string; hint: string }[]
  > {
    return delay(SEVERITY_OPTIONS);
  },

  getReportGuidelines(): Promise<string[]> {
    return delay(GUIDELINES);
  },

  getUserReports(): Promise<Report[]> {
    return delay(
      RUNTIME_REPORTS.filter((r) => r.reporterId === "user_current"),
    );
  },

  getReportById(id: string): Promise<Report | undefined> {
    return delay(RUNTIME_REPORTS.find((r) => r.id === id));
  },

  getReportsForAdmin(filters?: {
    status?: ReportStatus | "all";
    severity?: ReportSeverity | "all";
    targetType?: ReportTargetType | "all";
    source?: ReportSource | "all";
    search?: string;
  }): Promise<Report[]> {
    const s = filters?.search?.trim().toLowerCase() ?? "";
    return delay(
      RUNTIME_REPORTS.filter((r) => {
        if (filters?.status && filters.status !== "all" && r.status !== filters.status)
          return false;
        if (filters?.severity && filters.severity !== "all" && r.severity !== filters.severity)
          return false;
        if (
          filters?.targetType &&
          filters.targetType !== "all" &&
          r.targetType !== filters.targetType
        )
          return false;
        if (filters?.source && filters.source !== "all" && r.source !== filters.source)
          return false;
        if (
          s &&
          !(
            r.targetLabel.toLowerCase().includes(s) ||
            r.reporterName.toLowerCase().includes(s) ||
            r.code.toLowerCase().includes(s)
          )
        )
          return false;
        return true;
      }),
    );
  },

  simulateSubmitReport(payload: ReportPayload): Promise<Report> {
    const report = generateReport(payload);
    RUNTIME_REPORTS = [report, ...RUNTIME_REPORTS];
    return delay(report, 200);
  },

  getTargetTypeLabel(t: ReportTargetType): string {
    return TARGET_LABEL[t];
  },
};

export type ReportServiceType = typeof reportService;
