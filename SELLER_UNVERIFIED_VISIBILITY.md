# Visibilidade pública da verificação do Seller

## Owner target e implementação CURRENT

A capability O2 torna visível ao Buyer o estado CURRENT de verificação do Seller nos cards e no
detalhe do catálogo público. A única autoridade é o boolean obrigatório
`SellerProfile.verified`: list e detail serializam o mesmo valor no contrato
`seller: { slug, storeName, verified }`. O frontend não consulta endpoint auxiliar, não usa mock e
o parser falha fechado com `MALFORMED_PUBLIC_CATALOG_RESPONSE` se `verified` estiver ausente ou não
for boolean.

O componente visual compartilhado usa texto legível, sem depender de cor ou ícone:

- `verified=true`: **Vendedor verificado**;
- `verified=false`: **Vendedor não verificado**.

`verified=false` não significa fraude, insegurança, rejeição ou pendência de KYC. O boolean também
não informa provider, documentos, biometria, etapa ou resultado detalhado de um processo KYC.

## Invariantes e negative scope

Seller `ACTIVE` com `verified=false` continua elegível ao catálogo, pode anunciar, vender e
acumular saldo conforme as regras comerciais existentes. O prefilter continua exigindo
`SellerProfile.status=ACTIVE`, mas não exige verificação. Nenhuma regra de publication eligibility,
cart, checkout, pagamento, entrega ou release foi alterada; esta capability é somente visibilidade.

O único novo dado público é `verified`. Nenhuma PII, documento, e-mail, telefone, nome civil,
endereço, data de nascimento, provider, risk score, nota administrativa ou metadata de application
é exposta. Não há endpoint novo nem migration.

O1 permanece separado: esta entrega não cria lifecycle, application, approve/reject, SLA, KYC,
biometria ou provider de verificação. O3 permanece separado: não cria withdrawal, payout ou gate de
saque. A policy P e `CATALOG-TRUST-SIGNALS` também permanecem fora de escopo; não foram adicionados
rating, vendas, tempo de conta, reputação ou Seller MAX.

## Evidência automatizada

- testes unitários do backend provam serialização true/false, paridade list/detail, contrato seguro
  e ausência de filtro `verified`;
- a suite HTTP/PostgreSQL prova Seller `ACTIVE` não verificado público, Seller verificado, paridade
  list/detail e preserva a exclusão de profiles `SUSPENDED`/`CLOSED`;
- testes do parser aceitam somente boolean true/false e rejeitam ausência, string e null;
- testes dos componentes localizam as copies explícitas, tanto no card quanto no detalhe, e
  rejeitam semântica indevida de KYC.

A rota pública de loja `/loja/$slug` foi inspecionada e permanece uma superfície legacy/mock por
`sellerService`; ela não consome a authority pública real de `SellerProfile` e não foi ampliada.
