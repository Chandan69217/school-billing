import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  GraduationCap,
  Users,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Check,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../../api/client.js';
import { toast } from 'sonner';

interface SessionPromotionTabProps {
  sessions: any[];
  classes: any[];
  defaultFromSessionId?: string;
  defaultToSessionId?: string;
  onPromotionComplete: () => void;
}

export const SessionPromotionTab: React.FC<SessionPromotionTabProps> = ({
  sessions,
  classes,
  defaultFromSessionId,
  defaultToSessionId,
  onPromotionComplete
}) => {
  const [fromSessionId, setFromSessionId] = useState(defaultFromSessionId || sessions[0]?.id || '');
  const [toSessionId, setToSessionId] = useState(defaultToSessionId || sessions[1]?.id || sessions[0]?.id || '');
  const [fromClassId, setFromClassId] = useState(classes[0]?.id || '');
  const [toClassId, setToClassId] = useState('');

  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentPromotions, setStudentPromotions] = useState<Record<string, { toSectionId: string; rollNumber: string }>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<any | null>(null);

  // Sync defaults
  useEffect(() => {
    if (sessions.length > 0) {
      if (!fromSessionId) {
        const active = sessions.find(s => s.isActive) || sessions[0];
        setFromSessionId(active.id);
      }
      if (!toSessionId || toSessionId === fromSessionId) {
        const other = sessions.find(s => s.id !== fromSessionId);
        if (other) setToSessionId(other.id);
      }
    }
  }, [sessions, fromSessionId]);

  // Sync classes: when fromClassId changes, auto-suggest next class (e.g. Class 1 -> Class 2)
  useEffect(() => {
    if (fromClassId && classes.length > 0) {
      const currentIndex = classes.findIndex(c => c.id === fromClassId);
      if (currentIndex !== -1 && currentIndex + 1 < classes.length) {
        setToClassId(classes[currentIndex + 1].id);
      } else {
        setToClassId(fromClassId);
      }
    }
  }, [fromClassId, classes]);

  // Fetch students for the selected fromSession and fromClass
  useEffect(() => {
    if (!fromSessionId || !fromClassId) return;

    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/academic-years/${fromSessionId}/students?classId=${fromClassId}`);
        if (res.data?.success) {
          setStudents(res.data.data);
          // By default, select all unpromoted students
          const unpromoted = res.data.data.filter((s: any) => !s.promoted).map((s: any) => s.studentId);
          setSelectedStudentIds(unpromoted);

          // Initialize promotion details with default section and roll number
          const initialMap: Record<string, { toSectionId: string; rollNumber: string }> = {};
          res.data.data.forEach((s: any) => {
            initialMap[s.studentId] = {
              toSectionId: s.sectionId || '',
              rollNumber: s.rollNumber || ''
            };
          });
          setStudentPromotions(initialMap);
        }
      } catch (err) {
        console.error('Error fetching promotion candidates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [fromSessionId, fromClassId]);

  const targetClassObj = classes.find(c => c.id === toClassId);
  const targetSections = targetClassObj?.sections || [];

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.studentId));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handlePromotionSubmit = async () => {
    if (!fromSessionId || !toSessionId || !toClassId) {
      toast.error('Please configure source session, target session, and target class.');
      return;
    }
    if (fromSessionId === toSessionId) {
      toast.error('Source session and target session must be different.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student to promote.');
      return;
    }

    setSubmitting(true);
    try {
      const promotionsPayload = selectedStudentIds.map(studentId => ({
        studentId,
        toClassId,
        toSectionId: studentPromotions[studentId]?.toSectionId || targetSections[0]?.id || null,
        rollNumber: studentPromotions[studentId]?.rollNumber || null
      }));

      const res = await apiClient.post('/academic-years/promote', {
        fromSessionId,
        toSessionId,
        promotions: promotionsPayload
      });

      if (res.data?.success) {
        confetti({ particleCount: 90, spread: 60 });
        toast.success(res.data.message || 'Students successfully promoted!');
        setSuccessInfo(res.data.data);
        onPromotionComplete();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Promotion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fromSessionObj = sessions.find(s => s.id === fromSessionId);
  const toSessionObj = sessions.find(s => s.id === toSessionId);
  const fromClassObj = classes.find(c => c.id === fromClassId);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Student Academic Session Promotion & Rollover
            </h2>
            <p className="text-xs text-slate-500">
              Promote student cohorts from the current academic session to the next session and allocate new class levels and fee schedules.
            </p>
          </div>
        </div>

        {/* Source and Target Session Configuration */}
        <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
          {/* Source Session */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              1. Source Academic Batch (Promoting From)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Source Session</label>
                <select
                  value={fromSessionId}
                  onChange={(e) => setFromSessionId(e.target.value)}
                  className="w-full text-xs font-bold rounded-lg border border-slate-300 py-2 sm:py-1.5 px-3 bg-white focus:border-indigo-500 min-h-[40px] sm:min-h-[auto]"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Session {s.name} {s.isActive ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Current Class</label>
                <select
                  value={fromClassId}
                  onChange={(e) => setFromClassId(e.target.value)}
                  className="w-full text-xs font-bold rounded-lg border border-slate-300 py-2 sm:py-1.5 px-3 bg-white focus:border-indigo-500 min-h-[40px] sm:min-h-[auto]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Target Session */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">
              2. Target Academic Batch (Promoting Into)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Session</label>
                <select
                  value={toSessionId}
                  onChange={(e) => setToSessionId(e.target.value)}
                  className="w-full text-xs font-bold rounded-lg border border-slate-300 py-2 sm:py-1.5 px-3 bg-white focus:border-indigo-500 font-mono min-h-[40px] sm:min-h-[auto]"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === fromSessionId}>
                      Session {s.name} {s.id === fromSessionId ? '(Source Session)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Promoted Target Class</label>
                <select
                  value={toClassId}
                  onChange={(e) => setToClassId(e.target.value)}
                  className="w-full text-xs font-bold rounded-lg border border-slate-300 py-2 sm:py-1.5 px-3 bg-white focus:border-indigo-500 font-semibold min-h-[40px] sm:min-h-[auto]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner if just promoted */}
      {successInfo && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>
              Successfully promoted <strong>{successInfo.count}</strong> student(s) from Session <strong>{successInfo.fromSession}</strong> to Session <strong>{successInfo.toSession}</strong>!
            </span>
          </div>
          <button
            onClick={() => setSuccessInfo(null)}
            className="text-[11px] font-bold underline cursor-pointer p-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Student List for Promotion */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="selectAllStudents"
              checked={students.length > 0 && selectedStudentIds.length === students.length}
              onChange={handleToggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="selectAllStudents" className="text-xs font-bold text-slate-800 cursor-pointer">
              Select All Students ({selectedStudentIds.length} of {students.length} selected)
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Promoting from <strong>{fromClassObj?.name} ({fromSessionObj?.name})</strong> ➔ <strong>{targetClassObj?.name} ({toSessionObj?.name})</strong>
            </span>

            <button
              onClick={handlePromotionSubmit}
              disabled={submitting || selectedStudentIds.length === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs min-h-[42px] sm:min-h-[auto]"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {submitting ? 'Promoting Students...' : `Promote (${selectedStudentIds.length}) Students`}
              </span>
            </button>
          </div>
        </div>

        {/* Student Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="border-b border-slate-200 bg-slate-50/90 font-bold text-slate-600">
              <tr>
                <th className="py-3 px-4 w-10">Select</th>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Current Class & Section</th>
                <th className="py-3 px-4">Current Roll No</th>
                <th className="py-3 px-4">Target Section</th>
                <th className="py-3 px-4">New Roll No (Optional)</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span className="text-xs font-medium">Loading class student cohort...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Users className="h-8 w-8 text-slate-300 mx-auto" />
                      <div className="font-bold text-slate-700">No students enrolled in this class for Session {fromSessionObj?.name}</div>
                      <p className="text-[11px] text-slate-400">
                        Select a different source class or session to find eligible students for promotion.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const isSelected = selectedStudentIds.includes(s.studentId);
                  const promo = studentPromotions[s.studentId] || { toSectionId: '', rollNumber: '' };

                  return (
                    <tr
                      key={s.recordId}
                      className={`transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(s.studentId)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {s.admissionNumber}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {s.fullName}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {s.className} ({s.sectionName})
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {s.rollNumber || 'N/A'}
                      </td>

                      <td className="py-3 px-4">
                        <select
                          disabled={!isSelected}
                          value={promo.toSectionId}
                          onChange={(e) => {
                            setStudentPromotions(prev => ({
                              ...prev,
                              [s.studentId]: { ...promo, toSectionId: e.target.value }
                            }));
                          }}
                          className="text-xs rounded border border-slate-300 py-1 px-2 bg-white disabled:bg-slate-100 disabled:opacity-60"
                        >
                          {targetSections.length > 0 ? (
                            targetSections.map((sec: any) => (
                              <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                            ))
                          ) : (
                            <option value="">Section A</option>
                          )}
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        <input
                          type="text"
                          disabled={!isSelected}
                          placeholder={s.rollNumber || 'e.g. 01'}
                          value={promo.rollNumber}
                          onChange={(e) => {
                            setStudentPromotions(prev => ({
                              ...prev,
                              [s.studentId]: { ...promo, rollNumber: e.target.value }
                            }));
                          }}
                          className="w-24 text-xs rounded border border-slate-300 py-1 px-2 disabled:bg-slate-100 disabled:opacity-60"
                        />
                      </td>

                      <td className="py-3 px-4 text-right">
                        {s.promoted ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            Already Promoted
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Eligible
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
