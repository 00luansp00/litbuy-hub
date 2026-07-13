/**
 * transactionalEmailService — Sprint 18.19
 *
 * Service 100% MOCKADO para e-mails transacionais, templates e
 * preferências de comunicação. Nenhum e-mail real é enviado.
 * Nenhum provedor (Resend, SendGrid, Mailgun, SES) é integrado.
 * Nenhum dado é persistido — LocalStorage/Cookies não são usados.
 *
 * O envio real será responsabilidade do backend em uma sprint futura.
 */

import type {
  CommunicationChannel,
  CommunicationPreference,
  EmailHistoryItem,
  EmailSecurityEvent,
  EmailTemplateVariable,
  TransactionalEmailCategory,
  TransactionalEmailEvent,
  TransactionalEmailTemplate,
} from "@/types";

const wait = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms));

const COMMON_VARS: EmailTemplateVariable[] = [
  { key: "{{user_name}}", label: "Nome do usuário", example: "Ana" },
  { key: "{{order_id}}", label: "ID do pedido", example: "LIT-000123" },
  { key: "{{payment_id}}", label: "ID do pagamento", example: "PAY-9981" },
  { key: "{{product_title}}", label: "Título do produto", example: "Teclado NovaKeys" },
  { key: "{{seller_name}}", label: "Nome do vendedor", example: "NovaKeys Store" },
  { key: "{{buyer_name}}", label: "Nome do comprador", example: "João" },
  { key: "{{verification_code}}", label: "Código de verificação", example: "482910" },
  { key: "{{reset_link}}", label: "Link de reset de senha", example: "https://litbuy.com/redefinir-senha?token=..." },
  { key: "{{support_link}}", label: "Link do suporte", example: "https://litbuy.com/ajuda" },
  { key: "{{expires_at}}", label: "Validade / expiração", example: "10 minutos" },
];

const EVENTS: TransactionalEmailEvent[] = [
  { id: "e-auth-signup", key: "auth.signup_confirmation", category: "auth", audience: "all", critical: true, label: "Confirmação de cadastro", description: "Enviado quando um novo usuário cria conta.", channels: ["platform", "email"] },
  { id: "e-auth-reset", key: "auth.password_reset", category: "auth", audience: "all", critical: true, label: "Recuperação de senha", description: "Link seguro para redefinir a senha.", channels: ["email"] },
  { id: "e-auth-reset-done", key: "auth.password_reset_completed", category: "security", audience: "all", critical: true, label: "Senha redefinida", description: "Confirmação de que a senha foi alterada.", channels: ["email", "platform"] },
  { id: "e-sec-new-device", key: "security.new_device_login", category: "security", audience: "all", critical: true, label: "Login em novo dispositivo", description: "Alerta quando login parte de dispositivo desconhecido.", channels: ["email", "platform"] },
  { id: "e-sec-code", key: "security.verification_code", category: "security", audience: "all", critical: true, label: "Código de segurança", description: "Código de verificação de dois fatores.", channels: ["email"] },
  { id: "e-order-created", key: "order.created", category: "order", audience: "buyer", label: "Pedido criado", description: "Confirmação de que o pedido foi criado.", channels: ["platform", "email"] },
  { id: "e-pay-pending", key: "payment.pending", category: "payment", audience: "buyer", label: "Pagamento pendente", description: "Aguardando confirmação do pagamento.", channels: ["platform", "email"] },
  { id: "e-pay-approved", key: "payment.approved", category: "payment", audience: "buyer", label: "Pagamento aprovado", description: "Pagamento confirmado.", channels: ["platform", "email"] },
  { id: "e-deliv-released", key: "delivery.released", category: "delivery", audience: "buyer", label: "Entrega liberada", description: "Vendedor liberou entrega.", channels: ["platform", "email"] },
  { id: "e-msg-new", key: "message.new", category: "message", audience: "all", label: "Nova mensagem", description: "Nova mensagem no chat.", channels: ["platform", "email"] },
  { id: "e-med-open", key: "mediation.opened", category: "mediation", audience: "all", critical: true, label: "Mediação aberta", description: "Mediação/disputa foi aberta.", channels: ["platform", "email"] },
  { id: "e-order-done", key: "order.completed", category: "order", audience: "buyer", label: "Pedido concluído", description: "Pedido concluído com sucesso.", channels: ["platform", "email"] },
  { id: "e-review-avail", key: "order.review_available", category: "order", audience: "buyer", label: "Avaliação disponível", description: "Avalie sua compra.", channels: ["platform", "email"] },
  { id: "e-sale-new", key: "seller.new_sale", category: "seller", audience: "seller", label: "Nova venda", description: "Você recebeu uma nova venda.", channels: ["platform", "email"] },
  { id: "e-sale-pay-approved", key: "seller.payment_approved", category: "seller", audience: "seller", label: "Pagamento aprovado (venda)", description: "Pagamento aprovado em uma venda.", channels: ["platform", "email"] },
  { id: "e-sale-deliv-pending", key: "seller.delivery_pending", category: "seller", audience: "seller", label: "Entrega pendente", description: "Prepare a entrega ao comprador.", channels: ["platform", "email"] },
  { id: "e-sale-buyer-confirmed", key: "seller.buyer_confirmed", category: "seller", audience: "seller", label: "Comprador confirmou recebimento", description: "Comprador confirmou o recebimento.", channels: ["platform", "email"] },
  { id: "e-sale-balance", key: "seller.balance_available", category: "seller", audience: "seller", label: "Saldo disponível", description: "Novo saldo disponível na carteira.", channels: ["platform", "email"] },
  { id: "e-rep-received", key: "report.received", category: "report", audience: "all", label: "Denúncia recebida", description: "Confirmação de denúncia.", channels: ["platform", "email"] },
  { id: "e-kyc-approved", key: "kyc.approved", category: "kyc", audience: "all", label: "KYC aprovado", description: "Verificação de identidade aprovada.", channels: ["platform", "email"] },
  { id: "e-kyc-rejected", key: "kyc.rejected", category: "kyc", audience: "all", label: "KYC recusado", description: "Verificação de identidade recusada.", channels: ["platform", "email"] },
  { id: "e-adm-kyc-pend", key: "admin.kyc_pending", category: "admin", audience: "admin", label: "KYC pendente (admin)", description: "Novo KYC aguarda análise.", channels: ["platform", "email"] },
  { id: "e-adm-report-crit", key: "admin.report_critical", category: "admin", audience: "admin", label: "Denúncia crítica (admin)", description: "Nova denúncia crítica recebida.", channels: ["platform", "email"] },
  { id: "e-adm-dispute", key: "admin.dispute_opened", category: "admin", audience: "admin", label: "Disputa aberta (admin)", description: "Disputa aguarda análise.", channels: ["platform", "email"] },
  { id: "e-adm-listing", key: "admin.listing_review", category: "admin", audience: "admin", label: "Anúncio aguardando revisão", description: "Novo anúncio precisa ser revisado.", channels: ["platform", "email"] },
  { id: "e-aff-commission", key: "affiliate.commission_available", category: "affiliate", audience: "all", label: "Comissão de afiliado disponível", description: "Nova comissão disponível para saque.", channels: ["platform", "email"] },
  { id: "e-mkt-news", key: "marketing.newsletter", category: "marketing", audience: "all", label: "Novidades e promoções", description: "Comunicações opcionais de marketing.", channels: ["email"] },
];

const TEMPLATES: TransactionalEmailTemplate[] = [
  { id: "t-signup", key: "auth.signup_confirmation", name: "Confirme seu cadastro", category: "auth", subject: "Confirme seu cadastro na LIT Buy", preview: "Olá {{user_name}}, confirme seu e-mail para ativar sua conta.", body: "Olá {{user_name}},\n\nBem-vindo(a) à LIT Buy! Use o código {{verification_code}} para confirmar seu e-mail.\n\nEste código expira em {{expires_at}}.", variables: [COMMON_VARS[0], COMMON_VARS[6], COMMON_VARS[9]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-reset", key: "auth.password_reset", name: "Recuperação de senha", category: "auth", subject: "Recuperação de senha — LIT Buy", preview: "Você solicitou a redefinição da sua senha.", body: "Olá {{user_name}},\n\nRecebemos uma solicitação de redefinição de senha. Use o link seguro abaixo:\n{{reset_link}}\n\nSe não foi você, ignore este e-mail. O link expira em {{expires_at}}.", variables: [COMMON_VARS[0], COMMON_VARS[7], COMMON_VARS[9]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-device", key: "security.new_device_login", name: "Novo dispositivo detectado", category: "security", subject: "Novo dispositivo acessou sua conta", preview: "Detectamos um acesso a partir de um novo dispositivo.", body: "Olá {{user_name}},\n\nDetectamos um novo acesso à sua conta. Se foi você, ignore. Caso contrário, redefina sua senha em {{support_link}}.", variables: [COMMON_VARS[0], COMMON_VARS[8]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-order-created", key: "order.created", name: "Pedido criado", category: "order", subject: "Seu pedido {{order_id}} foi criado", preview: "Recebemos seu pedido na LIT Buy.", body: "Olá {{buyer_name}},\n\nSeu pedido {{order_id}} foi criado com sucesso e aguarda pagamento.", variables: [COMMON_VARS[5], COMMON_VARS[1]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-pay-approved", key: "payment.approved", name: "Pagamento aprovado", category: "payment", subject: "Pagamento aprovado — pedido {{order_id}}", preview: "Seu pagamento foi confirmado.", body: "Olá {{buyer_name}},\n\nO pagamento {{payment_id}} do pedido {{order_id}} foi aprovado.", variables: [COMMON_VARS[5], COMMON_VARS[1], COMMON_VARS[2]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-delivery", key: "delivery.released", name: "Entrega liberada", category: "delivery", subject: "Entrega liberada — pedido {{order_id}}", preview: "O vendedor liberou sua entrega.", body: "Olá {{buyer_name}},\n\nO vendedor {{seller_name}} liberou a entrega do pedido {{order_id}}.", variables: [COMMON_VARS[5], COMMON_VARS[4], COMMON_VARS[1]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-mediation", key: "mediation.opened", name: "Mediação aberta", category: "mediation", subject: "Mediação aberta no pedido {{order_id}}", preview: "Uma mediação foi aberta.", body: "Olá {{user_name}},\n\nUma mediação foi aberta no pedido {{order_id}}. Acompanhe em {{support_link}}.", variables: [COMMON_VARS[0], COMMON_VARS[1], COMMON_VARS[8]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-kyc-approved", key: "kyc.approved", name: "KYC aprovado", category: "kyc", subject: "Sua verificação foi aprovada", preview: "Verificação de identidade aprovada.", body: "Olá {{user_name}},\n\nSua verificação de identidade foi aprovada. Bem-vindo(a) ao Vendedor Verificado LIT.", variables: [COMMON_VARS[0]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-report", key: "report.received", name: "Denúncia recebida", category: "report", subject: "Recebemos sua denúncia", preview: "Sua denúncia foi registrada.", body: "Olá {{user_name}},\n\nRecebemos sua denúncia e nossa equipe irá analisá-la em breve.", variables: [COMMON_VARS[0]], status: "active", updatedAt: new Date().toISOString() },
  { id: "t-affiliate", key: "affiliate.commission_available", name: "Comissão de afiliado disponível", category: "affiliate", subject: "Nova comissão disponível", preview: "Uma nova comissão está disponível para saque.", body: "Olá {{user_name}},\n\nVocê tem uma nova comissão de afiliado disponível na sua carteira.", variables: [COMMON_VARS[0]], status: "draft", updatedAt: new Date().toISOString() },
];

const DEFAULT_PREFERENCES: CommunicationPreference[] = EVENTS.map((e) => ({
  eventKey: e.key,
  label: e.label,
  category: e.category,
  description: e.description,
  audience: e.audience,
  critical: e.critical,
  channels: {
    platform: e.channels.includes("platform"),
    email: e.channels.includes("email"),
    browser_future: false,
    sms_future: false,
  },
}));

const HISTORY: EmailHistoryItem[] = [
  { id: "h1", subject: "Confirme seu cadastro na LIT Buy", category: "auth", status: "sent_mocked", deliveryStatus: "delivered", channel: "email", to: "voce@exemplo.com", sentAt: new Date(Date.now() - 86400000 * 12).toISOString(), eventKey: "auth.signup_confirmation" },
  { id: "h2", subject: "Seu pedido LIT-000123 foi criado", category: "order", status: "sent_mocked", deliveryStatus: "delivered", channel: "email", to: "voce@exemplo.com", sentAt: new Date(Date.now() - 86400000 * 4).toISOString(), eventKey: "order.created" },
  { id: "h3", subject: "Pagamento aprovado — pedido LIT-000123", category: "payment", status: "sent_mocked", deliveryStatus: "opened", channel: "email", to: "voce@exemplo.com", sentAt: new Date(Date.now() - 86400000 * 4 + 3600000).toISOString(), eventKey: "payment.approved" },
  { id: "h4", subject: "Nova mensagem no pedido LIT-000123", category: "message", status: "sent_mocked", deliveryStatus: "delivered", channel: "email", to: "voce@exemplo.com", sentAt: new Date(Date.now() - 86400000 * 2).toISOString(), eventKey: "message.new" },
  { id: "h5", subject: "Novo dispositivo acessou sua conta", category: "security", status: "sent_mocked", deliveryStatus: "delivered", channel: "email", to: "voce@exemplo.com", sentAt: new Date(Date.now() - 86400000).toISOString(), eventKey: "security.new_device_login" },
  { id: "h6", subject: "Recuperação de senha — LIT Buy", category: "auth", status: "pending_mocked", deliveryStatus: "queued", channel: "email", to: "voce@exemplo.com", sentAt: new Date(Date.now() - 3600000).toISOString(), eventKey: "auth.password_reset" },
];

const SECURITY_EVENTS: EmailSecurityEvent[] = [
  { id: "s1", kind: "new_device", label: "Novo dispositivo detectado", description: "Um novo acesso à sua conta foi detectado.", device: "MacBook Pro", location: "São Paulo, BR (aproximada)", browser: "Chrome 128", at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: "s2", kind: "verification_code", label: "Código de verificação enviado", description: "Um código de segurança foi enviado ao seu e-mail.", at: new Date(Date.now() - 60000 * 8).toISOString() },
];

function filterByCategory(cats: TransactionalEmailCategory[]) {
  return EVENTS.filter((e) => cats.includes(e.category));
}

export interface SimulateEmailResult {
  eventKey: string;
  status: "sent_mocked";
  at: string;
}

export interface UpdatePreferencesPayload {
  eventKey: string;
  channel: CommunicationChannel;
  enabled: boolean;
}

export const transactionalEmailService = {
  async getTransactionalEmailEvents(): Promise<TransactionalEmailEvent[]> {
    await wait();
    return EVENTS;
  },
  async getEmailTemplates(): Promise<TransactionalEmailTemplate[]> {
    await wait();
    return TEMPLATES;
  },
  async getUserCommunicationPreferences(): Promise<CommunicationPreference[]> {
    await wait();
    // Devolve cópia profunda para evitar mutações compartilhadas.
    return DEFAULT_PREFERENCES.map((p) => ({ ...p, channels: { ...p.channels } }));
  },
  async getEmailHistory(): Promise<EmailHistoryItem[]> {
    await wait();
    return HISTORY;
  },
  async simulateSendTransactionalEmail(eventKey: string): Promise<SimulateEmailResult> {
    await wait();
    return { eventKey, status: "sent_mocked", at: new Date().toISOString() };
  },
  async simulateResendEmail(eventKey: string): Promise<SimulateEmailResult> {
    await wait();
    return { eventKey, status: "sent_mocked", at: new Date().toISOString() };
  },
  async simulateUpdateCommunicationPreferences(
    payload: UpdatePreferencesPayload,
  ): Promise<{ ok: true; payload: UpdatePreferencesPayload }> {
    await wait(120);
    return { ok: true, payload };
  },
  async getSecurityEmailEvents(): Promise<EmailSecurityEvent[]> {
    await wait();
    return SECURITY_EVENTS;
  },
  async getOrderEmailEvents(): Promise<TransactionalEmailEvent[]> {
    await wait();
    return filterByCategory(["order", "payment", "delivery", "message"]);
  },
  async getSellerEmailEvents(): Promise<TransactionalEmailEvent[]> {
    await wait();
    return EVENTS.filter((e) => e.audience === "seller");
  },
  async getAdminEmailEvents(): Promise<TransactionalEmailEvent[]> {
    await wait();
    return EVENTS.filter((e) => e.audience === "admin");
  },
  commonTemplateVariables: COMMON_VARS,
};

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  const masked = user.length > 2 ? "*".repeat(Math.min(6, user.length - 2)) : "***";
  return `${visible}${masked}@${domain}`;
}
