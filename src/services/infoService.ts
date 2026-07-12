import type {
  ContactFormPayload,
  ContactOption,
  FaqItem,
  HelpCategory,
  LegalDraftNotice,
  PlatformRule,
  PolicySection,
  ProhibitedItem,
  RefundPolicyRule,
  SafetyRule,
  StepItem,
} from "@/types";

/**
 * infoService — Sprint 18.17
 * Conteúdo institucional 100% mockado. Nada é persistido.
 * Textos legais são rascunhos demonstrativos.
 */

const HELP_CATEGORIES: HelpCategory[] = [
  { id: "buying", title: "Compras", description: "Como comprar, pagamento, entrega e confirmação.", icon: "ShoppingBag", to: "/como-comprar" },
  { id: "selling", title: "Vendas", description: "Como vender, anúncios, entrega e recebimento.", icon: "Store", to: "/como-vender" },
  { id: "payments", title: "Pagamentos", description: "Pix, cartão, boleto, Proteção LIT e taxas.", icon: "CreditCard", to: "/taxas" },
  { id: "delivery", title: "Entrega digital", description: "Entrega manual e automática, cofre seguro.", icon: "Send", to: "/como-comprar" },
  { id: "accounts", title: "Contas digitais", description: "Cuidados com contas de jogos e recuperação.", icon: "KeyRound", to: "/seguranca" },
  { id: "disputes", title: "Disputas e mediação", description: "Quando abrir problema, mediação e denúncia.", icon: "Gavel", to: "/politica-de-reembolso" },
  { id: "points", title: "LIT Points", description: "Programa de recompensas próprio da LIT Buy.", icon: "Sparkles", to: "/lit-points" },
  { id: "affiliates", title: "Afiliados", description: "Programa de afiliados e regras.", icon: "Share2", to: "/afiliados" },
  { id: "safety", title: "Segurança", description: "Boas práticas, golpes e proteção da conta.", icon: "ShieldCheck", to: "/seguranca" },
];

const HELP_FAQ: FaqItem[] = [
  { id: "f1", category: "buying", question: "Como faço uma compra segura?", answer: "Use o checkout da LIT Buy, mantenha o chat dentro da plataforma e ative a Proteção LIT quando disponível." },
  { id: "f2", category: "buying", question: "O que fazer se não receber o produto?", answer: "Abra 'Reportar problema' no pedido para acionar a mediação. Não confirme o recebimento antes de validar." },
  { id: "f3", category: "selling", question: "Preciso me cadastrar como vendedor?", answer: "Não. Toda conta LIT Buy pode comprar e vender. Verificação pode ser exigida em casos específicos." },
  { id: "f4", category: "selling", question: "Quando recebo o valor da venda?", answer: "Após a confirmação do comprador. Prazos e regras de liberação são demonstrativos e dependem de backend futuro." },
  { id: "f5", category: "payments", question: "Quais são as taxas?", answer: "Confira a página /taxas. Todos os valores exibidos são demonstrativos nesta fase." },
  { id: "f6", category: "delivery", question: "Como funciona a entrega automática?", answer: "O produto é liberado assim que o pagamento é confirmado. Cofre e criptografia reais dependem de backend." },
  { id: "f7", category: "accounts", question: "É seguro comprar contas de jogos?", answer: "Sim, mantendo tudo dentro da plataforma. Nunca compartilhe senhas em canais externos." },
  { id: "f8", category: "disputes", question: "Qual a diferença entre problema, mediação e denúncia?", answer: "Problema abre a mediação de um pedido específico. Denúncia sinaliza comportamento irregular geral." },
  { id: "f9", category: "points", question: "Posso trocar LIT Points por dinheiro?", answer: "Não. LIT Points são recompensa da plataforma e não podem ser sacados." },
  { id: "f10", category: "affiliates", question: "Como funcionam as comissões de afiliado?", answer: "As comissões exibidas são demonstrativas. Cálculo real exigirá backend e atribuição segura." },
  { id: "f11", category: "safety", question: "Posso negociar por WhatsApp ou Discord?", answer: "Não. Negociações fora da plataforma perdem proteção e podem violar as regras da LIT Buy." },
];

const BUYING_STEPS: StepItem[] = [
  { order: 1, title: "Busque o produto", description: "Use a busca ou navegue por categorias." },
  { order: 2, title: "Escolha o vendedor", description: "Verifique reputação, nível e selo Vendedor Verificado." },
  { order: 3, title: "Selecione a variação", description: "Anúncios dinâmicos exigem escolha de variação." },
  { order: 4, title: "Adicione ao carrinho", description: "Confira quantidade e valor total." },
  { order: 5, title: "Ative a Proteção LIT", description: "Camada opcional de proteção para sua compra." },
  { order: 6, title: "Pague em modo seguro", description: "Pix, cartão ou boleto no checkout LIT Buy." },
  { order: 7, title: "Acompanhe o pedido", description: "Timeline e status em tempo real na página do pedido." },
  { order: 8, title: "Use o chat do pedido", description: "Todo contato deve ficar dentro da plataforma." },
  { order: 9, title: "Confirme a entrega", description: "Só confirme após validar o produto." },
  { order: 10, title: "Avalie o vendedor", description: "Sua avaliação ajuda a comunidade." },
  { order: 11, title: "Abra mediação se houver problema", description: "Use 'Reportar problema' para acionar a LIT Buy." },
];

const SELLING_STEPS: StepItem[] = [
  { order: 1, title: "Crie sua conta", description: "Uma conta LIT Buy já permite comprar e vender." },
  { order: 2, title: "Verifique sua identidade", description: "KYC visual está disponível; obrigatoriedade real virá com backend." },
  { order: 3, title: "Crie o anúncio", description: "Escolha entre Normal, Dinâmico ou Serviço." },
  { order: 4, title: "Defina categoria e subcategoria", description: "Atributos podem variar por jogo." },
  { order: 5, title: "Configure a entrega", description: "Manual ou automática, com cofre seguro visual." },
  { order: 6, title: "Escolha o destaque", description: "Prata, Ouro ou Diamante — planos demonstrativos." },
  { order: 7, title: "Ative o LIT-MAX (opcional)", description: "Plano premium para vendedores da LIT Buy." },
  { order: 8, title: "Receba a venda", description: "Notificações e chat do pedido são criados automaticamente." },
  { order: 9, title: "Entregue o produto", description: "Use o fluxo de entrega da LIT Buy." },
  { order: 10, title: "Acompanhe o chat", description: "Comunicação oficial dentro do pedido." },
  { order: 11, title: "Aguarde a confirmação", description: "O comprador confirma o recebimento no pedido." },
  { order: 12, title: "Receba o saldo", description: "Prazos reais dependem de backend futuro." },
  { order: 13, title: "Construa reputação", description: "Suba de nível: Bronze, Prata, Ouro, Diamante, Elite." },
];

const SAFETY_RULES: SafetyRule[] = [
  { id: "s1", title: "Nunca negocie fora da LIT Buy", description: "Fora da plataforma você perde proteção e mediação.", tone: "danger" },
  { id: "s2", title: "Nunca compartilhe senhas fora do fluxo seguro", description: "Use apenas o cofre de entrega e o chat do pedido.", tone: "danger" },
  { id: "s3", title: "Desconfie de links externos", description: "WhatsApp, Discord e Telegram fora do fluxo são risco.", tone: "warning" },
  { id: "s4", title: "Use o chat do pedido", description: "Ele é a evidência oficial em disputas.", tone: "info" },
  { id: "s5", title: "Reporte comportamento suspeito", description: "Use a função de denúncia para proteger a comunidade.", tone: "info" },
  { id: "s6", title: "Ative a Proteção LIT", description: "Camada adicional de proteção ao seu pedido.", tone: "success" },
  { id: "s7", title: "Prefira Vendedor Verificado", description: "Selo indica identidade validada visualmente.", tone: "success" },
];

const PLATFORM_RULES: PlatformRule[] = [
  { id: "p1", audience: "all", severity: "critical", title: "Não burlar taxas ou pagamentos", description: "Qualquer tentativa de burlar taxas é violação grave." },
  { id: "p2", audience: "all", severity: "critical", title: "Proibido contato externo com intuito de fraude", description: "Tirar negociação da plataforma para golpe é penalizado." },
  { id: "p3", audience: "all", severity: "critical", title: "Proibida fraude", description: "Chargeback fraudulento, produto falso, engano deliberado." },
  { id: "p4", audience: "all", severity: "warning", title: "Sem spam ou abuso", description: "Mensagens em massa, ofensas e assédio não são tolerados." },
  { id: "p5", audience: "all", severity: "warning", title: "Sem falsificação de reputação", description: "Avaliações falsas, contas duplicadas e manipulação são proibidas." },
  { id: "p6", audience: "buyer", severity: "warning", title: "Sem denúncias falsas", description: "Denunciar sem motivo pode gerar penalidade." },
  { id: "p7", audience: "seller", severity: "critical", title: "Sem venda de itens proibidos", description: "Verifique /itens-proibidos antes de anunciar." },
  { id: "p8", audience: "seller", severity: "warning", title: "Entrega dentro do prazo prometido", description: "Atrasos podem gerar mediação e afetar reputação." },
  { id: "p9", audience: "affiliate", severity: "critical", title: "Autoindicação proibida", description: "Comissão gerada em própria conta é bloqueada." },
  { id: "p10", audience: "affiliate", severity: "warning", title: "Sem spam para promover", description: "Divulgação abusiva pode bloquear comissões." },
  { id: "p11", audience: "affiliate", severity: "warning", title: "Fraude bloqueia comissão", description: "Tracking real será feito no backend futuro." },
];

const PROHIBITED_ITEMS: ProhibitedItem[] = [
  { id: "i1", category: "prohibited", title: "Contas roubadas ou obtidas por fraude", description: "Qualquer conta de origem ilícita.", examples: ["Contas invadidas", "Recuperação fraudulenta"] },
  { id: "i2", category: "prohibited", title: "Dados vazados ou credenciais de terceiros", description: "Uso de dados sem autorização.", examples: ["Databases leaked", "Credenciais compradas"] },
  { id: "i3", category: "prohibited", title: "Cheats, hacks e scripts maliciosos", description: "Programas que violem regras de jogos ou causem dano.", examples: ["Aimbot", "Wallhack"] },
  { id: "i4", category: "prohibited", title: "Malware e ferramentas de invasão", description: "Software com intenção de ataque." },
  { id: "i5", category: "prohibited", title: "Métodos de exploração ou fraude", description: "Tutoriais e ferramentas para burlar sistemas." },
  { id: "i6", category: "prohibited", title: "Produtos ilegais", description: "Qualquer item cuja venda viole a lei." },
  { id: "i7", category: "prohibited", title: "Conteúdo adulto ilegal", description: "Conteúdo que envolva menores ou não consentido." },
  { id: "i8", category: "prohibited", title: "Documentos falsos", description: "Documentos falsificados ou de terceiros." },
  { id: "i9", category: "prohibited", title: "Itens que violem direitos de terceiros", description: "Pirataria, marca registrada, cópias não autorizadas." },
  { id: "i10", category: "prohibited", title: "Promessas enganosas", description: "Anúncios com descrição fraudulenta." },
  { id: "i11", category: "restricted", title: "Serviços que burlem regras graves de jogos", description: "Podem ser removidos conforme regras do jogo." },
  { id: "i12", category: "review", title: "Contas digitais", description: "Podem exigir verificação extra do vendedor." },
  { id: "i13", category: "review", title: "Moedas virtuais", description: "Sujeitas a cotação demonstrativa e análise." },
  { id: "i14", category: "review", title: "Serviços de boost", description: "Podem exigir revisão da equipe LIT Buy." },
  { id: "i15", category: "review", title: "Gift cards e assinaturas", description: "Necessitam comprovação de procedência." },
  { id: "i16", category: "review", title: "Entrega automática", description: "Requer configuração adequada para evitar fraude." },
];

const REFUND_POLICY: RefundPolicyRule[] = [
  { id: "r1", eligible: true, title: "Produto não recebido", description: "Se a entrega não ocorrer no prazo, abra problema no pedido." },
  { id: "r2", eligible: true, title: "Dados de acesso inválidos", description: "Credenciais que não funcionam liberam mediação." },
  { id: "r3", eligible: true, title: "Conta recuperada pelo vendedor original", description: "Recuperação indevida gera reembolso após análise." },
  { id: "r4", eligible: true, title: "Produto diferente do anunciado", description: "Divergência clara entre anúncio e entrega." },
  { id: "r5", eligible: false, title: "Contato externo à plataforma", description: "Negociações fora da LIT Buy perdem proteção." },
  { id: "r6", eligible: false, title: "Uso indevido ou má-fé do comprador", description: "Casos identificados podem ter reembolso negado." },
  { id: "r7", eligible: false, title: "Reclamação fora do prazo", description: "Prazos exatos serão definidos com backend real." },
];

const CONTACT_OPTIONS: ContactOption[] = [
  { id: "c1", title: "Suporte a compras", description: "Dúvidas sobre pedidos, pagamento e entrega.", channel: "compradores@litbuy.exemplo", icon: "ShoppingBag" },
  { id: "c2", title: "Suporte a vendedores", description: "Anúncios, entrega, saldo e reputação.", channel: "vendedores@litbuy.exemplo", icon: "Store" },
  { id: "c3", title: "Segurança e denúncias", description: "Comportamento suspeito, fraudes e golpes.", channel: "seguranca@litbuy.exemplo", icon: "ShieldCheck" },
  { id: "c4", title: "Parcerias e afiliados", description: "Programa de afiliados e parcerias comerciais.", channel: "parcerias@litbuy.exemplo", icon: "Share2" },
];

const LEGAL_NOTICE: LegalDraftNotice = {
  title: "Rascunho demonstrativo",
  description:
    "Este conteúdo é preliminar e não constitui documento jurídico final. Antes de qualquer uso em produção, será necessária revisão profissional (jurídica, financeira e de segurança).",
};

const TERMS_SECTIONS: PolicySection[] = [
  { id: "t1", title: "1. Aceitação dos termos", body: "Ao usar a LIT Buy você concorda com estes termos demonstrativos." },
  { id: "t2", title: "2. Uso da plataforma", body: "A LIT Buy é um marketplace para produtos digitais e serviços relacionados a jogos." },
  { id: "t3", title: "3. Responsabilidades do usuário", body: "Manter dados corretos, respeitar regras e utilizar canais oficiais." },
  { id: "t4", title: "4. Responsabilidades do vendedor", body: "Entregar dentro do prazo, cumprir o anunciado e responder pelo chat." },
  { id: "t5", title: "5. Pagamentos", body: "Todos os pagamentos ocorrem via checkout da LIT Buy. Métodos e taxas são demonstrativos." },
  { id: "t6", title: "6. Saldo e saques (futuro)", body: "Regras de liberação, bloqueio e saque exigirão backend financeiro." },
  { id: "t7", title: "7. LIT Points", body: "Programa próprio de recompensas, sem valor de saque." },
  { id: "t8", title: "8. Afiliados", body: "Comissões dependem de atribuição segura e regras antifraude." },
  { id: "t9", title: "9. Mediação e denúncias", body: "Casos serão analisados pela LIT Buy com base nas evidências dentro da plataforma." },
  { id: "t10", title: "10. Itens proibidos", body: "Ver /itens-proibidos. Violações podem gerar suspensão." },
  { id: "t11", title: "11. Limitações de responsabilidade", body: "A LIT Buy não se responsabiliza por acordos feitos fora da plataforma." },
  { id: "t12", title: "12. Suspensão de conta", body: "Contas podem ser suspensas em caso de violação das regras." },
  { id: "t13", title: "13. Alterações dos termos", body: "Estes termos podem ser atualizados a qualquer momento antes da produção." },
];

const PRIVACY_SECTIONS: PolicySection[] = [
  { id: "pv1", title: "1. Dados que poderão ser tratados", body: "Dados de conta, compras, vendas, mensagens e KYC — quando o backend real existir." },
  { id: "pv2", title: "2. Dados de conta", body: "Nome, e-mail, telefone e preferências." },
  { id: "pv3", title: "3. Dados de compra e venda", body: "Pedidos, valores, itens, status e chat vinculado ao pedido." },
  { id: "pv4", title: "4. Mensagens", body: "Mensagens dentro da plataforma poderão ser usadas como evidência em disputas." },
  { id: "pv5", title: "5. KYC e documentos", body: "Documentos poderão ser exigidos para verificação, com storage seguro obrigatório." },
  { id: "pv6", title: "6. Cookies e tracking (futuro)", body: "Nenhum cookie de tracking é utilizado nesta fase. Cookies exigirão consentimento." },
  { id: "pv7", title: "7. Afiliados e atribuição", body: "Atribuição real exigirá backend, tracking seguro e consentimento." },
  { id: "pv8", title: "8. Analytics", body: "Analytics real exigirá provedor formal e opt-in do usuário." },
  { id: "pv9", title: "9. Segurança dos dados", body: "Criptografia, controle de acesso e auditoria são responsabilidades do backend real." },
  { id: "pv10", title: "10. Direitos do usuário", body: "Acesso, correção, exclusão e portabilidade serão suportados na versão real." },
  { id: "pv11", title: "11. Retenção de dados", body: "Prazos serão definidos conforme LGPD e finalidade dos dados." },
  { id: "pv12", title: "12. Compartilhamento com provedores", body: "Provedores de pagamento, KYC e infraestrutura poderão receber dados estritamente necessários." },
  { id: "pv13", title: "13. LGPD", body: "A versão em produção seguirá as diretrizes da Lei Geral de Proteção de Dados." },
];

async function delay<T>(v: T): Promise<T> {
  return v;
}

export const infoService = {
  getHelpCategories: () => delay(HELP_CATEGORIES),
  getHelpFaq: () => delay(HELP_FAQ),
  getBuyingSteps: () => delay(BUYING_STEPS),
  getSellingSteps: () => delay(SELLING_STEPS),
  getSafetyRules: () => delay(SAFETY_RULES),
  getPlatformRules: () => delay(PLATFORM_RULES),
  getProhibitedItems: () => delay(PROHIBITED_ITEMS),
  getRefundPolicy: () => delay(REFUND_POLICY),
  getContactOptions: () => delay(CONTACT_OPTIONS),
  getLegalNotice: () => delay(LEGAL_NOTICE),
  getTermsSections: () => delay(TERMS_SECTIONS),
  getPrivacySections: () => delay(PRIVACY_SECTIONS),
  simulateSubmitContactForm: async (payload: ContactFormPayload): Promise<{ ok: true; id: string }> => {
    // Nenhum envio real; nada é persistido.
    return { ok: true, id: `contact_mock_${Date.now()}_${payload.email.length}` };
  },
};
