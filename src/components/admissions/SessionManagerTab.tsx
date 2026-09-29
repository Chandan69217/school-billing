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
  RefreshCw
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

  const activeSession = sessions.find(s => s.isActive) || sessions[0];
  const totalEnrolled = sessions.reduce((sum, s) => sum + (s.enrolledStudentsCount || s._count?.studentsAcademic || 0), 0);
  const totalCapacity = sessions.reduce((sum, s) => sum + (s.targetEnrollment || 300), 0);

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
            <span className="text-xs text-slate-400 font-semibold">
              / {activeSession?.targetEnrollment || 300} seats
            </span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(((activeSession?.enrolledStudentsCount || activeSession?._count?.studentsAcademic || 0) / (activeSession?.targetEnrollment || 300)) * 100))}%`
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400 font-medium">
              <span>
                {Math.round(((activeSession?.enrolledStudentsCount || activeSession?._count?.studentsAcademic || 0) / (activeSession?.targetEnrollment || 300)) * 100)}% filled
              </span>
              <span>
                {(activeSession?.targetEnrollment || 300) - (activeSession?.enrolledStudentsCount || activeSession?._count?.studentsAcademic || 0)} vacant seats
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Enrolled Across Sessions */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              All Session Admissions
            </span>
            <span className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{totalEnrolled}</span>
            <span className="text-xs text-slate-400 font-semibold">enrolled students</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Across {sessions.length} registered academic batches
          </p>
        </div>

        {/* Card 4: Quick Actions Banner */}
        <div className="p-4 rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50/70 to-white shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Session Actions
            </span>
            <p className="text-xs text-slate-600 mt-1">
              Add upcoming intake batches or rollover students to the next class.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onOpenCreateSession}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Session</span>
            </button>
            <button
              onClick={() => onOpenPromotionTab()}
              className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition-colors"
              title="Promote students from one session to another"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>Rollover</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Management Card List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Academic Admission Sessions
            </h3>
            <p className="text-xs text-slate-500">
              Control admission status, application cutoff deadlines, enrollment prefix, and seat quotas per batch.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={onRefreshSessions}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[38px] sm:min-h-[auto] flex-1 sm:flex-initial"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span>Refresh</span>
            </button>
            <button
              onClick={onOpenCreateSession}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-2xs min-h-[38px] sm:min-h-[auto] flex-1 sm:flex-initial"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Session</span>
            </button>
          </div>
        </div>

        {/* Sessions Grid */}
        <div className="divide-y divide-slate-100">
          {sessions.map((session) => {
            const enrolled = session.enrolledStudentsCount || session._count?.studentsAcademic || 0;
            const target = session.targetEnrollment || 300;
            const percent = Math.min(100, Math.round((enrolled / target) * 100));

            return (
              <div
                key={session.id}
                className={`p-4 sm:p-6 transition-colors ${
                  session.isActive ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                        Session {session.name}
                      </span>

                      {session.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-2xs">
                          <Check className="h-3 w-3" />
                          Primary Active Session
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivateSession(session.id, session.name)}
                          disabled={updatingId === session.id}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer min-h-[32px] inline-flex items-center"
                        >
                          Set as Active Session
                        </button>
                      )}

                      {session.isArchived && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                          Archived
                        </span>
                      )}

                      {/* Admission Status dropdown */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0 sm:ml-2">
                        <span className="text-[11px] text-slate-400 font-medium shrink-0">Admission Status:</span>
                        <select
                          value={session.admissionStatus || 'OPEN'}
                          onChange={(e) => handleUpdateAdmissionStatus(session.id, e.target.value, session.name)}
                          disabled={updatingId === session.id}
                          className={`text-xs font-bold rounded-lg border py-1.5 sm:py-1 px-2.5 focus:outline-hidden transition-colors cursor-pointer min-h-[36px] sm:min-h-[auto] ${
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
                  <div className="lg:w-72 shrink-0 space-y-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewSessionRegister(session.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors min-h-[40px] sm:min-h-[auto]"
                      >
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        <span>Admitted ({enrolled})</span>
                      </button>

                      <button
                        onClick={() => onSelectSessionForAdmission(session.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-2xs transition-colors min-h-[40px] sm:min-h-[auto]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Enroll Here</span>
                      </button>

                      <button
                        onClick={() => onEditSession(session)}
                        title="Edit Session Settings"
                        aria-label="Edit Session Settings"
                        className="p-2 sm:p-1.5 rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors min-h-[40px] min-w-[40px] sm:min-h-[auto] sm:min-w-[auto] flex items-center justify-center"
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
    </div>
  );
};
