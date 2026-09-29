import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Eye,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../api/client.js';

interface ReceiptsPageProps {
  onOpenReceipt: (receiptId: string) => void;
}

export const ReceiptsPage: React.FC<ReceiptsPageProps> = ({ onOpenReceipt }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/payments?search=${encodeURIComponent(search)}&limit=25`);
      if (res.data?.success) {
        setPayments(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Official Fee Receipt Archive
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Lookup, verify, reprint, or email digital fee receipts generated for verified payments.
        </p>
      </div>

      {/* Search Input */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchReceipts();
          }}
          className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-md w-full"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt number (e.g. REC-2026-000001)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs min-h-[42px] focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 min-h-[42px] transition-colors shrink-0"
          >
            Find Receipt
          </button>
        </form>
      </div>

      {/* Receipts Grid */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
            Loading receipt archive...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No receipts found matching search.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[650px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3 sm:px-4">Receipt #</th>
                  <th className="py-3 px-3 sm:px-4">Generated Date</th>
                  <th className="py-3 px-3 sm:px-4">Student Particulars</th>
                  <th className="py-3 px-3 sm:px-4">Class</th>
                  <th className="py-3 px-3 sm:px-4">Method</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-indigo-700">{p.receiptNumber}</td>
                    <td className="py-3 px-3 sm:px-4 text-slate-600">
                      {new Date(p.paidAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-semibold text-slate-900">
                      {p.studentName} ({p.admissionNumber})
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-700">{p.className} ({p.sectionName})</td>
                    <td className="py-3 px-3 sm:px-4">
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      {p.receiptId && (
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          <button
                            onClick={() => onOpenReceipt(p.receiptId)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] min-h-[34px]"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View</span>
                          </button>
                          <a
                            href={`/api/receipts/${p.receiptId}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-[11px] min-h-[34px]"
                          >
                            <Download className="h-3 w-3" />
                            <span>PDF</span>
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
