# TECH_DEBT_AND_RISKS.md — LIT Buy

Inventário honesto de dívida técnica e riscos conhecidos antes do
handoff.

Legenda: **Impacto** = baixo/médio/alto/crítico. **Prioridade** =
imediata (antes de dev) / alta (durante) / média / baixa.

## Dívida técnica

### Frontend gerado por IA

- Projeto foi construído em iterações com Lovable/IA.
- **Impacto**: médio. **Prioridade**: alta.
- **Recomendação**: revisão humana completa, dedupe de componentes,
  padronização de nomenclatura, testes.

### Duplicação potencial de componentes

- Possível sobreposição entre `common/`, `ui/` e componentes de área.
- **Impacto**: baixo. **Prioridade**: média.
- **Recomendação**: mapear e consolidar em uma passada de refactor.

### Services mockados

- Todos os services em `src/services/` retornam dados estáticos.
- **Impacto**: crítico. **Prioridade**: imediata.
- **Recomendação**: substituir por chamadas reais na fase backend.

### Tipos parciais

- `src/types/index.ts` cresceu ao longo das sprints; pode ter tipos
  redundantes.
- **Impacto**: baixo. **Prioridade**: média.
- **Recomendação**: consolidar + gerar tipos do banco (`supabase gen types`).

### Testes automatizados ausentes

- Nenhum teste unitário, integração ou e2e.
- **Impacto**: alto. **Prioridade**: alta.
- **Recomendação**: Vitest para unit, Playwright para e2e nas
  jornadas críticas (login, checkout, pedido, mediação).

## Riscos de produto

### Auth mockado

- `AuthProvider` em memória, sem RBAC real, sem sessão.
- **Impacto**: crítico. **Prioridade**: imediata.

### Admin mockado

- `AdminGate` é visual. Qualquer usuário sabendo o e-mail
  `admin@litbuy.com` acessa em modo demo.
- **Impacto**: crítico. **Prioridade**: imediata.

### Pagamentos mockados

- Pix/boleto/cartão gerados por mock; sem gateway.
- **Impacto**: crítico. **Prioridade**: imediata.

### Wallet / escrow / LIT Points inexistentes

- Saldos são números estáticos.
- **Impacto**: crítico. **Prioridade**: imediata.

### KYC visual

- SMS/documento/selfie são apenas UI.
- **Impacto**: crítico. **Prioridade**: imediata (antes de aceitar saque).

### Permissões reais ausentes

- Sem RLS, sem roles server-side.
- **Impacto**: crítico. **Prioridade**: imediata.

### Uploads ausentes

- Nada é enviado. Fluxos visuais apenas.
- **Impacto**: alto. **Prioridade**: alta.
- **Recomendação**: storage privado + antivírus + URL assinada.

### Mediação/denúncia visual

- Sem workflow real, sem SLA server-side, sem evidência persistida.
- **Impacto**: alto. **Prioridade**: alta.

## Riscos de plataforma

### SEO limitado por SPA

- Tags de `head()` são renderizadas no client. Crawlers e previews
  sociais podem não ler.
- **Impacto**: médio. **Prioridade**: média.
- **Recomendação**: SSR/SSG para rotas públicas (Next.js/Remix/prerender).

### Rotas dinâmicas dependem de backend

- `/produto/$id`, `/loja/$slug`, `/categoria/$slug`,
  `/pedidos/$id`, etc. precisam de backend real para dados.

### Ausência de monitoramento

- Sem Sentry, sem logs centralizados.
- **Impacto**: alto. **Prioridade**: alta.

### Ausência de deploy/infra

- Sem CI/CD, sem staging.
- **Impacto**: alto. **Prioridade**: alta.

## Riscos jurídicos

### Termos e privacidade são rascunhos

- Sem revisão jurídica. Sem versionamento.
- **Impacto**: crítico. **Prioridade**: imediata (antes de aceitar
  cadastro real).

### LGPD

- Sem DPO, sem consent banner, sem endpoints de portabilidade/apagamento.
- **Impacto**: crítico. **Prioridade**: imediata.

### Riscos de marketplace financeiro

- Marketplace movimenta dinheiro entre terceiros — exige compliance
  fiscal (NF-e/e-Financeira), antifraude, KYC/AML, PCI se cartão.
- **Impacto**: crítico. **Prioridade**: imediata.

### Itens digitais / gaming

- Alguns tipos de item podem violar TOS de plataformas (Riot, Blizzard,
  etc.). Exige revisão jurídica e política de itens proibidos.
- **Impacto**: alto. **Prioridade**: alta.

## Dados sensíveis coletados hoje

- **Nenhum** dado real é coletado (avisos de demonstração em todas as
  áreas sensíveis). Manter essa disciplina até backend + segurança
  estarem prontos.

## Recomendações finais

1. Nunca aceitar dinheiro real, cadastro real ou dado real antes da
   fase backend + segurança concluída.
2. Contratar dev sênior (ou agência) para fases 1, 5, 6, 9 do
   `BACKEND_ROADMAP.md`.
3. Contratar revisão jurídica antes do launch.
4. Fazer pentest antes de abrir para público.
5. Manter todas as áreas sensíveis com aviso de demonstração até
   backend real estar publicado.

## Sprint 2C2B1 — lint global histórico

O lint raiz legado (`eslint .`) ainda varre todo o monorepo, incluindo backend e arquivos históricos, com aproximadamente 1.662 problemas preexistentes observados no CI #33/execução local — majoritariamente `prettier/prettier`. Este PR não formata centenas de arquivos fora do escopo para não misturar saneamento mecânico com autenticação. A validação rigorosa desta sprint usa `bun run lint:auth` e `bun run format:check:auth` somente sobre a superfície integrada; uma sprint própria deverá normalizar o lint global.

## Sprint 2C2B2A

- A Central de Segurança não implementa geolocalização, fingerprint adicional ou step-up de gerenciamento.
- O endpoint real `POST /auth/sessions/logout-all` revoga inclusive a sessão atual; a UI comunica esse efeito e redireciona para login.
- 2FA de gerenciamento, telefone e alteração de e-mail permanecem para sprint futura.

## Sprint 2C2B2B1

- O frontend bloqueia entradas obviamente inválidas, mas o backend continua autoridade para normalização de telefone, cooldown, rate limit, expiração e disponibilidade.
- A rota de confirmação de e-mail depende de o usuário informar novamente o novo e-mail; isso evita colocar e-mail completo na URL e mantém funcionamento em nova aba.
- 2FA, recovery codes e step-up permanecem pendentes para sprint futura.

## Sprint 2C2B2B2A — riscos remanescentes de 2FA

- Status, ativação e desativação de 2FA estão integrados no frontend com contratos reais e parsers defensivos.
- Recovery codes são exibidos apenas uma vez e não são persistidos; a regeneração ainda não existe na UI e permanece para sprint futura.
- Step-up authentication e troca de método de 2FA seguem pendentes para 2C2B2B2B e não devem ser simulados no frontend.
