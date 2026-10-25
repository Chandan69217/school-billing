import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  UserCheck,
  UserMinus,
  LogOut,
  UserX,
  Loader2,
  Calendar,
  FileText
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { toast } from 'sonner';

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    admissionNumber: string;
    fullName: string;
    currentStatus: string;
  } | null;
  onSuccess: (slcData?: any) => void;
}

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess
}) => {
  if (!isOpen || !student) return null;

  const current = student.currentStatus;

  // Determine available target statuses
  const availableTargets: Array<{ status: string; label: string; icon: any; desc: string }> = [];

  if (current === 'ACTIVE') {
    availableTargets.push({
      status: 'INACTIVE',
      label: 'Mark as Inactive',
      icon: UserMinus,
      desc: 'Temporary pause. Preserves fee history but halts future monthly billing generation.'
    });
    availableTargets.push({
      status: 'WITHDRAWN',
      label: 'Withdraw Student',
      icon: LogOut,
      desc: 'Student has left the institution. Record leaving date and optionally generate SLC.'
    });
  } else if (current === 'INACTIVE') {
    availableTargets.push({
      status: 'ACTIVE',
      label: 'Reactivate to Active',
      icon: UserCheck,
      desc: 'Resume active schooling and regular monthly fee generation.'
    });
    availableTargets.push({
      status: 'WITHDRAWN',
      label: 'Withdraw Student',
      icon: LogOut,
      desc: 'Permanent student withdrawal.'
    });
  } else if (current === 'WITHDRAWN') {
    availableTargets.push({
      status: 'ACTIVE',
      label: 'Re-enroll / Reactivate',
      icon: UserCheck,
      desc: 'Reactivate a previously withdrawn student into the active roll.'
    });
  }

  const [targetStatus, setTargetStatus] = useState<string>(availableTargets[0]?.status || 'INACTIVE');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [generateSlc, setGenerateSlc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage('Please provide a mandatory reason for this status change.');
      return;
    }

    if (!effectiveDate) {
      setErrorMessage('Effective date is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.put(`/students/${student.id}/status`, {
        status: targetStatus,
        effectiveDate,
        reason: reason.trim(),
        generateSlc: targetStatus === 'WITHDRAWN' ? generateSlc : false
      });

      if (res.data?.success) {
        toast.success(`Student status updated to ${targetStatus}`);
        onSuccess(res.data.data?.slc);
        onClose();
      } else {
        setErrorMessage(res.data?.message || 'Failed to update status');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update student status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Update Student Enrollment Status
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {student.fullName} ({student.admissionNumber}) · Currently: <strong>{current}</strong>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="m-4 mb-0 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select New Target Status <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="space-y-2">
              {availableTargets.map((item) => (
                <label
                  key={item.status}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    targetStatus === item.status
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetStatus"
                    value={item.status}
                    checked={targetStatus === item.status}
                    onChange={() => setTargetStatus(item.status)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">{item.label}</span>
                    <span className="text-[11px] text-slate-500">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Effective Date <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Status Transition <span className="text-rose-500 font-bold">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Temporary leave of absence approved by Principal / Parent relocation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {targetStatus === 'WITHDRAWN' && (
            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateSlc}
                  onChange={(e) => setGenerateSlc(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-indigo-900 block">
                    Generate School Leaving Certificate (SLC)
                  </span>
                  <span className="text-[11px] text-indigo-700">
                    Creates an official sequential SLC card ready to download and print.
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Confirm Status Change</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
