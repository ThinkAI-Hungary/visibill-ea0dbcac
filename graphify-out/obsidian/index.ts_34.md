---
source_file: "supabase/functions/process-mailgun-webhook/index.ts"
type: "code"
community: "Hooks Useinvoicedata Transactionrecord"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Hooks_Useinvoicedata_Transactionrecord
---

# index.ts

## Connections
- [[KNOWN_BANK_DOMAINS]] - `contains` [EXTRACTED]
- [[KNOWN_SHIPMENT_DOMAINS]] - `contains` [EXTRACTED]
- [[error-logger.ts]] - `imports_from` [EXTRACTED]
- [[getBankFromDomain()]] - `contains` [EXTRACTED]
- [[isShipmentDomain()]] - `contains` [EXTRACTED]
- [[logError()]] - `imports` [EXTRACTED]
- [[sanitizeFileName()]] - `contains` [EXTRACTED]
- [[verifySignature()_1]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Hooks_Useinvoicedata_Transactionrecord