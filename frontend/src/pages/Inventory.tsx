import { useFetch } from '../lib/useFetch';
import { PageHeader, Spinner, Alert, KpiCard, Badge } from '../components/ui';
import { peso, num, dateTime } from '../lib/format';
import { InventoryItem } from '../types';
import { useState } from 'react';
import { api, apiError } from '../api/client';

interface InvResponse {
  orgId: string;
  items: InventoryItem[];
  costEditable: boolean;
  totalValue: number;
  lowStockCount: number;
}

interface LedgerEntry {
  id: string;
  change: number;
  balance: number;
  reason: string;
  createdAt: string;
  product: { sku: string; name: string };
}

export default function Inventory() {
  const { data, loading, error, refetch } = useFetch<InvResponse>('/inventory');
  const [ledgerFor, setLedgerFor] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const ledger = useFetch<{ entries: LedgerEntry[] }>(
    ledgerFor ? `/inventory/ledger?productId=${ledgerFor}` : null,
    [ledgerFor]
  );

  // Save cost / reorder level for an item, then refresh.
  async function saveSetting(productId: string, patch: { cost?: number | null; reorderLevel?: number | null }) {
    setSaveErr(null);
    try {
      await api.patch('/inventory/settings', { productId, ...patch });
      refetch();
    } catch (e) {
      setSaveErr(apiError(e));
    }
  }
  function parseNum(v: string): number | null {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return isNaN(n) ? null : n;
  }

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Your organization's current stock and per-SKU ledger" />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="SKUs" value={num(data.items.length)} />
        <KpiCard label="Stock Value" value={peso(data.totalValue)} accent="text-brand-600" />
        <KpiCard
          label="Low-stock Alerts"
          value={num(data.lowStockCount)}
          accent={data.lowStockCount ? 'text-red-600' : 'text-slate-900'}
        />
      </div>

      {saveErr && <div className="mb-4"><Alert>{saveErr}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="th">SKU</th>
              <th className="th">Product</th>
              <th className="th text-right">SRP</th>
              <th className="th text-right">Cost</th>
              <th className="th text-right">On hand</th>
              <th className="th text-right">Reorder @</th>
              <th className="th text-right">Value</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-50">
                <td className="td font-mono text-xs">{it.sku}</td>
                <td className="td font-medium">{it.name}</td>
                <td className="td text-right">{peso(it.srp)}</td>
                <td className="td text-right">
                  {data.costEditable ? (
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={it.cost ?? ''}
                      placeholder="—"
                      className="input w-24 text-right"
                      onBlur={(e) => {
                        const v = parseNum(e.target.value);
                        if (v !== (it.cost ?? null)) saveSetting(it.productId, { cost: v });
                      }}
                    />
                  ) : (
                    <span className="text-slate-500">{it.cost != null ? peso(it.cost) : '—'}</span>
                  )}
                </td>
                <td className="td text-right">
                  <span className={it.lowStock ? 'font-bold text-red-600' : ''}>{num(it.quantity)}</span>
                </td>
                <td className="td text-right">
                  <input
                    type="number"
                    min={0}
                    defaultValue={it.reorderLevel ?? ''}
                    placeholder="set…"
                    className="input w-20 text-right"
                    onBlur={(e) => {
                      const v = parseNum(e.target.value);
                      if (v !== (it.reorderLevel ?? null)) saveSetting(it.productId, { reorderLevel: v });
                    }}
                  />
                </td>
                <td className="td text-right">{peso(it.stockValue)}</td>
                <td className="td text-right">
                  {it.lowStock && <Badge value="LOW" />}{' '}
                  <button
                    className="text-xs font-semibold text-brand-600 hover:underline"
                    onClick={() => setLedgerFor(it.productId)}
                  >
                    Ledger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ledgerFor && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={() => setLedgerFor(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Stock Ledger</h2>
              <button className="btn-ghost text-xs" onClick={() => setLedgerFor(null)}>Close</button>
            </div>
            {ledger.loading ? (
              <Spinner />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">Date</th>
                    <th className="th">Reason</th>
                    <th className="th text-right">Change</th>
                    <th className="th text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.data?.entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50">
                      <td className="td whitespace-nowrap text-xs">{dateTime(e.createdAt)}</td>
                      <td className="td text-xs">{e.reason}</td>
                      <td className={`td text-right font-semibold ${e.change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {e.change > 0 ? `+${e.change}` : e.change}
                      </td>
                      <td className="td text-right">{e.balance}</td>
                    </tr>
                  ))}
                  {!ledger.data?.entries.length && (
                    <tr><td className="td text-slate-400" colSpan={4}>No movements yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
