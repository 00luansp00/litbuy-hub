import { products } from "@/data/products";
import { moderateText } from "@/utils/moderation";
import type { ProductQuestion } from "@/types";

/**
 * questionService — mock de perguntas públicas do anúncio.
 * As perguntas são adicionadas apenas ao estado em memória do módulo,
 * nunca persistidas. Substituível por API futura sem alterar UI.
 */

const now = new Date();
const iso = (offsetHours: number) =>
  new Date(now.getTime() - offsetHours * 3600 * 1000).toISOString();

const BASE_QUESTIONS: ProductQuestion[] = [
  {
    id: "q1",
    productId: "*",
    authorName: "gabriela.p",
    text: "Consigo transferir a conta para outra plataforma depois?",
    askedAt: iso(30),
    answer: {
      id: "q1-a",
      authorName: "Vendedor",
      authorRole: "seller",
      text: "Sim, você recebe todos os dados de acesso após a confirmação do pagamento pela LIT Buy.",
      answeredAt: iso(28),
    },
  },
  {
    id: "q2",
    productId: "*",
    authorName: "lucas.m",
    text: "Tem algum tipo de garantia caso a conta seja recuperada depois?",
    askedAt: iso(72),
    answer: {
      id: "q2-a",
      authorName: "Vendedor",
      authorRole: "seller",
      text: "Sim, garantia declarada de 15 dias. Em caso de problema, abra disputa dentro da LIT Buy.",
      answeredAt: iso(70),
    },
  },
  {
    id: "q3",
    productId: "*",
    authorName: "renata.z",
    text: "A entrega é imediata após o pagamento?",
    askedAt: iso(120),
  },
];

const memory = new Map<string, ProductQuestion[]>();

function seed(productId: string): ProductQuestion[] {
  const cached = memory.get(productId);
  if (cached) return cached;
  const cloned = BASE_QUESTIONS.map((q) => ({ ...q, productId }));
  memory.set(productId, cloned);
  return cloned;
}

function delay<T>(v: T, ms = 120): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export const questionService = {
  getQuestionsByProductId(productId: string): Promise<ProductQuestion[]> {
    const found = products.find((p) => p.id === productId || p.slug === productId);
    const key = found?.id ?? productId;
    return delay([...seed(key)]);
  },

  /** Adiciona pergunta ao estado em memória do módulo (não persiste). */
  simulateAskQuestion(productId: string, text: string): Promise<ProductQuestion> {
    const found = products.find((p) => p.id === productId || p.slug === productId);
    const key = found?.id ?? productId;
    const sanitized = moderateText(text);
    const q: ProductQuestion = {
      id: `q-mock-${Date.now()}`,
      productId: key,
      authorName: "Você",
      text: sanitized.sanitized,
      askedAt: new Date().toISOString(),
    };
    const list = [q, ...seed(key)];
    memory.set(key, list);
    return delay(q);
  },

  sanitizeQuestionText(text: string): string {
    return moderateText(text).sanitized;
  },
};
