import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  UserX,
  FileText,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ShieldAlert,
  Loader2,
  Calendar,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/client.js';

interface CancelAdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    admissionNumber: string;
    fullName: string;
    className?: string;
  } | null;
  onSuccess: (slcData?: any) => void;
}

const COMMON_REASONS = [
  'Parent Request - Family Relocation / Transfer',
  'Admission in alternative institution / Board change',
  'Medical or personal family reasons',
  'Financial / Fee affordability constraints',
  'Disciplinary / Continuous unexcused absence',
  'Documentation / Eligibility criteria not fulfilled',
  'Other (Specify in remarks below)'
];

export const CancelAdmissionModal: React.FC<CancelAdmissionModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess
}) => {
  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [cancellationDate, setCancellationDate] = useState(new Date().toISOString().split('T')[0]);
  const [conduct, setConduct] = useState('Good');

  // Dues state
  const [loadingDues, setLoadingDues] = useState(false);
  const [totalDues, setTotalDues] = useState(0);
  const [unpaidFees, setUnpaidFees] = useState<any[]>([]);

  // Waiver state
  const [waiveDues, setWaiveDues] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch dues whenever modal opens for this student
  useEffect(() => {
    if (isOpen && student?.id) {
      setLoadingDues(true);
      setErrorMessage(null);
      setWaiveDues(false);
      setWaiverReason('');
      setCancellationDate(new Date().toISOString().split('T')[0]);

      apiClient.get(`/students/${student.id}/dues`)
        .then(res => {
          if (res.data?.success) {
            setTotalDues(res.data.data.totalDues || 0);
            setUnpaidFees(res.data.data.unpaidFees || []);
          }
        })
        .catch(err => {
          console.error('Error fetching student dues:', err);
        })
        .finally(() => {
          setLoadingDues(false);
        });
    }
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const finalReason = selectedReason.startsWith('Other')
      ? customReason.trim()
      : selectedReason;

    if (!finalReason) {
      setErrorMessage('Please specify the cancellation reason.');
      return;
    }

    if (!cancellationDate) {
      setErrorMessage('Cancellation effective date is required.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (cancellationDate > today) {
      setErrorMessage('Cancellation date cannot be in the future.');
      return;
    }

    // Business Rule C2:
    // If pending dues exist and waiveDues is UNCHECKED: BLOCK cancellation!
    if (totalDues > 0 && !waiveDues) {
      setErrorMessage('Clear all pending dues or select Waive to cancel this admission.');
      return;
    }

    // If waiveDues is checked, waiverReason is mandatory
    if (totalDues > 0 && waiveDues && !waiverReason.trim()) {
      setErrorMessage('A mandatory waiver justification reason is required when waiving outstanding dues.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiClient.post(`/students/${student.id}/cancel-admission`, {
        reason: finalReason,
        notes: notes.trim() || undefined,
        cancellationDate,
        waiveDues,
        waiverReason: waiveDues ? waiverReason.trim() : undefined,
        conduct: conduct.trim() || 'Good'
      });

      if (res.data?.success) {
        toast.success(`Admission cancelled for ${student.fullName}. School Leaving Certificate generated.`);

        // Fetch the generated SLC
        let slc = null;
        try {
          const slcRes = await apiClient.get(`/students/${student.id}/slc`);
          if (slcRes.data?.success) {
            slc = slcRes.data.data;
          }
        } catch {}

        onSuccess(slc);
        onClose();
      } else {
        setErrorMessage(res.data?.message || 'Failed to cancel admission');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to cancel admission');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-rose-100 bg-rose-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Cancel Student Admission
              </h2>
              <p className="text-xs text-rose-700 font-medium">
                Pragya Bharti Public School · Dues Verification & SLC Generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Student summary banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex justify-between items-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Student Name</span>
              <div className="font-bold text-slate-900">{student.fullName}</div>
              <div className="text-[11px] font-mono text-indigo-700">{student.admissionNumber}</div>
            </div>
            {student.className && (
              <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-semibold text-slate-700">
                Class: {student.className}
              </span>
            )}
          </div>

          {/* Dues & Waiver Section (Part C2) */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-slate-500" />
                <span>Outstanding Dues Check</span>
              </span>
              {loadingDues ? (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Calculating dues...</span>
                </div>
              ) : (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  totalDues > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {totalDues > 0 ? `Pending: ₹${totalDues.toLocaleString('en-IN')}` : 'No Pending Dues'}
                </span>
              )}
            </div>

            {totalDues > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="text-[11px] text-slate-500">
                  The student has the following unpaid fee items:
                </div>
                <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs">
                  {unpaidFees.map(f => (
                    <div key={f.id} className="flex justify-between p-2 bg-slate-50/50">
                      <span className="font-medium text-slate-700">{f.title || f.feeType}</span>
                      <span className="font-mono font-bold text-rose-700">₹{Number(f.remainingAmount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                {/* Waive Dues Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waiveDues}
                      onChange={(e) => setWaiveDues(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-amber-900 block">
                        Waive all outstanding dues (₹{totalDues.toLocaleString('en-IN')})
                      </span>
                      <span className="text-[11px] text-amber-700">
                        Requires <code className="font-mono font-bold">fee.waive</code> permission. Each waived amount will be written to the waiver ledger and audit log.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Waiver Reason input if Waive is checked */}
                {waiveDues && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Waiver Justification Reason <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Approved by Director on compassionate grounds / relocation"
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cancellation Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cancellation / Leaving Date <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={cancellationDate}
                onChange={(e) => setCancellationDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Student Conduct for SLC <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
                placeholder="e.g. Good / Exemplary"
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Cancellation Reason <span className="text-rose-500 font-bold">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white font-medium focus:border-indigo-500 focus:outline-hidden"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {selectedReason.startsWith('Other') && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Specify Reason <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter specific de-registration reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Additional Administrative Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g. TC handed over to parent Rajesh Sharma in person..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Auto SLC generation notice */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 flex items-start gap-2.5 text-xs text-indigo-900">
            <Award className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
            <div>
              <span className="font-bold">Automatic SLC Generation:</span>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Upon confirmation, a unique sequential School Leaving Certificate (SLC) will be created immediately, ready to print and save as PDF.
              </p>
            </div>
          </div>

          {/* Refund scope note */}
          <p className="text-[11px] text-slate-400 italic">
            Note: Fee refunds for payments already completed are processed separately via Finance Ledgers.
          </p>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing Cancellation...</span>
                </>
              ) : (
                <>
                  <UserX className="h-3.5 w-3.5" />
                  <span>Confirm Cancellation & Issue SLC</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
