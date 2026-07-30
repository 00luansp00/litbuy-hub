# Inventário atual de real versus demonstrativo

## Fundação real auditada

- autenticação e sessões;
- lifecycle persistente de anúncios;
- categorias e subcategorias públicas;
- produtos materializados e variantes públicas;
- imagens privadas em MinIO/S3 compatível com URLs assinadas;
- listagem e detalhe públicos;
- Home, `/categoria/$slug` e `/produto/$id` conectados ao catálogo.

Essas superfícies são reais no rehearsal local, mas somente leitura pública não significa comércio pronto.

## Ainda demonstrativo ou incompleto

| Área                                 | Criticidade  | Pendência real                       |
| ------------------------------------ | ------------ | ------------------------------------ |
| Busca e loja pública/seller completo | alta         | integração e contratos próprios      |
| Favoritos                            | média        | persistência e autorização           |
| Carrinho e checkout                  | crítica      | backend, preço e validação           |
| Pedido e snapshot imutável           | crítica      | modelo e auditoria                   |
| Reserva de estoque e compra          | crítica      | atomicidade e idempotência           |
| Pagamento, split, escrow e wallet    | crítica      | ledger, gateway e webhooks           |
| Avaliações e perguntas               | alta         | persistência, moderação e antifraude |
| Mutações comerciais                  | crítica      | autorização, lifecycle e auditoria   |
| Mensagens, disputas e evidências     | crítica      | storage e workflows próprios         |
| KYC, admin, afiliados e notificações | alta/crítica | integrações e controles próprios     |

## Regra de segurança

Não inserir dados pessoais ou financeiros reais nas áreas demonstrativas. Todo item crítico exige arquitetura de pedidos/ledger, testes, segurança e revisão profissional antes de produção.
