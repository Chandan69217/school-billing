import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Search,
  CheckCircle,
  Download,
  Printer,
  Mail,
  Receipt as ReceiptIcon,
  AlertCircle,
  Building2,
  Calendar,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../../api/client.js';

interface FeeCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
  onPaymentSuccess?: () => void;
}

export const FeeCollectionModal: React.FC<FeeCollectionModalProps> = ({
  isOpen,
  onClose,
  initialStudentId,
  onPaymentSuccess
}) => {
  const [studentSearch, setStudentSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state
  const [paymentResult, setPaymentResult] = useState<{
    paymentId: string;
    receiptId: string;
    receiptNumber: string;
    amount: number;
  } | null>(null);

  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Search students
  useEffect(() => {
    if (!studentSearch.trim() || studentSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.get(`/students?search=${encodeURIComponent(studentSearch)}&limit=5`);
        if (res.data?.success) {
          setSearchResults(res.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [studentSearch]);

  // Load specific student details if selected or initialStudentId given
  const loadStudentDetails = async (id: string) => {
    setLoadingStudent(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get(`/students/${id}`);
      if (res.data?.success) {
        const data = res.data.data;
        setSelectedStudent(data);

        // Pre-fill total pending amount
        const pending = data.feeSummary?.pending || 0;
        setPaymentAmount(pending > 0 ? pending.toString() : '0');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load student details');
    } finally {
      setLoadingStudent(false);
    }
  };

  useEffect(() => {
    if (initialStudentId && isOpen) {
      loadStudentDetails(initialStudentId);
    } else if (isOpen) {
      // Reset state on open
      setSelectedStudent(null);
      setStudentSearch('');
      setPaymentResult(null);
      setErrorMessage(null);
      setEmailStatus(null);
    }
  }, [isOpen, initialStudentId]);

  if (!isOpen) return null;

  const totalOutstanding = selectedStudent?.feeSummary?.pending || 0;
  const numAmount = parseFloat(paymentAmount) || 0;
  const balanceAfter = Math.max(0, totalOutstanding - numAmount);

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (numAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than 0');
      return;
    }
    if (numAmount > totalOutstanding) {
      setErrorMessage(`Payment cannot exceed outstanding balance of ₹${totalOutstanding.toLocaleString('en-IN')}`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post('/payments', {
        studentId: selectedStudent.id,
        amount: numAmount,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined
      });

      if (res.data?.success) {
        setPaymentResult(res.data.data);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        if (onPaymentSuccess) onPaymentSuccess();
      } else {
        setErrorMessage(res.data?.message || 'Payment collection failed');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Payment collection failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!paymentResult?.receiptId) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const primaryParent = selectedStudent?.parents?.[0]?.parent;
      const res = await apiClient.post(`/receipts/${paymentResult.receiptId}/email`, {
        email: primaryParent?.email
      });
      if (res.data?.success) {
        setEmailStatus('Receipt sent to parent email successfully!');
      } else {
        setEmailStatus(res.data?.message || 'Failed to dispatch email');
      }
    } catch (err: any) {
      setEmailStatus(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <CreditCard className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">Fee Collection Counter</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">Collect fee, record transaction, and generate official receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {paymentResult ? (
            /* Success State */
            <div className="text-center py-2 sm:py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Fee Payment Successfully Collected!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Receipt generated and student fee balance updated in real-time.
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 max-w-md mx-auto text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Receipt Number:</span>
                  <span className="font-bold text-slate-900">{paymentResult.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedStudent?.firstName} {selectedStudent?.lastName} ({selectedStudent?.admissionNumber})
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    ₹{Number(paymentResult.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-medium text-slate-800">{paymentMethod}</span>
                </div>
              </div>

              {emailStatus && (
                <div className="mt-3 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 py-1.5 px-3 rounded-lg max-w-md mx-auto">
                  {emailStatus}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-2.5 sm:gap-3">
                <a
                  href={`/api/receipts/${paymentResult.receiptId}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs min-h-[44px]"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF Receipt</span>
                </a>

                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs min-h-[44px]"
                >
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span>{sendingEmail ? 'Sending...' : 'Email Receipt'}</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentResult(null);
                    loadStudentDetails(selectedStudent.id);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors min-h-[44px]"
                >
                  <span>Collect Another Fee</span>
                </button>
              </div>
            </div>
          ) : (
            /* Collection Form */
            <form onSubmit={handleCollectPayment} className="space-y-5">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1: Select Student if not chosen */}
              {!selectedStudent ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Search Student to Collect Fee</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type admission number (e.g. ADM-2026-001) or student name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {searching && <div className="text-xs text-indigo-600 animate-pulse">Searching...</div>}

                  {searchResults.length > 0 && (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-xs max-h-48 overflow-y-auto">
                      {searchResults.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => loadStudentDetails(s.id)}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">{s.fullName}</div>
                            <div className="text-[11px] text-slate-500">
                              {s.admissionNumber} · {s.className} ({s.sectionName}) · Phone: {s.parentPhone}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-rose-600 tabular-nums">
                              ₹{s.feeSummary?.pending?.toLocaleString('en-IN')} Due
                            </div>
                            <span className="text-[10px] text-slate-400">Click to select</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Student Info Card */
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Admission No: <strong>{selectedStudent.admissionNumber}</strong> · Class:{' '}
                        <strong>
                          {selectedStudent.academicRecords?.[0]?.class?.name || 'Class 8'} (
                          {selectedStudent.academicRecords?.[0]?.section?.name || 'A'})
                        </strong>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Parent: {selectedStudent.parents?.[0]?.parent?.fatherName || 'Parent'} ·{' '}
                        {selectedStudent.parents?.[0]?.parent?.primaryPhone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Change Student
                    </button>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/80 text-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Fee</div>
                      <div className="text-xs font-bold text-slate-800 tabular-nums">
                        ₹{Number(selectedStudent.feeSummary?.totalFee || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Already Paid</div>
                      <div className="text-xs font-bold text-emerald-600 tabular-nums">
                        ₹{Number(selectedStudent.feeSummary?.paid || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Outstanding Due</div>
                      <div className="text-xs font-bold text-rose-600 tabular-nums">
                        ₹{totalOutstanding.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Payment Inputs */}
              {selectedStudent && (
                <div className="space-y-4">
                  {totalOutstanding <= 0 ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center text-xs text-emerald-800 font-semibold">
                      This student has completely cleared all outstanding fees for the current session!
                    </div>
                  ) : (
                    <>
                      {/* Amount to pay */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-semibold text-slate-700">Payment Amount (INR)</label>
                          <button
                            type="button"
                            onClick={() => setPaymentAmount(totalOutstanding.toString())}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Pay Full Due (₹{totalOutstanding.toLocaleString('en-IN')})
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                          <input
                            type="number"
                            min="1"
                            max={totalOutstanding}
                            step="any"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="Enter amount to collect..."
                            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm font-semibold tabular-nums focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">Payment Method</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                          {['UPI', 'CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].map((mode) => (
                            <button
                              type="button"
                              key={mode}
                              onClick={() => setPaymentMethod(mode)}
                              className={`py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all min-h-[42px] cursor-pointer ${
                                paymentMethod === mode
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {mode === 'BANK_TRANSFER' ? 'BANK' : mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Transaction Ref & Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Ref / Cheque / UTR No. (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. UPI-9821832 / CHQ-10492"
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Collection Notes (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Quarter 1 tuition fee deposit"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
                          />
                        </div>
                      </div>

                      {/* Financial Math Summary */}
                      <div className="rounded-xl bg-slate-100/80 p-3 text-xs space-y-1.5 border border-slate-200">
                        <div className="flex justify-between text-slate-600">
                          <span>Total Outstanding Due:</span>
                          <span className="font-semibold tabular-nums">₹{totalOutstanding.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-bold">
                          <span>Collecting Now:</span>
                          <span className="text-indigo-600 tabular-nums">
                            ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                          <span>Balance Remaining After:</span>
                          <span className="font-semibold tabular-nums text-slate-800">
                            ₹{balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
                        <button
                          type="button"
                          onClick={onClose}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-[44px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || numAmount <= 0}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs min-h-[44px]"
                        >
                          {submitting ? 'Recording Payment...' : `Confirm & Collect ₹${numAmount.toLocaleString('en-IN')}`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
