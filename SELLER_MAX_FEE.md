# Seller MAX Fee (I2)

## CURRENT

Seller MAX é um add-on por anúncio. No checkout, `STANDARD` não exige nem recebe componente MAX. `LIT_MAX` exige exatamente uma regra canônica habilitada `LIT_MAX_PRICE`, `SELLER`, `PERCENT_BPS`, `sellerPlan=LIT_MAX`, sem qualifiers ou limites estranhos. A fixture local representa o baseline Owner de 299 bps; o runtime calcula pela regra versionada e não possui fallback ou rate hardcoded.

Uma única `FeePolicyVersion` efetiva é selecionada no timestamp transacional, bloqueada `FOR SHARE` e fornece tanto Listing Tier quanto MAX. A Order v2 congela um componente Tier e, condicionalmente, um MAX. Ambos usam o subtotal em minor units; não há fee sobre fee. A soma forma `platformFeeAmountMinor`, sem mudar `totalAmountMinor` do Buyer.

Sale Financial Recognition valida exclusivamente a policy, regras e amounts históricos congelados. Para R$100, Diamante 1299 bps e MAX 299 bps, o ledger debita `PROVIDER_CLEARING` em 10000 e credita `SELLER_PENDING` em 8402 e `PLATFORM_COMMISSION` em 1598. Policy retirada continua reconhecível; corrupção gera reconciliation e nenhum posting.

Legacy `NULL` e v1 continuam válidos e não recebem MAX retroativamente. Snapshot, componentes e replay são imutáveis/idempotentes. A evidência de identity/rate/base/amount/policy/rule permite reversão futura, mas I2 não implementa refund, reversal, deficit, recovery, withdrawal, PSP, estoque MAX, prazo 48h, release acelerado, pontos, mensagens ou Buyer VIP.
