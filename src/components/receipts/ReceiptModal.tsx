import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  Mail,
  CheckCircle,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { SchoolLogo } from '../common/SchoolLogo.js';

interface ReceiptModalProps {
  receiptId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receiptId, isOpen, onClose }) => {
  const [receipt, setReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email form
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  useEffect(() => {
    if (receiptId && isOpen) {
      fetchReceipt();
    } else {
      setReceipt(null);
      setError(null);
      setShowEmailInput(false);
      setEmailStatus(null);
    }
  }, [receiptId, isOpen]);

  const fetchReceipt = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/receipts/${receiptId}`);
      if (res.data?.success) {
        setReceipt(res.data.data);
        setRecipientEmail(res.data.data.studentDetails?.email || '');
      } else {
        setError(res.data?.message || 'Receipt not found');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptId || !recipientEmail) return;

    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await apiClient.post(`/receipts/${receiptId}/email`, { email: recipientEmail });
      if (res.data?.success) {
        setEmailStatus('Receipt sent to email successfully!');
        setTimeout(() => setShowEmailInput(false), 2000);
      } else {
        setEmailStatus(res.data?.message || 'Failed to send email');
      }
    } catch (err: any) {
      setEmailStatus(err.response?.data?.message || 'Failed to dispatch email');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Top Action Bar (No-Print) */}
        <div className="no-print p-3 sm:px-6 sm:py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-slate-700 truncate">Official Fee Receipt</span>
                <span className="text-xs font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-semibold truncate">
                  {receipt?.receiptNumber || 'Loading...'}
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="sm:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {receipt && (
                <>
                  <a
                    href={`/api/receipts/${receipt.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs min-h-[42px] sm:min-h-[36px]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PDF</span>
                  </a>

                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs min-h-[42px] sm:min-h-[36px]"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-600" />
                    <span>Print</span>
                  </button>

                  <button
                    onClick={() => setShowEmailInput(!showEmailInput)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs min-h-[42px] sm:min-h-[36px]"
                  >
                    <Mail className="h-3.5 w-3.5 text-slate-600" />
                    <span>Email</span>
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                aria-label="Close modal"
                className="hidden sm:flex p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 ml-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Email Form Popover (No-Print) */}
        {showEmailInput && (
          <div className="no-print bg-indigo-50 border-b border-indigo-100 p-3 px-4 sm:px-6 shrink-0">
            <form onSubmit={handleSendEmail} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <span className="text-xs font-semibold text-indigo-900 shrink-0">Send Receipt to Email:</span>
              <input
                type="email"
                required
                placeholder="parent@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="rounded-md border border-indigo-200 bg-white py-1.5 px-3 text-xs w-full sm:w-64 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[40px] sm:min-h-[auto]"
              />
              <button
                type="submit"
                disabled={sendingEmail}
                className="px-4 py-2 sm:py-1 rounded-md bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 min-h-[40px] sm:min-h-[auto]"
              >
                {sendingEmail ? 'Sending...' : 'Send Now'}
              </button>
              {emailStatus && (
                <span className="text-xs font-medium text-indigo-700 mt-1 sm:mt-0">{emailStatus}</span>
              )}
            </form>
          </div>
        )}

        {/* Receipt Printable Canvas */}
        <div className="p-3 sm:p-6 md:p-8 overflow-y-auto max-h-[75vh]">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
              Generating receipt view...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-rose-600">
              <AlertCircle className="h-6 w-6 mx-auto mb-2" />
              {error}
            </div>
          ) : receipt ? (
            <div id="printable-receipt" className="border-2 border-slate-900 rounded-xl p-3.5 sm:p-6 bg-white shadow-xs overflow-x-hidden">
              {/* Receipt Header Banner */}
              <div className="border-b-2 border-slate-800 pb-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <SchoolLogo className="h-12 w-12" />
                  <div className="text-left">
                    <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-900 leading-tight">
                      {receipt.school?.schoolName || 'Pragya Bharti Public School'}
                    </h1>
                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest block">
                      PBPS · AFFILIATED & RECOGNIZED
                    </span>
                  </div>
                </div>
                <p className="text-xs italic text-slate-600 mt-0.5">
                  {receipt.school?.tagline || 'Knowledge, Character & Excellence (PBPS)'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {receipt.school?.address || 'Knowledge Park, Campus Road'} · Phone: {receipt.school?.phone || '+91 98765 43210'} · Email: {receipt.school?.email || 'admissions@pbps.edu.in'}
                </p>
                <div className="inline-block mt-2 bg-slate-900 text-white text-[11px] font-bold px-4 py-1 rounded uppercase tracking-wider">
                  Official Fee Payment Receipt
                </div>
              </div>

              {/* Receipt Meta (Receipt No, Date, Session, Method) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 py-3 border-b border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Receipt Number</span>
                  <span className="font-mono font-bold text-slate-900">{receipt.receiptNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Payment Date</span>
                  <span className="font-medium text-slate-900">
                    {new Date(receipt.payment?.paidAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Academic Session</span>
                  <span className="font-medium text-slate-900">
                    {receipt.payment?.academicYear?.name || '2026-27'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Payment Mode</span>
                  <span className="font-semibold text-indigo-700">{receipt.payment?.paymentMethod}</span>
                </div>
              </div>

              {/* Student Particulars Card */}
              <div className="my-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:p-3.5 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Student Particulars
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-500 text-[11px]">Student Name:</span>
                    <div className="font-bold text-slate-900">{receipt.studentDetails?.name}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Admission Number:</span>
                    <div className="font-bold text-slate-900">{receipt.studentDetails?.admissionNumber}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Class & Section:</span>
                    <div className="font-semibold text-slate-800">
                      {receipt.studentDetails?.className} ({receipt.studentDetails?.sectionName})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Parent / Guardian:</span>
                    <div className="font-medium text-slate-800">{receipt.studentDetails?.fatherName}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Contact Phone:</span>
                    <div className="font-medium text-slate-800">{receipt.studentDetails?.phone}</div>
                  </div>
                  {receipt.payment?.transactionRef && (
                    <div>
                      <span className="text-slate-500 text-[11px]">Transaction Ref:</span>
                      <div className="font-mono text-slate-700">{receipt.payment.transactionRef}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Fee Items Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse mt-4 min-w-[360px]">
                  <thead>
                    <tr className="bg-slate-800 text-white font-semibold">
                      <th className="py-2 px-3 w-10">#</th>
                      <th className="py-2 px-3">Fee Particulars</th>
                      <th className="py-2 px-3">Term / Cycle</th>
                      <th className="py-2 px-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                    {receipt.payment?.items?.map((it: any, idx: number) => (
                      <tr key={it.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{it.studentFee?.title}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {it.studentFee?.month ? `Month ${it.studentFee.month}` : 'Annual / Cycle'}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-900">
                          {Number(it.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {(!receipt.payment?.items || receipt.payment.items.length === 0) && (
                      <tr>
                        <td className="py-2 px-3 text-slate-400">1</td>
                        <td className="py-2 px-3 font-medium text-slate-800">Tuition & Term Fee</td>
                        <td className="py-2 px-3 text-slate-600">Current Installment</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-900">
                          {Number(receipt.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Box */}
              <div className="flex justify-end mt-4">
                <div className="w-full sm:w-72 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Billable Amount:</span>
                    <span className="font-semibold tabular-nums">
                      ₹{Number(receipt.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Previous Outstanding:</span>
                    <span className="font-semibold tabular-nums">
                      ₹{Number(receipt.previousBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 p-1 rounded">
                    <span>Amount Paid Now:</span>
                    <span className="tabular-nums">
                      ₹{Number(receipt.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t border-slate-200">
                    <span>Remaining Balance:</span>
                    <span className="tabular-nums">
                      ₹{Number(receipt.remainingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures & Terms */}
              <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Terms & Conditions</div>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-tight">
                    1. Fees once deposited are non-refundable.<br/>
                    2. Cheque/Online payments are subject to realization.<br/>
                    3. Retain this digital receipt for all school administrative processes.
                  </p>
                </div>
                <div className="text-right flex flex-col justify-end items-end">
                  <div className="w-48 border-b border-slate-400 mb-1"></div>
                  <div className="font-bold text-slate-800 text-xs">
                    {receipt.school?.authorizedSignatory || 'Accounts Officer, PBPS'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    For {receipt.school?.schoolName || 'Pragya Bharti Public School (PBPS)'}
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-2">
                {receipt.school?.receiptFooter || 'System Generated Digital Receipt. Pragya Bharti Public School (PBPS).'}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
