/**
 * Bérszámfejtési adatbekérő e-mail sablon
 *
 * Havi adatbekérő e-mail generálása könyvelői irodák számára.
 * Az e-mail kéri a hiányzó adatokat (jelenléti ív, változások, új belépők/kilépők).
 */

export interface PayrollRequestEmailInput {
  companyName: string;
  contactName: string;
  year: number;
  month: number;
  dueDate: string;           // YYYY-MM-DD
  portalLink?: string;        // Ügyfélportál link
  senderName: string;         // Könyvelő neve
  senderCompany: string;      // Iroda neve

  // Opcionális testreszabás
  extraRequests?: string[];   // Extra kérendő dokumentumok
  hasNewEmployees?: boolean;  // Vannak új belépők?
  hasTerminations?: boolean;  // Vannak kilépők?
  hasSalaryChanges?: boolean; // Vannak bérmódosítások?
}

const MONTHS_HU = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

export interface PayrollRequestEmailResult {
  subject: string;
  plainText: string;
  htmlBody: string;
}

export function generatePayrollRequestEmail(input: PayrollRequestEmailInput): PayrollRequestEmailResult {
  const monthName = MONTHS_HU[input.month - 1];
  const dueDateFormatted = new Date(input.dueDate).toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const subject = `Bérszámfejtés - ${input.year}. ${monthName} - Adatbekérés | ${input.companyName}`;

  // Build checklist items
  const checklist: string[] = [
    'Jelenléti ív / munkaidő nyilvántartás',
    'Túlóra kimutatás (ha volt)',
    'Táppénz igazolások',
    'Szabadság igénylések',
  ];

  if (input.hasNewEmployees) {
    checklist.push('Új belépők adatai (TAJ, adóazonosító, bankszámla, nyilatkozatok)');
  }
  if (input.hasTerminations) {
    checklist.push('Kilépők dokumentumai (kilépés dátuma, elszámolás)');
  }
  if (input.hasSalaryChanges) {
    checklist.push('Bérmódosítások részletei');
  }
  checklist.push('Cafeteria juttatások (SZÉP kártya igények)');
  checklist.push('Adóelőleg-nyilatkozat módosítások (ha van)');

  if (input.extraRequests) {
    checklist.push(...input.extraRequests);
  }

  // Plain text version
  const plainText = `Tisztelt ${input.contactName}!

Kérem, hogy a(z) ${input.companyName} ${input.year}. ${monthName} havi bérszámfejtéséhez az alábbi dokumentumokat / adatokat legkésőbb ${dueDateFormatted}-ig szíveskedjen eljuttatni:

${checklist.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}

${input.portalLink ? `Az adatokat az ügyfélportálon keresztül is feltöltheti:\n${input.portalLink}\n` : ''}
Amennyiben az adott hónapban nem volt változás, kérem egy rövid visszajelzését erről is.

Köszönettel,
${input.senderName}
${input.senderCompany}`;

  // HTML version
  const htmlBody = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #2d3436; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); color: #fff; padding: 24px; border-radius: 12px 12px 0 0; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .header .period { font-size: 14px; opacity: 0.85; margin-top: 4px; }
  .content { background: #fff; border: 1px solid #dfe6e9; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; }
  .greeting { font-size: 14px; margin-bottom: 16px; }
  .deadline { background: #ffeaa7; border: 1px solid #fdcb6e; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; }
  .deadline strong { color: #d63031; }
  .checklist { list-style: none; padding: 0; margin: 16px 0; }
  .checklist li { padding: 8px 12px; border-left: 3px solid #0984e3; margin-bottom: 6px; background: #f8f9fa; border-radius: 0 6px 6px 0; font-size: 13px; }
  .portal-btn { display: inline-block; background: #0984e3; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0; }
  .portal-btn:hover { background: #0874c9; }
  .note { font-size: 12px; color: #636e72; margin-top: 16px; padding-top: 12px; border-top: 1px solid #dfe6e9; }
  .signature { margin-top: 20px; font-size: 13px; }
  .signature .name { font-weight: 700; }
  .signature .company { color: #636e72; }
</style>
</head>
<body>
  <div class="header">
    <h1>📋 Bérszámfejtési adatbekérés</h1>
    <div class="period">${input.year}. ${monthName} · ${input.companyName}</div>
  </div>
  <div class="content">
    <p class="greeting">Tisztelt ${escHtml(input.contactName)}!</p>
    <p style="font-size:14px;">Kérem, hogy a(z) <strong>${escHtml(input.companyName)}</strong> ${input.year}. ${monthName} havi bérszámfejtéséhez az alábbi dokumentumokat / adatokat szíveskedjen eljuttatni:</p>
    
    <div class="deadline">
      ⏰ Határidő: <strong>${dueDateFormatted}</strong>
    </div>

    <ul class="checklist">
      ${checklist.map(item => `<li>✓ ${escHtml(item)}</li>`).join('\n      ')}
    </ul>

    ${input.portalLink ? `
    <div style="text-align:center;">
      <a href="${input.portalLink}" class="portal-btn">📤 Feltöltés az ügyfélportálon</a>
    </div>
    ` : ''}

    <p class="note">
      Amennyiben az adott hónapban nem volt változás, kérem egy rövid visszajelzését erről is. 
      Ez segíti a pontos és időben történő bérszámfejtést.
    </p>

    <div class="signature">
      <div class="name">${escHtml(input.senderName)}</div>
      <div class="company">${escHtml(input.senderCompany)}</div>
    </div>
  </div>
</body>
</html>`;

  return { subject, plainText, htmlBody };
}

/**
 * Generate a follow-up reminder email
 */
export function generatePayrollReminderEmail(input: PayrollRequestEmailInput & { 
  reminderNumber: number; 
  originalSentDate: string;
}): PayrollRequestEmailResult {
  const monthName = MONTHS_HU[input.month - 1];
  const dueDateFormatted = new Date(input.dueDate).toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const subject = `⚠️ Emlékeztető (${input.reminderNumber}.) - Bérszámfejtés ${input.year}. ${monthName} | ${input.companyName}`;

  const isOverdue = new Date(input.dueDate) < new Date();

  const plainText = `Tisztelt ${input.contactName}!

Emlékeztetem, hogy a(z) ${input.companyName} ${input.year}. ${monthName} havi bérszámfejtési adatai ${isOverdue ? 'lejárt határidővel' : `${dueDateFormatted}-ig`} várjuk.

${input.portalLink ? `Portál: ${input.portalLink}` : ''}

Köszönettel,
${input.senderName}
${input.senderCompany}`;

  const htmlBody = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #2d3436; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: ${isOverdue ? '#d63031' : '#e17055'}; color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0; }
  .header h1 { margin: 0; font-size: 16px; }
  .content { background: #fff; border: 1px solid #dfe6e9; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; }
  .urgent { background: ${isOverdue ? '#ffcccc' : '#ffeaa7'}; border: 1px solid ${isOverdue ? '#d63031' : '#fdcb6e'}; border-radius: 8px; padding: 12px 16px; margin: 12px 0; font-size: 13px; font-weight: 600; }
  .portal-btn { display: inline-block; background: #d63031; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 12px 0; }
  .signature { margin-top: 20px; font-size: 13px; }
  .signature .name { font-weight: 700; }
  .signature .company { color: #636e72; }
</style>
</head>
<body>
  <div class="header">
    <h1>⚠️ ${input.reminderNumber}. Emlékeztető — Bérszámfejtés ${input.year}. ${monthName}</h1>
  </div>
  <div class="content">
    <p>Tisztelt ${escHtml(input.contactName)}!</p>
    <div class="urgent">
      ${isOverdue 
        ? `A(z) ${escHtml(input.companyName)} bérszámfejtési adatainak határideje (${dueDateFormatted}) LEJÁRT. Kérem, sürgősen küldje meg az adatokat!`
        : `A(z) ${escHtml(input.companyName)} bérszámfejtési adatainak határideje: ${dueDateFormatted}. Kérem, küldje meg mielőbb!`
      }
    </div>
    ${input.portalLink ? `<div style="text-align:center;"><a href="${input.portalLink}" class="portal-btn">📤 Adatok feltöltése</a></div>` : ''}
    <div class="signature">
      <div class="name">${escHtml(input.senderName)}</div>
      <div class="company">${escHtml(input.senderCompany)}</div>
    </div>
  </div>
</body>
</html>`;

  return { subject, plainText, htmlBody };
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
