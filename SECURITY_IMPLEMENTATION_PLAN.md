# SECURITY_IMPLEMENTATION_PLAN.md — LIT Buy

Plano de segurança para a fase backend. Classificado por criticidade.

## Crítica (bloqueia produção)

- **Autenticação real** (Supabase Auth ou equivalente) com hashing
  server-side, sessão via JWT httpOnly, refresh token rotativo.
- **RBAC + RLS** em toda tabela pública. Roles em tabela separada.
- **Proteção admin server-side** — `AdminGate` visual não protege nada.
- **Validação server-side** em todo endpoint (Zod / valibot).
- **PCI-DSS** ao lidar com cartão: tokenização via gateway; **nunca**
  armazenar PAN, CVV, banda magnética.
- **Idempotência de pagamento** via `Idempotency-Key` + `idempotency_key`
  no banco. Webhooks idempotentes com verificação de assinatura.
- **Auditoria financeira** append-only (`audit_logs`, `admin_actions`,
  `wallet_transactions`).
- **KYC real** antes de saque (Idwall / Unico / Jumio).
- **LGPD**: nomeação de DPO, política publicada, direitos do titular
  (acesso, correção, portabilidade, apagamento), consentimento
  explícito para tracking.

## Alta

- **Rate limiting** por IP e por usuário (login, cadastro, checkout,
  denúncia, envio de mensagem, saque).
- **Antifraude**: score + regras + revisão humana em pedido de alto
  valor, saque, novo dispositivo.
- **Sanitização de mensagens** (LIT-MAX) server-side. Bloquear
  telefones/e-mails/URLs externas no chat conforme regras.
- **Segurança de upload**: URL assinada, tamanho máximo, whitelist
  MIME, antivírus (ClamAV / VirusTotal), storage privado.
- **Segurança de cofre** (entrega automática): storage isolado,
  acesso auditado, expiração de token.
- **Criptografia em repouso** para KYC, documentos, dados financeiros
  sensíveis (pgcrypto ou KMS).
- **Reset de senha seguro**: token único, hash, expiração curta
  (15 min), invalidar após uso, notificação por e-mail.
- **Verificação de e-mail** obrigatória antes de comprar/vender.
- **Novo dispositivo**: e-mail + código, opcional 2FA.
- **Proteção contra phishing**: DKIM, DMARC, SPF, domínio dedicado
  para transacional.
- **Proteção de wallet**: reautenticação em saque, notificação em
  cada movimento, limite diário/mensal.
- **Conciliação bancária** diária (gateway vs ledger interno).
- **Termos e política de privacidade** revisados por jurídico + versão
  aceita registrada por usuário.

## Média

- **CSRF**: SameSite=Strict em cookies de sessão.
- **CORS**: whitelist de origens.
- **CSP** (Content-Security-Policy) restrita.
- **HSTS**, **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**.
- **Secret rotation**: chaves de gateway, JWT secret, provedores.
- **Monitoramento**: alertas para picos anômalos, tentativas de login,
  falhas de webhook.
- **Backups** diários + teste de restore mensal.
- **Retenção**: 7 anos para financeiro, 2 anos para mensagens,
  90 dias para notificações.
- **DDoS**: proteção via Cloudflare / WAF.

## Baixa

- Documentação de segurança interna atualizada.
- Bug bounty (após launch).
- Testes de penetração antes de aceitar dinheiro real.
- Treinamento LGPD para o time.

## Regras absolutas

- **Frontend nunca é fonte de verdade** — sempre validar server-side.
- **Nunca armazenar** senha em plaintext, PAN, CVV, chave Pix, token
  de gateway.
- **Nunca deletar** logs financeiros ou de auditoria.
- **Nunca confiar** em input do cliente para preço, taxa, saldo,
  comissão, papel de usuário.
- **Nunca expor** stack trace, e-mails de outros usuários, IDs
  internos sensíveis em respostas de API.
