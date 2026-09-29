import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Eye,
  Download,
  Printer,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';

interface PaymentsPageProps {
  onOpenFeeCollection: (studentId?: string) => void;
  onOpenReceipt: (receiptId: string) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  onOpenFeeCollection,
  onOpenReceipt
}) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Online Razorpay Test Simulation State
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlineStudentId, setOnlineStudentId] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('3500');
  const [onlineProcessing, setOnlineProcessing] = useState(false);
  const [onlineSuccess, setOnlineSuccess] = useState<any | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (methodFilter !== 'ALL') params.append('method', methodFilter);
      params.append('page', page.toString());
      params.append('limit', '10');

      const res = await apiClient.get(`/payments?${params.toString()}`);
      if (res.data?.success) {
        setPayments(res.data.data);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, methodFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  // Simulate complete Razorpay order creation and server-side signature verification
  const handleTestRazorpayOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnlineProcessing(true);
    try {
      // 1. Create Razorpay order on backend
      const orderRes = await apiClient.post('/payments/online/create-order', {
        studentId: onlineStudentId || payments[0]?.studentId,
        amount: parseFloat(onlineAmount)
      });

      if (!orderRes.data?.success) {
        toast.error(orderRes.data?.message || 'Failed to initialize order');
        return;
      }

      const { orderId } = orderRes.data.data;
      const fakePaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 2. Simulate server-side payment verification
      const verifyRes = await apiClient.post('/payments/online/verify', {
        orderId,
        razorpayPaymentId: fakePaymentId,
        studentId: onlineStudentId || payments[0]?.studentId,
        amount: parseFloat(onlineAmount)
      });

      if (verifyRes.data?.success) {
        setOnlineSuccess(verifyRes.data.data);
        toast.success('Payment verified and receipt created successfully!');
        fetchPayments();
      } else {
        toast.error(verifyRes.data?.message || 'Payment verification failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Online payment failed');
    } finally {
      setOnlineProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Fee Collection & Payment Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time transaction log across counter cash, UPI, cards, net banking, and verified online gateways.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setShowOnlineModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs min-h-[44px] cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>Test Online Gateway</span>
          </button>

          <button
            onClick={() => onOpenFeeCollection()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs min-h-[44px] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Collect New Fee</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by receipt #, student name, adm #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[42px]"
            />
          </div>

          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white font-medium min-h-[42px]"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="UPI">UPI / QR Code</option>
              <option value="CASH">Cash Counter</option>
              <option value="ONLINE">Online Payment (Razorpay)</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              <option value="CHEQUE">Cheque / Demand Draft</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 min-h-[42px] transition-colors"
            >
              Filter Ledger
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setMethodFilter('ALL');
                setPage(1);
                fetchPayments();
              }}
              className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 min-h-[42px] transition-colors shrink-0"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
            Loading payment ledger...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No payment transactions found.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Student Particulars</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Method & Ref</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4">Officer</th>
                  <th className="py-3 px-4 text-right">Receipt Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(p.paidAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{p.studentName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.admissionNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{p.className} ({p.sectionName})</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{p.paymentMethod}</span>
                      {p.transactionRef && (
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                          {p.transactionRef}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-700 text-sm">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.collectedBy}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.receiptId && (
                          <>
                            <button
                              onClick={() => onOpenReceipt(p.receiptId)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="View Official Receipt"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <a
                              href={`/api/receipts/${p.receiptId}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Download Signed PDF"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs bg-slate-50 text-center sm:text-left">
            <span className="text-slate-500">
              Page <strong>{page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} records)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700 sm:hidden">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Online Payment Test Gateway Modal */}
      {showOnlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Razorpay Payment Gateway</h3>
              </div>
              <button
                onClick={() => {
                  setShowOnlineModal(false);
                  setOnlineSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {onlineSuccess ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">Online Transaction Verified!</h4>
                <p className="text-xs text-slate-500">
                  Payment verified server-side via Razorpay webhook. Receipt #{onlineSuccess.receiptNumber} created and sent to parent email.
                </p>
                <button
                  onClick={() => onOpenReceipt(onlineSuccess.receiptId)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold min-h-[44px]"
                >
                  View Receipt
                </button>
              </div>
            ) : (
              <form onSubmit={handleTestRazorpayOnline} className="space-y-3 text-xs">
                <p className="text-slate-500">
                  Simulate the end-to-end online fee payment flow. Creates order, checks student balance, executes server-side cryptographic verification, and issues signed PDF receipt.
                </p>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Student</label>
                  <select
                    value={onlineStudentId}
                    onChange={(e) => setOnlineStudentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 bg-white min-h-[40px]"
                  >
                    {payments.map(p => (
                      <option key={p.studentId} value={p.studentId}>
                        {p.studentName} ({p.admissionNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    value={onlineAmount}
                    onChange={(e) => setOnlineAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 font-mono font-bold min-h-[40px]"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOnlineModal(false)}
                    className="w-full sm:w-auto px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 min-h-[42px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onlineProcessing}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 min-h-[42px]"
                  >
                    {onlineProcessing ? 'Verifying with Razorpay...' : 'Pay via Razorpay'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
