import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  CreditCard,
  User,
  GraduationCap,
  Calendar,
  AlertCircle,
  Download,
  Plus,
  RefreshCw,
  ArrowRight,
  UserX,
  FileText
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { CancelAdmissionModal } from './CancelAdmissionModal.js';

interface SessionRegisterTabProps {
  sessions: any[];
  selectedSessionId: string;
  onSelectSessionId: (id: string) => void;
  onOpenFeeCollectionForStudent: (studentId: string) => void;
  onStartAdmissionForSession: (sessionId: string) => void;
  onOpenPromotionTab: (sessionId: string) => void;
}

export const SessionRegisterTab: React.FC<SessionRegisterTabProps> = ({
  sessions,
  selectedSessionId,
  onSelectSessionId,
  onOpenFeeCollectionForStudent,
  onStartAdmissionForSession,
  onOpenPromotionTab
}) => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [cancelModalStudent, setCancelModalStudent] = useState<any | null>(null);

  const currentSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];

  const fetchSessionStudents = async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/academic-years/${selectedSessionId}/students`);
      if (res.data?.success) {
        setStudents(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching session students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionStudents();
  }, [selectedSessionId]);

  // Unique classes for filter
  const classList = Array.from(new Set(students.map(s => s.className))).filter(Boolean);

  const filteredStudents = students.filter(s => {
    const matchesSearch = !searchQuery.trim() ||
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admissionNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parentPhone?.includes(searchQuery) ||
      s.parentName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass = !selectedClassFilter || s.className === selectedClassFilter;

    return matchesSearch && matchesClass;
  });

  const enrolledCount = students.length;
  const targetCount = currentSession?.targetEnrollment || 300;
  const percentFilled = Math.min(100, Math.round((enrolledCount / targetCount) * 100));

  // Export CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['Admission Number', 'Student Name', 'Gender', 'Class', 'Section', 'Roll No', 'Parent Name', 'Parent Phone', 'Admission Date', 'Fee Status', 'Total Fee', 'Paid Fee', 'Remaining Fee'];
    const rows = filteredStudents.map(s => [
      s.admissionNumber,
      s.fullName,
      s.gender,
      s.className,
      s.sectionName,
      s.rollNumber || '',
      s.parentName,
      s.parentPhone,
      new Date(s.admissionDate).toLocaleDateString('en-IN'),
      s.feeSummary?.feeStatus || 'PENDING',
      s.feeSummary?.totalAmount || 0,
      s.feeSummary?.paidAmount || 0,
      s.feeSummary?.remainingAmount || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `session_${currentSession?.name || 'admissions'}_register.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Session Switcher & Metadata */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Viewing Admission Register For
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={selectedSessionId}
                  onChange={(e) => onSelectSessionId(e.target.value)}
                  className="text-base font-bold font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded-lg py-1 px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Session {s.name} {s.isActive ? '(Primary Active)' : ''}
                    </option>
                  ))}
                </select>

                {currentSession?.isActive && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Active Session
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Intake Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Enrolled Students</span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {enrolledCount} <span className="text-slate-400 text-xs font-normal">/ {targetCount}</span>
              </span>
            </div>

            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Intake Quota</span>
              <span className="text-base font-bold text-indigo-700 font-mono">
                {percentFilled}% <span className="text-slate-400 text-xs font-normal">filled</span>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => onStartAdmissionForSession(selectedSessionId)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs transition-colors flex-1 sm:flex-initial min-h-[40px] sm:min-h-[auto]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Admit Student</span>
              </button>

              <button
                onClick={() => onOpenPromotionTab(selectedSessionId)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[40px] sm:min-h-[auto]"
                title="Promote students from this session"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>Rollover</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Search & Class Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, admission #, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 sm:py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[40px] sm:min-h-[auto]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap justify-end">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white py-2 sm:py-1.5 px-3 focus:outline-hidden focus:border-indigo-500 flex-1 sm:flex-initial min-h-[40px] sm:min-h-[auto]"
            >
              <option value="">All Classes ({students.length})</option>
              {classList.map((cls) => (
                <option key={cls} value={cls}>
                  {cls} ({students.filter(s => s.className === cls).length})
                </option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              disabled={filteredStudents.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 min-h-[40px] sm:min-h-[auto]"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchSessionStudents}
              className="p-2 sm:p-1.5 rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-slate-800 transition-colors min-h-[40px] min-w-[40px] sm:min-h-[auto] sm:min-w-[auto] flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Student Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
              <tr>
                <th className="py-3 px-3 sm:px-4">Admission No</th>
                <th className="py-3 px-3 sm:px-4">Student Details</th>
                <th className="py-3 px-3 sm:px-4">Class & Section</th>
                <th className="py-3 px-3 sm:px-4">Parent / Contact</th>
                <th className="py-3 px-3 sm:px-4">Enrolled Date</th>
                <th className="py-3 px-3 sm:px-4">Fee Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span className="text-xs font-medium">Loading session admissions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500 space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Users className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        No Students Admitted for Session {currentSession?.name}
                      </div>
                      <p className="text-xs text-slate-500 text-center">
                        No student admissions registered yet for this academic session. Start registering new admissions or rollover students from previous sessions.
                      </p>
                      <button
                        onClick={() => onStartAdmissionForSession(selectedSessionId)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Admit First Student</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.recordId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      {s.admissionNumber}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {s.firstName?.[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{s.fullName}</div>
                          <div className="text-[11px] text-slate-400">
                            {s.gender} · Roll: {s.rollNumber || 'Not assigned'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {s.className}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Section {s.sectionName}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{s.parentName}</div>
                      <div className="text-[11px] text-slate-500">{s.parentPhone}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {new Date(s.admissionDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.feeSummary?.feeStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.feeSummary?.feeStatus === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {s.feeSummary?.feeStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Admission Slip PDF */}
                        <a
                          href={`/api/students/${s.studentId}/admission-pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold transition-colors"
                          title="Download Admission Slip PDF"
                        >
                          <Download className="h-3 w-3" />
                          <span>Slip</span>
                        </a>

                        <button
                          onClick={() => onOpenFeeCollectionForStudent(s.studentId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-semibold transition-colors"
                          title="Collect Student Fees"
                        >
                          <CreditCard className="h-3 w-3" />
                          <span>Fee</span>
                        </button>

                        <button
                          onClick={() => navigate(`/students?studentId=${s.studentId}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition-colors"
                          title="View Profile"
                        >
                          <User className="h-3 w-3" />
                          <span>Profile</span>
                        </button>

                        {/* Cancel Admission Button if active */}
                        {s.status !== 'CANCELLED' ? (
                          <button
                            onClick={() => setCancelModalStudent({
                              id: s.studentId,
                              admissionNumber: s.admissionNumber,
                              fullName: s.fullName,
                              className: `${s.className} - Section ${s.sectionName || 'A'}`
                            })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold transition-colors"
                            title="Cancel Student Admission"
                          >
                            <UserX className="h-3 w-3" />
                            <span>Cancel</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                            Cancelled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Admission Modal */}
      <CancelAdmissionModal
        isOpen={!!cancelModalStudent}
        student={cancelModalStudent}
        onClose={() => setCancelModalStudent(null)}
        onSuccess={fetchSessionStudents}
      />
    </div>
  );
};
