import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Spinner, Alert, KpiCard, Badge } from '../components/ui';
import { peso, num, date } from '../lib/format';
import { DATE_PRESETS, DatePreset, presetRange } from '../lib/datePresets';

interface Sale {
  id: string;
  number: string;
  channel: 'PO' | 'POS';
  distributionType: 'TRADE' | 'DROP_SHIP';
  total: number;
  createdAt: string;
  customerName?: string;
  sellerOrg: { id: string; name: string; type: string };
  buyerOrg?: { name: string } | null;
  items: { quantity: number }[];
}
interface SalesResponse {
  summary: {
    count: number;
    revenue: number;
    grossIncome: number;
    units: number;
    trade: { count: number; revenue: number };
    dropShip: { count: number; revenue: number };
    byChannel: {
      PO: { count: number; units: number; revenue: number };
      POS: { count: number; units: number; revenue: number };
    };
    bySku: { sku: string; name: string; units: number; revenue: number }[];
  };
  sales: Sale[];
}

type SalesTab = 'sales' | 'sku' | 'channel';

export default function SalesReport() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<DatePreset>('all');
  const [filters, setFilters] = useState({ from: '', to: '', tier: '', distributionType: '', channel: '' });

  function applyPreset(p: DatePreset) {
    setPreset(p);
    const r = presetRange(p);
    if (r) setFilters((f) => ({ ...f, from: r.from, to: r.to }));
  }
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filters]);

  const { data, loading, error } = useFetch<SalesResponse>(`/sales?${qs}`, [qs]);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [tab, setTab] = useState<SalesTab>('sales');
  const [detailId, setDetailId] = useState<string | null>(null);

  async function exportCsv() {
    setExporting(true);
    setExportErr(null);
    try {
      const res = await api.get(`/sales/export.csv?${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sales-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(apiError(e));
    } finally {
      setExporting(false);
    }
  }

  const canFilterTier = user!.role === 'PRINCIPAL' || user!.role === 'PROVINCIAL';

  return (
    <div>
      <PageHeader
        title="Sales Report"
        subtitle="Your sales plus rolled-up downstream sales"
        action={
          <button className="btn-ghost" onClick={exportCsv} disabled={exporting}>
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        }
      />

      {exportErr && <div className="mb-4"><Alert>{exportErr}</Alert></div>}

      <div className="card mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                preset === p.key
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {preset === 'custom' && (
          <>
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </div>
          </>
        )}
        {canFilterTier && (
          <div>
            <label className="label">Tier</label>
            <select className="input" value={filters.tier} onChange={(e) => setFilters({ ...filters, tier: e.target.value })}>
              <option value="">All</option>
              <option value="PRINCIPAL">Principal</option>
              <option value="PROVINCIAL">Provincial</option>
              <option value="CITY">City</option>
              <option value="RESELLER">Reseller</option>
            </select>
          </div>
        )}
        <div>
          <label className="label">Type</label>
          <select className="input" value={filters.distributionType} onChange={(e) => setFilters({ ...filters, distributionType: e.target.value })}>
            <option value="">All</option>
            <option value="TRADE">Regular</option>
            <option value="DROP_SHIP">Dropship</option>
          </select>
        </div>
        <div>
          <label className="label">Channel</label>
          <select className="input" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
            <option value="">All</option>
            <option value="POS">POS</option>
            <option value="PO">Purchase Order</option>
          </select>
        </div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : (
        <>
          {/* Distribution / Drop-ship headline (renamed Trade -> Distribution) */}
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-2">
            <KpiCard label="Distribution Revenue" value={peso(data!.summary.trade.revenue)} hint={`${data!.summary.trade.count} sales · Regular`} />
            <KpiCard label="Drop-ship Revenue" value={peso(data!.summary.dropShip.revenue)} hint={`${data!.summary.dropShip.count} sales`} />
          </div>

          {/* Sub-section tabs */}
          <div className="mb-4 flex gap-2 border-b border-slate-200">
            {([
              { k: 'sales', label: 'Sales' },
              { k: 'sku', label: 'Sales per SKU' },
              { k: 'channel', label: 'Sales per Channel' },
            ] as { k: SalesTab; label: string }[]).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                  tab === t.k ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'sales' && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard label="Total Revenue" value={peso(data!.summary.revenue)} accent="text-brand-600" hint="net, after discounts" />
                <KpiCard label="Number of Transactions" value={num(data!.summary.count)} />
                <KpiCard label="Gross Income" value={peso(data!.summary.grossIncome)} hint="sales − acquisition cost" />
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="th">Sale #</th>
                      <th className="th">Date</th>
                      <th className="th">Seller</th>
                      <th className="th">Buyer / Customer</th>
                      <th className="th">Channel</th>
                      <th className="th">Type</th>
                      <th className="th text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.sales.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50">
                        <td className="td">
                          <button onClick={() => setDetailId(s.id)} className="font-mono text-xs font-semibold text-brand-600 hover:underline">
                            {s.number}
                          </button>
                        </td>
                        <td className="td whitespace-nowrap text-xs text-slate-500">{date(s.createdAt)}</td>
                        <td className="td">{s.sellerOrg.name}</td>
                        <td className="td">{s.buyerOrg?.name || s.customerName || 'Walk-in'}</td>
                        <td className="td text-xs">{s.channel}</td>
                        <td className="td"><Badge value={s.distributionType} /></td>
                        <td className="td text-right font-semibold">{peso(s.total)}</td>
                      </tr>
                    ))}
                    {!data!.sales.length && (
                      <tr><td className="td text-slate-400" colSpan={7}>No sales match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'sku' && (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">SKU</th>
                    <th className="th">Product</th>
                    <th className="th text-right">Units Sold</th>
                    <th className="th text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.summary.bySku.map((r) => (
                    <tr key={r.sku} className="border-b border-slate-50">
                      <td className="td font-mono text-xs">{r.sku}</td>
                      <td className="td">{r.name}</td>
                      <td className="td text-right">{num(r.units)}</td>
                      <td className="td text-right font-semibold">{peso(r.revenue)}</td>
                    </tr>
                  ))}
                  {!data!.summary.bySku.length && (
                    <tr><td className="td text-slate-400" colSpan={4}>No sales match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'channel' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                { k: 'POS', label: 'POS (direct sales)' },
                { k: 'PO', label: 'Purchase Order' },
              ] as { k: 'POS' | 'PO'; label: string }[]).map((c) => (
                <div key={c.k} className="card">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">{c.label}</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-slate-400">Transactions</div>
                      <div className="text-lg font-bold">{num(data!.summary.byChannel[c.k].count)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Units</div>
                      <div className="text-lg font-bold">{num(data!.summary.byChannel[c.k].units)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Revenue</div>
                      <div className="text-lg font-bold text-brand-600">{peso(data!.summary.byChannel[c.k].revenue)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detailId && <SaleDetail saleId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

interface ReceiptDetail {
  number: string;
  seller: { name: string; type: string };
  channel: string;
  distributionType: string;
  customerName?: string;
  customerEmail?: string | null;
  discountRate: number;
  subtotal: number;
  total: number;
  savings: number;
  createdAt: string;
  lines: { sku: string; name: string; quantity: number; unitSrp: number; unitPrice: number; lineTotal: number }[];
}

function SaleDetail({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { data, loading, error } = useFetch<ReceiptDetail>(`/sales/${saleId}`);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Pre-fill with the customer's email once loaded.
  useEffect(() => {
    if (data?.customerEmail) setEmail(data.customerEmail);
  }, [data?.customerEmail]);

  async function emailReceipt() {
    setErr(null);
    setMsg(null);
    setSending(true);
    try {
      await api.post(`/sales/${saleId}/email-receipt`, { email });
      setMsg(`Receipt emailed to ${email}`);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <Spinner />
        ) : error || !data ? (
          <Alert>{error || 'Not found'}</Alert>
        ) : (
          <>
            <div className="mb-3 text-center">
              <div className="text-lg font-black text-brand-600">Juan Palaman</div>
              <div className="text-xs text-slate-400">{data.seller.name}</div>
              <div className="mt-1 text-xs text-slate-400">{date(data.createdAt)}</div>
            </div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-mono">{data.number}</span>
              <span className="text-slate-500">{data.channel} · <Badge value={data.distributionType} /></span>
            </div>
            <div className="mb-3 text-xs text-slate-500">Customer: {data.customerName || 'Walk-in'}</div>
            <table className="w-full text-sm">
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i} className="border-b border-dashed border-slate-100">
                    <td className="py-1">{l.name}<div className="text-xs text-slate-400">{l.quantity} × {peso(l.unitPrice)}</div></td>
                    <td className="py-1 text-right">{peso(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal (SRP)</span><span>{peso(data.subtotal)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Discount ({Math.round(data.discountRate * 100)}%)</span><span>-{peso(data.savings)}</span></div>
              <div className="flex justify-between text-lg font-bold text-brand-600"><span>Total</span><span>{peso(data.total)}</span></div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <label className="label">Email receipt to customer</label>
              {err && <div className="mb-2"><Alert>{err}</Alert></div>}
              {msg && <div className="mb-2"><Alert kind="success">{msg}</Alert></div>}
              <div className="flex gap-2">
                <input className="input" type="email" placeholder="customer@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn-primary whitespace-nowrap" disabled={sending || !email} onClick={emailReceipt}>
                  {sending ? 'Sending…' : 'Email'}
                </button>
              </div>
            </div>
            <button className="btn-ghost mt-4 w-full" onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
