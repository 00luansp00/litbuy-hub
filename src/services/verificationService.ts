import type {
  SellerVerificationBadge,
  VerificationAcceptedDocument,
  VerificationStatus,
  VerificationStep,
  VerificationSubmission,
  VerificationTimelineEvent,
  VerificationRequirement,
} from "@/types";
import { sellersList } from "@/data/sellers";

/**
 * verificationService — camada mockada de verificação de identidade (KYC).
 * Nenhum dado real é armazenado, nenhum documento é enviado. Todos os
 * métodos apenas retornam objetos fictícios. Em produção, este service
 * deve ser substituído por um provedor de KYC especializado com backend
 * seguro, storage criptografado e conformidade com LGPD.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const CURRENT_STATUS: VerificationStatus = "not_started";

const steps: VerificationStep[] = [
  {
    id: "basic",
    title: "Dados básicos",
    description: "Confirme seu nome, documento e data de nascimento.",
    status: "pending",
    icon: "UserRound",
  },
  {
    id: "sms",
    title: "Confirmação por SMS",
    description: "Valide seu telefone com um código de 6 dígitos.",
    status: "pending",
    icon: "MessageSquare",
  },
  {
    id: "document",
    title: "Documento",
    description: "Envie a frente e o verso de um documento com foto.",
    status: "pending",
    icon: "IdCard",
  },
  {
    id: "selfie",
    title: "Selfie",
    description: "Tire uma selfie para comparação biométrica.",
    status: "pending",
    icon: "Camera",
  },
  {
    id: "review",
    title: "Revisão",
    description: "Confira os dados e envie para análise.",
    status: "pending",
    icon: "ClipboardCheck",
  },
];

const acceptedDocs: VerificationAcceptedDocument[] = [
  { type: "rg", label: "RG", description: "Registro Geral, frente e verso." },
  { type: "cnh", label: "CNH", description: "Carteira Nacional de Habilitação, frente e verso." },
  { type: "passport", label: "Passaporte", description: "Página com foto e dados." },
  { type: "foreign_id", label: "Documento estrangeiro", description: "Suportado futuramente." },
];

const requirements: VerificationRequirement[] = [
  { id: "r1", label: "Ter 18 anos ou mais" },
  { id: "r2", label: "Documento oficial com foto válido" },
  { id: "r3", label: "Telefone celular ativo" },
  { id: "r4", label: "Boa iluminação para a selfie", helper: "Rosto visível e sem óculos escuros." },
];

const timeline: VerificationTimelineEvent[] = [
  {
    id: "vt-1",
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    title: "Verificação iniciada",
    description: "Você começou o fluxo de verificação de identidade.",
    tone: "info",
  },
];

export const verificationService = {
  getVerificationStatus: (): Promise<VerificationStatus> => delay(CURRENT_STATUS),

  getVerificationSteps: (): Promise<VerificationStep[]> => delay(steps),

  getAcceptedDocuments: (): Promise<VerificationAcceptedDocument[]> => delay(acceptedDocs),

  getRequirements: (): Promise<VerificationRequirement[]> => delay(requirements),

  getVerificationTimeline: (): Promise<VerificationTimelineEvent[]> => delay(timeline),

  simulateSendSmsCode: async (phone: string): Promise<{ ok: true; masked: string }> => {
    await delay(null, 300);
    const masked = phone.replace(/\d(?=\d{2})/g, "•");
    return { ok: true, masked };
  },

  simulateVerifySmsCode: async (code: string): Promise<{ ok: boolean }> => {
    await delay(null, 250);
    return { ok: code.trim().length >= 4 };
  },

  simulateSubmitDocument: async (): Promise<{ ok: true }> => {
    await delay(null, 350);
    return { ok: true };
  },

  simulateSubmitSelfie: async (): Promise<{ ok: true }> => {
    await delay(null, 300);
    return { ok: true };
  },

  simulateSubmitVerification: async (): Promise<VerificationSubmission> => {
    await delay(null, 400);
    return {
      ok: true,
      submissionId: `kyc-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "pending_review",
    };
  },

  getSellerVerificationBadge: async (
    sellerId: string,
  ): Promise<SellerVerificationBadge | null> => {
    const seller = sellersList.find((s) => s.id === sellerId || s.slug === sellerId);
    if (!seller?.verified) return delay(null);
    return delay({
      sellerId: seller.id,
      status: "approved",
      label: "Vendedor Verificado",
      since: seller.memberSince,
    });
  },
};
