import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  Layers,
  TrendingUp,
  CreditCard,
  Building,
  Tag,
  Users,
  AlertTriangle,
  XCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { apiClient } from '../api/client.js';

type ReportTab =
  | 'daily'
  | 'monthly'
  | 'classWise'
  | 'feeHead'
  | 'hostel'
  | 'discounts'
  | 'staff'
  | 'cancelled';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<ReportTab>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [dailyData, setDailyData] = useState<any | null>(null);
  const [monthlyData, setMonthlyData] = useState<any | null>(null);
  const [classData, setClassData] = useState<any[]>([]);
  const [feeHeadData, setFeeHeadData] = useState<any[]>([]);
  const [hostelData, setHostelData] = useState<any | null>(null);
  const [discountData, setDiscountData] = useState<any | null>(null);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [cancelledData, setCancelledData] = useState<any[]>([]);
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
      } else if (reportType === 'feeHead') {
        const res = await apiClient.get('/reports/fee-head-wise');
        if (res.data?.success) setFeeHeadData(res.data.data);
      } else if (reportType === 'hostel') {
        const res = await apiClient.get('/reports/hostel');
        if (res.data?.success) setHostelData(res.data.data);
      } else if (reportType === 'discounts') {
        const res = await apiClient.get('/reports/discounts');
        if (res.data?.success) setDiscountData(res.data.data);
      } else if (reportType === 'staff') {
        const res = await apiClient.get('/reports/user-wise-collection');
        if (res.data?.success) setStaffData(res.data.data);
      } else if (reportType === 'cancelled') {
        const res = await apiClient.get('/reports/cancelled-payments');
        if (res.data?.success) setCancelledData(res.data.data);
      }
    } catch (err) {
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    let rows: string[][] = [];
    let filename = `PBPS-Report-${reportType}.csv`;

    if (reportType === 'daily' && dailyData) {
      filename = `PBPS-Daily-Collection-${selectedDate}.csv`;
      rows.push(['Receipt #', 'Student Name', 'Admission #', 'Class', 'Hostel', 'Method', 'Amount (INR)', 'Officer', 'Date']);
      dailyData.payments?.forEach((p: any) => {
        rows.push([
          p.receiptNumber,
          p.studentName,
          p.admissionNumber,
          p.className,
          p.isHostel ? 'Hostel' : 'Day',
          p.paymentMethod,
          p.amount.toString(),
          typeof p.collectedBy === 'object' ? (p.collectedBy?.fullName || p.collectedBy?.username || 'Staff') : (p.collectedBy || 'Staff'),
          new Date(p.paidAt).toLocaleString('en-IN')
        ]);
      });
    } else if (reportType === 'classWise' && classData) {
      filename = 'PBPS-Class-Wise-Performance.csv';
      rows.push(['Class', 'Students', 'Hostel Students', 'Total Billed (INR)', 'Total Collected (INR)', 'Outstanding Due (INR)', 'Collection Rate']);
      classData.forEach((c: any) => {
        rows.push([
          c.className,
          c.studentCount.toString(),
          (c.hostelCount || 0).toString(),
          c.totalBilled.toString(),
          c.totalCollected.toString(),
          c.totalPending.toString(),
          `${c.collectionPercentage}%`
        ]);
      });
    } else if (reportType === 'feeHead' && feeHeadData) {
      filename = 'PBPS-Fee-Head-Wise-Collection.csv';
      rows.push(['Fee Head', 'Code', 'Billing Frequency', 'Total Billed (INR)', 'Collected (INR)', 'Dues (INR)']);
      feeHeadData.forEach((f: any) => {
        rows.push([f.feeHead, f.code, f.frequency, f.billed.toString(), f.collected.toString(), f.dues.toString()]);
      });
    } else if (reportType === 'hostel' && hostelData) {
      filename = 'PBPS-Hostel-Boarders-Report.csv';
      rows.push(['Student Name', 'Admission #', 'Class', 'Room #', 'Emergency Phone', 'Total Billed', 'Total Paid', 'Total Due']);
      hostelData.students?.forEach((s: any) => {
        rows.push([s.name, s.admissionNumber, s.className, s.roomNumber, s.emergencyPhone || '', s.totalBilled.toString(), s.totalPaid.toString(), s.totalDue.toString()]);
      });
    } else if (reportType === 'discounts' && discountData) {
      filename = 'PBPS-Discount-Concessions-Report.csv';
      rows.push(['Rule Name', 'Discount (INR)', 'Approved At']);
      discountData.discounts?.forEach((d: any) => {
        rows.push([d.discountRuleId || 'Custom Rule', d.amount.toString(), d.createdAt]);
      });
    } else if (reportType === 'staff' && staffData) {
      filename = 'PBPS-Staff-Collection-Summary.csv';
      rows.push(['Officer Name', 'Username', 'Role', 'Transactions', 'Total Amount (INR)']);
      staffData.forEach((u: any) => {
        rows.push([u.fullName, u.username, u.role, u.transactionsCount.toString(), u.totalAmount.toString()]);
      });
    } else if (reportType === 'cancelled' && cancelledData) {
      filename = 'PBPS-Cancelled-Payments-Audit.csv';
      rows.push(['Receipt #', 'Student Name', 'Admission #', 'Amount (INR)', 'Payment Method', 'Cancelled At', 'Cancellation Reason', 'Officer']);
      cancelledData.forEach((c: any) => {
        rows.push([
          c.receiptNumber,
          c.studentName,
          c.admissionNumber,
          c.amount.toString(),
          c.paymentMethod,
          new Date(c.cancelledAt).toLocaleString('en-IN'),
          c.cancellationReason,
          typeof c.collectedBy === 'object' ? (c.collectedBy?.fullName || c.collectedBy?.username || 'Staff') : (c.collectedBy || 'Staff')
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(x => `"${(x || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadReportPdf = async () => {
    try {
      setDownloading('pdf');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (reportType === 'daily') params.append('date', selectedDate);
      if (reportType === 'monthly') params.append('year', selectedYear.toString());
      
      const res = await fetch(`/api/reports/${reportType}/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const contentDisp = res.headers.get('Content-Disposition');
      let filename = `${reportType}_report.pdf`;
      if (contentDisp && contentDisp.includes('filename=')) {
        filename = contentDisp.split('filename=')[1].replace(/"/g, '').trim();
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(null);
    }
  };

  const downloadReportExcel = async () => {
    try {
      setDownloading('excel');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (reportType === 'daily') params.append('date', selectedDate);
      if (reportType === 'monthly') params.append('year', selectedYear.toString());
      
      const res = await fetch(`/api/reports/${reportType}/excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Excel export failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const contentDisp = res.headers.get('Content-Disposition');
      let filename = `${reportType}_report.xlsx`;
      if (contentDisp && contentDisp.includes('filename=')) {
        filename = contentDisp.split('filename=')[1].replace(/"/g, '').trim();
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download Excel:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'daily', label: '1. Daily Collection' },
    { id: 'monthly', label: '2. Monthly Trend' },
    { id: 'classWise', label: '3. Class Dues & Realization' },
    { id: 'feeHead', label: '4. Fee-Head-Wise' },
    { id: 'hostel', label: '5. Hostel Boarders' },
    { id: 'discounts', label: '6. Discounts & Concessions' },
    { id: 'staff', label: '7. Staff Counter Collections' },
    { id: 'cancelled', label: '8. Cancelled Payments Audit' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Institutional Audit & Revenue Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete institutional reports according to Director specifications with professional PDF, Excel (.xlsx), and Print layouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            title="Print current report view"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            <span>Print</span>
          </button>

          {/* Download Master Excel Button */}
          <button
            onClick={downloadReportExcel}
            disabled={downloading === 'excel'}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors disabled:opacity-50"
            title="Download formal Excel file with embedded logo, auto-filter, and formula totals"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{downloading === 'excel' ? 'Exporting...' : 'Excel (.xlsx)'}</span>
          </button>

          {/* Download Master PDF Button */}
          <button
            onClick={downloadReportPdf}
            disabled={downloading === 'pdf'}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-800 hover:bg-rose-100 shadow-2xs transition-colors disabled:opacity-50"
            title="Download unified formal PDF with school emblem, KPI cards, and page numbers"
          >
            <FileText className="h-4 w-4 text-rose-600" />
            <span>{downloading === 'pdf' ? 'Generating...' : 'PDF Report'}</span>
          </button>

          {/* CSV Fallback Button */}
          <button
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            title="Export raw CSV data"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Report Tab Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                reportType === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date / Year Selectors */}
        {reportType === 'daily' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-700 shrink-0">Collection Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg py-1 px-2.5 text-xs bg-white"
            />
          </div>
        )}

        {reportType === 'monthly' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-700 shrink-0">Fiscal / Calendar Year:</span>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="border border-slate-200 rounded-lg py-1 px-2.5 text-xs bg-white font-mono w-28"
            />
          </div>
        )}
      </div>

      {/* Report Body */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Compiling report records from database...
        </div>
      ) : (
        <>
          {/* 1. DAILY COLLECTION (CASH VS OTHER MODES) */}
          {reportType === 'daily' && dailyData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Day Collection</span>
                  <div className="text-xl font-bold text-emerald-600 tabular-nums mt-1">
                    ₹{Number(dailyData.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cash Counter</span>
                  <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                    ₹{Number(dailyData.cashTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">UPI / Digital / Cards</span>
                  <div className="text-xl font-bold text-indigo-700 tabular-nums mt-1">
                    ₹{Number(dailyData.nonCashTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Receipts Issued</span>
                  <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                    {dailyData.totalTransactions}
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[650px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Receipt #</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Resident</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Counter Officer</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyData.payments?.map((p: any) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{p.studentName}</td>
                          <td className="py-2.5 px-4 text-slate-600">{p.className}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              p.isHostel ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.isHostel ? 'Hostel' : 'Day'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{p.paymentMethod}</td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {typeof p.collectedBy === 'object'
                              ? p.collectedBy?.fullName || p.collectedBy?.username || 'Staff'
                              : p.collectedBy || 'Staff'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                            ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {(!dailyData.payments || dailyData.payments.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No collections recorded for {selectedDate}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. MONTHLY TREND */}
          {reportType === 'monthly' && monthlyData && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">Annual Monthly Realizations ({monthlyData.year})</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  Annual Total: ₹{Number(monthlyData.totalAnnual).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
          )}

          {/* 3. CLASS-WISE COLLECTION & DUES */}
          {reportType === 'classWise' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4 text-center">Students</th>
                      <th className="py-3 px-4 text-center">Hostel Boarders</th>
                      <th className="py-3 px-4 text-right">Total Billed</th>
                      <th className="py-3 px-4 text-right">Total Collected</th>
                      <th className="py-3 px-4 text-right">Outstanding Due</th>
                      <th className="py-3 px-4 text-center">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classData.map((cls: any) => (
                      <tr key={cls.classId}>
                        <td className="py-3 px-4 font-bold text-slate-900">{cls.className}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{cls.studentCount}</td>
                        <td className="py-3 px-4 text-center text-slate-600">{cls.hostelCount || 0}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          ₹{Number(cls.totalBilled).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-600">
                          ₹{Number(cls.totalCollected).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-rose-600">
                          ₹{Number(cls.totalPending).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
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
          )}

          {/* 4. FEE-HEAD-WISE COLLECTION */}
          {reportType === 'feeHead' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[600px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Fee Head Particular</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Frequency</th>
                      <th className="py-3 px-4 text-right">Total Billed</th>
                      <th className="py-3 px-4 text-right">Collected Amount</th>
                      <th className="py-3 px-4 text-right">Pending Dues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feeHeadData.map((f: any) => (
                      <tr key={f.feeTypeId}>
                        <td className="py-3 px-4 font-bold text-slate-900">{f.feeHead}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{f.code}</td>
                        <td className="py-3 px-4 text-slate-600">{f.frequency}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          ₹{Number(f.billed).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-600">
                          ₹{Number(f.collected).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-rose-600">
                          ₹{Number(f.dues).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. HOSTEL BOARDERS REPORT */}
          {reportType === 'hostel' && hostelData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Hostel Boarders</span>
                  <div className="text-xl font-bold text-indigo-700 mt-1">{hostelData.totalHostelStudents}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Hostel Fee Billed</span>
                  <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                    ₹{Number(hostelData.totalHostelFeeBilled || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Hostel Fee Collected</span>
                  <div className="text-xl font-bold text-emerald-600 tabular-nums mt-1">
                    ₹{Number(hostelData.totalHostelFeeCollected || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Hostel Fee Pending</span>
                  <div className="text-xl font-bold text-rose-600 tabular-nums mt-1">
                    ₹{Number(hostelData.totalHostelDues || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[650px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Admission #</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Room / Bed</th>
                        <th className="py-3 px-4">Emergency Phone</th>
                        <th className="py-3 px-4 text-right">Total Billed</th>
                        <th className="py-3 px-4 text-right">Paid</th>
                        <th className="py-3 px-4 text-right">Due Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hostelData.students?.map((s: any) => (
                        <tr key={s.id}>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{s.name}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{s.admissionNumber}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{s.className}</td>
                          <td className="py-2.5 px-4 text-slate-700">{s.roomNumber}</td>
                          <td className="py-2.5 px-4 text-slate-600">{s.emergencyPhone || 'N/A'}</td>
                          <td className="py-2.5 px-4 text-right font-mono">₹{Number(s.totalBilled).toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-bold">₹{Number(s.totalPaid).toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-rose-600 font-bold">₹{Number(s.totalDue).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {(!hostelData.students || hostelData.students.length === 0) && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No hostel residents enrolled in the system.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 6. DISCOUNTS & CONCESSIONS */}
          {reportType === 'discounts' && discountData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Discounts Granted</span>
                  <div className="text-xl font-bold text-indigo-700 mt-1">{discountData.totalApplications}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Concession Value</span>
                  <div className="text-xl font-bold text-amber-600 tabular-nums mt-1">
                    ₹{Number(discountData.totalDiscountAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[500px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Application Date</th>
                        <th className="py-3 px-4">Discount ID</th>
                        <th className="py-3 px-4 text-right">Amount Concession</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {discountData.discounts?.map((d: any) => (
                        <tr key={d.id}>
                          <td className="py-2.5 px-4 text-slate-600">
                            {new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{d.id}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">
                            ₹{Number(d.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                      {(!discountData.discounts || discountData.discounts.length === 0) && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            No discount applications recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 7. STAFF / USER-WISE COUNTER COLLECTION */}
          {reportType === 'staff' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[550px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-center">Receipts Handled</th>
                      <th className="py-3 px-4 text-right">Total Cash & Digital Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffData.map((u: any) => (
                      <tr key={u.userId}>
                        <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{u.username}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{u.transactionsCount}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm tabular-nums">
                          ₹{Number(u.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {staffData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No staff collection data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. CANCELLED / VOIDED PAYMENTS AUDIT */}
          {reportType === 'cancelled' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Receipt #</th>
                      <th className="py-3 px-4">Student Particulars</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4 text-right">Voided Amount</th>
                      <th className="py-3 px-4">Cancelled Date</th>
                      <th className="py-3 px-4">Cashier</th>
                      <th className="py-3 px-4">Mandatory Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cancelledData.map((c: any) => (
                      <tr key={c.id} className="bg-rose-50/20">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.receiptNumber}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{c.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.admissionNumber}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{c.className}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 line-through tabular-nums">
                          ₹{Number(c.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {new Date(c.cancelledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {typeof c.collectedBy === 'object'
                            ? c.collectedBy?.fullName || c.collectedBy?.username || 'Staff'
                            : c.collectedBy || 'Staff'}
                        </td>
                        <td className="py-3 px-4 text-rose-700 font-medium italic max-w-xs">{c.cancellationReason}</td>
                      </tr>
                    ))}
                    {cancelledData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No cancelled or voided payments on record. Clean financial ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
