# LIT Buy — Final Functional Audit — Bloco 2: Autenticação, Sessão e Segurança da Conta

## Finalidade

Este documento registra de forma persistente e detalhada o **Bloco 2 — Autenticação, sessão e segurança da conta** da validação funcional final do LIT Buy.

Ele complementa `FINAL_FUNCTIONAL_AUDIT_REPORT.md` e segue a regra operacional de `FINAL_FUNCTIONAL_AUDIT_REMEDIATION_GATE.md`:

> TESTAR → PARAR → AUDITAR → DOCUMENTAR → TRIAR/REMEDIAR NO GATE APROPRIADO → somente então avançar.

Este documento **não**:

- redefine `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`;
- autoriza Phase B;
- autoriza dinheiro real, saque, payout, KYC produtivo ou PSP produtivo;
- transforma um hardening de produção em implementação automaticamente autorizada;
- substitui `POST_FREEZE_BROWSER_QA_FINDINGS.md` como ledger dos findings manuais;
- substitui `CLAUDE_AUDIT_FINDINGS_LEDGER.md` como autoridade dos findings formais da auditoria Claude;
- declara o sistema production-ready.

## Estado do bloco

**Status:** `AUDITADO E DOCUMENTADO — ACHADOS/HARDENINGS ABERTOS`

A autenticação local real está suficientemente exercitada para encerrar este bloco e, depois da incorporação/revisão desta documentação conforme a governança do projeto, avançar ao bloco Buyer.

Isso **não** significa que todos os itens de segurança de produção estejam concluídos. Entrega externa de e-mail/SMS, KYC, saque, hardening privilegiado de Admin, política final de senha e demais controles de produção continuam separados e explicitamente classificados.

---

# 1. Baseline e ambiente usados

- Data local de encerramento do bloco: `2026-08-16`.
- Repositório autoritativo: `00luansp00/litbuy-hub`.
- `main` remoto confirmado antes desta documentação: `8e0825211e5635a9aaea4cffc1e4cfafcdf3f454`.
- Esse SHA corresponde ao merge da PR `#85` (`docs(audit): make remediation gate explicit`).
- Workspace local de Browser QA: `C:\Users\luans\litbuy-browser-validation`.
- Frontend local: `http://localhost:13000`.
- API local: `http://localhost:13001/api/v1`.
- PostgreSQL, Redis, MinIO, backend e frontend foram observados como `healthy` após a retomada do ambiente.
- `bun run demo:check` terminou `ok:true`.
- `demo:verify` confirmou a base demo esperada: 3 usuários, 1 seller, 3 categorias demo, 8 subcategorias, 8 produtos, 6 produtos públicos, 8 imagens e 1 FeePolicy.
- Home/catalog/category/product smokes e infraestrutura passaram.
- Modo de pagamento permanece rehearsal local / `FAKE_ALPHA`; nenhum dinheiro real.

## 1.1 Providers locais de autenticação

O rehearsal usa:

- `AUTH_EMAIL_DELIVERY_MODE=memory`;
- `AUTH_SMS_DELIVERY_MODE=memory`;
- `NODE_ENV=test`.

Portanto, criação de challenge, persistência e regras da API podem ser exercitadas localmente, mas **entrega externa real de e-mail/SMS não está homologada por esta rodada**.

A infraestrutura do backend possui adapters externos, mas o ambiente auditado não os utilizou para entrega real.

## 1.2 Warning de OpenSSL/Prisma

Após reiniciar o PC houve uma execução de `demo:prepare` que terminou em `demo:seed` com `DEMO_DATA_FAILED`, acompanhada do warning conhecido do Prisma sobre detecção de OpenSSL/libssl.

Na sequência, `demo:check`/`demo:verify` passaram e todos os serviços ficaram `healthy`; o mesmo warning de OpenSSL apareceu sem impedir a verificação.

Conclusão desta rodada:

- o warning permanece relevante para avaliação de imagem/runtime de produção;
- ele **não foi tratado como defeito de Auth**;
- não foi feita alteração oportunista de Dockerfile/OpenSSL durante esta auditoria;
- a causa exata da tentativa isolada de `demo:prepare` que falhou não foi estabelecida por este bloco.

---

# 2. Login, sessão, refresh e logout

## 2.1 Login inválido — `REAL-TESTED`

Conta usada:

`comprador@demo.litbuy.local`

Com senha incorreta, a UI respondeu:

`E-mail ou senha inválidos.`

A mensagem é genérica e não diferencia e-mail existente de senha incorreta.

**Resultado:** aprovado para o comportamento exercitado.

## 2.2 Login Buyer válido — `REAL-TESTED`

Com as credenciais demo válidas:

- autenticação concluiu sem erro;
- usuário `comprador` apareceu na Navbar;
- estado autenticado ficou disponível nas rotas protegidas;
- login direto terminou na Home, conforme implementação atual.

## 2.3 Refresh da sessão — `REAL-TESTED` com finding de UX

Ao pressionar `F5`:

- a sessão foi recuperada;
- o usuário permaneceu autenticado;
- rotas protegidas permaneceram na mesma URL;
- os dados voltaram a carregar.

Porém, antes da restauração houve um flash de aproximadamente um segundo em que a Navbar exibiu o estado anônimo (`Entrar` / `Criar conta`).

Isso foi reproduzido mais de uma vez, inclusive em rota protegida.

Classificação detalhada em `QA-BROWSER-009`.

## 2.4 Causa do flash confirmada no frontend

`AuthProvider` inicia com:

- `user = null`;
- `status = initializing`;
- depois executa `refresh()` → define access token em memória → `/auth/me` → `authenticated`.

A Navbar, entretanto, decide entre `UserMenu` e `Entrar/Criar conta` olhando apenas `isAuthenticated`; ela não neutraliza o estado `initializing`.

Resultado: durante a restauração da sessão, a UI renderiza temporariamente o estado anônimo.

Isso é problema visual/UX; a evidência **não** mostrou perda real da sessão nem vazamento de autorização.

## 2.5 Logout — `REAL-TESTED`

- logout removeu imediatamente o estado autenticado;
- Navbar voltou a `Entrar` / `Criar conta`;
- após `F5`, a sessão não reapareceu.

**Resultado:** aprovado.

---

# 3. Rotas autenticadas usadas como prova de boundary

## 3.1 `/carrinho` autenticado — `REAL-TESTED` para boundary de Auth

Com Buyer autenticado:

- `/carrinho` carregou o carrinho real da conta;
- a rota não pediu novo login;
- `F5` manteve rota e sessão.

Esta evidência prova a fronteira de autenticação da rota, **não encerra o Bloco Buyer/carrinho**, que continuará exigindo CRUD, ownership, checkout, replay e demais testes próprios.

## 3.2 `/mensagens` — `MOCK-DEMO`

A área autenticada de mensagens existe visualmente, porém o serviço atual de mensagens é mock/in-memory e não representa chat operacional real.

Não foi tratada como capability real de Auth nem como chat concluído.

`FUTURE-CHAT-001` permanece separado.

---

# 4. Recuperação de senha

## 4.1 Solicitação anti-enumeração — `REAL-TESTED`

Foram comparadas solicitações para:

- um e-mail inexistente;
- o Buyer demo existente.

Nos dois casos a UI apresentou a mesma resposta genérica:

`Se existir uma conta para este e-mail, enviaremos as instruções.`

**Resultado:** a superfície exercitada não expôs existência da conta por mensagem distinta.

## 4.2 Limite desta rodada

A troca efetiva de senha por token de recuperação **não foi concluída no browser**, porque a entrega de e-mail do rehearsal é `memory`.

Classificação:

- request de recuperação: `REAL-TESTED`;
- entrega externa do e-mail: `HUMAN-SENIOR / STAGING-PRODUCTION VALIDATION`;
- consumo completo do link/token em provider externo: não homologado nesta rodada.

Isso não é classificado como bug do fluxo local.

---

# 5. Cadastro real e validações

## 5.1 Validações de formulário — `REAL-TESTED`

Foram exercitados e bloqueados corretamente:

- senha menor que o mínimo atual → `A senha precisa ter pelo menos 12 caracteres.`;
- confirmação de senha diferente → `As senhas não conferem.`;
- usuário menor de 18 anos → `É necessário ter pelo menos 18 anos.`;
- Termos/Privacidade não aceitos → exigência explícita dos dois aceites.

## 5.2 Termos e Privacidade — rotas reais, conteúdo jurídico não final

Os links abriram:

- `/termos`;
- `/privacidade`.

As páginas existem e estão claramente marcadas como **rascunho demonstrativo**, não documento jurídico final.

Classificação:

- rota/renderização: `REAL-TESTED`;
- conteúdo jurídico final/LGPD/produção: `HUMAN-SENIOR`.

A navegação em mesma guia durante o cadastro gera o finding `QA-BROWSER-011`.

## 5.3 Cadastro válido — `REAL-TESTED`

Foi criada uma conta local nova de auditoria.

Resultado:

- cadastro aceito pela API real;
- usuário não foi autenticado automaticamente;
- aplicação levou para `/verificar-email`;
- conta passou a exigir confirmação de e-mail.

## 5.4 Login antes da confirmação — `REAL-TESTED`

Ao tentar autenticar a conta recém-criada sem e-mail confirmado:

- login não foi concedido;
- aplicação voltou para `/verificar-email`;
- mensagem: `Confirme seu e-mail antes de entrar.`

**Resultado:** aprovado.

## 5.5 Reenvio de verificação anti-enumeração — `REAL-TESTED`

Foi testado reenvio para:

- a conta recém-criada e existente;
- um endereço inexistente.

Nos dois casos a resposta foi equivalente:

`Se a conta existir, enviaremos as instruções por e-mail.`

**Resultado:** aprovado para a superfície exercitada.

## 5.6 Limite da confirmação de e-mail

A confirmação completa por link externo não foi homologada com provider real nesta rodada.

O backend local captura a entrega em memória; não foi criado endpoint inseguro nem exposto token ao browser somente para facilitar o QA.

Classificação:

- criação do desafio/reenvio/bloqueio pré-verificação: `REAL-TESTED`;
- entrega externa + clique real por e-mail: `HUMAN-SENIOR / STAGING-PRODUCTION VALIDATION`.

---

# 6. Política de senha

## 6.1 Estado atual confirmado

A autoridade central atual do backend usa `validatePasswordPolicy()` e aceita senha quando:

- possui entre 12 e 128 caracteres;
- não é somente whitespace.

O hash utiliza `Argon2id`.

Cadastro, alteração de senha e reset utilizam a fundação central de Auth, o que permite endurecer a política sem manter regras contraditórias por tela.

## 6.2 Decisão de hardening registrada — `QA-BROWSER-010`

A política atual foi considerada **insuficiente como política final desejada** para um marketplace que futuramente terá saldo/saque.

Regra registrada para remediação/revisão de segurança:

- a política deve ser central no backend;
- a mesma autoridade deve valer para **cadastro, alteração de senha e redefinição de senha**;
- frontend deve orientar o usuário, mas nunca ser a única barreira;
- a política final deve ser mais forte que o simples mínimo atual de 12 caracteres;
- considerar comprimento/passphrases e bloqueio de senhas comuns/comprometidas;
- não congelar nesta auditoria uma regra arbitrária de composição (`maiúscula + número + símbolo`) sem revisão técnica de segurança;
- a definição final deve ser revisada no gate de segurança/humano sênior.

Este finding é `NON_BLOCKER` da auditoria funcional local e não autoriza mudança imediata durante este bloco.

---

# 7. Área `/perfil/seguranca`

A página foi exercitada com a conta Buyer demo e utiliza APIs reais de Auth/segurança.

Foram inspecionadas:

- sessões ativas;
- dispositivos aprovados;
- telefone;
- alteração de e-mail;
- autenticação em dois fatores;
- alteração de senha.

---

# 8. Sessões ativas

## 8.1 Listagem — `REAL-TESTED`

A UI apresentou múltiplas sessões persistidas, incluindo marcação da `Sessão atual`, datas de criação, última atividade e expiração.

## 8.2 Revogar uma sessão — `REAL-TESTED`

Foi executada revogação de sessão.

- toast confirmou `Sessão revogada.`;
- após `F5`, a sessão revogada não voltou à lista.

Isso prova persistência; não foi apenas feedback visual.

## 8.3 Encerrar todas as sessões — `REAL-TESTED`

Ao clicar `Encerrar todas as sessões`:

- o usuário foi deslogado imediatamente;
- aplicação foi para login;
- o estado autenticado não permaneceu.

Depois, no mesmo navegador cujo dispositivo ainda estava aprovado:

- login com senha correta voltou a funcionar;
- não houve nova aprovação de dispositivo apenas porque as sessões foram encerradas.

**Conclusão:** sessão e confiança do dispositivo são conceitos separados, conforme esperado.

## 8.4 Expiração natural por TTL

Não foi aguardado intencionalmente o TTL natural completo de uma sessão para reproduzir expiração por tempo.

A rodada comprovou perda de acesso por revogação, logout e revogação de dispositivo, mas **não deve transformar isso em alegação de que o cenário de expiração natural foi reproduzido manualmente**.

A expiração por TTL permanece coberta por configuração/automação aplicável e deve continuar na revalidação técnica final.

---

# 9. Dispositivos aprovados e novo dispositivo

## 9.1 Revogar dispositivo — `REAL-TESTED`

Foi revogado um dispositivo aprovado.

- UI confirmou `Dispositivo revogado.`;
- após `F5`, o dispositivo revogado não retornou;
- ao revogar o dispositivo atual, a sessão foi perdida;
- novo login naquele navegador deixou de confiar automaticamente no dispositivo e voltou a exigir aprovação.

## 9.2 Novo navegador sem aprovação — `REAL-TESTED`

Em um navegador diferente, com e-mail e senha corretos:

- login não criou sessão imediatamente;
- aplicação foi para `/verificacao-login?mode=device`;
- mensagem orientou aprovar o dispositivo pelo link enviado ao e-mail.

**Conclusão:** possuir apenas senha correta não bastou para entrar em dispositivo novo.

## 9.3 Aprovação local completa — `REAL-TESTED` no rehearsal

Como o provider de e-mail é `memory`, a aprovação foi concluída por mecanismo controlado local/CLI durante a auditoria, e não por e-mail externo.

Após a aprovação:

- o segundo navegador conseguiu autenticar;
- nova sessão apareceu na lista;
- novo dispositivo apareceu em `Dispositivos aprovados` com status `APPROVED`.

Isso fecha o ciclo funcional local:

`novo navegador → PENDING/aprovação exigida → aprovação controlada → login → sessão/dispositivo aprovados persistidos`.

Não equivale a homologar entrega real de e-mail.

## 9.4 Dispositivo pendente não aparece na gestão — `QA-BROWSER-012`

Antes da aprovação, o navegador confiável não mostrou o device `PENDING` na seção `Dispositivos aprovados`.

O comportamento não quebra a autorização atual, mas reduz visibilidade para o dono da conta.

Hardening desejado:

- seção separada de tentativas/dispositivos aguardando aprovação;
- horário, dispositivo/user-agent e sinais seguros de origem;
- ação `Não fui eu` / bloquear quando apropriado;
- evitar expor PII ou dados de risco desnecessários.

Classificação: `OPEN / NON_BLOCKER / SECURITY-UX`.

---

# 10. Telefone e SMS

## 10.1 Challenge de telefone — `REAL-TESTED` para criação local

A tela aceitou telefone + senha da conta e criou challenge de confirmação.

A UI exibiu prazo vindo da API e campo de código SMS.

## 10.2 Limite do teste

O rehearsal usa `AUTH_SMS_DELIVERY_MODE=memory`.

Portanto:

- geração/persistência do challenge: exercitada;
- entrega SMS real por operadora/provider externo: **não homologada**;
- confirmação final do telefone com SMS externo: não concluída nesta rodada.

Não registrar `SMS production ready` com base neste teste.

---

# 11. Alteração de e-mail

## 11.1 Solicitação — `REAL-TESTED` para a etapa inicial

A UI permitiu solicitar alteração de e-mail mediante:

- novo e-mail;
- confirmação do novo e-mail;
- senha atual.

Após solicitação válida, informou que confirmações foram enviadas para os dois endereços e que a alteração só termina após dupla confirmação.

## 11.2 Arquitetura atual relevante

A fundação atual já separa:

- `User.id` como identidade interna UUID;
- `User.email` como endereço atual;
- `emailVerifiedAt` como estado de confirmação;
- `EmailChangeRequest` como processo separado de alteração.

A troca foi desenhada para confirmação do e-mail atual e do novo endereço antes da conclusão.

O backend também possui `sensitiveActionHoldUntil`/mecanismo de hold para mudanças sensíveis e eventos de segurança.

## 11.3 Limite da rodada

A dupla confirmação externa não foi concluída com provider real porque o rehearsal usa e-mail `memory`.

Portanto:

- criação da solicitação: `REAL-TESTED`;
- confirmação real pelos dois e-mails externos: `HUMAN-SENIOR / STAGING-PRODUCTION VALIDATION`.

## 11.4 Decisão de segurança — hold de 72 horas

A configuração atual do backend/rehearsal usa **48 horas** como default de `AUTH_SENSITIVE_CHANGE_HOLD_HOURS`.

Decisão registrada nesta auditoria:

> Para **alteração concluída de e-mail**, o hold financeiro desejado passa a ser **72 horas**, não 48.

Esse hold deverá ser efetivamente respeitado por saque/destino financeiro quando essas capabilities existirem; a existência do timestamp no usuário, sozinha, não será evidência suficiente.

A extensão do mesmo período para outras mudanças sensíveis (telefone, 2FA, recovery crítico etc.) deve ser consolidada no contrato final de segurança/financeiro sem reduzir a proteção do e-mail.

## 11.5 Logs e acompanhamento operacional

Regra registrada:

- alteração sensível deve gerar trilha de auditoria segura;
- tokens, senhas, cookies, códigos 2FA e segredos não entram nos logs;
- mudança de e-mail concluída deve alimentar uma superfície/fila de **Segurança/Risco**;
- acesso a essa fila deve ser de Admin/Mod com permissão específica, não indiscriminadamente qualquer moderador;
- conta Seller com saldo/vendas/saques deve receber atenção de risco proporcional;
- tentativa de saque durante hold deve ser negada pela API e gerar evento rastreável quando saque existir.

## 11.6 Step-up para conta com 2FA

Hardening desejado:

Se a conta possuir 2FA ativo, alteração de e-mail deve exigir reautenticação/step-up apropriado além da sessão já aberta e da dupla confirmação.

Classificação: segurança futura/remediação; não implementada por esta documentação.

---

# 12. Autenticação em dois fatores (2FA)

## 12.1 Estado atual

A UI real oferece:

- `E-mail`;
- `SMS`, indisponível enquanto telefone não estiver confirmado.

Status inicial auditado: `inativo`.

## 12.2 Validações de ativação — `REAL-TESTED`

Foram testados:

1. sem senha atual → `Informe a senha atual.`;
2. senha incorreta → rejeição segura;
3. senha correta → criação de challenge de seis dígitos com expiração.

Após apenas criar o challenge:

- 2FA continuou `inativo`;
- não houve ativação automática.

## 12.3 Refresh durante enrollment

Após `F5`:

- sessão continuou autenticada;
- status permaneceu `inativo`;
- UI voltou ao formulário inicial de enrollment;
- não houve ativação acidental.

## 12.4 Limite do provider `memory`

Não foi confirmada a ativação final do 2FA por código externo.

Assim:

- reautenticação e criação do challenge: `REAL-TESTED`;
- entrega externa de código: não homologada;
- ativação completa + recovery codes no browser com provider externo: pendente de staging/produção controlada.

## 12.5 Hardening futuro de MFA

O estado atual só expõe e-mail/SMS.

Para contas privilegiadas e operações financeiras, registrar para revisão humana sênior a inclusão de método mais forte, como TOTP/authenticator e/ou passkey/WebAuthn, com prioridade especial para Admin.

Isso não autoriza implementação durante o feature freeze.

---

# 13. Alteração de senha

## 13.1 Validações exercitadas — `REAL-TESTED`

No formulário real foram bloqueados corretamente:

- senha atual vazia → `Informe a senha atual.`;
- nova senha abaixo do mínimo atual → `A nova senha precisa ter pelo menos 12 caracteres.`;
- confirmação diferente → `As senhas não conferem.`;
- nova senha igual à atual → `A nova senha deve ser diferente da senha atual.`.

## 13.2 Mutation bem-sucedida deliberadamente não executada

Uma troca real de senha revoga sessões e inicia mudança sensível/hold.

Ela **não foi executada neste momento** para não contaminar a conta Buyer demo e os blocos financeiros posteriores.

Portanto não declarar a mutation completa como manualmente homologada apenas pelas validações negativas.

A troca bem-sucedida deverá ser exercitada em momento controlado, com restauração/revalidação do estado da conta e sem contaminar outros gates.

---

# 14. Termos/Privacidade durante cadastro — `QA-BROWSER-011`

## Observação

Ao clicar em `Termos` ou `Privacidade` no cadastro, o usuário navega para outra rota na mesma guia.

Como os campos do cadastro são estado local do componente, essa jornada pode fazer o usuário perder o que já preencheu e prejudicar conversão.

## Classificação

- **Estado:** `OPEN`;
- **Impacto:** `NON_BLOCKER`;
- **Tipo:** UX / cadastro / conversão.

## Direção registrada

Preferência de UX:

- modal/drawer rolável dentro do cadastro;
- opção secundária para abrir o documento completo em nova guia;
- preservar os dados já preenchidos.

A solução final não deve ocultar o documento jurídico nem criar aceite implícito.

---

# 15. Login com Google

## `FUTURE-AUTH-001` — `NOT-IMPLEMENTED / FUTURE-SCOPE`

Foi registrada a intenção futura de oferecer `Continuar com Google`.

Regra:

- não inserir botão funcionalmente falso;
- só apresentar como real quando backend/OAuth, vínculo de identidade, conta existente, sessão, logout, dispositivos, eventual 2FA e recuperação estiverem definidos e testados;
- manter sob decisão explícita de escopo.

---

# 16. RBAC e fronteiras Buyer / Seller / Admin

## 16.1 Buyer → Admin — `REAL-TESTED`

Com Buyer autenticado, acesso direto a:

`/admin`

resultou em `Acesso restrito`.

Buyer não recebeu painel Admin.

## 16.2 Seller → Admin — `REAL-TESTED`

Com a conta Seller demo autenticada, acesso direto a `/admin` também resultou em `Acesso restrito`.

Seller não recebeu painel Admin.

## 16.3 Buyer → Seller

Buyer sem papel Seller, ao acessar `/vendedor`, não recebeu painel Seller operacional; foi conduzido ao fluxo de solicitação/onboarding.

Em `/perfil/vendedor`, a UI exibiu requisitos reais de onboarding e formulário de solicitação.

Isso é coerente com a arquitetura atual de papel `SELLER` persistido.

## 16.4 Segurança não depende de esconder `/admin`

A URL `/admin` ser conhecida **não é classificada como vulnerabilidade por si só**.

A defesa correta precisa continuar válida assumindo que um atacante conhece todas as rotas.

A fundação atual usa:

- role real retornada por `/auth/me` para gates visuais;
- `PlatformRole` persistido;
- guards server-side nas APIs protegidas.

A UI `AdminGate` é defesa adicional, não deve ser a autoridade final.

## 16.5 Limite do Browser QA

O Browser QA provou os gates visuais e os fluxos reais de contas Buyer/Seller.

Não foi feito nesta rodada um ataque manual forjando requests Admin fora da UI. A suíte de integração atual possui cobertura de autorização/CSRF em caminhos críticos; a revalidação final deve manter essa evidência técnica separada da observação visual.

---

# 17. Hardening privilegiado de Admin — `HUMAN-SENIOR`

Para a meta de produção segura, registrar como requisito de revisão humana sênior:

- MFA obrigatório para Admin;
- preferir método resistente a phishing/passkey/WebAuthn ou equivalente forte para contas privilegiadas;
- dispositivo aprovado;
- sessões administrativas mais curtas;
- step-up para ações de alto impacto;
- permissões granulares/least privilege, evitando que todo moderador tenha poderes financeiros;
- logging/auditoria de ações e tentativas negadas;
- alertas de risco para mudanças críticas;
- considerar proteção adicional de infraestrutura para painel privilegiado (ex.: camada Zero Trust/restrição de rede/host separado), sem tratar obscuridade de URL como segurança.

Nenhum desses itens deve ser falsamente declarado pronto só porque `/admin` está escondido do menu de uma conta comum.

---

# 18. Seller onboarding versus verificação para saque

## 18.1 Decisão de produto confirmada nesta auditoria

Após revisar `/perfil/vendedor`, foi decidido **manter o onboarding mínimo atual como conceito válido para habilitar venda**.

A distinção obrigatória é:

### A. Habilitação para vender / Seller onboarding

Pode usar requisitos como os já apresentados pela UI atual:

- e-mail confirmado;
- telefone confirmado;
- idade mínima;
- aceite das regras de vendedor;
- informações da loja;
- análise/aprovação administrativa conforme fluxo atual.

A aprovação cria/concede o acesso Seller conforme a foundation existente.

Essa etapa é **aprovação mínima para vender**, não deve ser confundida com KYC financeiro completo.

### B. Verificação forte para saque

Antes de qualquer saque real, o Seller deverá obrigatoriamente passar por verificação mais forte, com dados/documentos definidos pelo contrato final, como identidade, nome civil, documento, endereço e demais requisitos aplicáveis.

Decisão registrada:

> Um Seller aprovado no onboarding mínimo pode vender conforme as regras da plataforma, mas **não pode sacar dinheiro enquanto não concluir a verificação documental mínima exigida para saque**.

A verificação documental deverá ser analisada manualmente pela equipe LIT Buy no desenho atual desejado.

## 18.2 Enforcement obrigatório

Quando saque existir, não basta esconder o botão.

A API deverá negar saque se a verificação obrigatória não estiver aprovada.

Também deverá respeitar, entre outros controles futuros:

- conta ativa;
- hold de segurança aplicável, incluindo a regra de 72h após troca de e-mail;
- step-up/autenticação forte definida;
- destino financeiro válido;
- demais gates de risco/compliance.

## 18.3 Selo público de vendedor verificado

A capacidade de vender e o selo público `Vendedor verificado` não devem ser tratados como sinônimos.

O selo deve possuir critério real e auditável; não pode ser um campo livre do Seller nem um badge fictício.

## 18.4 Classificação

- Seller onboarding mínimo atual: capability real a auditar profundamente no Bloco Seller;
- KYC/documentos/saque real: `HUMAN-SENIOR / FUTURE-SCOPE`;
- compliance/PSP/jurídico podem impor gates adicionais antes de dinheiro real.

Esta decisão não autoriza payout nem coleta de documentos reais no rehearsal.

---

# 19. Findings do Bloco 2

## `QA-BROWSER-009` — flash de estado anônimo durante bootstrap da sessão

- **Tipo:** Auth / frontend / UX;
- **Estado:** `OPEN`;
- **Impacto:** `NON_BLOCKER`;
- **Causa:** `AuthProvider` inicia em `initializing`, enquanto Navbar decide somente por `isAuthenticated` e mostra temporariamente controles anônimos.

Critério futuro: não apresentar estado anônimo enganoso enquanto a sessão persistida ainda está sendo resolvida.

## `QA-BROWSER-010` — política de senha precisa de hardening central

- **Tipo:** Auth / security-hardening;
- **Estado:** `OPEN`;
- **Impacto:** `NON_BLOCKER` da validação local;
- **Estado atual:** 12–128 caracteres, não-whitespace, Argon2id.

Critério futuro: política central mais forte, consistente em cadastro/alteração/reset, com definição final revisada por segurança.

## `QA-BROWSER-011` — documentos legais interrompem cadastro

- **Tipo:** UX / cadastro / conversão;
- **Estado:** `OPEN`;
- **Impacto:** `NON_BLOCKER`.

Critério futuro: permitir consulta sem destruir contexto do formulário, preferencialmente modal/drawer + documento completo em nova guia.

## `QA-BROWSER-012` — device pendente não é visível na área de segurança

- **Tipo:** Security UX / account protection;
- **Estado:** `OPEN`;
- **Impacto:** `NON_BLOCKER`.

Critério futuro: permitir ao usuário confiável enxergar/cancelar tentativas de novo dispositivo quando isso puder ser feito sem expor informação sensível.

---

# 20. Requisitos futuros/humanos registrados no Bloco 2

## `FUTURE-AUTH-001` — Google federated login

`NOT-IMPLEMENTED / FUTURE-SCOPE`.

## `FUTURE-AUTH-002` — MFA mais forte / passkey-TOTP

Avaliar método mais forte que e-mail/SMS, especialmente para Admin e operações financeiras. `HUMAN-SENIOR / FUTURE-SCOPE`.

## `FUTURE-SECURITY-001` — troca de e-mail e monitoramento de risco

Regra registrada:

- hold financeiro desejado de **72h** após troca concluída de e-mail;
- logging seguro;
- fila/painel de Segurança/Risco para equipe autorizada;
- alertas proporcionais ao risco;
- step-up adicional quando 2FA estiver ativo;
- comprovar enforcement real no saque quando saque existir.

## `FUTURE-ADMIN-SECURITY-001` — hardening privilegiado

MFA forte, sessões menores, step-up, granularidade de permissões, logs/alertas e proteção adicional de infraestrutura antes de produção.

## `FUTURE-WITHDRAWAL-KYC-001` — KYC/verificação documental antes do saque

Seller pode ter onboarding mínimo aprovado para vender, mas saque real deve permanecer bloqueado até verificação documental manual mínima e demais requisitos de compliance/PSP/segurança.

---

# 21. Matriz consolidada do Bloco 2

## `REAL-TESTED`

- login inválido com mensagem genérica;
- login Buyer válido;
- restauração de sessão após `F5`;
- logout;
- logout persistente após `F5`;
- acesso autenticado a `/carrinho` como prova de boundary;
- recuperação de senha — request anti-enumeração;
- cadastro real;
- validação de senha mínima atual;
- confirmação de senha;
- idade mínima;
- aceites separados de Termos/Privacidade;
- bloqueio de login antes de verificação de e-mail;
- reenvio de verificação anti-enumeração;
- listagem de sessões;
- revogação de sessão com persistência após refresh;
- encerramento de todas as sessões;
- listagem de dispositivos aprovados;
- revogação de dispositivo;
- dispositivo revogado volta a exigir aprovação;
- novo navegador exige aprovação mesmo com senha correta;
- aprovação local controlada de novo dispositivo;
- novo dispositivo aprovado aparece persistido na lista;
- criação local de challenge de telefone;
- solicitação inicial de alteração de e-mail;
- validações de 2FA sem senha/senha errada;
- criação de challenge 2FA com senha correta;
- 2FA não ativa apenas por criar challenge;
- validações negativas de alteração de senha;
- Buyer bloqueado no `/admin`;
- Seller bloqueado no `/admin`;
- Buyer sem Seller role conduzido ao onboarding, não ao painel Seller.

## `REAL-BUG` / `OPEN`

- `QA-BROWSER-009` — flash anônimo durante bootstrap da sessão;
- `QA-BROWSER-011` — Termos/Privacidade podem interromper cadastro/perder contexto.

## `SECURITY-HARDENING / OPEN`

- `QA-BROWSER-010` — política de senha final precisa endurecimento central;
- `QA-BROWSER-012` — pendências/tentativas de device não visíveis ao dono da conta.

## `MOCK-DEMO`

- mensagens/chat autenticado continua mockado.

## `NOT-IMPLEMENTED / FUTURE-SCOPE`

- Google OAuth;
- passkey/TOTP como método forte adicional;
- KYC documental real e saque;
- fila operacional completa de risco para alterações sensíveis;
- hardening de infraestrutura Admin de produção.

## `HUMAN-SENIOR / STAGING-PRODUCTION VALIDATION`

- entrega externa real de e-mail;
- entrega externa real de SMS;
- confirmação de e-mail por provider externo;
- reset completo por link externo;
- ativação 2FA completa com entrega externa e recovery codes;
- dupla confirmação externa da troca de e-mail;
- política final de senha;
- Admin privileged access de produção;
- KYC/compliance/saque real.

## Não reproduzido manualmente de ponta a ponta nesta rodada

- expiração natural completa da sessão por TTL;
- alteração de senha bem-sucedida, deliberadamente adiada para não contaminar o Buyer demo;
- ataque manual forjando request Admin/CSRF fora da UI;
- delivery externo real de e-mail/SMS.

Esses limites devem permanecer explícitos; não convertê-los em `REAL-TESTED` por inferência.

---

# 22. O que não deve ser corrigido durante esta documentação

Esta PR/bloco não autoriza:

- alterar runtime de Auth;
- mudar política de senha agora;
- mudar hold de 48h para 72h diretamente nesta PR;
- implementar Google OAuth;
- implementar passkeys/TOTP;
- criar KYC;
- criar saque;
- criar painel de risco;
- alterar onboarding Seller;
- endurecer infraestrutura Admin;
- configurar providers externos;
- mexer em cookies/CSRF;
- resolver findings do bloco sem PR corretiva própria.

A etapa atual é **registro e classificação**.

---

# 23. Gate para o próximo bloco

Depois que esta documentação e o ledger correspondente forem revisados/incorporados conforme a governança do projeto, o próximo bloco da bateria é:

**Bloco 3 — Buyer: carrinho e checkout.**

O Bloco Buyer deverá partir do estado real e testar separadamente:

- adicionar produto real;
- persistência do carrinho;
- quantidade/remoção;
- refresh;
- ownership Buyer A/B;
- checkout por seller;
- preço/estoque server-authoritative;
- snapshot;
- idempotência;
- pedido real;
- e, em blocos posteriores, pagamento Alpha/pós-compra.

**Regra:** findings `NON_BLOCKER` deste Auth block ficam registrados para o gate consolidado de remediação; não ampliar escopo silenciosamente antes de continuar a auditoria.

# Reconciliação pós-PR #97 — refresh single-flight

A PR #95, `fix(auth): unify refresh single-flight`, encerrou o blocker funcional descoberto posteriormente no Browser QA; ela não é artificialmente convertida em finding Claude. Evidência formal: HEAD `6402d6b769ac209617c4d5281df1a38d08d66585`, merge `9df43e6cd8c38ea7e771d92dddf7f05ebacd683f`, CI #346 / run `32035490792` `SUCCESS`.

O sintoma era logout após `F5` em rota protegida, com duas chamadas concorrentes a `/auth/refresh`. A causa eram duas primitives concorrentes (`AuthProvider` → `authService.refresh()` e retry 401 → `refreshAccessToken()`): a primeira rotacionava o token e a segunda reutilizava o predecessor, que o backend corretamente tratava como `REFRESH_TOKEN_REUSE`, revogando a família.

A correção preservou o backend e unificou bootstrap e retry 401 na mesma primitive `refreshAccessToken()` com single-flight; `authService.refresh()` passou a delegar a ela. A revalidação posterior observou um único `/auth/refresh`, HTTP 200, usuário autenticado e Session persistida ativa, sem `revokedAt` ou `revokedReason`. Não repetir sem mudança relevante, regressão objetiva ou revalidação final deliberada.

Residual separado: `QA-BROWSER-009` continua `OPEN / NON_BLOCKER` para o flash visual anônimo durante bootstrap. O requisito desejado de hold de 72h após troca concluída de e-mail também continua não implementado; o runtime/default histórico observado é 48h. Nenhuma alteração de escopo Alpha é feita nesta reconciliação.
