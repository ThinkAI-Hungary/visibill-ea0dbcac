import type { SubledgerItem, GroupedSubledgerInvoice } from '@/types/subledger';

export interface DerivedForeignAmounts {
  isForeign: boolean;
  exchangeRate: number | null;
  foreignGross: number | null;
  foreignNet: number | null;
  foreignVat: number | null;
  foreignRemaining: number | null;
  foreignSettled: number | null;
}

/**
 * Derives foreign gross, net, vat, settled and remaining amounts for a single subledger item.
 */
export function deriveItemForeignAmounts(item: SubledgerItem): DerivedForeignAmounts {
  const isForeign = Boolean(item.currency && item.currency !== 'HUF');
  if (!isForeign) {
    return {
      isForeign: false,
      exchangeRate: null,
      foreignGross: null,
      foreignNet: null,
      foreignVat: null,
      foreignRemaining: null,
      foreignSettled: null,
    };
  }

  const rate =
    item.exchange_rate ||
    (item.foreign_amount && item.foreign_amount > 0 && item.amount
      ? Number((item.amount / item.foreign_amount).toFixed(4))
      : null);

  const foreignGross =
    item.foreign_amount != null
      ? item.foreign_amount
      : rate && item.amount
      ? Number((item.amount / rate).toFixed(2))
      : null;

  let foreignNet: number | null = null;
  let foreignVat: number | null = null;

  const alapLines = (item.all_lines || []).filter((l) => l.vat_role === 'ALAP');
  const afaLines = (item.all_lines || []).filter((l) => l.vat_role === 'AFA');

  if (alapLines.length > 0 && alapLines.some((l) => l.foreign_amount != null)) {
    foreignNet = alapLines.reduce((s, l) => s + (l.foreign_amount || 0), 0);
  } else if (rate && item.net_amount != null) {
    foreignNet = Number((item.net_amount / rate).toFixed(2));
  } else if (foreignGross != null && (item.vat_amount === 0 || !item.vat_amount)) {
    foreignNet = foreignGross;
  }

  if (item.vat_amount === 0) {
    foreignVat = 0;
  } else if (afaLines.length > 0 && afaLines.some((l) => l.foreign_amount != null)) {
    foreignVat = afaLines.reduce((s, l) => s + (l.foreign_amount || 0), 0);
  } else if (rate && item.vat_amount != null) {
    foreignVat = Number((item.vat_amount / rate).toFixed(2));
  } else if (foreignGross != null && foreignNet != null) {
    foreignVat = Number((foreignGross - foreignNet).toFixed(2));
  }

  let foreignRemaining: number | null = null;
  if (item.remaining_amount === 0) {
    foreignRemaining = 0;
  } else if (Math.abs(item.remaining_amount - item.amount) < 0.01 && foreignGross != null) {
    foreignRemaining = foreignGross;
  } else if (rate) {
    foreignRemaining = Number((item.remaining_amount / rate).toFixed(2));
  }

  let foreignSettled: number | null = null;
  if (item.settled_amount === 0) {
    foreignSettled = 0;
  } else if (foreignGross != null && foreignRemaining != null) {
    foreignSettled = Number((foreignGross - foreignRemaining).toFixed(2));
  } else if (rate) {
    foreignSettled = Number((item.settled_amount / rate).toFixed(2));
  }

  return {
    isForeign: true,
    exchangeRate: rate,
    foreignGross,
    foreignNet,
    foreignVat,
    foreignRemaining,
    foreignSettled,
  };
}

/**
 * Groups filtered subledger items into invoices with aggregate financial numbers,
 * properly supporting both domestic (HUF) and foreign currency (EUR, USD, etc.) values.
 */
export function groupSubledgerItems(items: SubledgerItem[]): GroupedSubledgerInvoice[] {
  const map = new Map<string, GroupedSubledgerInvoice>();

  items.forEach((item) => {
    const docId =
      (item.document_id && item.document_id.trim()) ||
      (item.settlement_number && item.settlement_number.trim()) ||
      item.header_id;
    const partnerKey = item.partner_id || item.partner_name || 'no-partner';
    const key = `${partnerKey}___${docId}`;

    const {
      isForeign,
      exchangeRate,
      foreignGross,
      foreignNet,
      foreignVat,
      foreignRemaining,
      foreignSettled,
    } = deriveItemForeignAmounts(item);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        group_key: key,
        document_id: docId,
        partner_id: item.partner_id,
        partner_name: item.partner_name,
        posting_date: item.posting_date,
        document_date: item.document_date || item.posting_date,
        due_date: item.due_date,
        journal_code: item.journal_code,
        journal_number: item.journal_number,
        currency: item.currency || 'HUF',
        exchange_rate: exchangeRate,
        description: item.description,
        status: item.status,
        is_settled: item.is_settled,
        net_amount: Number(item.net_amount || 0),
        vat_amount: Number(item.vat_amount || 0),
        amount: Number(item.amount || 0),
        foreign_amount: foreignGross,
        foreign_net_amount: foreignNet,
        foreign_vat_amount: foreignVat,
        foreign_settled_amount: foreignSettled,
        foreign_remaining_amount: foreignRemaining,
        settled_amount: Number(item.settled_amount || 0),
        remaining_amount: Number(item.remaining_amount || 0),
        match_count: item.match_count || 0,
        items: [item],
        header_ids: [item.header_id],
        line_ids: [item.line_id],
        all_lines: item.all_lines ? [...item.all_lines] : [],
      });
    } else {
      existing.items.push(item);
      if (!existing.header_ids.includes(item.header_id)) {
        existing.header_ids.push(item.header_id);
      }
      existing.line_ids.push(item.line_id);
      if (item.all_lines) {
        existing.all_lines.push(...item.all_lines);
      }
      existing.net_amount += Number(item.net_amount || 0);
      existing.vat_amount += Number(item.vat_amount || 0);
      existing.amount += Number(item.amount || 0);
      existing.settled_amount += Number(item.settled_amount || 0);
      existing.remaining_amount += Number(item.remaining_amount || 0);
      existing.match_count += item.match_count || 0;

      if (isForeign) {
        if (foreignGross != null) {
          existing.foreign_amount = Number(((existing.foreign_amount || 0) + foreignGross).toFixed(2));
        }
        if (foreignNet != null) {
          existing.foreign_net_amount = Number(((existing.foreign_net_amount || 0) + foreignNet).toFixed(2));
        }
        if (foreignVat != null) {
          existing.foreign_vat_amount = Number(((existing.foreign_vat_amount || 0) + foreignVat).toFixed(2));
        }
        if (foreignSettled != null) {
          existing.foreign_settled_amount = Number(((existing.foreign_settled_amount || 0) + foreignSettled).toFixed(2));
        }
        if (foreignRemaining != null) {
          existing.foreign_remaining_amount = Number(((existing.foreign_remaining_amount || 0) + foreignRemaining).toFixed(2));
        }
        if (existing.foreign_amount && existing.foreign_amount > 0 && existing.amount > 0) {
          existing.exchange_rate = Number((existing.amount / existing.foreign_amount).toFixed(4));
        }
      }

      if (item.status === 'GEPI_JAVASLAT') {
        existing.status = 'GEPI_JAVASLAT';
      } else if (item.status === 'KEZI_PISZKOZAT' && existing.status !== 'GEPI_JAVASLAT') {
        existing.status = 'KEZI_PISZKOZAT';
      }

      existing.is_settled = existing.remaining_amount <= 0.01;

      if (item.due_date && (!existing.due_date || item.due_date > existing.due_date)) {
        existing.due_date = item.due_date;
      }
    }
  });

  return Array.from(map.values());
}
