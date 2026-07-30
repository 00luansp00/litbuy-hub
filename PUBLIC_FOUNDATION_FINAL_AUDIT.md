# Auditoria final da fundação pública

> **Contrato comercial vigente:** `COMMERCE_ARCHITECTURE.md` é a fonte autoritativa. O conteúdo comercial histórico abaixo é preliminar ou substituído quando divergir; pagamentos e ledger não estão implementados, e nenhum gateway foi escolhido.

## Baseline

Esta fotografia encerra a sequência: PR #28 (lifecycle de produto), #29 (leitura pública), #30 (dados locais), #31 (Home real), #32 (categoria real), #33 (detalhe real; merge `857a34867ba539b462963780b91447cc97e7d5d1`) e #34 (rehearsal e auditoria). SHAs não confirmados no histórico não são atribuídos.

## O que é real

Autenticação auditada, PostgreSQL, Redis, migrations, MinIO privado, categorias/subcategorias, listagem e detalhe públicos, Home, categoria e detalhe, imagens assinadas, dataset local determinístico e três smokes públicos usam a fundação real.

## O que continua demonstrativo

O grid editorial de categorias da Home permanece estático. Busca, loja pública, favoritos, carrinho, checkout, pedidos, pagamento, wallet, mensagens, avaliações, perguntas, relacionados e demais superfícies legadas são demonstrativos. Isso não representa conexão comercial.

## Matriz por rota

| Rota               | Origem                            | Backend      | Mutação  | Comércio | Observação              |
| ------------------ | --------------------------------- | ------------ | -------- | -------- | ----------------------- |
| `/`                | catálogo público + grid editorial | real/parcial | não      | não      | anúncios recentes reais |
| `/categoria/$slug` | catálogo público                  | real         | não      | não      | filtros e paginação     |
| `/produto/$id`     | detalhe público                   | real         | não      | não      | `$id` contém slug       |
| `/buscar`          | services/dados locais             | mock         | não real | não      | busca demonstrativa     |
| `/loja/$slug`      | dados locais                      | mock         | não real | não      | loja demonstrativa      |
| `/carrinho`        | provider em memória               | mock         | local    | não      | sem reserva             |
| `/checkout`        | services legados                  | mock         | local    | não      | sem pedido/pagamento    |

## Segurança

O backend é fonte de verdade; endpoints públicos são somente leitura. O storage é privado e entrega URLs assinadas temporárias, sem dados privados. Invisibilidade é uniforme. Guardas recusam produção e alvos não locais; dados são fictícios; portas Compose ficam no loopback. Nada implica prontidão para produção.

## Evidências automatizadas

No commit auditado, CI executa testes, typecheck e build frontend/backend, integrações, migrations, health/readiness, CORS, staging e infrastructure smokes. O rehearsal cobre os três smokes públicos, seed idempotente, verify, segundo seed/verify e reset idempotente. `audit:public-foundation` verifica a fronteira sem rede, Docker ou Git. Contagens exatas pertencem ao resultado do CI do commit, não a este texto.

## Riscos restantes

- Compose local não é arquitetura de produção e não há browser E2E completo.
- A rota legada `$id` contém slug; superfícies mockadas coexistem com reais.
- Credenciais locais são públicas e descartáveis; busca e loja não estão integradas.
- Nenhum fluxo financeiro deve começar sem arquitetura de pedidos e ledger.
- Revisão profissional continua obrigatória antes da produção.

## Gate para a próxima fase

A fase comercial só pode começar depois que a PR #34 estiver verde e mesclada. Deve haver planejamento separado para carrinho, criação de pedido, snapshot imutável, reserva de estoque, idempotência, ledger, pagamentos, webhooks, split, escrow, reembolso e chargeback. Nenhum desses itens é implementado aqui.
