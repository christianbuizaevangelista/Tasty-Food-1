// Lightweight email sender using the Resend HTTP API (no SMTP ports, which
// suits serverless). If RESEND_API_KEY is not set, it logs and no-ops so the
// app keeps working without email configured.

const DIST_LABEL: Record<string, string> = { TRADE: 'Regular', DROP_SHIP: 'Dropship' };

function peso(n: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n || 0);
}

export interface PoSubmittedEmail {
  to: string;
  supplierName: string;
  poNumber: string;
  buyerName: string;
  total: number;
  distributionType: string;
  itemsCount: number;
}

export async function sendPoSubmittedEmail(p: PoSubmittedEmail): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Tasty Food <onboarding@resend.dev>';

  if (!p.to) return { sent: false, reason: 'supplier has no email on file' };
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would notify ${p.to} of PO ${p.poNumber}`);
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const dist = DIST_LABEL[p.distributionType] ?? p.distributionType;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#e8521d;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
        <strong style="font-size:18px">Juan Palaman · Tasty Food Mfg. Inc.</strong>
      </div>
      <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 8px">New Purchase Order to approve</h2>
        <p>Hi ${p.supplierName}, you have received a new purchase order awaiting your approval.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#666">PO Number</td><td style="text-align:right"><strong>${p.poNumber}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">From</td><td style="text-align:right">${p.buyerName}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Distribution</td><td style="text-align:right">${dist}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Items</td><td style="text-align:right">${p.itemsCount}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Total</td><td style="text-align:right"><strong>${peso(p.total)}</strong></td></tr>
        </table>
        <p style="margin-top:16px">Log in to the distribution portal to review and approve this order.</p>
      </div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject: `New Purchase Order ${p.poNumber} from ${p.buyerName}`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[email] Resend error', res.status, body);
      return { sent: false, reason: `Resend responded ${res.status}` };
    }
    return { sent: true };
  } catch (err: any) {
    console.error('[email] send failed', err?.message);
    return { sent: false, reason: err?.message ?? 'send failed' };
  }
}
