import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  UserX,
  FileText,
  CheckCircle2,
  AlertCircle
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
  onSuccess: () => void;
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
  const [cancelPendingFees, setCancelPendingFees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason.startsWith('Other')
      ? customReason.trim() || 'Other reason'
      : selectedReason;

    if (!finalReason) {
      setErrorMessage('Please specify the cancellation reason.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post(`/admissions/${student.id}/cancel`, {
        reason: finalReason,
        notes: notes.trim() || undefined,
        cancelPendingFees
      });

      if (res.data?.success) {
        toast.success(`Admission cancelled for ${student.fullName}`);
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.data?.message || 'Failed to cancel admission');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to cancel admission');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
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
                Pragya Bharti Public School · Enrollment De-registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Target Student Identity Banner */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Student</span>
              <span className="font-bold text-slate-900 text-sm">{student.fullName}</span>
              {student.className && (
                <span className="text-slate-500 block text-[11px] mt-0.5">Class: {student.className}</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Admission No</span>
              <span className="font-mono font-bold text-indigo-700 text-xs bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                {student.admissionNumber}
              </span>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="leading-relaxed">
              Cancelling admission marks this student’s profile as <strong>CANCELLED</strong> in the school register and generates an official de-registration audit record.
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cancellation Reason Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-medium focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500 bg-white min-h-[40px]"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Reason if "Other" */}
          {selectedReason.startsWith('Other') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specify Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Relocated to another country"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500 min-h-[40px]"
              />
            </div>
          )}

          {/* Detailed Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Remarks & Documentation Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Parent submitted written application on 29-Sep. Original TC returned to parent."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* Waive Unpaid Dues Checkbox */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
            <input
              type="checkbox"
              id="cancelPendingFees"
              checked={cancelPendingFees}
              onChange={(e) => setCancelPendingFees(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="cancelPendingFees" className="text-xs text-slate-700 cursor-pointer select-none">
              <strong className="block text-slate-900 font-semibold">Waive outstanding pending fees</strong>
              Automatically cancel all pending and overdue monthly fee invoices for this student so they do not show in outstanding accounts.
            </label>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors min-h-[40px]"
            >
              Cancel & Keep Admission
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs min-h-[40px] transition-colors"
            >
              <UserX className="h-4 w-4" />
              <span>{submitting ? 'Cancelling Admission...' : 'Confirm Admission Cancellation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
