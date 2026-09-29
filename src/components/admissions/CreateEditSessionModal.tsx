import React, { useState, useEffect } from 'react';
import { X, Calendar, Layers, Hash, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../api/client.js';

interface CreateEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: any | null;
  onSuccess: () => void;
}

export const CreateEditSessionModal: React.FC<CreateEditSessionModalProps> = ({
  isOpen,
  onClose,
  sessionToEdit,
  onSuccess
}) => {
  const isEditing = !!sessionToEdit;

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [admissionStatus, setAdmissionStatus] = useState('OPEN');
  const [admissionStartDate, setAdmissionStartDate] = useState('');
  const [admissionEndDate, setAdmissionEndDate] = useState('');
  const [admissionPrefix, setAdmissionPrefix] = useState('ADM');
  const [targetEnrollment, setTargetEnrollment] = useState(300);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sessionToEdit) {
      setName(sessionToEdit.name || '');
      setStartDate(sessionToEdit.startDate ? sessionToEdit.startDate.split('T')[0] : '');
      setEndDate(sessionToEdit.endDate ? sessionToEdit.endDate.split('T')[0] : '');
      setAdmissionStatus(sessionToEdit.admissionStatus || 'OPEN');
      setAdmissionStartDate(sessionToEdit.admissionStartDate ? sessionToEdit.admissionStartDate.split('T')[0] : '');
      setAdmissionEndDate(sessionToEdit.admissionEndDate ? sessionToEdit.admissionEndDate.split('T')[0] : '');
      setAdmissionPrefix(sessionToEdit.admissionPrefix || 'ADM');
      setTargetEnrollment(sessionToEdit.targetEnrollment || 300);
      setDescription(sessionToEdit.description || '');
      setIsActive(!!sessionToEdit.isActive);
      setIsArchived(!!sessionToEdit.isArchived);
    } else {
      // Defaults for a new session e.g. 2027-28
      const nextYear = new Date().getFullYear() + 1;
      const nextYearPlus = (nextYear + 1).toString().slice(-2);
      setName(`${nextYear}-${nextYearPlus}`);
      setStartDate(`${nextYear}-04-01`);
      setEndDate(`${nextYear + 1}-03-31`);
      setAdmissionStatus('OPEN');
      setAdmissionStartDate(`${nextYear}-01-15`);
      setAdmissionEndDate(`${nextYear}-06-30`);
      setAdmissionPrefix(`ADM-${nextYear}`);
      setTargetEnrollment(350);
      setDescription('Standard academic session for student admission and enrollment');
      setIsActive(false);
      setIsArchived(false);
    }
    setErrorMessage(null);
  }, [sessionToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Academic Session name is required (e.g. 2026-27)');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Session Start and End dates are required.');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setErrorMessage('Session Start date must be before End date.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await apiClient.put(`/academic-years/${sessionToEdit.id}`, {
          name,
          startDate,
          endDate,
          admissionStatus,
          admissionStartDate: admissionStartDate || null,
          admissionEndDate: admissionEndDate || null,
          admissionPrefix,
          targetEnrollment,
          description,
          isArchived
        });
      } else {
        await apiClient.post('/academic-years', {
          name,
          startDate,
          endDate,
          isActive,
          admissionStatus,
          admissionStartDate: admissionStartDate || null,
          admissionEndDate: admissionEndDate || null,
          admissionPrefix,
          targetEnrollment,
          description
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {isEditing ? `Edit Session: ${sessionToEdit?.name}` : 'Configure New Academic Session'}
              </h2>
              <p className="text-xs text-slate-500">
                Manage admission dates, enrollment targets, and intake status.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Row 1: Session Name & Admission Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Session Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2027-28"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-semibold focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Format: YYYY-YY (e.g. 2026-27)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Intake Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={admissionStatus}
                onChange={(e) => setAdmissionStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-semibold bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="OPEN">🟢 OPEN - Accepting New Admissions</option>
                <option value="CLOSING_SOON">🟡 CLOSING_SOON - Seats Filling Fast</option>
                <option value="CLOSED">🔴 CLOSED - Admissions Blocked</option>
                <option value="UPCOMING">🔵 UPCOMING - Pre-Registration Phase</option>
              </select>
              <span className="text-[10px] text-slate-400">Controls student registration availability</span>
            </div>
          </div>

          {/* Row 2: Session Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Row 3: Admission Window Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Window Opens (Optional)
              </label>
              <input
                type="date"
                value={admissionStartDate}
                onChange={(e) => setAdmissionStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Application Deadline
              </label>
              <input
                type="date"
                value={admissionEndDate}
                onChange={(e) => setAdmissionEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Row 4: Admission Prefix & Target Enrollment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Number Prefix
              </label>
              <input
                type="text"
                placeholder="e.g. ADM or ADM-2027"
                value={admissionPrefix}
                onChange={(e) => setAdmissionPrefix(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-mono uppercase focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Generates: {admissionPrefix || 'ADM'}-2027-0001</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Enrollment Capacity
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                value={targetEnrollment}
                onChange={(e) => setTargetEnrollment(parseInt(e.target.value, 10) || 100)}
                className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Total admission seats target for this session</span>
            </div>
          </div>

          {/* Row 5: Notes/Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Session Notes / Admission Description
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 2027-28 Admission Drive with special quota for sports & scholarship..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Toggles */}
          {!isEditing && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="setActiveSession"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="setActiveSession" className="text-xs font-medium text-slate-700 cursor-pointer">
                Set as Primary Active Academic Session immediately
              </label>
            </div>
          )}

          {isEditing && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="setArchivedSession"
                checked={isArchived}
                onChange={(e) => setIsArchived(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="setArchivedSession" className="text-xs font-medium text-slate-700 cursor-pointer">
                Archive this academic session (hide from standard intake)
              </label>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-h-[42px] sm:min-h-[auto]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 sm:py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50 min-h-[42px] sm:min-h-[auto]"
            >
              {saving ? 'Saving Session...' : isEditing ? 'Update Session' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
