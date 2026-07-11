import { products } from "@/data/products";
import type {
  Conversation,
  ConversationContext,
  ConversationMessage,
  ConversationParticipant,
} from "@/types";

/**
 * messageService — camada mockada de mensagens/conversas.
 *
 * Nenhuma rota deve acessar mocks diretamente. Toda a área
 * /mensagens e /mensagens/$id deve passar por aqui.
 *
 * NOTA: nenhuma mensagem real é enviada, salva ou entregue.
 * Substituição futura por backend/WebSocket deve preservar
 * as assinaturas dos métodos.
 */

const delay = <T,>(data: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const CURRENT_USER: ConversationParticipant = {
  id: "me",
  name: "Você",
  role: "buyer",
};

function iso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

interface Seed {
  id: string;
  type: Conversation["type"];
  productIdx?: number;
  orderId?: string;
  orderCode?: string;
  orderStatus?: NonNullable<ConversationContext["orderStatus"]>;
  unread: number;
  note?: string;
  messages: Array<
    Omit<ConversationMessage, "id" | "conversationId" | "status"> & {
      status?: ConversationMessage["status"];
    }
  >;
}

const SEEDS: Seed[] = [
  {
    id: "c1",
    type: "order_related",
    productIdx: 0,
    orderId: "order-1",
    orderCode: "LIT-102345",
    orderStatus: "awaiting_buyer_confirmation",
    unread: 2,
    messages: [
      {
        authorId: "me",
        authorRole: "buyer",
        text: "Olá! Acabei de comprar a conta, já pode enviar o acesso?",
        sentAt: iso(180),
      },
      {
        authorId: "seller",
        authorRole: "seller",
        text: "Fechado! Estou preparando a entrega agora, em instantes te mando.",
        sentAt: iso(160),
      },
      {
        authorId: "seller",
        authorRole: "seller",
        text: "Enviado! Confirma se o acesso funcionou por favor 🙌",
        sentAt: iso(45),
      },
      {
        authorId: "system",
        authorRole: "system",
        text: "Mensagens ficam vinculadas ao pedido e podem ser usadas como evidência em disputa.",
        sentAt: iso(44),
        system: true,
      },
    ],
  },
  {
    id: "c2",
    type: "pre_purchase",
    productIdx: 1,
    unread: 1,
    messages: [
      {
        authorId: "me",
        authorRole: "buyer",
        text: "Boa tarde! O gift card é válido para conta brasileira?",
        sentAt: iso(90),
      },
      {
        authorId: "seller",
        authorRole: "seller",
        text: "Sim, funciona 100% em contas BR. Entrega é automática após o pagamento.",
        sentAt: iso(75),
      },
    ],
  },
  {
    id: "c3",
    type: "pre_purchase",
    productIdx: 2,
    unread: 0,
    messages: [
      {
        authorId: "me",
        authorRole: "buyer",
        text: "Tem estoque para entrega ainda hoje?",
        sentAt: iso(60 * 6),
      },
      {
        authorId: "seller",
        authorRole: "seller",
        text: "Tenho sim! Assim que o pagamento cair, libero o produto.",
        sentAt: iso(60 * 5 + 45),
      },
    ],
  },
  {
    id: "c4",
    type: "order_related",
    productIdx: 3,
    orderId: "order-4",
    orderCode: "LIT-102348",
    orderStatus: "completed",
    unread: 0,
    messages: [
      {
        authorId: "seller",
        authorRole: "seller",
        text: "Obrigado pela compra! Qualquer coisa é só chamar por aqui.",
        sentAt: iso(60 * 24),
      },
      {
        authorId: "me",
        authorRole: "buyer",
        text: "Deu tudo certo, obrigado!",
        sentAt: iso(60 * 23),
      },
    ],
  },
  {
    id: "c5",
    type: "support",
    unread: 0,
    note: "Atendimento oficial LIT Buy. Nunca solicitamos senha ou dados de cartão.",
    messages: [
      {
        authorId: "support",
        authorRole: "support",
        text: "Olá! Sou do suporte LIT Buy. Como posso te ajudar?",
        sentAt: iso(60 * 48),
      },
    ],
  },
];

function buildConversation(seed: Seed): {
  conversation: Conversation;
  messages: ConversationMessage[];
} {
  const product =
    seed.productIdx !== undefined ? products[seed.productIdx] : undefined;
  const seller = product?.seller;

  const counterpart: ConversationParticipant =
    seed.type === "support"
      ? {
          id: "support",
          name: "Suporte LIT Buy",
          role: "support",
          verified: true,
        }
      : {
          id: seller?.id ?? `seller-${seed.id}`,
          name: seller?.name ?? "Vendedor LIT",
          avatarUrl: seller?.avatarUrl,
          role: "seller",
          sellerSlug: seller?.slug,
          verified: seller?.verified,
        };

  const participants: ConversationParticipant[] = [CURRENT_USER, counterpart];

  const messages: ConversationMessage[] = seed.messages.map((m, i) => ({
    id: `${seed.id}-m${i + 1}`,
    conversationId: seed.id,
    authorId:
      m.authorId === "me"
        ? "me"
        : m.authorId === "seller" || m.authorId === "support"
          ? counterpart.id
          : m.authorId,
    authorRole: m.authorRole,
    text: m.text,
    sentAt: m.sentAt,
    status: m.status ?? (m.authorRole === "buyer" ? "read" : "delivered"),
    system: m.system,
    attachments: m.attachments,
  }));

  const last = messages[messages.length - 1]!;

  const context: ConversationContext = {
    type: seed.type,
    productId: product?.id,
    productSlug: product?.slug,
    productTitle: product?.title,
    productImage: product?.imageUrl,
    productPrice: product?.price,
    orderId: seed.orderId,
    orderCode: seed.orderCode,
    orderStatus: seed.orderStatus,
    sellerSlug: counterpart.sellerSlug,
    sellerName: counterpart.role === "seller" ? counterpart.name : undefined,
    note: seed.note,
  };

  const conversation: Conversation = {
    id: seed.id,
    type: seed.type,
    participants,
    counterpart,
    lastMessage: {
      text: last.text,
      sentAt: last.sentAt,
      authorRole: last.authorRole,
    },
    unreadCount: seed.unread,
    productId: product?.id,
    orderId: context.orderId,
    sellerSlug: counterpart.sellerSlug,
    context,
  };

  return { conversation, messages };
}

const store = SEEDS.map(buildConversation);
const conversationsById = new Map(
  store.map((s) => [s.conversation.id, s]),
);

export const messageService = {
  getConversations: (): Promise<Conversation[]> =>
    delay(store.map((s) => s.conversation)),

  getConversationById: (
    conversationId: string,
  ): Promise<Conversation | null> =>
    delay(conversationsById.get(conversationId)?.conversation ?? null),

  getConversationMessages: (
    conversationId: string,
  ): Promise<ConversationMessage[]> =>
    delay(conversationsById.get(conversationId)?.messages.slice() ?? []),

  getConversationContext: (
    conversationId: string,
  ): Promise<ConversationContext | null> =>
    delay(conversationsById.get(conversationId)?.conversation.context ?? null),

  /** Conversa vinculada a um pedido (order_related). */
  getConversationByOrderId: (orderId: string): Promise<Conversation | null> =>
    delay(
      store.find((s) => s.conversation.orderId === orderId)?.conversation ??
        null,
    ),

  getOrderConversation: (orderId: string): Promise<Conversation | null> =>
    messageService.getConversationByOrderId(orderId),

  getOrderConversationMessages: (
    orderId: string,
  ): Promise<ConversationMessage[]> =>
    delay(
      store.find((s) => s.conversation.orderId === orderId)?.messages.slice() ??
        [],
    ),

  /** Conversa vinculada a uma venda (visão vendedor). */
  getSellerSaleConversation: async (
    saleId: string,
  ): Promise<Conversation | null> => {
    // Mock: sale-N ↔ order-N.
    const orderId = saleId.replace(/^sale-/, "order-");
    return messageService.getConversationByOrderId(orderId);
  },

  /** Retorna a mensagem automática mockada do vendedor (ex.: LIT-MAX). */
  getAutomaticSellerMessage: (orderId: string): Promise<string | null> => {
    const conv = store.find((s) => s.conversation.orderId === orderId);
    if (!conv) return delay(null);
    return delay(
      "Olá! Obrigado pela compra. Sua entrega será acompanhada por aqui dentro da LIT Buy. Mantenha toda a comunicação pela plataforma para sua segurança.",
    );
  },

  /**
   * Simula a criação de uma conversa vinculada ao pedido após
   * o pagamento aprovado. Não persiste — apenas devolve a conversa
   * mockada existente (ou null se não houver seed correspondente).
   */
  simulateCreateOrderConversation: (
    orderId: string,
  ): Promise<Conversation | null> =>
    messageService.getConversationByOrderId(orderId),

  /**
   * Simula envio de mensagem em conversa de pedido.
   * Nada é persistido.
   */
  simulateSendOrderMessage: (
    conversationId: string,
    text: string,
  ): Promise<ConversationMessage> =>
    messageService.simulateSendMessage(conversationId, text),

  /**
   * Simula envio de mensagem. Não persiste em backend nem em
   * LocalStorage. Retorna a mensagem que seria criada.
   */
  simulateSendMessage: (
    conversationId: string,
    text: string,
  ): Promise<ConversationMessage> => {
    const now = new Date().toISOString();
    const message: ConversationMessage = {
      id: `${conversationId}-m-${Date.now()}`,
      conversationId,
      authorId: "me",
      authorRole: "buyer",
      text,
      sentAt: now,
      status: "sent",
    };
    return delay(message, 120);
  },

  getCurrentUser: (): ConversationParticipant => CURRENT_USER,
};

