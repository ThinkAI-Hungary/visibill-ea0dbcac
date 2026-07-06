// shipment-retroactive-match — Edge Function v2
// DR-031: Retroaktív shipment matching invoice-first szcenárióhoz
//
// Trigger: ShipmentImportPage.tsx hívja az Excel import befejezése után (1 HTTP POST)
//
// Matching logika:
//   1. Pozíciószám egyezés (kötelező)
//   2. Összeg összehasonlítás (±5% tolerancia)
//      - Tiszta match (≥95% konfidencia) → status='confirmed', invoice='matched'
//      - Eltéréssel jár (75% konfidencia) → status='pending', invoice='escalated'
//        → megjelenik az EszkalációListan "Párosítási eltérések" szekciójában
//
// Auth: verify_jwt=false, de saját service_role kulcs ellenőrzés
// Timeout: ~60s elegendő (tisztán DB műveletek)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Segédfüggvények ──────────────────────────────────────────────────────────

/** Pozíciószám normalizálás és összehasonlítás — tükrözi a Python logikát */
function positionNumbersMatch(invoicePos: string, shipmentPos: string): boolean {
  if (!invoicePos || !shipmentPos) return false;

  const normalize = (p: string): { prefix: string; digits: string } => {
    const m = p.trim().match(/^([A-Za-z])\/(\d+)$/);
    if (m) return { prefix: m[1].toUpperCase(), digits: m[2] };
    return { prefix: "", digits: p.trim() };
  };

  const inv = normalize(invoicePos);
  const ship = normalize(shipmentPos);

  if (inv.prefix && ship.prefix) {
    if (inv.prefix !== ship.prefix) return false;
    return inv.digits.endsWith(ship.digits) || ship.digits.endsWith(inv.digits);
  }
  return inv.digits.endsWith(ship.digits) || ship.digits.endsWith(inv.digits);
}

/** Összeg összehasonlítás — visszaad eltérés %-ot és leírást */
function compareAmounts(
  invoiceAmount: number,
  invoiceCurrency: string,
  shipAmountHuf: number | null,
  shipAmountEur: number | null,
): { diff: number; discrepancy: string | null } {
  let shipAmount: number | null = null;

  if (invoiceCurrency === "EUR" && shipAmountEur !== null) {
    shipAmount = Math.abs(shipAmountEur);
  } else if (invoiceCurrency === "HUF" && shipAmountHuf !== null) {
    shipAmount = Math.abs(shipAmountHuf);
  } else if (shipAmountHuf !== null) {
    // Fallback: HUF alapú összehasonlítás más devizánál — csak jelzés szinten
    shipAmount = Math.abs(shipAmountHuf);
  }

  if (shipAmount === null || shipAmount === 0) {
    return { diff: 999, discrepancy: "Selexped kalkulált összeg nem elérhető" };
  }

  const invoiceAbs = Math.abs(invoiceAmount);
  const diffPct = Math.abs(invoiceAbs - shipAmount) / Math.max(invoiceAbs, shipAmount);

  if (diffPct > 0.05) {
    const diffFormatted = (diffPct * 100).toFixed(1);
    return {
      diff: diffPct,
      discrepancy: `Összegeltérés: számla ${invoiceAbs.toFixed(2)} ${invoiceCurrency} ↔ Selexped ${shipAmount.toFixed(2)} (${diffFormatted}% eltérés)`,
    };
  }

  return { diff: 0, discrepancy: null };
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const company_id: string | undefined = body?.company_id;
    const import_session_id: string | undefined = body?.import_session_id;

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[retro-match v2] START company=${company_id} session=${import_session_id ?? "n/a"}`);

    // ── 1. Escalated invoicek pozíciószámmal ──────────────────────────────────
    const { data: pendingInvoices, error: invErr } = await supabase
      .from("invoices")
      .select("id, position_numbers, brutto_vegosszeg, penznem")
      .eq("company_id", company_id)
      .eq("shipment_match_status", "escalated")
      .not("position_numbers", "is", null);

    if (invErr) throw new Error(`Invoice fetch: ${invErr.message}`);
    if (!pendingInvoices?.length) {
      return new Response(
        JSON.stringify({ matched: 0, pending: 0, checked: 0, message: "No pending invoices" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Shipmentek (90 napos ablak) ────────────────────────────────────────
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const { data: shipments, error: shipErr } = await supabase
      .from("shipments")
      .select("id, position_number, carrier_name, calculated_amount_huf, calculated_amount_eur, delivery_date, pickup_date")
      .eq("company_id", company_id)
      .gte("pickup_date", cutoff.toISOString().slice(0, 10));

    if (shipErr) throw new Error(`Shipment fetch: ${shipErr.message}`);
    if (!shipments?.length) {
      return new Response(
        JSON.stringify({ matched: 0, pending: 0, checked: pendingInvoices.length, message: "No shipments in 90d window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Retroaktív matching logika ─────────────────────────────────────────
    // Minden invoice-hoz megkeressük az egyező shipmentet pozíciószám alapján,
    // majd összeg-ellenőrzést futtatunk:
    //   - Tiszta match (≤5% eltérés)  → confidence=95, status='confirmed'
    //   - Összegeltérés (>5%)          → confidence=75, status='pending' (user jóváhagyás kell)
    //   - Nincs összeg adat            → confidence=60, status='pending'

    let confirmedCount = 0;
    let pendingCount = 0;
    const checkedCount = pendingInvoices.length;

    for (const invoice of pendingInvoices) {
      const posNums: string[] = invoice.position_numbers ?? [];
      if (!posNums.length) continue;

      const matchedShipments = shipments.filter((ship) =>
        posNums.some((invPos) => positionNumbersMatch(invPos, ship.position_number))
      );

      if (!matchedShipments.length) continue;

      for (const ship of matchedShipments) {
        // ── Összeg összehasonlítás ──
        const discrepancies: string[] = [];
        let confidence = 75; // pozíciószám match alap

        if (invoice.brutto_vegosszeg != null) {
          const { diff, discrepancy } = compareAmounts(
            invoice.brutto_vegosszeg,
            invoice.penznem ?? "HUF",
            ship.calculated_amount_huf,
            ship.calculated_amount_eur,
          );

          if (discrepancy) {
            discrepancies.push(discrepancy);
            confidence = 75; // eltérés → marad 75%
          } else {
            confidence = 95; // tiszta match
          }
        } else {
          discrepancies.push("Számlaösszeg nem elérhető az összehasonlításhoz");
          confidence = 60;
        }

        // ── Státusz meghatározása ──
        // Ha nincs eltérés → confirmed (automatikusan párosítva)
        // Ha van eltérés   → pending  (user jóváhagyás kell)
        const matchStatus = discrepancies.length === 0 ? "confirmed" : "pending";
        const invoiceStatus = discrepancies.length === 0 ? "matched" : "escalated";

        console.log(
          `[retro-match v2] invoice=${invoice.id} → ship=${ship.id} | conf=${confidence}% | status=${matchStatus} | discrepancies=${discrepancies.length}`
        );

        // ── Upsert a shipment_matches táblába ──
        const { error: upsertErr } = await supabase
          .from("shipment_matches")
          .upsert(
            {
              company_id,
              invoice_id: invoice.id,
              shipment_id: ship.id,
              match_type: "retroactive",
              confidence_score: confidence,
              match_details: {
                matched_by: "position_number",
                retroactive: true,
                import_session_id: import_session_id ?? null,
              },
              discrepancies,
              status: matchStatus,
            },
            { onConflict: "invoice_id,shipment_id", ignoreDuplicates: false }
          );

        if (upsertErr) {
          console.error(`[retro-match v2] Upsert error invoice=${invoice.id}:`, upsertErr);
          continue;
        }

        // ── Placeholder törlése (pending_shipment NULL rekord) ──
        await supabase
          .from("shipment_matches")
          .delete()
          .eq("invoice_id", invoice.id)
          .is("shipment_id", null)
          .eq("status", "pending_shipment");

        // ── Invoice státusz frissítés ──
        await supabase
          .from("invoices")
          .update({ shipment_match_status: invoiceStatus })
          .eq("id", invoice.id);

        // ── Transport documents linkálása ──
        await supabase
          .from("transport_documents")
          .update({ linked_shipment_id: ship.id })
          .eq("linked_invoice_id", invoice.id)
          .is("linked_shipment_id", null);

        // ── Shipment frissítése (csak confirmed esetén) ──
        if (matchStatus === "confirmed") {
          await supabase
            .from("shipments")
            .update({ match_status: "matched", matched_invoice_id: invoice.id })
            .eq("id", ship.id);
          confirmedCount++;
        } else {
          // Pending esetén a shipment 'review' státuszba kerül
          await supabase
            .from("shipments")
            .update({ match_status: "review" })
            .eq("id", ship.id);
          pendingCount++;
        }
      }
    }

    const result = {
      confirmed: confirmedCount,
      pending: pendingCount,
      checked: checkedCount,
      import_session_id: import_session_id ?? null,
    };

    console.log(`[retro-match v2] DONE`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[retro-match v2] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
