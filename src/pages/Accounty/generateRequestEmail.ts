// ══════════════════════════════════════════════════════════════
// generateRequestEmail — AI-style email template for missing docs
// ══════════════════════════════════════════════════════════════

export interface MissingItemForEmail {
  title: string;
  category: string;
  deadline?: string;
}

export interface GenerateEmailParams {
  companyName: string;
  contactName?: string;
  missingItems: MissingItemForEmail[];
  portalLink: string;
  senderName?: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  htmlPreview: string;
}

const categoryLabels: Record<string, string> = {
  bejovo: 'Bejövő számla',
  kimeno: 'Kimenő számla',
  bank: 'Banki dokumentum',
  ber: 'Bérszámfejtés',
};

export function generateRequestEmail(params: GenerateEmailParams): GeneratedEmail {
  const {
    companyName,
    contactName,
    missingItems,
    portalLink,
    senderName = 'ThinkAI',
  } = params;

  const greeting = contactName
    ? `Kedves ${contactName}!`
    : `Tisztelt ${companyName}!`;

  const itemCount = missingItems.length;
  const subject = `Hiányzó dokumentumok bekérése – ${companyName}`;

  const itemsList = missingItems
    .map((item) => {
      const catLabel = categoryLabels[item.category] || item.category;
      const deadlineStr = item.deadline ? ` (Határidő: ${item.deadline})` : '';
      return `• ${item.title} – ${catLabel}${deadlineStr}`;
    })
    .join('\n');

  const body = `${greeting}

Könyvelőjük az alábbi ${itemCount > 1 ? `${itemCount} dokumentum` : 'dokumentum'} benyújtását kéri a havi könyvelési zárás érdekében:

${itemsList}

A dokumentumokat az alábbi linken keresztül tudja biztonságosan feltölteni:
${portalLink}

Amennyiben a dokumentumokat már eljuttatta hozzánk, kérjük tekintse tárgytalannak ezt az üzenetet.

Üdvözlettel,
${senderName}`;

  const htmlPreview = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #111827; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <div style="color: #ffffff; font-size: 20px; font-weight: 700;">eaisybooks</div>
    <div style="color: #9ca3af; font-size: 12px; margin-top: 2px;">Dokumentum bekérés</div>
  </div>
  <div style="padding: 28px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 15px; color: #374151; margin-bottom: 16px;">${greeting}</p>
    <p style="font-size: 14px; color: #374151; line-height: 1.6;">
      Könyvelőjük az alábbi ${itemCount > 1 ? `<strong>${itemCount}</strong> dokumentum` : 'dokumentum'} 
      benyújtását kéri a havi könyvelési zárás érdekében:
    </p>
    <div style="margin: 20px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Dokumentum</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Kategória</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Határidő</th>
          </tr>
        </thead>
        <tbody>
          ${missingItems.map(item => `
          <tr>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #111827; font-weight: 500;">${item.title}</td>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">${categoryLabels[item.category] || item.category}</td>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">${item.deadline || '–'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${portalLink}" style="display: inline-block; padding: 14px 32px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
         Dokumentumok feltöltése
      </a>
    </div>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">
      Amennyiben a dokumentumokat már eljuttatta hozzánk, kérjük tekintse tárgytalannak ezt az üzenetet.
    </p>
    <p style="font-size: 14px; color: #374151; margin-top: 20px;">
      Üdvözlettel,<br/>
      <strong>${senderName}</strong>
    </p>
  </div>
  <div style="background: #f3f4f6; padding: 14px 28px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 11px; color: #9ca3af; margin: 0;">Ez a levél automatikusan készült az eaisybooks rendszerből.</p>
  </div>
</div>`;

  return { subject, body, htmlPreview };
}

// ── Outgoing message type for the approval queue ──

export type MessageStatus = 'pending' | 'approved' | 'rejected' | 'sent';
export type MessageCategory = 'urgent' | 'normal' | 'callback';

export interface OutgoingMessage {
  id: string;
  companyId: string;
  companyName: string;
  contactEmail: string;
  channel: 'email';
  category: MessageCategory;
  subject: string;
  originalContext: string;
  aiGeneratedBody: string;
  htmlPreview: string;
  portalLink: string;
  status: MessageStatus;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  sentAt?: string;
  missingItemIds: string[];
}

// ── localStorage helpers ──

const STORAGE_KEY = 'accounty_approval_queue';

export function getApprovalQueue(): OutgoingMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveApprovalQueue(messages: OutgoingMessage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export function addToApprovalQueue(message: OutgoingMessage): void {
  const queue = getApprovalQueue();
  queue.unshift(message);
  saveApprovalQueue(queue);

  // ── Fire email notification to firm admins/seniors ──
  fireApprovalNotification(message).catch((err) =>
    console.error('[approval-queue] Notification fire failed:', err)
  );
}

async function fireApprovalNotification(message: OutgoingMessage): Promise<void> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session?.user?.id) return;

    await supabase.functions.invoke('send-accounty-notification', {
      body: {
        user_id: session.user.id,
        type: 'accounty_approval',
        title: 'Új jóváhagyásra váró üzenet',
        body_html: `
          <p><strong>${message.companyName}</strong> céghez tartozó dokumentum-bekérő üzenet jóváhagyásra vár.</p>
          <div style="background:#f3f4f6;padding:12px 16px;border-radius:6px;margin:12px 0">
            <p style="margin:0;font-size:13px;color:#6b7280">Tárgy:</p>
            <p style="margin:4px 0 0;font-weight:600">${message.subject}</p>
          </div>
          <p style="font-size:13px;color:#6b7280">Címzett: ${message.contactEmail}</p>
          <p style="margin-top:16px">
            <a href="https://app.visibill.hu/accounty/approval-queue" 
               style="display:inline-block;padding:10px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
              Jóváhagyás megtekintése
            </a>
          </p>
        `,
        subject: `Jóváhagyásra vár: ${message.companyName} – dokumentum bekérés`,
        company_name: message.companyName,
        company_id: message.companyId,
      },
    });
  } catch {
    // Best-effort — don't break the queue flow
  }
}

export function updateMessageStatus(
  messageId: string,
  status: MessageStatus,
  extraFields?: Partial<OutgoingMessage>
): void {
  const queue = getApprovalQueue();
  const idx = queue.findIndex((m) => m.id === messageId);
  if (idx === -1) return;

  queue[idx] = {
    ...queue[idx],
    ...extraFields,
    status,
    ...(status === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
    ...(status === 'rejected' ? { rejectedAt: new Date().toISOString() } : {}),
    ...(status === 'sent' ? { sentAt: new Date().toISOString() } : {}),
  };
  saveApprovalQueue(queue);
}

export function updateMessageBody(messageId: string, newBody: string): void {
  const queue = getApprovalQueue();
  const idx = queue.findIndex((m) => m.id === messageId);
  if (idx === -1) return;
  queue[idx].aiGeneratedBody = newBody;
  saveApprovalQueue(queue);
}
