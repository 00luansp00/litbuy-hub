# Seller Onboarding Foundation

## Real nesta sprint

- Compradores autenticados salvam e submetem uma solicitação persistida de vendedor.
- Estados reais: `draft`, `submitted`, `under_review`, `approved`, `rejected`.
- Administradores com `ADMIN` analisam, iniciam revisão, aprovam ou rejeitam solicitações.
- Aprovação cria `SellerProfile` com `verified=false` e concede `SELLER` via `UserRoleAssignment` na mesma transação serializável.
- Auditoria usa `SecurityEvent` sem PII sensível.
- Gates e telas frontend apontam para `/perfil/vendedor`; `/admin/vendedores` consome a API real de solicitações.

## Ainda mockado ou pendente

- KYC, CPF/CNPJ, documentos, selfie, biometria, OCR, liveness e fornecedor externo.
- Selo Vendedor Verificado (`SellerProfile.verified` permanece `false`).
- Loja pública real, produtos, anúncios, vendas, financeiro, wallet, saques, equipe, reputação, níveis e LIT-MAX.
- Staging e produção dependem de revisão jurídica do acordo e decisões operacionais finais.

## Segurança

O frontend não envia `userId`, `role`, `status`, `verified` nem dados de revisão. A aprovação é exclusiva da API administrativa protegida por `AccessTokenGuard`, `PlatformRolesGuard` e `@RequireRoles(ADMIN)`. Slug e requisitos da conta são revalidados no backend durante submissão e aprovação.
