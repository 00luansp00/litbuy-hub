# SECURITY_NOTES.md — LIT Buy (MVP mockado)

> Este documento existe para deixar explícito o que **não é seguro** no MVP
> atual. Nada aqui é produção. Toda a segurança real deve ser implementada
> quando o backend (Lovable Cloud / Supabase) for ligado.

## Modelo de conta atual (mock)

- Toda conta comum da LIT Buy é **compradora e vendedora** por padrão.
- Não existe cadastro/onboarding separado de vendedor no MVP.
- `activeRole` (`"buyer" | "seller"`) é apenas **contexto visual** da
  navegação — não é permissão real.
- `hasSellerProfile` permanece como campo legado (sempre `true` no mock)
  e **não deve ser usado para bloquear** acesso à área do vendedor.

## Admin mockado

- Login com o email demo `admin@litbuy.com` gera um usuário com
  `isAdmin: true`. Qualquer outro email gera `isAdmin: false`.
- `AdminGate` bloqueia visualmente `/admin` quando `isAdmin` é falso.
- `isAdmin` vive apenas no cliente, em memória. **Qualquer pessoa com
  DevTools pode alterá-lo.** Não é RBAC.
- Toda ação administrativa hoje é `toast` — nenhuma escrita real.

## O que ainda NÃO é seguro

1. Autenticação — `authMock` é in-memory; senha é ignorada; nada de JWT.
2. Autorização — `AuthGate` e `AdminGate` são UI, não impedem chamadas.
3. Sessão — não persiste, some no F5 (nenhum `localStorage` / cookie por design).
4. Dados — tudo vem de `src/data/*.ts`; alteração no cliente não altera nada.
5. Uploads — `ImageUploader` usa apenas File API + preview, nada sobe.
6. Pagamentos — nenhum gateway ligado; sucesso do checkout é visual.
7. Carteira — saldo mockado, sem ledger.
8. Mensagens / disputas / denúncias — apenas UI.

## Requisitos para produção

Antes de qualquer publicação real:

- Substituir `AuthProvider` por Supabase Auth (email/senha + OAuth).
- Criar tabela `user_roles` + função `has_role()` + RLS
  (ver `SUPABASE_RLS_PLAN.md`).
- Trocar `AdminGate` para checar `has_role(auth.uid(), 'admin')`
  server-side, além do visual.
- Toda server function admin deve usar `.middleware([requireSupabaseAuth])`
  e validar a role no handler.
- Webhooks de pagamento em `src/routes/api/public/*` com verificação de
  assinatura.
- Auditoria (log de ações admin) em tabela dedicada.
- Rate limiting nas rotas públicas sensíveis.
- Validação Zod server-side em todo input (não confiar no frontend).

## Regra de ouro

Nada do `src/services/authMock.ts`, `src/data/*`, ou dos `*Gate`
puramente visuais deve sobreviver ao merge com o backend real.

## Sprint 18.7 — Anúncio Avançado

- **Cofre Seguro de Entrega**: implementação real exige backend, criptografia
  em repouso e trilha de auditoria — impossível fazer com segurança no cliente.
- No MVP, nunca inserir credenciais, senhas ou códigos reais no cofre demo.
- **Upload de imagens** real exigirá Storage seguro (tamanho, MIME, moderação);
  o wizard atual usa apenas previews locais.
- **Mensagem automática LIT-MAX** não pode conter contato externo
  (WhatsApp, Telegram, Discord pessoal, links externos) nem dados sensíveis;
  a comunicação deve permanecer dentro da LIT Buy.
- **Campos de conta** (procedência, recuperação) serão prova em disputas
  futuras — precisarão de validação e política formal de aceitação.

## Sprint 18.8 — considerações

- **Moderação real exige backend.** A função `sanitizeExternalContact()` é
  apenas mock client-side; um atacante pode contornar. Deve haver moderação
  no servidor com regras versionadas e log de auditoria.
- **Negociação fora da plataforma remove proteção futura** — não implementado,
  mas os avisos já preparam o comprador/vendedor.
- **Dados sensíveis (login, senha, seed) nunca são exibidos no frontend.**
  O componente `AccountInfoCard` apresenta apenas metadados declarados.
- **Cotação de moeda virtual e multi-vendedor** são demonstrativos; a divisão
  entre vendedores deve ocorrer em transação atômica no backend.

## Sprint 18.9 — Pagamento

- **Não colete cartão real** no frontend. Nem PAN, nem CVV, nem validade
  reais. O bloco de cartão do checkout é uma demonstração com placeholders.
- **Não gere Pix real** no frontend puro. Chaves e QR devem vir do PSP.
- **Não emita boleto real** no frontend. Somente o banco/PSP emite.
- **Não valide CPF real** e não trafegue CPF real em texto simples.
- **LIT Points e Saldo LIT reais** exigem backend com carteira, ledger e
  transação atômica. O frontend nunca deve debitar saldo/pontos.
- **Proteção LIT** real exige regras jurídicas, cobertura declarada,
  antifraude e reserva financeira. Nunca prometer cobertura sem backend.
- `analyticsService` não envia eventos; ao ligar um provider real, prefira
  server-side para evitar bloqueadores e vazamento de PII.

## Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor

- Programa LIT Points é próprio da LIT Buy. Não é dinheiro, não é saldo financeiro, não pode ser sacado.
- Rotas públicas `/lit-points` e `/taxas` explicam programa, tarifas, prazos e níveis de vendedor.
- Níveis Bronze/Prata/Ouro/Diamante/Elite são visuais e mockados.
- Taxas e prazos exibidos são demonstrativos. Cálculo real, cobrança, split, escrow, saques e assinatura LIT-MAX exigem backend.
- Saldo LIT é separado de LIT Points. Saldo pendente/disponível/bloqueado é apenas visual.
- Services: `litPointsService`, `sellerLevelService`, `platformEconomicsService` — todos mockados, sem persistência.
- Integrações leves em `/carteira`, `/vendedor`, `/vendedor/financeiro`, `/loja/$slug` e `/produto/$id`.
- Footer aponta para `/lit-points` e `/taxas`.

## Sprint 18.11 — KYC e Equipe (avisos)
- O fluxo `/perfil/verificacao` é **estritamente demonstrativo**. Não coleta, não valida e não armazena documentos, selfies ou dados sensíveis.
- KYC real exige backend seguro, storage criptografado, fornecedor especializado (ex.: provedor de KYC), OCR e prova de vida.
- Dados pessoais e documentos precisam seguir LGPD (base legal, retenção mínima, direito ao esquecimento, DPO).
- SMS, documento e selfie de produção **não podem trafegar/persistir no frontend**.
- Equipe do vendedor (`/vendedor/equipe`) é visual. Permissões reais exigem RBAC no backend e autenticação individual por membro.
- Ações críticas (saque, alteração de configurações, remoção de membro) exigem audit log e, preferencialmente, MFA.
- Convites reais precisam de token de uso único, expiração e verificação de e-mail.
- Membros nunca devem compartilhar senha; cada operador é uma conta.

## Sprint 18.12 — Admin (avisos)
- `AdminGate` é uma cortina **visual**. Não valida sessão, papel ou permissão de fato.
- `isAdmin` no frontend é demonstrativo — decisão real deve ser server-side com JWT/claim assinado.
- Permissões e perfis mostrados em `/admin/permissoes` são visuais. Aplicar RBAC no backend antes de qualquer endpoint sensível.
- Feature flags nunca podem viver apenas no cliente para decisões de segurança (KYC obrigatório, modo manutenção, pagamentos). Precisam de serviço central com cache e propagação.
- Taxas, saques, LIT Points e cotações devem ser calculados/persistidos no backend, nunca a partir do frontend.
- Todas as ações administrativas sensíveis (aprovar KYC, alterar taxa, bloquear saque, remover anúncio, editar permissão) exigem audit log imutável com ator, IP, entidade, antes/depois e resultado.
- CMS real deve incluir versionamento, agendamento, review e rollback.

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.

## Sprint 18.14 — Central de Notificações (mock)

- Central visual/mockada: `notificationService` + `NotificationProvider` (`useNotifications`).
- Sino na Navbar (`NotificationBell`): dropdown no desktop, navegação para `/notificacoes` no mobile.
- Rota nova: `/notificacoes` com filtros, contagem de não lidas, marcar como lida / marcar todas / arquivar (tudo em memória).
- Notificações são geradas por papel — comprador, vendedor, admin — e cobrem pedido, pagamento, entrega, chat, mediação, vendas, KYC, denúncias, financeiro e admin.
- Notificações apontam para rotas reais quando existem (`/pedidos/$id`, `/vendedor/vendas/$id`, `/mensagens/$id`, `/admin/*`, `/lit-points`, etc.).
- **Nada é persistido**: sem LocalStorage, sem Cookies, sem backend. Push, e-mail, SMS, WebSocket e Service Worker **não** são implementados — exigem backend real, opt-in do usuário e infra de mensageria.
- Dados sensíveis nunca devem aparecer em notificações — títulos e descrições são genéricos e mascarados.

## Sprint 18.15 — Denúncias (limitações)

- Denúncias reais exigem backend, moderação humana, audit log e RBAC nas ações admin.
- Evidências reais (imagens, vídeos, links, mensagens) exigem storage seguro com scanning de conteúdo, retenção limitada e controle de acesso.
- Ações destrutivas (suspender anúncio, bloquear usuário) nunca podem depender do frontend.
- Nada nesta sprint persiste em backend, LocalStorage ou Cookies. Toda simulação é em memória.

## Sprint 18.16 — Afiliados (limitações)
- Tracking real exige backend, cookies com consentimento (LGPD) e atribuição server-side.
- Antifraude é obrigatório: detecção de autoindicação, cliques automatizados, múltiplas contas e padrões suspeitos.
- Comissão real exige cálculo server-side, ledger dedicado e audit log imutável.
- Saque real exige verificação de identidade (KYC), aprovação financeira e integração bancária.
- Nenhum dado do programa de afiliados persiste no MVP (sem LocalStorage, sem Cookies).
- Frontend NÃO deve decidir status de comissão, valor liberado, elegibilidade a saque ou legitimidade de indicação.

## Sprint 18.17 — Confiança pública

- Termos, Privacidade e Política de Reembolso publicados são **rascunhos demonstrativos**. LGPD real exige backend, storage seguro e revisão jurídica.
- KYC e documentos referenciados em `/como-vender` e `/seguranca` seguem exigindo backend, storage protegido e fornecedor especializado.
- Formulário de `/contato` é mock — sem envio real, sem persistência. Suporte real não pode depender só do frontend; exigirá canal dedicado (e-mail, ticketing, chat) com autenticação e auditoria.
- Cookies de tracking, analytics real e consentimento LGPD serão implementados junto com o backend.

## Sprint 18.18 — Chat oficial e mediação guiada
- Mediação real exige backend com auditoria, atribuição a moderadores e RBAC — hoje `simulateOpenMediation` é um mock.
- Prazos reais (categoria, Proteção LIT, exceções) precisam vir do backend. Prazo derivado do frontend é apenas demonstrativo.
- Saldo real não pode depender do frontend: bloqueio/retenção/liberação exigem serviço financeiro com conciliação, escrow e auditoria.
- Upload de evidências (prints, vídeos, seleção de mensagens) exige storage seguro, verificação de MIME, tamanho máximo, deduplicação e política LGPD.
- Sanitização anti-poaching no frontend é apenas visual — moderação real precisa acontecer no servidor antes de persistir/entregar mensagens.

## Sprint 18.19 — E-mails Transacionais

- O frontend NUNCA envia e-mail nem armazena chaves SMTP/API de provedor.
- Reset de senha exige token seguro gerado no backend com expiração curta.
- Verificação de novo dispositivo depende de backend/auditoria de sessão.
- Links reais de e-mail devem sempre apontar para o domínio oficial LIT Buy
  e usar HTTPS — proteger contra phishing.
- E-mails de marketing seguem opt-in explícito (LGPD); e-mails transacionais
  críticos não podem ser desativados.
- Nunca colocar dados sensíveis (senha, código PIX, dados de cartão) no corpo
  do e-mail — apenas metadados e links assinados.
