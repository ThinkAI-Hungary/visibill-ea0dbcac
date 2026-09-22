// Hivatalos OpenAPI 3.0.3 specifikáció a Visibill / eaisybill Customer REST API-hoz
export const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "Visibill / eaisybill Customer REST API",
    version: "2.2.0",
    description: "Hivatalos programozási felület (M2M) cégadatok, számlák, partnerek, banki tranzakciók, főkönyvi adatok, kategóriák, hibajegyek és NAV szinkronizáció gépi integrációjához.",
    contact: {
      name: "Visibill / ThinkAI Support",
      email: "support@visibill.hu"
    }
  },
  servers: [
    {
      url: "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api",
      description: "Éles Edge Function Átjáró"
    }
  ],
  security: [
    {
      BearerAuth: []
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API-Key",
        description: "API kulcs hitelesítés. Formátum: 'Authorization: Bearer vb_<40_hex_karakter>'."
      }
    },
    parameters: {
      CompanyIdQuery: {
        name: "company_id",
        in: "query",
        required: false,
        schema: {
          type: "string",
          format: "uuid"
        },
        description: "A cél cég azonosítója (UUID). Egycéges kulcsnál opcionális, többcéges kulcsnál kötelező."
      },
      IdempotencyKeyHeader: {
        name: "Idempotency-Key",
        in: "header",
        required: false,
        schema: {
          type: "string"
        },
        description: "Egyedi azonosító (pl. UUID v4) hálózati hibák miatti ismétlések duplikáció-védelmére. 24 órán át garantálja az azonos választ."
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", example: "TRANSACTION_NOT_FOUND" },
              message: { type: "string", example: "A megadott azonosítójú tranzakció nem található." },
              details: { type: "object", nullable: true }
            }
          }
        }
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          page_size: { type: "integer", example: 50 },
          total_items: { type: "integer", example: 142 },
          total_pages: { type: "integer", example: 3 }
        }
      },
      InvoiceItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          invoice_number: { type: "string", example: "INV-2026-001" },
          direction: { type: "string", enum: ["inbound", "outbound"], example: "inbound" },
          partner_name: { type: "string", example: "Beszállító Partner Kft." },
          partner_tax_number: { type: "string", example: "12345678-2-41" },
          gross_amount: { type: "number", example: 127000 },
          net_amount: { type: "number", example: 100000 },
          vat_amount: { type: "number", example: 27000 },
          currency: { type: "string", example: "HUF" },
          is_paid: { type: "boolean", example: false },
          issue_date: { type: "string", format: "date", example: "2026-09-01" },
          delivery_date: { type: "string", format: "date", example: "2026-08-31" },
          payment_deadline: { type: "string", format: "date", example: "2026-09-15" },
          has_image: { type: "boolean", example: true },
          attachment_url: { type: "string", nullable: true },
          is_nav_synced: { type: "boolean", example: true },
          nav_status: { type: "string", example: "verified" },
          category_id: { type: "string", format: "uuid", nullable: true },
          project_id: { type: "string", format: "uuid", nullable: true }
        }
      },
      TransactionItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          transaction_date: { type: "string", format: "date", example: "2026-09-05" },
          description: { type: "string", example: "Partner Kft. utalás számla alapján" },
          amount: { type: "number", example: -127000 },
          currency: { type: "string", example: "HUF" },
          type: { "type": "string", example: "debit" },
          matched_invoice_id: { type: "string", format: "uuid", nullable: true },
          is_matched: { type: "boolean", example: false },
          match_type: { type: "string", nullable: true, example: "manual" },
          is_verified: { type: "boolean", example: false },
          created_at: { type: "string", format: "date-time" }
        }
      },
      PartnerItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Partner Cégnév Kft." },
          tax_number: { type: "string", example: "12345678-2-41" },
          address: { type: "string", example: "1054 Budapest, Bajcsy-Zsilinszky út 12." },
          email: { type: "string", format: "email", nullable: true },
          bank_account_number: { type: "string", nullable: true },
          partner_type: { type: "string", enum: ["customer", "supplier", "both"] }
        }
      },
      CategoryItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Irodaszer & Eszközök" },
          description: { type: "string", nullable: true },
          icon: { type: "string", nullable: true },
          color: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" }
        }
      },
      NavStatus: {
        type: "object",
        properties: {
          is_configured: { type: "boolean", example: true },
          technical_user: { type: "string", example: "TECHUSER123" },
          last_sync: {
            type: "object",
            nullable: true,
            properties: {
              started_at: { type: "string", format: "date-time" },
              completed_at: { type: "string", format: "date-time" },
              status: { type: "string", example: "completed" },
              direction: { type: "string", example: "inbound" },
              invoices_fetched: { type: "integer", example: 14 },
              duration_ms: { type: "integer", example: 1250 }
            }
          },
          last_success_at: { type: "string", format: "date-time", nullable: true },
          recent_errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                started_at: { type: "string", format: "date-time" },
                error_message: { type: "string" }
              }
            }
          }
        }
      }
    }
  },
  paths: {
    "/v1/openapi.json": {
      get: {
        summary: "Hivatalos OpenAPI 3.0.3 specifikáció letöltése",
        description: "Visszaadja a Customer REST API teljes gépi sémáját JSON formátumban SDK-k és kliensek generálásához.",
        security: [],
        responses: {
          200: {
            description: "Sikeres specifikáció válasz"
          }
        }
      }
    },
    "/v1/invoices": {
      get: {
        summary: "Számlák listázása, szűrése & Hiánylista (has_image=false)",
        description: "Számlák lapozott listája. A has_image=false szűrővel lekérhető a számlaképpel még nem rendelkező tételek hiánylistája.",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "direction", in: "query", required: false, schema: { type: "string", enum: ["all", "inbound", "outbound", "INBOUND", "OUTBOUND"] } },
          { name: "has_image", in: "query", required: false, schema: { type: "boolean" }, description: "false esetén HIÁNYLISTA (kép nélküli NAV számlák)" },
          { name: "status", in: "query", required: false, schema: { type: "string", enum: ["paid", "unpaid", "all"] } },
          { name: "date_from", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "date_to", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "partner_tax_number", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 100 } }
        ],
        responses: {
          200: { description: "Számlák listája" },
          400: { description: "Érvénytelen query paraméter" },
          401: { description: "Érvénytelen API kulcs" },
          403: { description: "Nincs jogosultság a céghez" }
        }
      }
    },
    "/v1/invoices/{id}": {
      get: {
        summary: "Számla lekérése tételsorokkal",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: {
          200: { description: "Számla adatai" },
          404: { description: "Számla nem található" }
        }
      },
      patch: {
        summary: "Számla módosítása (bizonylatszám korrekció, számlakép összekötés, kategória)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  invoice_number: { type: "string", description: "OCR hiba esetén bizonylatszám javítása" },
                  attachment_url: { type: "string", description: "Számlakép csatolása" },
                  is_paid: { type: "boolean" },
                  payment_date: { type: "string", format: "date" },
                  category_id: { type: "string", format: "uuid" },
                  project_id: { type: "string", format: "uuid" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Számla sikeresen frissítve" },
          404: { description: "Számla nem található" }
        }
      },
      delete: {
        summary: "Számla törlése",
        description: "Manuális/feltöltött számla törlése. NAV-szinkronizált számla esetén 409 Conflict hiba keletkezik.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "delete_file", in: "query", required: false, schema: { type: "boolean" } }
        ],
        responses: {
          200: { description: "Számla sikeresen törölve" },
          404: { description: "Számla nem található" },
          409: { description: "NAV-szinkronizált számla nem törölhető" }
        }
      }
    },
    "/v1/invoices/{id}/image": {
      get: {
        summary: "Számlakép letöltése / Pre-signed letöltési URL kérése",
        description: "Számlakép (PDF vagy kép) 1 órás érvényességű közvetlen letöltési linkje, vagy 302 átirányítás a tárolóra.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "redirect", in: "query", required: false, schema: { type: "boolean", default: false }, description: "true esetén 302 HTTP átirányítás a fájlra" }
        ],
        responses: {
          200: { description: "Pre-signed URL válasz" },
          302: { description: "Közvetlen átirányítás a fájlra" },
          404: { description: "A számlához nem tartozik számlakép vagy a számla nem található" }
        }
      }
    },
    "/v1/invoices/upload": {
      post: {
        summary: "Számlakép feltöltése Base64 formátumban + azonnali NAV párosítás",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["file_base64"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  file_base64: { type: "string", description: "A PDF vagy képfájl Base64 kódolt tartalma" },
                  file_name: { type: "string", example: "szamla.pdf" },
                  nav_invoice_number: { type: "string", description: "Azonnali összerendeléshez a NAV bizonylatszám" },
                  direction: { type: "string", enum: ["inbound", "outbound", "INBOUND", "OUTBOUND"] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Sikeres feltöltés és párosítás" }
        }
      }
    },
    "/v1/invoices/link": {
      post: {
        summary: "Számlakép és NAV tétel közvetlen összekötése",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  invoice_id: { type: "string", format: "uuid" },
                  invoice_number: { type: "string" },
                  attachment_url: { type: "string" },
                  source_invoice_id: { type: "string", format: "uuid" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Összekötés sikeres" },
          404: { description: "Cél számla nem található" }
        }
      }
    },
    "/v1/transactions": {
      get: {
        summary: "Banki tranzakciók lekérdezése számlapárosítási információkkal",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "is_matched", in: "query", required: false, schema: { type: "boolean" }, description: "true: csak párosított | false: csak párosítatlan" },
          { name: "unmatched_only", in: "query", required: false, schema: { type: "boolean" }, description: "Alias az is_matched=false szűrőhöz" },
          { name: "date_from", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "date_to", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "currency", in: "query", required: false, schema: { type: "string", example: "HUF" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 50 } }
        ],
        responses: {
          200: { description: "Tranzakciók listája" }
        }
      }
    },
    "/v1/transactions/{id}/match": {
      post: {
        summary: "Banki tranzakció kézi összerendelése számlával",
        description: "Érvényesíti a tranzakció és számla létezését. Nem létező azonosító esetén szigorú 404 hibát ad.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["invoice_id"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  invoice_id: { type: "string", format: "uuid" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Sikeres összerendelés" },
          400: { description: "Hiányzó paraméter" },
          404: { description: "Tranzakció vagy számla nem található (TRANSACTION_NOT_FOUND / INVOICE_NOT_FOUND)" }
        }
      },
      delete: {
        summary: "Párosítás felbontása (Unmatch alias)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: {
          200: { description: "Párosítás sikeresen bontva" },
          404: { description: "Tranzakció nem található" }
        }
      }
    },
    "/v1/transactions/{id}/unmatch": {
      post: {
        summary: "Banki tranzakció és számla párosításának felbontása",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        responses: {
          200: { description: "Párosítás sikeresen felbontva" },
          400: { description: "A tranzakció nem volt párosítva" },
          404: { description: "Tranzakció nem található" }
        }
      }
    },
    "/v1/transactions/{id}": {
      delete: {
        summary: "Egyedi banki tranzakció törlése",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "force", in: "query", required: false, schema: { type: "boolean", default: false }, description: "Ha true, a párosított tranzakciót automatikusan unmatch-eli törlés előtt" }
        ],
        responses: {
          200: { description: "Tranzakció sikeresen törölve" },
          404: { description: "Tranzakció nem található" },
          409: { description: "A tranzakció számlához van rendelve (force=true szükséges)" }
        }
      }
    },
    "/v1/transactions/bulk-delete": {
      post: {
        summary: "Tranzakciók tömeges törlése (max 500 ID)",
        description: "Tömeges duplikációk takarítására szolgáló kötegelt végpont. Automatikusan cascade unmatch-eli és törli a kijelölt tételeket.",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["transaction_ids"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  transaction_ids: { type: "array", items: { type: "string", format: "uuid" } },
                  force: { type: "boolean", default: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Tranzakciók sikeresen törölve" }
        }
      }
    },
    "/v1/categories": {
      get: {
        summary: "Cég kategóriáinak listázása",
        description: "Visszaadja a céghez rögzített kategóriák listáját számlák kategorizálásához.",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: {
          200: { description: "Kategóriák listája" }
        }
      }
    },
    "/v1/nav/status": {
      get: {
        summary: "NAV Online Számla szinkron státusza és logjai",
        description: "Visszaadja a cég technikai felhasználójának állapotát, az utolsó számlaszinkron időpontját és az esetleges szinkronizációs hibákat.",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: {
          200: { description: "NAV státusz információk" }
        }
      }
    },
    "/v1/nav/sync": {
      post: {
        summary: "Manuális NAV számla szinkronizáció indítása",
        description: "Lekéri a NAV Online Számla rendszeréből a számlákat a megadott dátumtartományra és irányra, elmenti őket és automatikus újrapárosítási feladatot indít.",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["date_from"],
                properties: {
                  company_id: { type: "string", format: "uuid", description: "Cél cég azonosítója (többcéges kulcsnál kötelező)" },
                  date_from: { type: "string", format: "date", example: "2026-04-01", description: "Kezdő dátum (YYYY-MM-DD), kötelező" },
                  date_to: { type: "string", format: "date", example: "2026-04-30", description: "Záró dátum (YYYY-MM-DD), alapértelmezetten a mai nap" },
                  direction: { type: "string", enum: ["inbound", "outbound", "both"], default: "both", description: "Szinkronizáció iránya (inbound: bejövő, outbound: kimenő, both: mindkettő)" },
                  fetch_details: { type: "boolean", default: true, description: "Tételszintű számlasorok letöltése" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "A NAV szinkronizáció sikeresen lefutott",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "A manuális NAV szinkronizáció sikeresen lefutott." },
                    data: {
                      type: "object",
                      properties: {
                        company_id: { type: "string", format: "uuid" },
                        date_from: { type: "string", format: "date" },
                        date_to: { type: "string", format: "date" },
                        direction: { type: "string", enum: ["inbound", "outbound", "both"] },
                        total_invoices_fetched: { type: "integer", example: 14 },
                        total_invoices_inserted: { type: "integer", example: 2 }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: "#/components/schemas/ErrorResponse" },
          422: {
            description: "A megadott céghez nincs NAV technikai felhasználó beállítva",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          429: {
            description: "A cégnél nemrég futott vagy folyamatban van egy NAV szinkronizáció (60 másodperces cooldown védelem)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/partners": {
      get: {
        summary: "Partnertörzs listázása és keresése",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "search", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 50 } }
        ],
        responses: { 200: { description: "Partnerek listája" } }
      },
      post: {
        summary: "Új partner rögzítése",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  tax_number: { type: "string" },
                  address: { type: "string" },
                  email: { type: "string" },
                  bank_account_number: { type: "string" },
                  partner_type: { type: "string", enum: ["customer", "supplier", "both"] }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Partner sikeresen létrehozva" } }
      }
    },
    "/v1/partners/{id}": {
      patch: {
        summary: "Partner adatainak módosítása",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  tax_number: { type: "string" },
                  address: { type: "string" },
                  email: { type: "string" },
                  bank_account_number: { type: "string" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Partner sikeresen frissítve" } }
      }
    },
    "/v1/ledger": {
      get: {
        summary: "Sorszintű, kontírozott főkönyvi napló lekérdezése ERP feladáshoz",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "date_from", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "date_to", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 50 } }
        ],
        responses: { 200: { description: "Főkönyvi tételek" } }
      }
    },
    "/v1/reports/vat": {
      get: {
        summary: "Időszaki ÁFA bevallási kimutatás és pozíció",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "period", in: "query", required: false, schema: { type: "string", example: "2026-09" } },
          { name: "year", in: "query", required: false, schema: { type: "string", example: "2026" } }
        ],
        responses: { 200: { description: "ÁFA riport" } }
      }
    },
    "/v1/reports/pnl": {
      get: {
        summary: "Éves eredménykimutatás (P&L)",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "year", in: "query", required: false, schema: { type: "string", example: "2026" } }
        ],
        responses: { 200: { description: "Eredménykimutatás adatok" } }
      }
    },
    "/v1/projects": {
      get: {
        summary: "Aktív projektek és keretek listája",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: { 200: { description: "Projektek listája" } }
      },
      post: {
        summary: "Új projekt rögzítése",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  project_code: { type: "string" },
                  budget: { type: "number" },
                  description: { type: "string" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Projekt létrehozva" } }
      }
    },
    "/v1/companies": {
      get: {
        summary: "Az API kulccsal elérhető cégek listája",
        responses: { 200: { description: "Elérhető cégek" } }
      }
    },
    "/v1/company": {
      get: {
        summary: "Cég részletes törzsadatai és beállításai",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: { 200: { description: "Cégadatok" } }
      },
      patch: {
        summary: "Cégadatok módosítása (whitelistelt mezők)",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  tax_number: { type: "string" },
                  address: { type: "string" },
                  description: { type: "string" },
                  primary_teaor: { type: "string" },
                  vat_regime: { type: "string" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Cég sikeresen frissítve" } }
      }
    },
    "/v1/settings": {
      patch: {
        summary: "Cég működési beállításainak frissítése",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  work_start_time: { type: "string", example: "08:00" },
                  work_end_time: { type: "string", example: "16:30" },
                  admin_deadline: { type: "integer", example: 10 },
                  monthly_working_hours: { type: "integer", example: 168 },
                  gl_date_basis: { type: "string", enum: ["fulfillment_date", "issue_date"] }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Beállítások frissítve" } }
      }
    },
    "/v1/auth/me": {
      get: {
        summary: "Hitelesített API kulcs introspekció és engedélyek",
        description: "Visszaadja az éppen használt API kulcs metaadatait, scope-ját, rate limitjét és az elérhető cégek listáját.",
        responses: {
          200: { description: "API kulcs adatok" }
        }
      }
    },
    "/v1/tickets": {
      get: {
        summary: "Hibajegyek listája lapozással és szűréssel",
        description: "A céghez tartozó hibajegyek lekérdezése státusz, prioritás és típus szűréssel.",
        parameters: [
          { $ref: "#/components/parameters/CompanyIdQuery" },
          { name: "status", in: "query", schema: { type: "string", enum: ["created", "assigned", "in_progress", "waiting_confirmation", "resolved", "all"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["low", "medium", "high", "critical"] } },
          { name: "type", in: "query", schema: { type: "string", enum: ["bug", "feedback", "question"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "page_size", in: "query", schema: { type: "integer", default: 20, maximum: 100 } }
        ],
        responses: { 200: { description: "Hibajegyek listája" } }
      },
      post: {
        summary: "Új hibajegy nyitása a céghez",
        description: "Új hibajelentés, visszajelzés vagy kérdés rögzítése programozottan.",
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  type: { type: "string", enum: ["bug", "feedback", "question"], default: "bug" },
                  service: { type: "string", enum: ["eaisybill", "accounty"], default: "eaisybill" },
                  priority: { type: "string", enum: ["low", "medium", "high", "critical"], default: "medium" },
                  message: { type: "string", description: "A hiba vagy visszajelzés részletes leírása." },
                  page_url: { type: "string", description: "Opcionális forrás URL vagy modulnév." },
                  attachments: { type: "array", items: { type: "string" }, description: "Csatolmányok nyilvános vagy tároló URL-jei." }
                }
              }
            }
          }
        },
        responses: { 201: { description: "Hibajegy sikeresen létrehozva" } }
      }
    },
    "/v1/tickets/{id}": {
      get: {
        summary: "Egyedi hibajegy adatlapja és publikus hozzászólásai",
        description: "A megadott hibajegy adatainak és hozzászólásainak lekérése UUID vagy jegyszám (EB-xxxx) alapján.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Hibajegy UUID vagy jegyszám (pl. EB-0094)" },
          { $ref: "#/components/parameters/CompanyIdQuery" }
        ],
        responses: {
          200: { description: "Hibajegy részletek és publikus hozzászólások" },
          404: { description: "Hibajegy nem található" }
        }
      }
    },
    "/v1/tickets/{id}/comments": {
      post: {
        summary: "Új hozzászólás küldése a hibajegyhez",
        description: "Ügyfél válasz vagy további információ hozzáfűzése a meglévő hibajegyhez.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  company_id: { type: "string", format: "uuid" },
                  message: { type: "string", description: "Hozzászólás szövege." },
                  attachments: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Hozzászólás sikeresen rögzítve" },
          400: {
            description: "Érvénytelen adatok vagy lezárt hibajegy (TICKET_CLOSED)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          404: { description: "Hibajegy nem található" }
        }
      }
    },
    "/v1/tickets/{id}/confirm-resolution": {
      post: {
        summary: "Megoldás jóváhagyása és hibajegy lezárása",
        description: "Az ügyfél megerősíti a probléma megoldódását, a hibajegy resolved státuszba kerül.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  company_id: { type: "string", format: "uuid" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Hibajegy sikeresen lezárva" } }
      }
    }
  }
};
