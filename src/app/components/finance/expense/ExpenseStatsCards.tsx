'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown, Users, FileText } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

interface StatsData {
  byStatus: Record<string, number>;
  amounts: { approved: number; pending: number };
  overdue: number;
  myPending: number;
  categoryBreakdown: Array<{ category: string; count: number; amount: number }>;
  monthlyTrend: Array<{ month: string; count: number; amount: number }>;
  recentRequests: Array<any>;
  dateRange: { from: string; to: string };
}

interface ExpenseStatsCardsProps {
  workspaceId: string;
  userRole: string;
  userId: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <FileText className="w-5 h-5" />,
  SUBMITTED: <FileText className="w-5 h-5" />,
  FINANCE_REVIEW: <AlertTriangle className="w-5 h-5" />,
  PENDING_APPROVAL: <Clock className="w-5 h-5" />,
  APPROVED: <CheckCircle2 className="w-5 h-5" />,
  REJECTED: <XCircle className="w-5 h-5" />,
  CANCELLED: <XCircle className="w-5 h-5" />,
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-600',
  FINANCE_REVIEW: 'bg-amber-100 text-amber-600',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-600',
  APPROVED: 'bg-emerald-100 text-emerald-600',
  REJECTED: 'bg-red-100 text-red-600',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Diajukan',
  FINANCE_REVIEW: 'Finance Review',
  PENDING_APPROVAL: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export default function ExpenseStatsCards({ workspaceId, userRole, userId }: ExpenseStatsCardsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/v1/expense-requests/stats`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setStats(data.stats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 h-3 w-3/4 rounded bg-slate-200"></div>
            <div className="h-7 w-1/2 rounded bg-slate-200"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const totalRequests = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
  const approvalRate = stats.byStatus.APPROVED && totalRequests > 0 
    ? ((stats.byStatus.APPROVED / totalRequests) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-4">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Pengajuan"
          value={totalRequests.toLocaleString('id-ID')}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          iconBg="bg-emerald-100 text-emerald-600"
          trend={{ value: approvalRate + '%', label: 'Tingkat Approval', positive: true }}
        />
        <StatCard
          title="Menunggu Persetujuan"
          value={(
            (stats.byStatus.FINANCE_REVIEW || 0) + 
            (stats.byStatus.PENDING_APPROVAL || 0)
          ).toLocaleString('id-ID')}
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          iconBg="bg-amber-100 text-amber-600"
          subValue={stats.overdue > 0 && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {stats.overdue} terlambat
            </span>
          )}
        />
        <StatCard
          title="Total Disetujui"
          value={formatRupiah(stats.amounts.approved)}
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          iconBg="bg-emerald-100 text-emerald-600"
          trend={{ value: stats.amounts.pending > 0 ? '+' : '-', label: `Pending: ${formatRupiah(stats.amounts.pending)}`, positive: false }}
        />
        <StatCard
          title="Menunggu Saya"
          value={stats.myPending.toLocaleString('id-ID')}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          iconBg="bg-blue-100 text-blue-600"
        />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Status Pengajuan</h3>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${STATUS_COLORS[status]}`}>
                    {STATUS_ICONS[status]}
                  </span>
                  <span className="text-xs font-medium text-slate-700">{STATUS_LABELS[status]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-900">{count.toLocaleString('id-ID')}</span>
                  {totalRequests > 0 && (
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                      <div 
                        className="h-full rounded-full bg-emerald-600 transition-all" 
                        style={{ width: `${(count / totalRequests) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Kategori Pengeluaran (Disetujui)</h3>
          {stats.categoryBreakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                      {cat.category}
                    </span>
                    <span className="text-xs text-slate-500">{cat.count} pengajuan</span>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-emerald-800">{formatRupiah(cat.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">Belum ada data kategori</p>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      {stats.monthlyTrend.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Tren Bulanan (Disetujui)</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bulan</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Jumlah</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.monthlyTrend.slice(-6).reverse().map((month) => (
                  <tr key={month.month} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 text-slate-700">{month.month}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">{month.count}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-emerald-800">{formatRupiah(month.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Requests */}
      {stats.recentRequests.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Pengajuan Terbaru</h3>
          <div className="space-y-2">
            {stats.recentRequests.slice(0, 5).map((req: any) => (
              <div key={req.id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${STATUS_COLORS[req.status]}`}>
                    {STATUS_ICONS[req.status]}
                  </span>
                  <div>
                    <p className="truncate text-xs font-medium text-slate-900">{req.title}</p>
                    <p className="text-xs text-slate-500">{req.requester?.fullName} • {new Date(req.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-emerald-800">{formatRupiah(req.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  iconBg, 
  subValue, 
  trend 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  iconBg: string; 
  subValue?: React.ReactNode; 
  trend?: { value: string; label: string; positive: boolean }; 
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
          {subValue && <div className="mt-2">{subValue}</div>}
        </div>
        <div className={`rounded-lg p-2 ${iconBg}`}>{icon}</div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.positive ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
            {trend.value}
          </span>
          <span className="text-xs text-slate-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}