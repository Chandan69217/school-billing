import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle,
  Plus,
  Users,
  Settings,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Check,
  ShieldCheck,
  RefreshCw,
  Archive,
  ArchiveRestore,
  Download,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { toast } from 'sonner';

interface SessionManagerTabProps {
  sessions: any[];
  onRefreshSessions: () => void;
  onOpenCreateSession: () => void;
  onEditSession: (session: any) => void;
  onSelectSessionForAdmission: (sessionId: string) => void;
  onViewSessionRegister: (sessionId: string) => void;
  onOpenPromotionTab: (sessionId?: string) => void;
}

export const SessionManagerTab: React.FC<SessionManagerTabProps> = ({
  sessions,
  onRefreshSessions,
  onOpenCreateSession,
  onEditSession,
  onSelectSessionForAdmission,
  onViewSessionRegister,
  onOpenPromotionTab
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Archive confirmation modal state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [sessionToArchive, setSessionToArchive] = useState<any | null>(null);
  const [archiveDetails, setArchiveDetails] = useState<{
    studentCount: number;
    feeStructureCount: number;
    paymentCount: number;
    unpaidDuesCount: number;
    loading: boolean;
  }>({
    studentCount: 0,
    feeStructureCount: 0,
    paymentCount: 0,
    unpaidDuesCount: 0,
    loading: false
  });
  const [archiving, setArchiving] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const activeSession = sessions.find(s => s.isActive && !s.isArchived) || sessions.find(s => s.isActive) || sessions[0];
  const totalEnrolled = sessions.reduce((sum, s) => sum + (s.enrolledStudentsCount || s._count?.studentsAcademic || 0), 0);
  const totalCapacity = sessions.reduce((sum, s) => sum + (s.targetEnrollment || 300), 0);

  // Filtered sessions based on tab
  const filteredSessions = sessions.filter(s => {
    if (activeFilterTab === 'ACTIVE') return !s.isArchived;
    if (activeFilterTab === 'ARCHIVED') return !!s.isArchived;
    return true;
  });

  const handleActivateSession = async (id: string, name: string) => {
    try {
      setUpdatingId(id);
      const res = await apiClient.put(`/academic-years/${id}/activate`);
      if (res.data?.success) {
        toast.success(`Session "${name}" is now the primary active academic session!`);
        onRefreshSessions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate session');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateAdmissionStatus = async (id: string, status: string, name: string) => {
    try {
      setUpdatingId(id);
      const res = await apiClient.put(`/academic-years/${id}/admission-status`, { admissionStatus: status });
      if (res.data?.success) {
        toast.success(`Admission status for Session "${name}" updated to ${status}`);
        onRefreshSessions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update admission status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Open archive confirmation dialog with count checks
  const handleInitiateArchive = async (session: any) => {
    if (session.isActive) {
      toast.error('Set another session as current before archiving this one.', {
        description: 'The current active academic session cannot be archived.'
      });
      return;
    }

    setSessionToArchive(session);
    setArchiveModalOpen(true);
    setArchiveDetails({
      studentCount: session.enrolledStudentsCount || session._count?.studentsAcademic || 0,
      feeStructureCount: session._count?.feeStructures || 0,
      paymentCount: session._count?.payments || 0,
      unpaidDuesCount: 0,
      loading: true
    });

    try {
      const res = await apiClient.get(`/academic-years/${session.id}/archive-details`);
      if (res.data?.success) {
        setArchiveDetails({
          studentCount: res.data.data.studentCount || 0,
          feeStructureCount: res.data.data.feeStructureCount || 0,
          paymentCount: res.data.data.paymentCount || 0,
          unpaidDuesCount: res.data.data.unpaidDuesCount || 0,
          loading: false
        });
      }
    } catch {
      setArchiveDetails(prev => ({ ...prev, loading: false }));
    }
  };

  const handleConfirmArchive = async () => {
    if (!sessionToArchive) return;
    try {
      setArchiving(true);
      const res = await apiClient.post(`/academic-years/${sessionToArchive.id}/archive`);
      if (res.data?.success) {
        toast.success(`Session "${sessionToArchive.name}" archived successfully.`);
        setArchiveModalOpen(false);
        setSessionToArchive(null);
        onRefreshSessions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to archive academic session.');
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async (session: any) => {
    try {
      setUpdatingId(session.id);
      const res = await apiClient.post(`/academic-years/${session.id}/unarchive`);
      if (res.data?.success) {
        toast.success(`Session "${session.name}" restored from archive.`);
        onRefreshSessions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to restore session.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Export Sessions to CSV with UTF-8 BOM, escaped values
  const handleExportSessionsCSV = async () => {
    try {
      setExportingCsv(true);
      const response = await apiClient.get('/academic-years/export/csv', {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PBPS_Academic_Sessions_${new Date().getFullYear()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Academic Sessions exported to CSV successfully.');
    } catch (err: any) {
      // Fallback client-side CSV export if offline
      const headers = ['Session Name', 'Start Date', 'End Date', 'Status', 'Admission Status', 'Enrolled Students', 'Target Capacity', 'Archived'];
      const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const rows = sessions.map(s => [
        escapeCsv(s.name),
        escapeCsv(s.startDate ? new Date(s.startDate).toLocaleDateString('en-IN') : ''),
        escapeCsv(s.endDate ? new Date(s.endDate).toLocaleDateString('en-IN') : ''),
        escapeCsv(s.isActive ? 'CURRENT ACTIVE' : 'INACTIVE'),
        escapeCsv(s.admissionStatus),
        escapeCsv(s.enrolledStudentsCount || s._count?.studentsAcademic || 0),
        escapeCsv(s.targetEnrollment || 300),
        escapeCsv(s.isArchived ? 'YES' : 'NO')
      ]);
      const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'PBPS_Academic_Sessions.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Sessions exported to CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Admissions Open
          </span>
        );
      case 'CLOSING_SOON':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-500" />
            Closing Soon
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Admissions Closed
          </span>
        );
      case 'UPCOMING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <Sparkles className="h-3 w-3 text-sky-500" />
            Upcoming Session
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Session KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Session */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Primary Active Session
            </span>
            <span className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Calendar className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {activeSession?.name || '2026-27'}
            </span>
            <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
              Current
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Intake:</span>
            {activeSession && getStatusBadge(activeSession.admissionStatus || 'OPEN')}
          </div>
        </div>

        {/* Card 2: Active Session Seats */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Intake Capacity
            </span>
            <span className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {activeSession?.enrolledStudentsCount || activeSession?._count?.studentsAcademic || 0}
            </span>
            <span className="text-xs text-slate-500">
              / {activeSession?.targetEnrollment || 300} seats
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{activeSession?.capacityPercent || Math.round(((activeSession?.enrolledStudentsCount || 0) / (activeSession?.targetEnrollment || 300)) * 100)}% filled</span>
          </div>
        </div>

        {/* Card 3: Total Configured Sessions */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Configured Sessions
            </span>
            <span className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {sessions.length}
            </span>
            <span className="text-xs text-slate-500">
              ({sessions.filter(s => s.isArchived).length} archived)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {sessions.filter(s => !s.isArchived).length} active academic cycles
          </div>
        </div>

        {/* Card 4: Quick Action */}
        <div className="p-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Annual Session Rollover
            </span>
            <p className="mt-1 text-xs text-indigo-900 leading-relaxed">
              Promote continuing students to the next class batch before opening new admissions.
            </p>
          </div>
          <button
            onClick={() => onOpenPromotionTab()}
            className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs"
          >
            <span>Batch Promotion</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Sessions List Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Toolbar Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Academic Sessions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control student admission intake status, active primary session, and archive expired sessions.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Filter Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
              <button
                onClick={() => setActiveFilterTab('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilterTab === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({sessions.length})
              </button>
              <button
                onClick={() => setActiveFilterTab('ACTIVE')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilterTab === 'ACTIVE'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active ({sessions.filter(s => !s.isArchived).length})
              </button>
              <button
                onClick={() => setActiveFilterTab('ARCHIVED')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilterTab === 'ARCHIVED'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived ({sessions.filter(s => s.isArchived).length})
              </button>
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportSessionsCSV}
              disabled={exportingCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            {/* Create Session button */}
            <button
              onClick={onOpenCreateSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Academic Session</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="divide-y divide-slate-100">
          {filteredSessions.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No sessions found in the selected tab.
            </div>
          )}

          {filteredSessions.map((session) => {
            const isCurrentActive = session.isActive;
            const isArchived = session.isArchived;
            const enrolled = session.enrolledStudentsCount || session._count?.studentsAcademic || 0;
            const target = session.targetEnrollment || 300;
            const percent = Math.min(100, Math.round((enrolled / target) * 100));

            return (
              <div
                key={session.id}
                className={`p-5 transition-colors ${
                  isCurrentActive
                    ? 'bg-indigo-50/20'
                    : isArchived
                    ? 'bg-slate-50/50 opacity-90'
                    : 'hover:bg-slate-50/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Session identity and metadata */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-lg font-bold text-slate-900">
                        Session {session.name}
                      </span>

                      {/* Current Active Badge */}
                      {isCurrentActive && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                          <Check className="h-3 w-3" />
                          PRIMARY ACTIVE
                        </span>
                      )}

                      {/* Archived Badge */}
                      {isArchived && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                          <Archive className="h-3 w-3" />
                          ARCHIVED
                        </span>
                      )}

                      {/* Admission Status */}
                      {!isArchived && getStatusBadge(session.admissionStatus || 'OPEN')}

                      {/* Admission Status Selector */}
                      {!isArchived && (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0 sm:ml-2">
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">Admission Status:</span>
                          <select
                            value={session.admissionStatus || 'OPEN'}
                            onChange={(e) => handleUpdateAdmissionStatus(session.id, e.target.value, session.name)}
                            disabled={updatingId === session.id}
                            className={`text-xs font-bold rounded-lg border py-1 px-2.5 focus:outline-hidden transition-colors cursor-pointer ${
                              session.admissionStatus === 'OPEN'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : session.admissionStatus === 'CLOSING_SOON'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : session.admissionStatus === 'CLOSED'
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-sky-200 bg-sky-50 text-sky-700'
                            }`}
                          >
                            <option value="OPEN">🟢 Open</option>
                            <option value="CLOSING_SOON">🟡 Closing Soon</option>
                            <option value="CLOSED">🔴 Closed</option>
                            <option value="UPCOMING">🔵 Upcoming</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Meta Dates & Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1.5 gap-x-4 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-slate-400">Duration: </span>
                        <span className="font-semibold text-slate-700">
                          {new Date(session.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} – {new Date(session.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Admission Prefix: </span>
                        <span className="font-mono font-bold text-indigo-700">
                          {session.admissionPrefix || 'ADM'}-YYYY-XXXX
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Application Cutoff: </span>
                        <span className="font-semibold text-slate-700">
                          {session.admissionEndDate ? new Date(session.admissionEndDate).toLocaleDateString('en-IN') : 'No cutoff set'}
                        </span>
                      </div>
                    </div>

                    {/* Archive Timestamp Info if archived */}
                    {isArchived && (
                      <p className="text-[11px] text-slate-500 font-medium">
                        Archived on {session.archivedAt ? new Date(session.archivedAt).toLocaleDateString('en-IN') : 'N/A'}{' '}
                        {session.archivedByName ? `by ${session.archivedByName}` : ''}. Hidden from new admissions and billing.
                      </p>
                    )}

                    {/* Description */}
                    {session.description && (
                      <p className="text-xs text-slate-500 italic max-w-2xl">
                        "{session.description}"
                      </p>
                    )}

                    {/* Class distribution tags */}
                    {session.classDistribution && session.classDistribution.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] font-semibold text-slate-400">Class breakdown:</span>
                        {session.classDistribution.map((cd: any) => (
                          <span
                            key={cd.classId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                          >
                            <span>{cd.className}:</span>
                            <strong className="text-indigo-600">{cd.count}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Capacity meter & Action buttons */}
                  <div className="lg:w-80 shrink-0 space-y-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Capacity progress */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-bold text-slate-700">Admission Seats</span>
                        <span className="font-mono font-bold text-indigo-700">
                          {enrolled} / {target} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            percent >= 90 ? 'bg-rose-500' : percent >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Button group */}
                    <div className="flex items-center flex-wrap gap-2">
                      <button
                        onClick={() => onViewSessionRegister(session.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                      >
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        <span>Admitted ({enrolled})</span>
                      </button>

                      {!isArchived ? (
                        <button
                          onClick={() => onSelectSessionForAdmission(session.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-2xs transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Enroll Here</span>
                        </button>
                      ) : (
                        <span className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium cursor-not-allowed">
                          <span>Archived</span>
                        </span>
                      )}

                      {!isCurrentActive && !isArchived && (
                        <button
                          onClick={() => handleActivateSession(session.id, session.name)}
                          disabled={updatingId === session.id}
                          title="Set as Primary Active Academic Session"
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Make Primary</span>
                        </button>
                      )}

                      {/* Archive / Unarchive Action */}
                      {!isArchived ? (
                        <button
                          onClick={() => handleInitiateArchive(session)}
                          title="Archive Session"
                          disabled={isCurrentActive}
                          className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                            isCurrentActive
                              ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                              : 'border-slate-300 bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200'
                          }`}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnarchive(session)}
                          title="Restore from Archive"
                          disabled={updatingId === session.id}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          <span>Unarchive</span>
                        </button>
                      )}

                      <button
                        onClick={() => onEditSession(session)}
                        title="Edit Session Settings"
                        aria-label="Edit Session Settings"
                        className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center justify-center"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog for Archiving Session (Part A2) */}
      {archiveModalOpen && sessionToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Archive Academic Session {sessionToArchive.name}?
                </h3>
                <p className="text-xs text-slate-500">
                  Confirm session archival and understand the system impact.
                </p>
              </div>
            </div>

            {/* Impact Details Box */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2 text-xs text-slate-700">
              <p className="font-semibold text-amber-900">
                Current Records linked to Session {sessionToArchive.name}:
              </p>
              <ul className="space-y-1 pl-4 list-disc text-slate-600">
                <li>
                  <strong>{archiveDetails.studentCount}</strong> enrolled student academic record(s)
                </li>
                <li>
                  <strong>{archiveDetails.feeStructureCount}</strong> class fee structure(s) configured
                </li>
                <li>
                  <strong>{archiveDetails.paymentCount}</strong> fee collection payment transaction(s)
                </li>
              </ul>
              <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-800 leading-relaxed">
                Archived sessions will <strong>NOT</strong> appear in dropdowns when creating new admissions, fee collection, or billing records. Historical student reports and receipts will remain accessible.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setArchiveModalOpen(false);
                  setSessionToArchive(null);
                }}
                disabled={archiving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={archiving}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {archiving ? (
                  <>
                    <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    <span>Confirm Archive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
