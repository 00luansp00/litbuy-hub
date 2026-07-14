# LIT Buy — Documento Mestre de Regras do Back-end

**Versão:** 2.0 — Pós-auditoria estática do repositório  
**Data:** 13 de julho de 2026  
**Status:** Fonte canônica para o Codex; regras consolidadas e stack técnica congelada para a fundação do back-end  
**Finalidade:** servir como fonte de verdade obrigatória para o Codex, modelagem do banco, contratos da API, geração dos prompts de implementação e revisão profissional posterior.

---

## 0. Instruções obrigatórias para Codex e outros agentes

Antes de analisar, planejar ou alterar qualquer arquivo deste repositório, o agente deve:

1. ler este documento integralmente;
2. tratá-lo como a **fonte canônica de regras de negócio e arquitetura** dentro do repositório;
3. ler `LIT_BUY_REPOSITORY_AUDIT_V1.md` para conhecer o estado real do front-end;
4. usar os demais documentos e mocks somente como evidência do front, histórico ou inspiração;
5. nunca permitir que um documento antigo, valor mockado, texto de demonstração ou comentário substitua uma regra deste documento;
6. quando encontrar algo não resolvido aqui, registrar a divergência e pedir decisão — não escolher silenciosamente a regra antiga;
7. não alterar código fora do escopo do prompt;
8. não implementar pagamento real, saque real ou produção sem autorização e revisão profissional.

### 0.1 Regra para prompts futuros

Todo prompt enviado ao Codex deverá começar, em essência, com esta instrução:

> Leia integralmente `LIT_BUY_BACKEND_MASTER_SPEC_V2.md` e `LIT_BUY_REPOSITORY_AUDIT_V1.md` antes de executar. O Documento Mestre V2 prevalece sobre qualquer outro Markdown, mock, service, componente, texto visual ou planejamento antigo. Em caso de conflito ainda não resolvido, interrompa a decisão afetada e apresente o conflito.

O Codex **não lê este arquivo por obrigação automática apenas por ele existir**. A referência explícita acima será repetida em todos os prompts de trabalho.

### 0.2 Documentos antigos mantidos na raiz

Por decisão do proprietário, nenhum documento existente precisa ser apagado, movido ou colocado em pasta histórica. Eles permanecerão na raiz.

Os arquivos abaixo são **referência histórica ou planejamento anterior**. Podem ser consultados para entender o front, mas não podem definir a arquitetura ou regra atual quando divergirem deste Documento Mestre:

- `API_CONTRACTS_DRAFT.md`;
- `BACKEND_ROADMAP.md`;
- `DATABASE_IMPLEMENTATION_NOTES.md`;
- `DATABASE_SCHEMA.md`;
- `ENTITY_RELATIONSHIP.md`;
- `PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md`;
- `SUPABASE_RLS_PLAN.md`;
- `SECURITY_IMPLEMENTATION_PLAN.md`;
- seções futuras de back-end em `MVP_STATUS.md`, `PROJECT_RULES.md`, `MARKETPLACE_RULES.md`, `ORDER_LIFECYCLE.md`, `DISPUTE_FLOW.md`, `WALLET_AND_ESCROW_RULES.md`, `MESSAGING_RULES.md`, `SECURITY_NOTES.md` e `DEVELOPER_HANDOFF.md`.

Os mapas do estado atual do front — como `ROUTES_MAP.md`, `SERVICES_MAP.md`, `PROVIDERS_MAP.md`, `MOCKS_INVENTORY.md`, `ROUTE_AUDIT.md`, `QA_CHECKLIST.md` e `PRE_HANDOFF_AUDIT.md` — continuam úteis para inventário, porém também não prevalecem sobre este documento.

### 0.3 Resultado confirmado da auditoria

A leitura estática integral confirmou:

- 404 arquivos no ZIP;
- 402 arquivos de texto/configuração legíveis e inventariados;
- 314 arquivos TSX e 43 arquivos TS;
- 35 documentos Markdown;
- 65 arquivos de rota, além da árvore de rotas gerada;
- 29 services mockados;
- três providers globais;
- 261 declarações exportadas de tipos/interfaces/enums em `src/types/index.ts`;
- ausência de back-end de domínio, banco, persistência, autenticação real, gateway real ou API própria;
- presença de SSR/entrada do TanStack Start, mas nenhuma base de API de marketplace que justifique concentrar o back-end financeiro dentro do front.

### 0.4 Stack técnica congelada para a fundação

A auditoria confirmou que o projeto é React 19 + TypeScript + TanStack Start/Router + Vite. Não é Laravel.

A fundação do back-end deverá usar:

- NestJS + TypeScript;
- PostgreSQL;
- Prisma;
- Redis + BullMQ;
- REST em `/api/v1` + OpenAPI;
- WebSocket para chat e notificações;
- storage compatível com S3;
- Docker;
- monólito modular;
- pasta `backend/` na raiz, sem reorganizar ou reescrever o front existente nesta primeira fase.

O TanStack Start continuará responsável pelo front/SSR. Regras de domínio, autenticação real, autorização, financeiro e persistência ficarão na API NestJS.

## 1. Objetivo e limites deste documento

O LIT Buy será um marketplace brasileiro de produtos e serviços exclusivamente digitais. O front-end já existe, está amplamente mockado e documentado, e deverá ser conectado progressivamente a um back-end real.

Este documento consolida:

- regras comerciais;
- regras de conta e autenticação;
- anúncios e planos;
- pedidos, pagamentos e liberação de valores;
- chat, intervenção e reembolsos;
- carteira, saques e ledger;
- programa LIT Points;
- administração, segurança e auditoria;
- limites do que poderá ser implementado por IA;
- pontos que deverão ser confirmados por leitura do repositório.

Este documento **não autoriza operação financeira em produção**. Pagamentos reais, custódia, saque, chargeback, KYC, segurança avançada e conformidade jurídica deverão ser revisados e homologados por profissionais antes do lançamento público.

---

## 2. Hierarquia das fontes de verdade

Quando duas regras entrarem em conflito, será aplicada a seguinte prioridade:

1. atualização explícita do proprietário presente no prompt atual do Codex;
2. este Documento Mestre V2, que já incorpora as decisões e prints prioritários anteriores;
3. `LIT_BUY_REPOSITORY_AUDIT_V1.md`;
4. evidência estrutural do código do front-end;
5. documentação existente no repositório;
6. comportamento, textos, mocks, dados demonstrativos e valores ilustrativos;
7. padrão técnico recomendado.

Uma instrução de tarefa não deve substituir regra de negócio por acidente. Somente será considerada atualização do proprietário quando o prompt declarar expressamente que está alterando uma decisão anterior.

A IA não deverá resolver silenciosamente contradições. Toda divergência encontrada durante a auditoria deverá ser registrada com:

- regra A;
- regra B;
- arquivos de origem;
- impacto;
- recomendação;
- situação final.

### 2.1 Regras expressamente substituídas

As seguintes definições anteriores não devem ser usadas:

- a comissão única de 7% foi substituída pelas tarifas oficiais dos planos Prata, Ouro e Diamante;
- os nomes Bronze, Prata e Ouro foram substituídos por Prata, Ouro e Diamante;
- o reembolso sempre convertido em saldo sacável foi substituído pela política de reembolso conforme o meio de pagamento;
- o LIT Buy pagando imediatamente do próprio caixa uma disputa tardia foi substituído pelo modelo de recuperação da dívida do vendedor;
- a disputa com reembolso garantido por 30 dias após a liberação foi substituída pelo prazo de intervenção que termina na data de liberação; os 30 dias posteriores servem apenas para reclamação, investigação ou análise excepcional;
- o início do prazo de liberação condicionado à confirmação do comprador foi substituído pelo prazo contado conforme a regra da categoria a partir da aprovação do pagamento, com data exata informada no chat;
- LIT Points não podem ser combinados parcialmente com outra forma de pagamento.

---

## 3. Visão funcional do marketplace

### 3.1 Escopo

O LIT Buy aceitará exclusivamente produtos e serviços digitais, incluindo:

- contas de jogos;
- moedas virtuais;
- gold, ouro e recursos de jogos;
- itens digitais;
- códigos e gift cards;
- cursos, guias e e-books;
- serviços digitais;
- powerlevel;
- entrega automática de códigos ou dados;
- produtos com validade determinada, como acesso por 30, 60 ou 90 dias.

Não haverá cobrança recorrente automática no lançamento. A arquitetura poderá ser preparada para recorrência futura, mas ela não faz parte do MVP funcional do back-end.

### 3.2 Mercado inicial

- país: Brasil;
- idioma: português;
- moeda fiduciária: real brasileiro;
- moeda de recompensa: LIT Points;
- operação pública somente por CNPJ;
- usuários somente maiores de 18 anos;
- pessoas físicas e jurídicas poderão vender.

### 3.3 Itens proibidos

Mesmo sem uma categoria comercial específica de “produtos proibidos”, a plataforma deverá impedir produtos ou serviços ilegais, fraudulentos ou incompatíveis com o gateway. A política mínima deverá proibir:

- dados roubados;
- documentos pessoais de terceiros;
- meios de pagamento;
- malware e ferramentas de invasão;
- produtos obtidos por fraude;
- conteúdo ilícito;
- violação manifesta de propriedade intelectual;
- anúncios destinados a burlar sistemas de segurança;
- atividades vedadas pelo parceiro financeiro;
- venda de contas ou ativos sem autorização ou posse legítima.

A lista de motivos de moderação poderá ser administrável, mas proibições legais e estruturais não poderão ser desativadas por um operador comum.

---

## 4. Arquitetura técnica proposta

### 4.1 Decisão provisória

A arquitetura-alvo, caso a auditoria confirme que o repositório é um front-end React/TypeScript/Vite sem back-end Laravel funcional, será:

- **Back-end:** NestJS + TypeScript;
- **Banco:** PostgreSQL;
- **ORM:** Prisma;
- **API:** REST versionada em `/api/v1`;
- **Documentação:** OpenAPI;
- **Filas e cache:** Redis + BullMQ;
- **Tempo real:** WebSocket para chat e notificações;
- **Arquivos:** armazenamento compatível com S3;
- **Execução:** Docker;
- **Arquitetura:** monólito modular;
- **Código:** GitHub com branches e pull requests;
- **Ambientes:** desenvolvimento, homologação e produção separados.

### 4.2 Trava de decisão técnica

A linguagem do back-end só será congelada depois da auditoria:

- se existir apenas front-end em React/TypeScript, adotar NestJS;
- se existir uma base Laravel real, organizada e reaproveitável, comparar o custo de manter Laravel com o custo de criar NestJS;
- não iniciar implementação até registrar a decisão em `TECH_STACK_DECISION.md`;
- não escolher tecnologia apenas pelo nome informado verbalmente; usar o conteúdo real do repositório.

### 4.3 Independência de plataforma

- o front-end nunca acessará diretamente o banco;
- o front-end chamará exclusivamente a API do LIT Buy;
- o banco será PostgreSQL padrão;
- não haverá dependência obrigatória de Supabase Auth, Edge Functions, API automática ou regras críticas espalhadas em RLS;
- Supabase poderá, no máximo, ser considerado como hospedagem de PostgreSQL;
- migrations, seeds e contratos permanecerão no repositório;
- gateway, armazenamento e e-mail deverão usar adaptadores substituíveis.

Fluxo:

```text
Front-end
   ↓
API LIT Buy
   ↓
Módulos de negócio
   ↓
PostgreSQL / Redis / Storage / Gateway
```

---

## 5. Conta, identidade e perfil

### 5.1 Conta única

Uma única conta poderá atuar como compradora e vendedora.

Não existirão contas separadas de comprador e vendedor. O perfil de vendedor será uma extensão da conta principal.

Estrutura conceitual:

```text
User
├── dados de autenticação
├── perfil pessoal
├── perfil público
├── preferências
├── dispositivos e sessões
├── carteira
├── perfil de vendedor opcional
├── histórico de compras
├── histórico de vendas
└── reputações separadas
```

### 5.2 Cadastro obrigatório

- e-mail;
- senha;
- telefone;
- CPF;
- nome completo;
- data de nascimento;
- aceite dos termos;
- aceite da política de privacidade;
- verificação de e-mail;
- verificação de telefone.

Entradas permitidas:

- e-mail e senha;
- Google;
- Apple.

Mesmo usando login social, CPF, telefone, nome e data de nascimento deverão ser preenchidos e validados.

### 5.3 Unicidade

- um CPF por conta ativa;
- um telefone por conta ativa;
- um e-mail por conta ativa;
- uma pessoa não poderá manter contas múltiplas;
- relações suspeitas entre contas poderão ser analisadas por dispositivo, telefone, CPF, chave Pix, comportamento e outros sinais de risco;
- correspondências não provocarão banimento automático sem análise.

### 5.4 E-mail

- o usuário não poderá alterar o e-mail diretamente pelo perfil;
- alteração excepcional será feita pelo suporte;
- exigirá verificação reforçada;
- encerrará sessões;
- notificará endereços antigo e novo;
- bloqueará temporariamente saques;
- ficará integralmente auditada.

### 5.5 Telefone

A alteração de telefone exigirá:

- senha atual;
- código do telefone antigo, quando possível;
- código do telefone novo;
- confirmação por e-mail;
- auditoria;
- bloqueio de saques por 48 horas.

Sem acesso ao telefone antigo, será necessário atendimento e validação adicional.

### 5.6 Senha e tentativas

- cinco tentativas consecutivas;
- bloqueio inicial de 15 minutos;
- aumento progressivo após reincidência;
- CAPTCHA após comportamento suspeito;
- aviso de tentativa de acesso;
- proteção contra enumeração de e-mails;
- redefinição por fluxo seguro.

### 5.7 Novo dispositivo

- um novo dispositivo precisará ser aprovado por e-mail;
- o usuário poderá visualizar dispositivos e sessões;
- poderá encerrar sessões remotamente;
- eventos de dispositivo serão auditados;
- recuperação alternativa poderá usar SMS e suporte.

### 5.8 Autenticação em duas etapas

- opcional para comprador comum;
- obrigatória para administradores;
- obrigatória para vendedor antes do primeiro saque;
- obrigatória para ações financeiras de risco;
- inicialmente por e-mail e SMS;
- arquitetura preparada para aplicativo autenticador;
- método final deverá ser revisado pelo profissional de segurança.

### 5.9 Exclusão

Fluxo:

```text
Solicitação
→ período reversível de 90 dias
→ cancelamento possível
→ exclusão ou anonimização final
```

Durante os 90 dias:

- não será possível criar nova conta com os mesmos dados;
- pedidos, saques e disputas deverão ser resolvidos;
- conta com dívida ou obrigação pendente não será totalmente encerrada.

Após o prazo:

- perfil público será removido;
- dados não necessários serão apagados ou anonimizados;
- registros financeiros, pedidos, disputas, auditoria e evidências necessárias serão preservados;
- reutilização de e-mail poderá ser permitida;
- prevenção de fraude poderá manter identificadores protegidos e minimizados.

### 5.10 Perfil público

Dados públicos possíveis:

- nickname;
- nome da loja;
- foto;
- data de criação;
- quantidade de compras;
- quantidade de vendas;
- reputação como comprador;
- reputação como vendedor;
- selo de verificação;
- nível;
- pedidos concluídos;
- tempo médio de entrega;
- percentual de avaliações positivas.

Não serão públicos:

- nome civil;
- CPF ou CNPJ;
- telefone;
- e-mail;
- produtos comprados;
- valores gastos;
- saldo;
- dados financeiros.

Nickname e nome de loja:

- devem ser únicos;
- podem ser alterados a cada 180 dias;
- alterações ficam registradas;
- nomes ofensivos, fraudulentos ou de marcas protegidas podem ser recusados.

---

## 6. Perfil de vendedor e verificação

### 6.1 Ativação

Qualquer usuário elegível poderá ativar o perfil de vendedor.

Não haverá:

- limite fixo de anúncios;
- limite inicial fixo de faturamento;
- convite obrigatório.

Haverá:

- detecção de duplicatas;
- controle de spam;
- limites dinâmicos por risco;
- moderação de categorias sensíveis;
- possibilidade de pausar vendas sem bloquear compras.

### 6.2 Verificação

O vendedor poderá criar anúncios e vender antes da verificação completa, mas não poderá sacar.

Antes do primeiro saque, deverá concluir:

- documento;
- selfie ou prova de vida;
- validação de CPF ou CNPJ;
- validação de telefone e e-mail;
- titularidade da chave Pix;
- requisitos do parceiro financeiro.

Depois da aprovação, haverá espera adicional de três dias antes do primeiro saque.

### 6.3 Loja

- uma loja por conta no lançamento;
- nome próprio da loja;
- catálogo com múltiplos anúncios;
- equipe da loja será implementada no back-end, mas permanecerá desativada inicialmente.

Papéis previstos para equipe:

- proprietário;
- gerente;
- catálogo;
- vendas;
- atendimento;
- financeiro.

O acesso financeiro nunca será concedido automaticamente.

---

## 7. Categorias, anúncios e estoque

### 7.1 Categorias

- criadas e administradas pela equipe autorizada;
- podem ter subcategorias;
- podem possuir campos próprios;
- podem determinar prazo de liberação;
- podem determinar prazo de entrega;
- podem determinar risco e moderação;
- alterações não afetam retroativamente pedidos existentes.

### 7.2 Tipos de anúncio

A modelagem deverá suportar:

- estoque convencional;
- variações;
- unidades digitais;
- código de entrega automática;
- conta digital;
- serviço manual;
- produto com validade;
- conteúdo ou arquivo digital;
- estoque ilimitado quando aplicável.

### 7.3 Regras gerais

- o vendedor escolhe categoria e subcategoria;
- anúncio contém título, descrição, preço, estoque, campos específicos, capa e galeria;
- links e contatos externos são proibidos;
- anúncios duplicados ou muito semelhantes devem ser sinalizados;
- anúncio vendido não pode ser removido do histórico;
- o vendedor pode pausar ou arquivar;
- alterações críticas podem exigir nova análise;
- pedidos preservam um snapshot do anúncio comprado;
- segredos e credenciais não ficam em campos públicos.

### 7.4 Moderação

A auditoria deverá confirmar no front:

- quais anúncios exigem aprovação;
- quais campos alterados provocam reanálise;
- quais filtros e motivos já existem;
- quais regras são apenas visuais.

Como padrão:

- primeiro anúncio pode ser analisado;
- anúncios de alto risco podem exigir análise;
- anúncios comuns podem ser publicados após validações automáticas;
- denúncias e padrões suspeitos podem suspender temporariamente a publicação.

---

## 8. Planos e tarifas do anúncio

Os planos oficiais iniciais são:

### 8.1 Prata — 9,99%

- Anúncio Prata;
- posicionamento padrão;
- tarifa total inicial de 9,99% quando ocorrer venda.

### 8.2 Ouro — 11,99%

- Anúncio Ouro;
- destaque na página principal;
- maior visibilidade;
- tarifa total inicial de 11,99%.

### 8.3 Diamante — 12,99%

- Anúncio Diamante;
- destaque na página principal;
- destaque nas pesquisas;
- máxima visibilidade;
- tarifa total inicial de 12,99%.

### 8.4 Regras das tarifas

- não há cobrança apenas para publicar;
- a tarifa é cobrada quando ocorre venda;
- o plano e percentual são registrados no subpedido;
- mudanças futuras não afetam vendas antigas;
- o administrador pode alterar valores e benefícios para novas contratações;
- toda alteração deve ter vigência e auditoria;
- valores encontrados no front devem ser classificados como oficiais ou ilustrativos.

### 8.5 LIT MAX

LIT MAX é um adicional opcional e independente do plano Prata, Ouro ou Diamante.

Modelo:

```text
Plano obrigatório:
- Prata
- Ouro
- Diamante

Adicional opcional:
- LIT MAX
```

Os benefícios exatos, valores, duração e textos deverão ser extraídos do front. Está confirmado que o LIT MAX pode conceder LIT Points ao vendedor quando houver venda e avaliação positiva.

### 8.6 Plano adicional do comprador

O comprador poderá selecionar um adicional no checkout ou pedido, conforme o fluxo já definido no front.

Benefícios conhecidos:

- maior ganho de LIT Points;
- possibilidade de abrir intervenção mais rapidamente;
- outros benefícios existentes no front.

A auditoria deverá extrair:

- preço;
- duração;
- benefícios;
- limitações;
- momento da contratação;
- regra de reembolso;
- impacto sobre cada subpedido.

---

## 9. Carrinho, checkout e subpedidos

### 9.1 Multi-vendedor

Um único checkout poderá conter produtos de vários vendedores.

Modelo:

```text
Checkout / Compra principal
├── Subpedido do vendedor A
│   ├── itens
│   ├── tarifa
│   ├── chat
│   ├── entrega
│   ├── intervenção
│   └── liberação
└── Subpedido do vendedor B
    ├── itens
    ├── tarifa
    ├── chat
    ├── entrega
    ├── intervenção
    └── liberação
```

Cada subpedido terá:

- vendedor;
- itens;
- valores;
- tarifa;
- prazo;
- chat;
- entrega;
- avaliação;
- intervenção;
- saldo e lançamento próprios.

### 9.2 Snapshot

No momento da compra, o sistema salvará:

- título;
- descrição relevante;
- variação;
- quantidade;
- preço;
- plano;
- tarifa;
- prazo de entrega;
- prazo de liberação;
- benefícios;
- regras da categoria;
- cotação de pontos;
- políticas aplicáveis.

Mudanças futuras no anúncio ou painel não alteram o pedido.

### 9.3 Estoque e concorrência

- estoque deve ser reservado durante o pagamento;
- reserva tem prazo configurável;
- ao expirar, estoque retorna;
- última unidade exige transação e bloqueio no banco;
- webhooks duplicados não podem duplicar pedido ou consumo de estoque;
- códigos revelados não retornam automaticamente ao estoque;
- devolução de conta ou credencial exige análise.

---

## 10. Pagamentos

### 10.1 Meios ativos no lançamento

- Pix;
- cartão;
- saldo LIT Buy;
- LIT Points.

Boleto poderá ser preparado, mas permanecer desativado.

Criptomoeda não faz parte do lançamento, mesmo que apareça em material de referência.

### 10.2 Parcelamento

- quantidade máxima configurável;
- juros normalmente pagos pelo comprador;
- campanhas podem subsidiar juros;
- condições ficam registradas na compra;
- alterações não são retroativas.

### 10.3 Taxas do gateway

A responsabilidade depende do meio:

- Pix: custo pode ser absorvido pela tarifa ou descontado conforme configuração;
- cartão: custo pode ser descontado do vendedor;
- parcelamento: juros normalmente do comprador;
- campanhas podem alterar a distribuição;
- pedido deve exibir composição dos valores;
- configurações devem ser versionadas.

### 10.4 Gateway

O fornecedor será escolhido após comparação específica de:

- Pix;
- cartão;
- split;
- subcontas;
- KYC;
- saldo;
- saques;
- estorno;
- reembolso;
- chargeback;
- webhooks;
- sandbox;
- documentação;
- custo;
- suporte no Brasil;
- portabilidade.

A integração usará uma interface própria, evitando acoplamento:

```text
PaymentProvider
- createPayment
- getPayment
- refund
- createSellerAccount
- verifyIdentity
- requestPayout
- getPayout
- processWebhook
```

### 10.5 Webhooks

- assinatura obrigatória;
- idempotência;
- registro do payload;
- proteção contra repetição;
- reprocessamento seguro;
- fila;
- conciliação;
- alertas para eventos inválidos;
- nenhuma aprovação manual comum de pagamento.

---

## 11. Prazo de liberação, entrega e proteção

### 11.1 Início da contagem

O prazo padrão de liberação é calculado quando o pagamento é aprovado.

A data e o horário exatos deverão ser informados automaticamente no chat.

### 11.2 Prazos oficiais iniciais

| Categoria | Prazo inicial |
|---|---:|
| Moedas virtuais, gold, ouro e itens | 4 dias |
| Contas com e-mail não verificado | 4 dias |
| Cursos, guias e e-books | 4 dias |
| Venda de contas, powerlevel e serviços | 7 dias |

Algumas categorias e subcategorias poderão ter prazo:

- menor;
- maior;
- especial;
- definido pelo administrador.

O prazo aplicado fica congelado no subpedido.

### 11.3 Entrega

- vendedor entrega por área própria;
- dados sensíveis não devem depender apenas do chat;
- sistema registra entrega;
- sistema registra visualização pelo comprador;
- arquivos e segredos usam acesso privado;
- dados de entrega podem ser criptografados;
- alteração da entrega gera nova versão, sem apagar a anterior;
- entrega automática ocorre após pagamento aprovado e validações necessárias.

### 11.4 Conclusão automática

Se o comprador não notificar problema até a data-limite:

- a entrega é considerada concluída;
- o valor pode ser liberado;
- a garantia de entrega do LIT Buy termina;
- a reclamação posterior não gera reembolso automático.

### 11.5 Liberação acelerada

O prazo pode ser reduzido pela metade quando o comprador:

- marca o produto ou serviço como entregue;
- avalia positivamente o vendedor;
- não possui intervenção aberta.

Exemplos:

- quatro dias passam a dois dias;
- sete dias passam a três dias e doze horas.

A liberação acelerada:

- é registrada;
- pode ser desativada em categoria de risco;
- não apaga o prazo original;
- não ocorre com disputa aberta.

---

## 12. Chat do pedido

### 12.1 Abertura

O chat é aberto após a confirmação do pagamento.

Cada subpedido possui chat independente.

### 12.2 Finalidade

- comunicação entre comprador e vendedor;
- registro de instruções;
- mensagens automáticas;
- suporte à intervenção;
- preservação de evidências.

### 12.3 Contatos externos

Não será permitido enviar:

- telefone;
- e-mail;
- WhatsApp;
- Telegram;
- Discord;
- Instagram;
- links externos destinados a tirar a negociação da plataforma;
- outros identificadores de contato.

O sistema deverá:

- detectar padrões;
- impedir ou ocultar o envio;
- registrar a tentativa;
- aplicar advertências;
- permitir análise administrativa;
- aumentar a punição em reincidência.

### 12.4 Mensagens

Como padrão:

- mensagens de pedido não são apagadas definitivamente;
- podem ser ocultadas visualmente por moderação;
- o original permanece auditável;
- eventos do sistema são imutáveis;
- leitura e horário são registrados;
- anexos exigem controle de tipo, tamanho, autorização e segurança.

Os tipos exatos de mídia deverão ser confirmados pela auditoria do front.

### 12.5 Mensagem automática inicial

Após aprovação do pagamento, o chat mostrará:

- data e horário da aprovação;
- prazo de entrega;
- prazo de liberação;
- data e horário exatos em que o valor poderá ser liberado;
- prazo para pedir intervenção;
- orientação para testar antes de confirmar;
- aviso para abrir intervenção em caso de dúvida;
- informação de que depois da liberação não existe reembolso garantido;
- proibição de contato externo;
- link para regras da categoria.

Lembretes poderão ser enviados antes da liberação.

---

## 13. Intervenção, disputa e reclamação

### 13.1 Terminologia

O front pode usar “reclamação”, “intervenção”, “disputa” ou “reportar”. A auditoria deverá escolher um termo público consistente.

Internamente, o domínio poderá usar `dispute`.

### 13.2 Prazo com proteção financeira

O prazo para solicitar reembolso garantido pela política do LIT Buy termina na data de liberação do vendedor, mostrada no chat.

Ao abrir intervenção antes da liberação:

- o valor é bloqueado;
- a liberação é pausada;
- as partes podem apresentar informações;
- a moderação decide;
- nenhuma das partes pode sacar o valor bloqueado.

### 13.3 Reclamação posterior

Até 30 dias depois da liberação, poderá existir um canal para:

- denúncia;
- investigação de fraude;
- descumprimento de garantia do vendedor;
- registro de problema;
- análise excepcional;
- produção de evidências.

Esse prazo **não é uma extensão da garantia automática de reembolso**.

### 13.4 Decisões possíveis

- liberação integral ao vendedor;
- reembolso integral;
- reembolso parcial;
- divisão do valor;
- acordo entre as partes;
- encerramento sem efeito financeiro;
- punição separada do resultado financeiro.

Toda decisão exige justificativa.

### 13.5 Recurso

- um recurso;
- prazo inicial de 48 horas;
- configurável;
- analisado por moderador diferente;
- valores ainda existentes permanecem bloqueados;
- decisão e justificativa ficam auditadas.

### 13.6 Valor já sacado

Se, em situação excepcional posterior, for reconhecida dívida do vendedor e o dinheiro já tiver sido sacado:

- o LIT Buy não garante antecipação com recursos próprios;
- o vendedor recebe saldo negativo;
- vendas e créditos futuros amortizam a dívida;
- o comprador recebe conforme o valor for recuperado;
- o caso pode gerar suspensão, bloqueio de saque e outras sanções;
- chargeback segue análise própria.

---

## 14. Política de reembolso

### 14.1 Situações cobertas

O comprador poderá solicitar intervenção quando:

1. desistir antes de receber o produto;
2. exercer arrependimento sem utilizar ou comprometer a integridade do produto;
3. o vendedor não conseguir entregar;
4. o produto ou serviço divergir do anúncio;
5. ocorrer falta de estoque ou imprevisto equivalente;
6. o vendedor não responder;
7. ocorrer situação adicional prevista na categoria.

Para produto digital, a moderação deverá considerar se:

- código foi revelado;
- credencial foi visualizada;
- moeda ou item foi transferido;
- serviço começou;
- conteúdo foi baixado;
- produto pode retornar à condição original.

### 14.2 Forma do reembolso

| Meio original | Destino |
|---|---|
| Cartão | Estorno para o cartão |
| Pix | Conta de origem |
| Saldo LIT Buy | Saldo LIT Buy |
| LIT Points | LIT Points |
| Boleto, depósito ou transferência, caso ativados | Crédito em saldo, com possibilidade de retirada conforme regras |
| Criptomoeda, caso futuramente ativada | Carteira de origem por processo controlado |

### 14.3 Prazo

- reembolso autorizado pelo moderador;
- processamento interno em até 48 horas úteis;
- prazo da instituição financeira é adicional;
- todo reembolso é auditado;
- reembolso não gera nova recompensa.

### 14.4 Garantia do vendedor

O vendedor poderá anunciar garantia própria superior ao prazo do LIT Buy.

Essa garantia:

- é compromisso do vendedor;
- não mantém automaticamente o dinheiro bloqueado;
- não representa garantia financeira automática da plataforma;
- pode gerar análise e saldo negativo se descumprida e reconhecida;
- deve estar claramente distinguida da proteção do LIT Buy.

---

## 15. Carteira, ledger e saldos

### 15.1 Ledger

Toda movimentação financeira será registrada em ledger imutável.

Princípios:

- lançamentos não são apagados;
- correções geram movimentos compensatórios;
- cada lançamento tem origem;
- cada lançamento relaciona pedido, subpedido, saque ou ajuste;
- valores usam unidade monetária inteira, sem ponto flutuante;
- operações críticas usam transação no banco;
- idempotência obrigatória.

### 15.2 Estados de saldo

A carteira poderá exibir:

- pendente;
- em prazo de liberação;
- bloqueado por intervenção;
- disponível;
- em saque;
- sacado;
- estornado;
- negativo.

### 15.3 Saldo negativo

Pode surgir por:

- disputa posterior reconhecida;
- chargeback;
- reembolso posterior;
- erro corrigido;
- ajuste administrativo.

Consequências:

- saques bloqueados;
- créditos futuros amortizam automaticamente;
- vendas podem ser restringidas;
- usuário mantém acesso ao extrato;
- dívida mostra origem;
- nenhum operador apaga a dívida sem movimento compensatório.

### 15.4 Ajustes administrativos

- até R$ 200: um administrador financeiro;
- de R$ 200 a R$ 1.000: 2FA e justificativa;
- acima de R$ 1.000: aprovação de duas pessoas;
- superadministrador também respeita dupla aprovação;
- limites devem ser configuráveis com histórico;
- produção poderá exigir limites mais conservadores.

---

## 16. Saques

### 16.1 Regras iniciais

- somente Pix no lançamento;
- chave Pix no mesmo CPF ou CNPJ verificado;
- mínimo inicial de R$ 20;
- limites diários e mensais configuráveis;
- taxa configurável;
- uma solicitação por dia;
- análise para valor alto ou risco;
- falha devolve o valor ao saldo disponível;
- todas as tentativas ficam registradas.

### 16.2 Bloqueios temporários

Alteração de:

- senha;
- telefone;
- 2FA;
- e-mail por suporte;
- chave Pix;
- documento;
- dispositivo de alto risco;

pode bloquear saques por, no mínimo, 48 horas.

### 16.3 Comprador sacando reembolso

Para retirar saldo de reembolso, o comprador deverá concluir:

- documento;
- selfie;
- CPF;
- telefone;
- e-mail;
- titularidade da chave Pix.

---

## 17. Chargeback e risco

A responsabilidade depende da causa:

- fraude ou problema do vendedor: vendedor;
- falha comprovada do LIT Buy: plataforma;
- fraude de pagamento: conforme análise e contrato do gateway;
- erro administrativo: responsável definido;
- situação ambígua: equipe de risco e financeiro.

O sistema deverá preservar:

- anúncio comprado;
- mensagens;
- entrega;
- visualização;
- avaliações;
- IP e dispositivo dentro da política de privacidade;
- webhooks;
- comprovantes;
- ações administrativas.

A estratégia de reserva, provisão e responsabilidade final será revisada antes da produção.

---

## 18. LIT Points

### 18.1 Conceito

LIT Points é o programa de recompensas e lealdade do LIT Buy.

Não é moeda fiduciária e não é sacável.

### 18.2 Cotação inicial

```text
R$ 1 em compra elegível = 1 LIT Point
100 LIT Points = R$ 1 para uso
```

Isso equivale a uma recompensa-base de 1%.

### 18.3 Ganho do comprador

- compra elegível gera um ponto por real;
- plano adicional pode aumentar o ganho;
- cupom ou campanha pode conceder pontos;
- eventos e ações de comunidade podem conceder pontos;
- pontos pendentes não podem ser usados;
- pedido cancelado ou reembolsado não gera pontos.

### 18.4 Ganho do vendedor com LIT MAX

- exige LIT MAX ativo no anúncio;
- exige avaliação positiva;
- vendedor recebe 50% dos pontos convencionais;
- exemplo: venda de R$ 10 gera 5 pontos;
- sem avaliação positiva, não há pontos;
- reembolso cancela pontos pendentes.

### 18.5 Liberação

- pontos acompanham a conclusão financeira do pedido;
- comprador que avalia pode receber conforme a regra do pedido;
- se comprador não avaliar, seus pontos são liberados automaticamente após 14 dias;
- vendedor com LIT MAX só recebe com avaliação positiva;
- auditoria deverá confirmar o marco exato dos 14 dias no front.

### 18.6 Expiração

- seis meses a partir da liberação;
- consumo dos que vencem primeiro;
- extrato por lote;
- ajustes preservam rastreabilidade;
- pontos devolvidos em reembolso preservam validade quando possível;
- se expirarem durante o pedido, poderá ser concedida janela adicional de 30 dias como padrão operacional.

### 18.7 Uso

- mínimo de 1.000 pontos por operação;
- 1.000 pontos equivalem inicialmente a R$ 10;
- compra com pontos deve ser paga 100% com pontos;
- não pode combinar pontos com Pix, cartão ou saldo;
- sem pontos suficientes, o método fica indisponível;
- vendedor recebe o valor integral em reais;
- LIT Buy financia a parte equivalente aos pontos;
- cotação do checkout fica congelada no pedido.

### 18.8 Reembolso

```text
Compra 100% em LIT Points
→ reembolso 100% em LIT Points
```

- não converte em dinheiro;
- não permite saque;
- não gera pontos adicionais;
- retorna ao extrato.

### 18.9 Antifraude de pontos

O sistema deverá detectar:

- compras entre contas relacionadas;
- autorreferência;
- avaliações combinadas;
- criação artificial de vendas;
- múltiplas contas;
- uso abusivo de cupom;
- movimentações circulares.

Pontos fraudulentos podem ser cancelados por lançamento compensatório, com justificativa e auditoria.

---

## 19. Avaliações e reputação

- comprador avalia vendedor;
- vendedor avalia comprador;
- reputações são separadas;
- somente pedidos elegíveis podem ser avaliados;
- avaliações podem afetar liberação acelerada e LIT Points;
- prazo inicial sugerido: 14 dias;
- avaliação removida por fraude não é apagada da auditoria;
- vendedor pode responder;
- moderação remove apenas por infração;
- manipulação gera punição;
- fórmula de reputação deve ser versionada.

A auditoria deverá confirmar:

- critérios;
- estrelas;
- comentários;
- edição;
- publicação simultânea ou diferida;
- campos já existentes no front.

---

## 20. Notificações e e-mails

### 20.1 Canais

- notificações internas;
- e-mail;
- SMS para segurança;
- WebSocket para tempo real;
- push poderá ser preparado futuramente.

### 20.2 Eventos de segurança obrigatórios

Não poderão ser desativados:

- novo dispositivo;
- alteração de senha;
- alteração de telefone;
- alteração excepcional de e-mail;
- ativação ou remoção de 2FA;
- alteração de chave Pix;
- solicitação de saque;
- saque concluído ou recusado;
- atividade suspeita;
- suspensão;
- intervenção crítica.

### 20.3 Eventos operacionais configuráveis

Poderão ser desativados ou ajustados:

- nova mensagem;
- pedido criado;
- pagamento aprovado;
- entrega;
- avaliação;
- promoção;
- cashback;
- alterações de anúncio;
- campanhas.

### 20.4 Histórico

- registrar envio;
- registrar falha;
- tentar novamente por fila;
- templates versionados;
- não permitir HTML arbitrário sem controle;
- links sensíveis com validade;
- preferências por usuário.

---

## 21. Administração

### 21.1 Estrutura inicial

A operação prevê pequena equipe com funções separadas:

- superadministrador;
- administrador operacional;
- suporte;
- moderador;
- financeiro;
- analista de risco;
- gestor de conteúdo.

### 21.2 Princípios

- menor privilégio;
- administrador não aumenta a própria permissão;
- ações críticas exigem 2FA;
- ações financeiras podem exigir segunda aprovação;
- logs não são apagados pela interface;
- acesso a documento, chat e finanças é restrito;
- justificativa obrigatória em ações sensíveis.

### 21.3 Configurações administráveis

Sempre que seguro, o painel poderá alterar:

- prazos por categoria;
- planos e tarifas;
- benefícios;
- cotação de pontos;
- validade de pontos;
- limites de saque;
- taxa de saque;
- parcelamento;
- categorias;
- campos de categoria;
- modelos de mensagem;
- regras de moderação;
- ativação de afiliados;
- ativação de equipe da loja;
- campanha e cashback;
- limites operacionais.

Regras:

- versão;
- data de vigência;
- histórico;
- autor;
- justificativa;
- não retroatividade por padrão;
- snapshot no pedido.

Não devem ser editáveis por painel comum:

- segredos;
- chaves;
- credenciais;
- algoritmos críticos de segurança;
- migrations;
- regras legais obrigatórias;
- permissões máximas;
- integridade do ledger.

---

## 22. Afiliados

- back-end implementado;
- função inicialmente desativada;
- ativação por configuração;
- atribuição inicial sugerida de 30 dias;
- comissão somente após conclusão;
- reembolso cancela comissão;
- custo sai da receita do LIT Buy;
- vendedor não perde valor líquido prometido;
- antifraude obrigatório.

Os valores e regras finais serão confirmados pelo front e pelo documento de afiliados existente.

---

## 23. Serviços digitais com etapas

No lançamento:

- um pagamento;
- uma entrega final;
- sem liberações parciais.

A modelagem deverá permitir evolução futura para:

- marcos;
- etapas;
- aceite parcial;
- liberação parcial;
- disputa por etapa.

A funcionalidade não será ativada agora.

---

## 24. Modelo de dados conceitual

Entidades esperadas:

- User;
- UserProfile;
- PublicProfile;
- SellerProfile;
- Store;
- StoreMember;
- Role;
- Permission;
- UserSession;
- TrustedDevice;
- TwoFactorMethod;
- IdentityVerification;
- Address;
- Category;
- CategoryField;
- Listing;
- ListingVariation;
- ListingMedia;
- InventoryUnit;
- DeliverySecret;
- ListingPlan;
- ListingPlanVersion;
- ListingSubscription;
- LitMaxEnrollment;
- BuyerAdditionalPlan;
- Cart;
- CartItem;
- Checkout;
- Purchase;
- Order;
- OrderItem;
- OrderSnapshot;
- Payment;
- PaymentAttempt;
- PaymentWebhook;
- Delivery;
- DeliveryVersion;
- Conversation;
- Message;
- MessageAttachment;
- ModerationDetection;
- Dispute;
- DisputeEvidence;
- DisputeDecision;
- DisputeAppeal;
- Refund;
- Wallet;
- LedgerAccount;
- LedgerEntry;
- BalanceSnapshot;
- Payout;
- PayoutAttempt;
- Chargeback;
- LitPointsWallet;
- LitPointsLot;
- LitPointsEntry;
- Review;
- Notification;
- NotificationPreference;
- EmailDelivery;
- Coupon;
- Campaign;
- Affiliate;
- AffiliateAttribution;
- AffiliateCommission;
- AdminAction;
- AuditEvent;
- RiskSignal;
- Suspension;
- SupportTicket;
- SystemSetting;
- SettingVersion.

A auditoria deverá validar nomes, remover duplicações e relacionar cada entidade aos tipos e mocks do front.

---

## 25. Módulos do back-end

Estrutura sugerida:

```text
auth
users
profiles
devices
identity
sellers
stores
teams
categories
listings
inventory
plans
carts
checkout
orders
payments
deliveries
conversations
disputes
refunds
wallets
ledger
payouts
chargebacks
lit-points
reviews
notifications
affiliates
support
moderation
risk
admin
audit
settings
files
health
```

O projeto deve começar como monólito modular. Não criar microserviços prematuramente.

---

## 26. Integração entre front e back

O front mockado deverá ser migrado progressivamente.

Fluxo:

```text
Componente
→ service do front
→ cliente HTTP
→ API
→ módulo do back
→ banco
```

Cada service mockado deverá ser mapeado em uma matriz:

| Front | Mock atual | Endpoint futuro | Entidade | Permissão | Sprint |
|---|---|---|---|---|---|

Regras:

- não remover todos os mocks de uma vez;
- conectar um módulo depois que API e testes estiverem prontos;
- manter feature flag quando necessário;
- não permitir que componentes acessem banco ou gateway;
- gerar tipos do cliente a partir do OpenAPI quando viável.

---

## 27. Requisitos de segurança

Base mínima implementável pela IA:

- hash seguro de senha;
- autorização por permissão;
- validação de entrada;
- rate limit;
- proteção contra brute force;
- CSRF conforme a estratégia de sessão;
- CORS restrito;
- idempotência;
- headers seguros;
- logs sem segredos;
- segredos fora do repositório;
- arquivos privados;
- links temporários;
- verificação de webhook;
- auditoria;
- backups;
- recuperação testada;
- ambientes separados;
- dependências verificadas;
- 2FA para administração.

Revisão profissional obrigatória:

- threat model;
- pentest;
- estratégia de sessão;
- criptografia;
- proteção de dados sensíveis;
- segurança do chat e anexos;
- KYC;
- permissões administrativas;
- prevenção de fraude;
- hardening da infraestrutura;
- revisão LGPD;
- plano de incidente;
- recuperação de desastre.

---

## 28. Requisitos de qualidade

Cada sprint deverá exigir:

- branch própria;
- escopo fechado;
- migrations;
- testes unitários;
- testes de integração;
- lint;
- typecheck;
- build;
- documentação;
- relatório de arquivos alterados;
- riscos e pendências;
- nenhuma credencial;
- nenhuma alteração fora do escopo;
- nenhuma aprovação automática de merge.

Financeiro deverá ter testes de:

- idempotência;
- concorrência;
- webhook duplicado;
- transação interrompida;
- saldo insuficiente;
- reembolso parcial;
- reversão;
- saque falho;
- disputa simultânea;
- precisão monetária.

---

## 29. Limites da implementação por IA

A IA poderá implementar:

- banco e migrations;
- autenticação;
- usuários;
- perfis;
- anúncios;
- estoque;
- carrinho;
- checkout;
- pedidos;
- chat;
- disputas;
- avaliações;
- notificações;
- ledger;
- saldos;
- pontos;
- gateway em sandbox;
- webhooks de teste;
- saque simulado ou sandbox;
- KYC por interface e sandbox;
- documentação;
- Docker;
- testes;
- homologação.

A IA não deverá:

- ativar dinheiro real;
- guardar segredos no repositório;
- decidir regra financeira não documentada;
- operar produção;
- desativar testes;
- alterar branch principal diretamente;
- aprovar transação manual sem regra;
- afirmar que o sistema está seguro sem revisão;
- homologar sozinha gateway, LGPD ou chargeback.

---

## 30. Revisão profissional antes da produção

O profissional contratado deverá revisar e aprovar formalmente:

- arquitetura final;
- migrations;
- índices;
- concorrência;
- ledger;
- wallet;
- split;
- fluxo de Pix e cartão;
- reembolso;
- chargeback;
- saque;
- KYC;
- segurança;
- permissões;
- logs;
- proteção de arquivos;
- LGPD;
- retenção de dados;
- backups;
- observabilidade;
- testes de carga;
- CI/CD;
- infraestrutura;
- plano de incidente;
- plano de recuperação;
- checklist de lançamento.

Nenhum pagamento real será ativado antes da aprovação.

---

## 31. Auditoria obrigatória do repositório

A auditoria deve ocorrer antes de qualquer implementação.

### 31.1 O que analisar

- estrutura;
- stack real;
- package manager;
- rotas;
- páginas;
- componentes;
- providers;
- hooks;
- tipos;
- schemas;
- services;
- mocks;
- documentação;
- planos;
- textos;
- valores;
- categorias;
- estados;
- permissões;
- notificações;
- funcionalidades administrativas;
- fluxos de comprador;
- fluxos de vendedor;
- fluxos de suporte;
- referências a GGMAX ou GG Points;
- código não utilizado;
- riscos;
- inconsistências.

### 31.2 Documentos que a auditoria deverá produzir

```text
docs/backend-planning/
├── 01_REPOSITORY_INVENTORY.md
├── 02_FRONTEND_FUNCTIONAL_MAP.md
├── 03_DOMAIN_ENTITIES.md
├── 04_STATE_MACHINES.md
├── 05_ROLES_AND_PERMISSIONS.md
├── 06_MOCKS_TO_API_MATRIX.md
├── 07_FRONTEND_BACKEND_FIELD_MATRIX.md
├── 08_BUSINESS_RULES_FOUND.md
├── 09_CONFLICTS_WITH_MASTER_SPEC.md
├── 10_VALUES_AND_PLANS_TO_CONFIRM.md
├── 11_RISK_REGISTER.md
├── 12_TECH_STACK_DECISION.md
├── 13_BACKEND_ROADMAP.md
└── 14_AUDIT_SUMMARY.md
```

### 31.3 Itens que devem ser extraídos do front, sem perguntar antes

- benefícios e preço do LIT MAX;
- benefícios e preço do plano adicional do comprador;
- campos exatos de cada tipo de anúncio;
- categorias e subcategorias;
- estados já exibidos;
- mensagens automáticas;
- regras de notificação;
- papéis administrativos;
- tipos de anexos;
- páginas e rotas;
- planos, valores e textos;
- equipe de vendedor;
- afiliados;
- LIT Points;
- taxa e prazo apresentados;
- serviços mockados;
- contratos já rascunhados.

### 31.4 Critério de conclusão da auditoria

A auditoria somente termina quando:

- todos os arquivos relevantes forem inventariados;
- comandos de instalação, lint, typecheck, testes e build forem registrados;
- toda funcionalidade visual tiver um destino no back-end;
- conflitos com este documento estiverem listados;
- stack final estiver decidida;
- decisões realmente pendentes estiverem reduzidas ao mínimo;
- nenhum código funcional tiver sido alterado.

---

## 32. Pendências não bloqueadoras antes da auditoria

Não exigem resposta agora:

- escolha do gateway;
- hospedagem;
- fornecedor de e-mail;
- fornecedor de SMS;
- fornecedor de KYC;
- CDN;
- monitoramento;
- preço e benefícios finais do LIT MAX;
- preço e benefícios finais do plano adicional do comprador;
- valor final de taxa de saque;
- limites finais de saque;
- regras exatas de anexos;
- fórmula definitiva de reputação;
- taxonomia final de categorias;
- textos jurídicos.

Esses itens serão resolvidos por auditoria, comparação técnica ou revisão profissional, sem iniciar a implementação financeira real.

---

## 33. Definition of Ready para começar o back-end

O back-end só poderá começar quando:

- repositório auditado;
- stack congelada;
- conflitos resolvidos;
- mapa de mocks concluído;
- entidades principais definidas;
- estados de pedido, pagamento, entrega, disputa e saldo definidos;
- matriz de permissões pronta;
- gateway isolado por interface;
- ambientes planejados;
- limites da IA aceitos;
- plano de revisão profissional registrado.

---

## 34. Definition of Done de cada sprint

Uma sprint só é concluída quando:

- requisitos atendidos;
- migrations versionadas;
- testes passando;
- typecheck limpo;
- lint limpo;
- build concluído;
- documentação atualizada;
- contratos da API atualizados;
- logs e erros tratados;
- permissões testadas;
- relatório final emitido;
- revisão realizada;
- nenhuma alteração indevida;
- merge aprovado conscientemente.

---

## 35. Registro de origem das regras

Cada regra futura deverá ser marcada como:

- `OWNER_CONFIRMED`;
- `SCREENSHOT_CONFIRMED`;
- `FRONTEND_FOUND`;
- `DOCUMENTATION_FOUND`;
- `RECOMMENDED_DEFAULT`;
- `PROFESSIONAL_REVIEW_REQUIRED`;
- `SUPERSEDED`;
- `PENDING_AUDIT`.

---

## 36. Próximo passo oficial

1. obter o repositório completo sem dependências, builds ou segredos;
2. analisar o repositório nesta conversa;
3. produzir o inventário e o confronto com este documento;
4. conectar o repositório ao Codex;
5. executar uma segunda auditoria somente documental;
6. revisar as divergências;
7. congelar a stack;
8. criar o roadmap definitivo;
9. somente então gerar o primeiro prompt de implementação.

---

## 37. Controle de alterações

### Versão 1.0

Consolida:

- conta única de comprador e vendedor;
- maiores de 18 anos;
- marketplace exclusivamente digital;
- planos Prata, Ouro e Diamante;
- LIT MAX;
- plano adicional do comprador;
- checkout multi-vendedor;
- prazo de liberação por categoria;
- liberação acelerada;
- chat interno obrigatório;
- intervenção até a data de liberação;
- reclamação posterior de até 30 dias sem garantia automática;
- reembolso pelo meio original;
- ledger e saldo negativo;
- Pix, cartão, saldo e LIT Points;
- LIT Points com pagamento integral;
- KYC antes de saque;
- saque Pix;
- administração por funções;
- arquitetura desacoplada de Supabase;
- implementação por IA com revisão profissional obrigatória.
