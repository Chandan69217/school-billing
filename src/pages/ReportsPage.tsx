import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  Layers,
  TrendingUp,
  CreditCard,
  Printer
} from 'lucide-react';
import { apiClient } from '../api/client.js';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'classWise'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [dailyData, setDailyData] = useState<any | null>(null);
  const [monthlyData, setMonthlyData] = useState<any | null>(null);
  const [classData, setClassData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate, selectedYear]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'daily') {
        const res = await apiClient.get(`/reports/daily-collection?date=${selectedDate}`);
        if (res.data?.success) setDailyData(res.data.data);
      } else if (reportType === 'monthly') {
        const res = await apiClient.get(`/reports/monthly-collection?year=${selectedYear}`);
        if (res.data?.success) setMonthlyData(res.data.data);
      } else if (reportType === 'classWise') {
        const res = await apiClient.get('/reports/class-wise-collection');
        if (res.data?.success) setClassData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    let rows: string[][] = [];
    let filename = 'report.csv';

    if (reportType === 'daily' && dailyData) {
      filename = `daily-collection-${selectedDate}.csv`;
      rows.push(['Receipt #', 'Student', 'Adm #', 'Class', 'Method', 'Amount (INR)', 'Officer']);
      dailyData.payments?.forEach((p: any) => {
        rows.push([p.receiptNumber, p.studentName, p.admissionNumber, `${p.className} (${p.sectionName})`, p.paymentMethod, p.amount.toString(), p.collectedBy]);
      });
    } else if (reportType === 'classWise' && classData) {
      filename = 'class-wise-collection.csv';
      rows.push(['Class', 'Students', 'Total Billed (INR)', 'Total Collected (INR)', 'Pending (INR)', 'Collection Rate']);
      classData.forEach((c: any) => {
        rows.push([c.className, c.studentCount.toString(), c.totalBilled.toString(), c.totalCollected.toString(), c.totalPending.toString(), `${c.collectionPercentage}%`]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Financial & Admission Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional revenue analytics, collection breakdowns, and exportable audit ledgers.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs self-stretch sm:self-auto min-h-[42px] sm:min-h-[36px]"
        >
          <Download className="h-4 w-4 text-indigo-600" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Report Type Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {[
            { id: 'daily', label: 'Daily Collection' },
            { id: 'monthly', label: 'Monthly Trend' },
            { id: 'classWise', label: 'Class-wise Performance' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[38px] sm:min-h-[auto] ${
                reportType === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {reportType === 'daily' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700 shrink-0">Audit Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs bg-white w-full sm:w-auto min-h-[38px] sm:min-h-[auto]"
            />
          </div>
        )}

        {reportType === 'monthly' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700 shrink-0">Year:</span>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs bg-white font-mono w-full sm:w-28 min-h-[38px] sm:min-h-[auto]"
            />
          </div>
        )}
      </div>

      {/* Report Canvas */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Compiling report records...
        </div>
      ) : reportType === 'daily' && dailyData ? (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Day Collection</span>
              <div className="text-xl font-bold text-emerald-600 tabular-nums mt-1">
                ₹{Number(dailyData.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Transactions Count</span>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                {dailyData.totalTransactions} Receipts Issued
              </div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Report Date</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {new Date(dailyData.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-3 sm:px-4">Receipt #</th>
                    <th className="py-3 px-3 sm:px-4">Student</th>
                    <th className="py-3 px-3 sm:px-4">Class</th>
                    <th className="py-3 px-3 sm:px-4">Method</th>
                    <th className="py-3 px-3 sm:px-4">Cashier</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyData.payments?.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 sm:px-4 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-semibold text-slate-900">{p.studentName}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-slate-600">{p.className} ({p.sectionName})</td>
                      <td className="py-2.5 px-3 sm:px-4 font-medium">{p.paymentMethod}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-slate-600">{p.collectedBy}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-bold text-emerald-700">
                        ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {(!dailyData.payments || dailyData.payments.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No collections recorded for this selected date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : reportType === 'classWise' ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[620px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3 sm:px-4">Class</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Active Enrolled</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Total Billed</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Total Collected</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Realization Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classData.map((cls: any) => (
                  <tr key={cls.classId}>
                    <td className="py-3 px-3 sm:px-4 font-bold text-slate-900">{cls.className}</td>
                    <td className="py-3 px-3 sm:px-4 text-center font-semibold text-slate-700">{cls.studentCount}</td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono tabular-nums text-slate-700">
                      ₹{Number(cls.totalBilled).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono tabular-nums font-bold text-emerald-600">
                      ₹{Number(cls.totalCollected).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono tabular-nums font-bold text-rose-600">
                      ₹{Number(cls.totalPending).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center">
                      <span className="font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full">
                        {cls.collectionPercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : reportType === 'monthly' && monthlyData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-slate-100 gap-2">
            <span className="text-xs font-bold text-slate-700">Annual Monthly Collections ({monthlyData.year})</span>
            <span className="text-sm font-bold text-emerald-700 font-mono">
              Total Realized: ₹{Number(monthlyData.totalAnnual).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {monthlyData.months?.map((m: any) => (
              <div key={m.monthNumber} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
                <div className="text-[11px] font-bold text-slate-500 uppercase">{m.month}</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-1">
                  ₹{Number(m.amount).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{m.count} txns</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
