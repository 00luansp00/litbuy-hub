# LIT Buy — runbook de estabilização local do Alpha

Este é o runbook operacional atual da fase pós-freeze. A checklist autoritativa de escopo e gates continua sendo `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`.

## Estado

- **Feature freeze ativo.** Não adicionar funcionalidades, fazer refactor geral ou iniciar hardening/auditoria externa.
- Baseline oficial: `aceb8b26b7205b03b28e0681aba9fb71a175f67f`.
- `PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`.
- Fase atual: estabilização local; os cinco gates pós-freeze continuam abertos.
- Este ambiente é local e não é produção. Não inserir dados pessoais, credenciais ou dados financeiros reais.
- Alteração funcional exige bug objetivo reproduzido, evidência e correção mínima, com teste de regressão quando apropriado.

## Pré-requisitos

- Bun (o lockfile deve ser respeitado; a revalidação do baseline usou Bun `1.2.14`).
- Docker com o comando `docker` e Docker Compose v2 como `docker compose`.
- Portas loopback livres: frontend `13000`, API `13001`, PostgreSQL `15432`, Redis `16379`, MinIO/S3 `19000` e console MinIO `19001`.
- Acesso para obter as imagens declaradas em `docker-compose.staging.yml` na primeira preparação.

Confirme antes de começar:

```bash
docker version
docker compose version
bun --version
```

Se Docker não responder, não altere portas nem arquitetura para contornar a máquina: registre a limitação, execute apenas os checks independentes de infraestrutura e não declare rehearsal, integration ou o gate como concluídos.

## Instalação

Na raiz do repositório:

```bash
bun install --frozen-lockfile
cd backend && bun install --frozen-lockfile && cd ..
```

## Subida do ambiente

Reutilize a composição existente; não crie um Compose paralelo:

```bash
bun run demo:prepare
```

O comando sobe `docker-compose.staging.yml`, aplica as migrations existentes, cria o bucket local, semeia/verifica os dados fictícios e mantém o ambiente ativo. Operação posterior:

```bash
bun run demo:check
bun run demo:status
bun run demo:logs
bun run demo:down
```

`demo:reset` remove somente os dados demo reservados e exige confirmação explícita; depois dele, execute novamente `demo:prepare`.

## Health e endpoints locais

- Frontend: `http://localhost:13000`
- API: `http://localhost:13001/api/v1`
- Readiness da API: `http://localhost:13001/api/v1/health/ready`
- Liveness da API: `http://localhost:13001/api/v1/health/live`
- Storage S3-compatible/MinIO: `http://localhost:19000` (health: `/minio/health/live`)
- Console MinIO: `http://localhost:19001`

Todos os serviços publicados pelo Compose ligam somente em `127.0.0.1`. `demo:check` valida health, CORS, frontend, catálogo e dados demo; `demo:status` e `demo:logs` fornecem evidência dos containers.

## Contas demo

Credenciais determinísticas, públicas e exclusivamente locais:

| Papel  | E-mail                        | Senha             |
| ------ | ----------------------------- | ----------------- |
| Buyer  | `comprador@demo.litbuy.local` | `LitBuyDemo2026!` |
| Seller | `vendedor@demo.litbuy.local`  | `LitBuyDemo2026!` |
| Admin  | `admin@demo.litbuy.local`     | `LitBuyDemo2026!` |

Nunca reutilize essas credenciais em staging hospedado ou produção.

## Validação automatizada

### Frontend e guards críticos

```bash
bun run test
bun run typecheck
bun run build
bun x vitest run \
  __tests__/alpha-critical-flow-no-mock.test.ts \
  __tests__/admin-critical-path-no-mock.test.ts \
  __tests__/buyer-payment-mock-guard.test.ts \
  __tests__/seller-sales-no-mock.test.ts
```

A guarda `alpha-critical-flow-no-mock` cobre as fronteiras críticas de catálogo, cart e checkout, além das leituras/mutações Buyer, Seller e Admin. As guardas específicas mantêm pagamento Buyer, vendas Seller e Admin sem autoridade mock; os testes de UI/serviço da suíte completa cobrem financeiro Seller e checkout/cart. Não duplique esses testes em novos scripts.

O lint global contém dívida histórica. Não reformate o repositório inteiro; todo arquivo alterado deve passar Prettier/lint focado e qualquer falha deve ser classificada como preexistente ou regressão desta mudança.

### Backend

```bash
cd backend
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run test:e2e
bun run prisma:validate
bun run prisma:generate
bun run build
```

Com PostgreSQL, Redis e demais infraestrutura local disponíveis:

```bash
bun run test:integration
bun run prisma:migrate:status
```

Não declare integration ou estado de migrations verde sem executar esses comandos contra a infraestrutura correta.

### Infraestrutura, rehearsal, audits e smokes

Com o ambiente preparado:

```bash
bun run demo:prepare
bun run demo:check
bun run audit:public-foundation
bun run audit:commerce-architecture
bun run smoke:infra
bun run smoke:home-catalog
bun run smoke:category-catalog
bun run smoke:product-detail-catalog
bun run demo:status
```

Os audits são estruturais. Os smokes e `demo:check` exigem os serviços locais ativos; falha por conexão recusada não pode ser reportada como validação do produto.

## Caminho crítico Alpha

Validar que a autoridade permanece nas integrações reais na ordem atual:

1. **Seller:** onboarding → aprovação Admin → `ListingDraft` → moderação → `Product` → imagem/lifecycle → catálogo público.
2. **Buyer:** produto → carrinho → checkout → pedido → pagamento Alpha não produtivo → pedido `ACTIVE`.
3. **Seller:** venda → registro de entrega.
4. **Buyer:** confirmação de recebimento.
5. **Financeiro:** lifecycle do ledger `SELLER_PENDING → SELLER_HELD → SELLER_AVAILABLE` → leitura owner-only do Seller.
6. **Admin:** onboarding → moderação → catálogo/taxonomia.

Os guards automatizados demonstram as fronteiras estruturais, não a aceitação completa pelo navegador. A validação manual ponta a ponta local e em staging pertence ao gate posterior **Fluxo crítico sem mocks**, e browser E2E/testes manuais completos pertencem a **Testes e estabilização**. Não fechar esses gates neste rehearsal.

## Troubleshooting

- **`docker: command not found` ou daemon indisponível:** instalar/iniciar Docker e repetir as três verificações de pré-requisito. Não declarar rehearsal verde.
- **Porta ocupada:** encerrar o processo conflitante; não apontar os comandos para host remoto.
- **Health/build falhou:** executar `bun run demo:status` e `bun run demo:logs` e preservar o erro sem publicar tokens, cookies, URLs assinadas, connection strings ou `.env`.
- **Seed/verify divergiu:** executar `bun run demo:reset` e depois `bun run demo:prepare`; o reset é restrito aos dados demo.
- **Imagem assinada falhou:** verificar a saúde do MinIO e os logs dos serviços.
- **Frontend abre e catálogo falha:** conferir readiness da API e logs de backend/frontend.
- **`PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED`:** usar somente os alvos loopback, portas e paths previstos; o rehearsal rejeita destinos não locais.
- **Teste dependente de infraestrutura falhou:** distinguir indisponibilidade local de bug. Reproduzir com a composição saudável antes de alterar código funcional.

## Production blockers (fora desta fase)

A seção **FORA DO ALPHA / PRODUÇÃO** de `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` é autoritativa. Permanecem fora desta PR: dinheiro real e payout/saque; KYC e antifraude reais; homologação produtiva do PSP; refunds, chargebacks, disputas e reconciliação completos; hardening geral/Issue #41 e governança; observabilidade completa, backups/restore e disaster recovery; infraestrutura/performance finais; LGPD, jurídico, revisão humana sênior e aprovação de lançamento.

Esses itens são production blockers rastreados, não trabalho da estabilização local. Não implementar busca, seller store, chat, reviews, afiliados, Seller Level, LIT-MAX, promotions, payout, saque, KYC ou PSP produtivo durante o freeze.
