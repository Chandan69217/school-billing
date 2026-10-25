import React, { useState, useEffect } from 'react';
import { X, Calendar, Layers, Hash, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../api/client.js';

interface CreateEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: any | null;
  onSuccess: () => void;
  existingSessions?: any[];
}

export const CreateEditSessionModal: React.FC<CreateEditSessionModalProps> = ({
  isOpen,
  onClose,
  sessionToEdit,
  onSuccess,
  existingSessions = []
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
  const [topErrorMessage, setTopErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      // Clean defaults
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const nextYearShort = nextYear.toString().slice(-2);
      setName(`${currentYear}-${nextYearShort}`);
      setStartDate(`${currentYear}-04-01`);
      setEndDate(`${nextYear}-03-31`);
      setAdmissionStatus('OPEN');
      setAdmissionStartDate(`${currentYear}-01-15`);
      setAdmissionEndDate(`${currentYear}-07-31`);
      setAdmissionPrefix(`ADM-${currentYear}`);
      setTargetEnrollment(350);
      setDescription('Academic session for regular admissions and fee collection');
      setIsActive(false);
      setIsArchived(false);
    }
    setTopErrorMessage(null);
    setFieldErrors({});
  }, [sessionToEdit, isOpen]);

  if (!isOpen) return null;

  // Clear specific field error on change
  const handleFieldChange = (field: string, value: any, setter: (val: any) => void) => {
    setter(value);
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (topErrorMessage) {
      setTopErrorMessage(null);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();

    // 1. Session Name: required, format YYYY-YY or YYYY-YYYY with consecutive years
    if (!trimmedName) {
      errors.name = 'Session name is required.';
    } else {
      const match = trimmedName.match(/^(\d{4})-(\d{2}|\d{4})$/);
      if (!match) {
        errors.name = 'Format must be YYYY-YY (e.g. 2026-27) or YYYY-YYYY (e.g. 2026-2027).';
      } else {
        const startYr = parseInt(match[1], 10);
        const endPart = match[2];
        const endYr = endPart.length === 2 ? Math.floor(startYr / 100) * 100 + parseInt(endPart, 10) : parseInt(endPart, 10);
        if (endYr !== startYr + 1) {
          errors.name = 'End year must be exactly one year after start year (e.g. 2026-27).';
        }
      }
    }

    // 2. Duplicate session check client-side (including against archived sessions)
    if (trimmedName && !errors.name && !isEditing) {
      const duplicate = existingSessions.find(
        s => s.name?.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        errors.name = `Academic session ${trimmedName} already exists.`;
      }
    }

    // 3. Start date and end date
    if (!startDate) {
      errors.startDate = 'Start date is required.';
    }
    if (!endDate) {
      errors.endDate = 'End date is required.';
    }

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (isNaN(s.getTime())) {
        errors.startDate = 'Invalid start date.';
      }
      if (isNaN(e.getTime())) {
        errors.endDate = 'Invalid end date.';
      }
      if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
        if (e <= s) {
          errors.endDate = 'End date must be after start date.';
        } else if (!isEditing) {
          // Date range overlap check against existing sessions
          const overlapping = existingSessions.find(existing => {
            const exStart = new Date(existing.startDate);
            const exEnd = new Date(existing.endDate);
            return s <= exEnd && e >= exStart;
          });
          if (overlapping) {
            errors.startDate = `Dates overlap with session ${overlapping.name}.`;
            errors.endDate = `Dates overlap with session ${overlapping.name}.`;
          }
        }
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setTopErrorMessage(Object.values(errors)[0]);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await apiClient.put(`/academic-years/${sessionToEdit.id}`, {
          name: name.trim(),
          startDate,
          endDate,
          admissionStatus,
          admissionStartDate: admissionStartDate || null,
          admissionEndDate: admissionEndDate || null,
          admissionPrefix: admissionPrefix.trim().toUpperCase(),
          targetEnrollment,
          description: description.trim() || null,
          isArchived
        });
      } else {
        await apiClient.post('/academic-years', {
          name: name.trim(),
          startDate,
          endDate,
          isActive,
          admissionStatus,
          admissionStartDate: admissionStartDate || null,
          admissionEndDate: admissionEndDate || null,
          admissionPrefix: admissionPrefix.trim().toUpperCase(),
          targetEnrollment,
          description: description.trim() || null
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const respData = err.response?.data;
      if (respData?.errors) {
        setFieldErrors(respData.errors);
      }
      setTopErrorMessage(respData?.message || err.message || 'Failed to save academic session.');
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

        {/* Top Error Summary */}
        {topErrorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-medium">{topErrorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Row 1: Session Name & Admission Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Session Name <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 2026-27 or 2026-2027"
                value={name}
                onChange={(e) => handleFieldChange('name', e.target.value, setName)}
                className={`w-full rounded-lg border py-2 px-3 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-1 ${
                  fieldErrors.name
                    ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              {fieldErrors.name ? (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.name}</p>
              ) : (
                <span className="text-[10px] text-slate-400">Format: YYYY-YY (e.g. 2026-27) with consecutive years</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Intake Status <span className="text-rose-500 font-bold">*</span>
              </label>
              <select
                value={admissionStatus}
                onChange={(e) => setAdmissionStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-semibold bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
                Session Start Date <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFieldChange('startDate', e.target.value, setStartDate)}
                className={`w-full rounded-lg border py-2 px-3 text-xs transition-colors focus:outline-hidden focus:ring-1 ${
                  fieldErrors.startDate
                    ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              {fieldErrors.startDate && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session End Date <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFieldChange('endDate', e.target.value, setEndDate)}
                className={`w-full rounded-lg border py-2 px-3 text-xs transition-colors focus:outline-hidden focus:ring-1 ${
                  fieldErrors.endDate
                    ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              {fieldErrors.endDate && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.endDate}</p>
              )}
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
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
                placeholder="e.g. ADM or PBPS-2026"
                value={admissionPrefix}
                onChange={(e) => setAdmissionPrefix(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-mono uppercase focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Generates: {admissionPrefix || 'ADM'}-2026-0001</span>
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
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Total admission seats target for this session</span>
            </div>
          </div>

          {/* Row 5: Notes/Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Session Notes / Description
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Regular academic session for primary and secondary sections..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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

          {/* Footer buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Session...</span>
                </>
              ) : (
                <span>{isEditing ? 'Update Session' : 'Create Session'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
