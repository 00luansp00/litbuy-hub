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
