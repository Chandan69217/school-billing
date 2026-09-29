import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { apiClient } from '../api/client.js';

interface DashboardPageProps {
  onOpenFeeCollection: () => void;
  onOpenReceipt: (receiptId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenFeeCollection,
  onOpenReceipt
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/dashboard/stats');
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load dashboard data');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];
  const METHOD_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 lg:col-span-2 bg-slate-200 animate-pulse rounded-xl" />
          <div className="h-80 bg-slate-200 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center rounded-xl bg-white border border-slate-200">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Failed to load dashboard data</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const { cards, charts, recentPayments, recentAdmissions } = data;

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Administrative & Fee Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial collection, admissions summary, and student demographics for Academic Session <strong>{cards.activeAcademicYear}</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => navigate('/admissions')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors min-h-[44px] cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>New Admission</span>
          </button>
          <button
            onClick={onOpenFeeCollection}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors min-h-[44px] cursor-pointer"
          >
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <span>Collect Fee</span>
          </button>
        </div>
      </div>

      {/* 6 Key Stat Cards: 1 col on mobile, 2 on tablet, 4 on desktop (as requested: grid-cols-1 sm:grid-cols-2 xl:grid-cols-4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Total Students */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Students</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {cards.totalStudents}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
            <span>Enrolled Active</span>
          </div>
        </div>

        {/* New Admissions */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Admissions</span>
            <UserPlus className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {cards.newAdmissions}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Session {cards.activeAcademicYear}
          </div>
        </div>

        {/* Total Collection */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Collected</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            ₹{cards.totalFeeCollection.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">
            Verified In Bank/Cash
          </div>
        </div>

        {/* Pending Fees */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Pending Due</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 tabular-nums">
            ₹{cards.pendingFees.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 font-medium">
            Receivables Outstanding
          </div>
        </div>

        {/* Today's Collection */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Today's Inflow</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            ₹{cards.todayCollection.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Collected Today
          </div>
        </div>

        {/* This Month's Collection */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">This Month</span>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            ₹{cards.thisMonthCollection.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">
            Monthly Target Pace
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Fee Collection Trend Area Chart */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Monthly Fee Collection Velocity</h2>
              <p className="text-xs text-slate-500">Gross fee realizations across recent billing cycles</p>
            </div>
          </div>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="feeColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Collection']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#feeColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Payment Channel Breakdown</h2>
            <p className="text-xs text-slate-500">Distribution by instrument type</p>
          </div>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.paymentMethods} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `₹${v/1000}k`} />
                <YAxis dataKey="method" type="category" stroke="#64748b" fontSize={10} width={80} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[0, 4, 4, 0]}>
                  {charts.paymentMethods.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={METHOD_COLORS[index % METHOD_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Row: Recent Payments & Recent Admissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments Table */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Collections</h2>
              <p className="text-xs text-slate-500">Latest recorded fee receipts</p>
            </div>
            <button
              onClick={() => navigate('/payments')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[520px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px]">
                  <th className="pb-2">Receipt #</th>
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Class</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-center">Method</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                    <td className="py-2.5">
                      <div className="font-semibold text-slate-900">{p.studentName}</div>
                      <div className="text-[10px] text-slate-500">{p.admissionNumber}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{p.className} ({p.sectionName})</td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-emerald-700">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {p.receiptId && (
                        <button
                          onClick={() => onOpenReceipt(p.receiptId)}
                          className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                          title="View Receipt"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Admissions Table */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Admissions</h2>
              <p className="text-xs text-slate-500">Newly enrolled students</p>
            </div>
            <button
              onClick={() => navigate('/students')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5"
            >
              <span>Student Directory</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[520px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px]">
                  <th className="pb-2">Adm #</th>
                  <th className="pb-2">Student Name</th>
                  <th className="pb-2">Class</th>
                  <th className="pb-2">Parent & Phone</th>
                  <th className="pb-2 text-right">Enrolled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAdmissions.map((s: any) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/students?studentId=${s.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-mono font-bold text-slate-900">{s.admissionNumber}</td>
                    <td className="py-2.5 font-semibold text-slate-900">{s.studentName}</td>
                    <td className="py-2.5 text-slate-600">{s.className} ({s.sectionName})</td>
                    <td className="py-2.5">
                      <div className="text-slate-800">{s.parentName}</div>
                      <div className="text-[10px] text-slate-400">{s.parentPhone}</div>
                    </td>
                    <td className="py-2.5 text-right text-slate-500">
                      {new Date(s.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
