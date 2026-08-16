# LIT Buy — Final Functional Audit Report

> **Atualização 2026-08-16 — Bloco 3 Buyer:** encerrado formalmente sobre `main` remoto `44fa6c57cba4a9d458e5d7086068d6e8ccd8edd9`. O caminho crítico local foi `REAL-TESTED` com browser/HTTP/PostgreSQL, ownership, refresh e replay. `QA-BROWSER-003` foi fechado por revalidação; `QA-BROWSER-007` e `QA-BROWSER-013` permanecem `OPEN / NON_BLOCKER`. Multi-Seller tem cobertura estrutural/automatizada, mas não browser completo porque a seed contém um Seller. Disputa/refund/chat/review e produção ficam fora. Matriz: `FINAL_FUNCTIONAL_AUDIT_BLOCK_3_BUYER_PROGRESS.md`.

## Finalidade

Este documento consolida, bloco a bloco, a validação funcional manual final do LIT Buy antes do handoff para revisão humana sênior.

Ele não substitui:

- `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` como autoridade funcional máxima do Alpha;
- `CLAUDE_AUDIT_FINDINGS_LEDGER.md` como autoridade dos findings formais da auditoria Claude;
- `POST_FREEZE_BROWSER_QA_FINDINGS.md` como ledger dos achados manuais de Browser QA;
- `FINAL_FUNCTIONAL_VALIDATION_CHECKLIST.md` como roteiro obrigatório da bateria final.

A função deste relatório é responder, de forma legível e persistente, para cada bloco:

1. o que foi testado;
2. o que é real e funcionou;
3. o que ainda é mock/demo;
4. o que está ausente;
5. o que apresentou bug;
6. o que exige decisão de produto;
7. o que deve ser corrigido com mudança estreita e controlada;
8. o que deve ficar para trabalho humano sênior/produção;
9. de onde cada informação pública deve vir e quem pode alterá-la.

## Regra operacional da auditoria por blocos

A partir desta rodada, o fluxo obrigatório é:

> TESTAR → PARAR → AUDITAR → DOCUMENTAR → REVISAR O DOCUMENTO → somente então avançar ao próximo bloco.

Uma nova área não deve ser iniciada enquanto o bloco anterior não tiver sua evidência consolidada neste relatório e seus findings persistidos no ledger apropriado.

## Classificações usadas

- `REAL-TESTED` — capacidade real conectada à autoridade correta e validada no browser/ambiente aplicável.
- `REAL-BUG` — capacidade real existe, mas apresentou defeito objetivo.
- `MOCK-DEMO` — conteúdo/ação demonstrativa sem autoridade operacional real.
- `NOT-IMPLEMENTED` — capacidade esperada/visível não existe de forma funcional.
- `FUTURE-SCOPE` — capacidade deliberadamente futura e não deve ser implementada silenciosamente nesta fase.
- `HUMAN-SENIOR` — depende de revisão/decisão/infraestrutura/segurança/produção humana sênior.
- `DECISION-REQUIRED` — existe uma necessidade de produto/UX, mas o contrato correto ainda precisa ser definido antes de implementar.

---

# Bloco 1 — Público / Home / Catálogo / Produto

## Estado do bloco

**Status:** `AUDITADO E DOCUMENTADO — ACHADOS ABERTOS`

O bloco público está suficientemente exercitado para avançar à autenticação depois que esta documentação for incorporada ao `main`. Isso não significa que todos os achados do bloco estejam corrigidos; significa que o comportamento atual está classificado e as lacunas estão registradas.

## Baseline validado

- Data local da rodada: `2026-08-15`.
- Repositório autoritativo: `00luansp00/litbuy-hub`.
- `main`/SHA validado: `0aae26149db54ab7715306de0476bf3b589f0ee2`.
- Workspace local: `C:\Users\luans\litbuy-browser-validation`.
- Working tree: limpa, detached em `origin/main`.
- Ambiente: `docker-compose.staging.yml` local.
- Frontend: `http://localhost:13000`.
- API: `http://localhost:13001/api/v1`.
- PostgreSQL, Redis, MinIO, backend e frontend: healthy.
- `bun install --frozen-lockfile`: sem alteração de lockfile.
- `demo:prepare`: aprovado.
- `demo:check`: aprovado.
- `demo:status`: todos os serviços esperados healthy.
- Catálogo demo verificado: 3 usuários, 1 seller, 3 categorias demo, 8 subcategorias, 8 produtos, 6 produtos públicos e 1 FeePolicy.
- Modo financeiro: rehearsal local / `FAKE_ALPHA`; nenhum dinheiro real.

### Warning observado na preparação

O container de demo-data emitiu warning do Prisma sobre detecção de OpenSSL/libssl e fallback para `openssl-1.1.x`. O warning não impediu seed, verify, smokes ou infraestrutura de passarem. Deve permanecer visível para avaliação de ambiente/produção, mas não bloqueou esta bateria local.

---

## 1. Home e catálogo público

### `REAL-TESTED`

Foram validados no browser:

- Home carregando sem erro;
- seção `Catálogo real / Anúncios recentes`;
- 6 anúncios públicos vindos da API real;
- navegação de card real para detalhe real;
- dropdown `Categorias` alimentado pela API de catálogo;
- categorias demo e categorias preexistentes do catálogo aparecendo no dropdown;
- categorias válidas abrindo suas páginas;
- categorias sem anúncios exibindo empty state correto;
- categoria inexistente exibindo `Categoria não encontrada` sem tela branca;
- produto inexistente exibindo `Produto não encontrado` sem tela branca;
- filtros de subcategoria;
- filtro de tipo de produto;
- ordenação (`RECENT`, `OLDEST`, título etc.) alterando a consulta/ordem;
- produto real abrindo detalhe consistente com o catálogo;
- `Contas`, `Gift Cards` e `Serviços` como categorias reais válidas, ainda que sem anúncios públicos na base usada.

### Evidências representativas

Rotas exercitadas incluem:

- `/`;
- `/categoria/demo-jogos?sort=RECENT&page=1`;
- `/categoria/demo-software?sort=RECENT&page=1`;
- filtros por `subcategory=...`;
- `/categoria/contas?sort=RECENT&page=1`;
- `/categoria/gift-cards?sort=RECENT&page=1`;
- `/categoria/servicos?sort=RECENT&page=1`;
- `/categoria/categoria-que-nao-existe`;
- `/produto/demo-servico-acompanhamento`;
- `/produto/produto-que-nao-existe`.

### Observação sobre dados demo versus dados reais

Os nomes `— Demonstração` e o conteúdo fictício do seed não tornam a superfície mockada. Esses produtos/categorias estão persistidos no backend real do rehearsal e são servidos pela API real. O conteúdo é fictício para validação local; a autoridade técnica é real.

---

## 2. Home Hero e navegação promocional

### `MOCK-DEMO`

Os quatro cards visuais do Hero:

- Steam;
- Valorant;
- FIFA;
- Xbox GP;

são hardcoded/decorativos e não representam os anúncios persistidos do catálogo público.

Eles não possuem destino real de produto.

### `REAL-BUG` / `QA-BROWSER-002`

O CTA `Explorar produtos` se apresenta como ação real, mas não leva a uma superfície útil do catálogo. Durante a validação não houve mudança funcional perceptível/destino de exploração.

Os cards do Hero também se apresentam visualmente como cards de produto sem possuir navegação.

**Critério de correção futuro:**

- ou transformar a área em catálogo real/destaques reais;
- ou deixar claramente decorativa;
- e dar ao CTA um destino real e coerente.

Não implementar silenciosamente sem decisão de escopo.

---

## 3. Notificações no estado anônimo

### Classificação: `MOCK-DEMO` + UX aberta

O sino apresenta notificações mesmo sem login, com badge e cartões como:

- `Chat do pedido criado`;
- `Pagamento aprovado`;
- `Entrega automática liberada`;
- `Nova conversão de afiliado`.

A auditoria do código confirmou que:

- `src/services/notificationService.ts` se declara camada mockada;
- as notificações não são salvas nem persistidas;
- `NotificationProvider` possui comportamento deliberado de mostrar notificações sem autenticação para não deixar o sino vazio na demo.

### Reclassificação de risco do `QA-BROWSER-001`

A evidência atual **não sustenta vazamento de notificações privadas reais**.

O finding permanece aberto como problema de UX/demo enganosa no estado anônimo, não como incidente confirmado de segurança.

**Critério de correção:** visitante anônimo não deve receber uma superfície que pareça conter atividade privada de uma conta real. Se notificações demo forem preservadas em ambiente de demonstração, precisam estar explicitamente identificadas e não confundíveis com dados pessoais reais.

---

## 4. Busca global

### Classificação: `MOCK-DEMO`

A busca global `/buscar` não consulta o catálogo público real.

Evidência observada:

- pesquisa por `acompanhamento`, termo existente no produto público real `Serviço de acompanhamento — Demonstração`, retornou zero;
- pesquisa por `jogo` retornou produtos legados/mock como `Conta Steam com 100+ jogos AAA`, `LIT Gold — Moeda virtual do jogo` e `Cyberpunk 2077 — Chave Steam Original`.

A auditoria de `src/services/searchService.ts` confirma que o serviço se declara explicitamente `camada mockada de busca global` e usa `productService.list()`/dados legados.

### Estado de escopo

Busca real permanece fora do caminho crítico atual/feature freeze, salvo reabertura explícita de escopo.

Ela deve ser entregue no handoff claramente como `MOCK-DEMO`, nunca como capability real concluída.

---

## 5. Termo de busca persistindo fora de `/buscar`

### `QA-BROWSER-005`

- **Classificação:** `REAL-BUG` / UX.
- **Estado:** `OPEN`.
- **Impacto:** `NON_BLOCKER`.

Após pesquisar, por exemplo, `jogo`, e voltar para a Home/categoria, o texto continua no campo de busca da Navbar mesmo que a página atual não represente mais aquele resultado.

### Causa confirmada no frontend

A Navbar mantém `searchQuery` como estado local e não o reconcilia/limpa quando a rota deixa `/buscar`.

### Critério de correção

Definir comportamento coerente entre rota e campo de busca. Exemplos aceitáveis:

- refletir `q` apenas quando a rota é `/buscar`;
- limpar o campo ao sair da busca;
- ou manter o termo somente se houver decisão explícita de UX e indicação clara.

---

## 6. Fronteiras anônimas

### `REAL-TESTED`

Foram validados:

- `/mensagens` deslogado exibe gate de autenticação (`Entre para acessar suas mensagens`), sem expor conversas reais;
- `/carrinho` deslogado informa que é necessário entrar para acessar carrinhos reais;
- `Entrar` abre `/login`;
- `Criar conta` abre `/cadastro`;
- produto público deslogado apresenta `Entrar para comprar` em vez de mutar carrinho anonimamente.

### Favoritos

A superfície real do catálogo não possui favorito funcional.

O coração existente nos cards legados/mock é apenas visual e a área `/favoritos` usa `accountService`, que se declara camada mockada da conta.

**Classificação atual:** `MOCK-DEMO / NOT-IMPLEMENTED` para favoritos reais.

---

## 7. Produto público real — comportamento técnico

### `REAL-TESTED`

Produto representativo:

`/produto/demo-servico-acompanhamento`

A página real mostrou corretamente:

- breadcrumb;
- imagem pública assinada;
- categoria/subcategoria;
- título;
- preço;
- tipo do produto;
- modelo;
- estoque ou `Não aplicável`;
- `deliveryMode` como `Entrega manual`/`Entrega automática`;
- painel de compra;
- seller/loja básica;
- descrição;
- service details quando aplicável;
- `Prazo estimado de entrega` para serviço quando informado.

### Correção de interpretação importante

Dois elementos inicialmente percebidos como ausentes **existem tecnicamente**, porém com apresentação comercial fraca:

1. modo de entrega (`MANUAL`/`AUTOMATIC`);
2. prazo estimado de entrega (`estimatedDelivery`) para serviços.

O problema aqui é principalmente de apresentação/UX, não ausência absoluta de dado.

---

## 8. Qualidade comercial do anúncio real

### `QA-BROWSER-006`

- **Classificação:** lacuna de UX/conversão do catálogo real.
- **Estado:** `OPEN`.
- **Impacto:** `NON_BLOCKER` para o gate atual.

O card/página real é funcional, mas perdeu sinais comerciais/trust que o protótipo/mock apresentava.

### Ausentes hoje na superfície pública real

- favorito real;
- avaliação média;
- quantidade de avaliações;
- quantidade de vendas;
- selo público de vendedor verificado;
- reputação/confiança do seller;
- badge comercial forte para entrega manual/automática;
- promoção/desconto/preço anterior;
- compartilhar;
- denunciar anúncio;
- produtos relacionados;
- perguntas ao vendedor;
- perfil da loja mais completo;
- navegação clicável para a página da loja.

### `Sobre a loja`

`LIT Demo Store` é atualmente texto simples, não link para uma storefront/profile.

### Regra de integridade comercial

Não é aceitável copiar para o catálogo real números/sinais fictícios apenas para reproduzir o visual do mock.

Exemplos:

- `4,9 estrelas` precisa vir de avaliações reais;
- `1,9 mil vendas` precisa ser derivado de pedidos reais válidos;
- `Verificado` precisa refletir estado/critério real de Seller;
- `% confiança` precisa ter regra objetiva e auditável;
- `-60%` precisa vir de preço/promocional real, não de decoração.

### Direção de produto

A meta de handoff deve ser manter o nível de clareza e conversão visual do protótipo **sem sacrificar autoridade dos dados**.

---

## 9. Proveniência dos dados exibidos no anúncio

Regra registrada para a futura auditoria Seller/Admin:

> Para cada informação exibida publicamente, validar quem a fornece, onde é armazenada, quem pode alterá-la e qual autoridade a publica.

### Informações que podem/deveriam ser alimentadas pelo Seller quando aplicável

Já há fundação real no listing wizard/backend para:

- categoria;
- subcategoria;
- tipo de produto;
- modelo (`NORMAL`, `DYNAMIC`, `SERVICE`);
- título;
- descrição;
- preço;
- estoque;
- modo de entrega (`MANUAL`/`AUTOMATIC`);
- variantes;
- título/descrição do serviço;
- tipo de preço de serviço (`FIXED`/`QUOTE`);
- preço-base do serviço;
- prazo estimado de entrega;
- requisitos para o Buyer;
- notas do serviço;
- atributos dinâmicos da taxonomia;
- dados específicos de conta quando o produto for conta;
- promoção/plano solicitados, conforme modelo atual;
- auto message/notificações conforme suporte atual.

### Informações que **não** devem ser digitadas livremente pelo Seller

Devem ser derivadas do sistema/autoridades reais:

- média de avaliações;
- quantidade de avaliações;
- quantidade vendida;
- seller verificado;
- reputação;
- trust score;
- número de pedidos concluídos;
- histórico de disputas, se algum dia exposto;
- selo `Mais vendido`;
- ranking/relevância.

### Ações pertencentes ao Buyer/UI, não ao formulário do Seller

- favoritar;
- compartilhar;
- denunciar;
- perguntar/interagir;
- abrir mediação quando futuramente autorizado;
- avaliar depois de um evento elegível.

### Recursos que exigem decisão/contrato próprio

- desconto/preço anterior/promoção real;
- produtos relacionados;
- reputação/trust score;
- storefront pública completa;
- perguntas e respostas;
- reports/denúncia pública;
- favoritos reais;
- avaliações reais.

A auditoria de Seller deverá confirmar se todo campo que **deve** ser controlado pelo Seller existe no fluxo de criar/editar anúncio, valida, persiste e publica corretamente.

---

## 10. Intenção de compra perdida durante login

### `QA-BROWSER-007`

- **Classificação:** `REAL-BUG` / conversão Buyer.
- **Estado:** `OPEN`.
- **Impacto:** `NON_BLOCKER` no gate atual, porém importante para conversão.

### Evidência

Fluxo exercitado:

`Produto real → Entrar para comprar → /login → autenticar`

Resultado atual:

- o produto não é preservado no contexto;
- após login o usuário é enviado para `/`;
- o item não vai para carrinho;
- a intenção original de compra é perdida.

### Causa confirmada

`PublicProductPurchasePanel` usa link simples para `/login`, sem `returnTo`/intenção de compra.

A rota de login, ao concluir autenticação, executa navegação direta para `/`.

### Critério de correção a decidir

A experiência correta deve preservar a intenção do usuário. Alternativas a decidir antes de implementar:

1. `Produto → Login → retorna ao mesmo produto`, mantendo contexto e permitindo adicionar;
2. `Produto → Login → adiciona após confirmação explícita → Carrinho/Revisão`;
3. outro fluxo equivalente documentado.

Evitar auto-adicionar silenciosamente sem decisão de produto e sem proteção contra replay/duplicação.

---

## 11. Produtos dinâmicos / variantes

### `REAL-TESTED`

Produto representativo:

`/produto/demo-licenca-digital`

O modelo `DYNAMIC` funcionou como esperado:

- variantes `Mensal` e `Anual` aparecem;
- cada opção informa preço e estoque;
- é possível selecionar a variante;
- seleção é visualmente refletida;
- o botão `Adicionar ao carrinho` depende da seleção quando autenticado.

A implementação real mantém `selectedVariantId` e envia `productVariantId` ao carrinho.

---

## 12. Formatos do serviço

### `QA-BROWSER-008`

- **Classificação:** `DECISION-REQUIRED` / UX funcional.
- **Estado:** `OPEN` até decisão.
- **Impacto:** `NON_BLOCKER`.

Em produto `SERVICE`, a seção `Formatos do serviço` pode mostrar cards como:

`Sessão — R$ 79,90 — Estoque 1`

Esses cards são informativos; não são selecionáveis.

O código os renderiza como `<article>` sem click/selection.

### Diferença importante

- variantes de produto `DYNAMIC` são selecionáveis no painel de compra;
- variantes exibidas dentro de `SERVICE` são apenas informativas.

### Decisão necessária

Definir se serviços podem realmente possuir formatos/pacotes compráveis (ex.: sessão, pacote, duração, mensalidade).

Se sim, o contrato correto deve determinar:

- como o Seller cria esses formatos;
- como preço/estoque são vinculados;
- como o Buyer seleciona;
- qual variant/id entra no carrinho;
- como checkout/snapshot preservam a opção escolhida.

Não transformar os cards em botões apenas visualmente sem completar o contrato de compra.

---

## 13. Matriz consolidada do Bloco Público

### `REAL-TESTED`

- Home básica;
- catálogo público real;
- anúncios recentes reais;
- categoria real;
- subcategoria;
- filtro de tipo;
- ordenação;
- empty state de categoria sem anúncio;
- categoria inexistente segura;
- produto real;
- produto inexistente seguro;
- dropdown de categorias real;
- página de produto real;
- delivery mode real;
- prazo estimado de serviço real;
- variante dinâmica selecionável;
- auth gate de mensagens anônimo;
- auth gate de carrinho anônimo;
- rotas de login e cadastro acessíveis.

### `MOCK-DEMO`

- notificações;
- busca global;
- quatro cards do Hero;
- favoritos/área de conta legada relacionada a favoritos.

### `REAL-BUG` / findings abertos

- `QA-BROWSER-002` — CTA/cards do Hero sem navegação útil;
- `QA-BROWSER-005` — termo da busca persiste na Navbar após sair de `/buscar`;
- `QA-BROWSER-006` — catálogo real carece de sinais comerciais/trust e storefront mais completa;
- `QA-BROWSER-007` — intenção de compra se perde após login.

### `DECISION-REQUIRED`

- `QA-BROWSER-008` — formatos de serviço informativos versus opções realmente compráveis.

### Fora do bloco, mas já conhecidos no ledger

- `QA-BROWSER-003` — tela de pagamento stale após FAKE_ALPHA;
- `QA-BROWSER-004` — erro/replay histórico precisa reprodução limpa;
- `FUTURE-CHAT-001`;
- `FUTURE-MEDIATION-001`.

---

## 14. O que deve ser corrigido versus apenas documentado

Este relatório **não autoriza automaticamente implementação**. A ordem continua sendo decisão explícita → PR estreita → CI → browser QA → merge autorizado.

### Candidatos prováveis a correção de baixo risco após triagem

- limpar/sincronizar termo de busca ao sair da rota de busca (`QA-BROWSER-005`);
- preservar `returnTo`/intenção de compra no login (`QA-BROWSER-007`), desde que o comportamento desejado seja definido;
- neutralizar notificações demo no estado anônimo (`QA-BROWSER-001`), se aprovado;
- corrigir destino do CTA do Hero (`QA-BROWSER-002`), se Home for explicitamente reaberta para essa mudança estreita.

### Itens que provavelmente exigem escopo funcional maior ou decisão de produto

- busca global real;
- favoritos reais;
- avaliações/reviews;
- reputação/trust score;
- vendas/contadores públicos;
- storefront completa;
- perguntas e respostas;
- denúncias/reports;
- recomendações/relacionados;
- promoções/descontos reais;
- formatos compráveis de serviço.

Esses itens não devem ser implementados como “enfeite” durante feature freeze.

---

## 15. Gate para o próximo bloco

O próximo bloco definido pelo roteiro é:

**Bloco 2 — Autenticação e sessão**

Escopo esperado quando iniciado:

- login válido;
- login inválido;
- logout;
- refresh/sessão;
- cookies/token boundary;
- recuperação de senha;
- cadastro real e seus estados;
- verificação de e-mail quando aplicável;
- device approval/2FA quando acionável no rehearsal;
- redirects e preservação segura de contexto;
- acessos anônimos e autenticados;
- classificação de qualquer superfície mockada/legada de conta.

**Regra:** não iniciar o Bloco 2 até este Bloco 1 estar persistido/revisado no repositório conforme governança do projeto.
