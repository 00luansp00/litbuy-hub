# Marketplace RBAC Foundation

Status: implemented as a foundation sprint. Buyer, seller and administrator roles are now persistent marketplace authorization data, not frontend demo state.

## Completed

- Roles are represented by `PlatformRole` (`BUYER`, `SELLER`, `ADMIN`) and assigned through `UserRoleAssignment` with a composite key by user and role.
- The Prisma migration `20260718120000_marketplace_rbac_foundation` creates the enum/table/indexes and backfills `BUYER` for every existing user. It does not create sellers, administrators or any personal data.
- New registrations create only `BUYER` as part of the persisted user graph; registration DTOs still do not accept roles.
- `GET /api/v1/auth/me` returns deterministic API roles as `roles: ["buyer" | "seller" | "admin"]` from the database.
- Backend APIs can use `@RequireRoles(...)` with `PlatformRolesGuard`; multiple roles mean “any role is sufficient”. The guard reads the authenticated user id from `AccessTokenGuard` context and checks the database on each request.
- `AccessTokenGuard` continues to require an active session/device and now also fails closed unless the account status is `ACTIVE`.
- Operators can grant/revoke roles with non-HTTP scripts: `bun run roles:grant -- --user-id=<uuid> --role=ADMIN --confirm` and `bun run roles:revoke -- --user-id=<uuid> --role=ADMIN --confirm`. Revoking `BUYER` is blocked in this phase.
- Role grants and revokes write safe `SecurityEvent` audit events (`ROLE_GRANTED`, `ROLE_REVOKED`) without e-mail, phone, tokens, cookies or raw CLI arguments.
- Frontend authorization is derived only from `/auth/me.roles`; `VITE_ENABLE_DEMO_ROLES` no longer grants admin or seller access.
- `activeRole` remains presentation-only between buyer/seller. Seller mode requires a real `seller` role and resets to buyer if the refreshed `/auth/me` no longer contains it.
- `hasSellerAccess` is the current authorization flag. `hasSellerProfile` is a deprecated compatibility alias derived only from `seller`.
- `AdminGate` and `SellerGate` are visual gates backed by real roles from `/auth/me`; future marketplace APIs must still use server-side guards.

## Pending

- Real seller onboarding, `SellerProfile`, seller approval and KYC.
- Store teams and internal seller permissions.
- Real user/role administration screens, including `/admin/permissoes`.
- Catalog, products, inventory, cart, checkout, orders, payments, wallet, ledger, splits, escrow and withdrawals.
- Object-level authorization, granular permissions, staging and production rollout.

No payment, delivery, SMS/e-mail, hosting, staging or production provider was selected or changed by this sprint.

## Seller onboarding foundation (2026-07-18)

- Adicionado onboarding real de vendedor sem KYC externo: solicitação persistida, análise administrativa, aprovação/rejeição, criação de perfil inicial e concessão atômica do papel `SELLER`.
- Novos modelos: `SellerApplication` e `SellerProfile`; `SellerProfile.verified` nasce `false` e não representa KYC.
- Produtos, anúncios, vendas, financeiro, reputação, wallet, saques, documentos, selfie e verificação externa continuam mockados ou pendentes para sprints futuras.
- Fornecedor de KYC permanece não escolhido (`NOT_ANALYZED`); nenhum documento real deve ser enviado.
- Consulte `SELLER_ONBOARDING_FOUNDATION.md` para escopo, endpoints, estados e limitações.
