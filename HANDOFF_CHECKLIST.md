# HANDOFF_CHECKLIST.md — LIT Buy

Checklist prático para entregar o projeto para desenvolvedor,
freelancer ou agência.

## Antes de contratar dev

- [ ] Ler `DEVELOPER_HANDOFF.md`.
- [ ] Ler `BACKEND_ROADMAP.md` para dimensionar escopo.
- [ ] Ler `PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md` (parte mais crítica).
- [ ] Ler `SECURITY_IMPLEMENTATION_PLAN.md`.
- [ ] Ler `TECH_DEBT_AND_RISKS.md` para entender riscos.
- [ ] Subir o projeto no **GitHub** (privado inicialmente).
- [ ] Rodar `bun install && bun run dev` localmente.
- [ ] Rodar `bunx tsgo --noEmit` (typecheck deve estar limpo).
- [ ] Rodar `bun run lint`.
- [ ] Revisar `package.json` (scripts, dependências, versões).
- [ ] Definir orçamento e prazo com base no roadmap.
- [ ] Definir escopo mínimo do MVP com dinheiro real (recomendado:
      pagamento + escrow simples antes de afiliados).

## Durante a contratação

- [ ] Entregar acesso ao GitHub (leitor + colaborador).
- [ ] Compartilhar `DEVELOPER_HANDOFF.md` como primeiro doc.
- [ ] Compartilhar todos os `.md` da raiz.
- [ ] Definir stack de backend com o dev (Supabase assumido).
- [ ] Definir provedor de pagamento (Stripe, PagBank, MP, etc.).
- [ ] Definir provedor de KYC.
- [ ] Definir provedor de e-mail transacional.
- [ ] Definir storage (Supabase Storage / S3).
- [ ] Definir estratégia de deploy (Cloudflare / Vercel / Netlify).
- [ ] Definir domínio e configurar DNS.
- [ ] Configurar variáveis de ambiente + secrets (nunca commitar).
- [ ] Combinar rituais (daily, review, entregas).
- [ ] Combinar critério de aceite por fase do `BACKEND_ROADMAP.md`.

## Antes de produção

- [ ] Backend fase 1 (fundação + auth + RLS) 100% pronto e testado.
- [ ] Backend fase 5 (pagamentos + escrow + wallet) 100% pronto e
      testado em sandbox.
- [ ] KYC real integrado e testado.
- [ ] Testes automatizados nas jornadas críticas.
- [ ] Auditoria de segurança externa (recomendado).
- [ ] Pentest (recomendado).
- [ ] LGPD: DPO nomeado, política publicada, direitos do titular,
      consent banner.
- [ ] Termos e privacidade revisados por jurídico.
- [ ] Política de itens proibidos revisada por jurídico.
- [ ] Backups automatizados + teste de restore.
- [ ] Monitoramento (Sentry / Logtail / equivalente).
- [ ] Logs centralizados + retenção legal.
- [ ] SEO/SSR para rotas públicas (recomendado).
- [ ] Analytics real + consent LGPD.
- [ ] Provedor de e-mail com DKIM/DMARC/SPF configurados.
- [ ] Rate limiting em endpoints críticos.
- [ ] WAF / DDoS protection (Cloudflare recomendado).
- [ ] CI/CD configurado (staging + produção).
- [ ] Runbook de incidentes.

## Antes de aceitar dinheiro real

- [ ] Fluxo completo de checkout + escrow + saque testado em sandbox.
- [ ] KYC obrigatório para saque, validado por provedor real.
- [ ] Antifraude ativa (regras + score).
- [ ] Conciliação bancária diária funcionando.
- [ ] Webhooks idempotentes com verificação de assinatura.
- [ ] Chargeback testado.
- [ ] Estorno testado.
- [ ] Mediação testada ponta a ponta.
- [ ] Auditoria financeira imutável (`wallet_transactions` append-only).
- [ ] Contabilidade fiscal (NF-e, e-Financeira, etc.) alinhada.
- [ ] Contrato de intermediador definido com o gateway.
- [ ] Contrato com escritório contábil para conciliação.
- [ ] Seguro / reserva técnica se aplicável.
- [ ] Suporte ao usuário definido (SLA de resposta).

## Nunca fazer

- ✗ Aceitar dinheiro real com backend incompleto.
- ✗ Usar `AdminGate` visual como proteção real.
- ✗ Confiar em preço/saldo/comissão vindos do frontend.
- ✗ Armazenar PAN/CVV/senha em plaintext.
- ✗ Deletar linhas de `wallet_transactions` ou `audit_logs`.
- ✗ Deploy sem monitoramento.
- ✗ Launch sem revisão jurídica.
