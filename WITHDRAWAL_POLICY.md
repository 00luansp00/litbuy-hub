# Withdrawal policy

> **CURRENT vs OWNER TARGET (2026-08-18):** 48h/only STANDARD below remains CURRENT. The `NOT IMPLEMENTED` freeze target is STANDARD 60 elapsed hours/R$0, EXPRESS 12 elapsed hours/R$10, no active INSTANT; MAX never accelerates withdrawal.


> **Boundary:** this policy governs the process after Seller funds are already `SELLER_AVAILABLE` and a withdrawal is requested. It is separate from `SELLER RELEASE POLICY`, which governs protection from `COMPLETED` through `SELLER_HELD` to `SELLER_AVAILABLE`. The default/category/subcategory hierarchy and Liberação Acelerada in `DISPUTE_FINANCIAL_RECOVERY_CONTRACT.md` do not change this withdrawal SLA.

## MVP baseline

Only STANDARD is enabled, with an SLA communicated as up to 48 hours, MANUAL ADMIN approval, and zero additional withdrawal fee. Request creation reserves AVAILABLE into RESERVED; only approval can begin external execution. INSTANT is represented for future compatibility but disabled and must not appear in frontend.

A Withdrawal status is independent from its ledger reservation. The request is immutable: admin may eventually approve or reject, never edit seller, amount, destination, fee, or speed. Rejection before transfer is a compensating RESERVED to AVAILABLE posting plus FinancialEvent; history is retained.

A definitive external failure may release the reservation. Timeout, unknown response, or ambiguous external result must keep RESERVED and create `ReconciliationIssue`; it must never auto-release.

`WithdrawalPolicyVersion` has typed rules per speed for enablement, SLA, approval mode, and integer fee. This allows future automatic STANDARD (still up to 48 hours and zero fee) and automatic INSTANT with configurable fee without a structural migration. Published history is immutable and overlapping validity is rejected.

The database treats the created withdrawal request as structurally immutable: seller, speed, approval mode, monetary values, currency, SLA/request times, destination, and idempotency/request hashes cannot be updated or deleted. Only lifecycle review, provider/transfer correlation, statuses, results, and processing timestamps may evolve.
