import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  CreditCard,
  Eye,
  UserCheck,
  UserX,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '../api/client.js';
import { StudentProfileModal } from '../components/students/StudentProfileModal.js';
import { CancelAdmissionModal } from '../components/admissions/CancelAdmissionModal.js';

interface StudentsPageProps {
  onOpenFeeCollection: (studentId?: string) => void;
  onOpenReceipt: (receiptId: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  onOpenFeeCollection,
  onOpenReceipt
}) => {
  const [searchParams] = useSearchParams();
  const studentIdParam = searchParams.get('studentId');

  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Profile modal
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [cancelStudent, setCancelStudent] = useState<any | null>(null);

  useEffect(() => {
    if (studentIdParam) {
      setSelectedStudentId(studentIdParam);
      setIsProfileOpen(true);
    }
  }, [studentIdParam]);

  // Load classes
  useEffect(() => {
    apiClient.get('/classes').then(res => {
      if (res.data?.success) setClasses(res.data.data);
    }).catch(console.error);
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (classFilter) params.append('classId', classFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('page', page.toString());
      params.append('limit', '10');

      const res = await apiClient.get(`/students?${params.toString()}`);
      if (res.data?.success) {
        setStudents(res.data.data);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, classFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const filteredStudents = feeStatusFilter === 'ALL'
    ? students
    : students.filter(s => s.feeStatus === feeStatusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Student Information Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive student ledger, guardian contact details, class allocations, and fee settlement statuses.
          </p>
        </div>

        <button
          onClick={() => onOpenFeeCollection()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs min-h-[40px] transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          <span>Quick Fee Collection</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3">
        {/* Mobile top search bar & filter toggle button */}
        <div className="flex sm:hidden items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, adm #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold min-h-[44px] shrink-0 transition-colors ${
              mobileFiltersOpen || classFilter || feeStatusFilter !== 'ALL'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {(classFilter || feeStatusFilter !== 'ALL') && (
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
            )}
          </button>
        </div>

        {/* Filter controls: Grid on tablet/desktop, collapsible drawer/stack on mobile */}
        <form
          onSubmit={handleSearchSubmit}
          className={`${mobileFiltersOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100`}
        >
          {/* Desktop Search input (hidden on mobile since shown above) */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, adm #, parent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-h-[42px]"
            />
          </div>

          {/* Class Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1 sm:hidden">Class</label>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[44px] sm:min-h-[42px]"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Admission / Student Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1 sm:hidden">Admission Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[44px] sm:min-h-[42px]"
            >
              <option value="ACTIVE">Active Students</option>
              <option value="CANCELLED">Cancelled Admissions</option>
              <option value="ALL">All Statuses</option>
              <option value="INACTIVE">Inactive</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>

          {/* Fee Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1 sm:hidden">Fee Status</label>
            <select
              value={feeStatusFilter}
              onChange={(e) => setFeeStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[44px] sm:min-h-[42px]"
            >
              <option value="ALL">All Fee Statuses</option>
              <option value="PAID">Paid in Full</option>
              <option value="PARTIAL">Partial Dues</option>
              <option value="PENDING">Pending Total</option>
              <option value="OVERDUE">Overdue Over 15 Days</option>
            </select>
          </div>

          {/* Search & Reset Actions */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 min-h-[44px] sm:min-h-[42px] transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setClassFilter('');
                setFeeStatusFilter('ALL');
                setStatusFilter('ACTIVE');
                setPage(1);
                fetchStudents();
              }}
              className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 min-h-[44px] sm:min-h-[42px] transition-colors shrink-0"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Student Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
            Loading student directory from MySQL...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-rose-500" />
            {error}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No student records match the active filter criteria.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[750px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Adm #</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Parent Details</th>
                  <th className="py-3 px-4 text-center">Enrollment Status</th>
                  <th className="py-3 px-4 text-right">Total Outstanding</th>
                  <th className="py-3 px-4 text-center">Fee Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.admissionNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{s.fullName}</div>
                      <div className="text-[10px] text-slate-400">DOB: {new Date(s.dateOfBirth).toLocaleDateString()}</div>
                      {s.status === 'CANCELLED' && s.cancellationReason && (
                        <div className="text-[10px] text-rose-600 font-medium italic mt-0.5 truncate max-w-xs" title={s.cancellationReason}>
                          Reason: {s.cancellationReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{s.className} ({s.sectionName})</div>
                      <div className="text-[10px] text-slate-400">Roll: {s.rollNumber || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{s.parentName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.parentPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        s.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      {s.feeSummary?.pending > 0 ? (
                        <span className="text-rose-600">₹{s.feeSummary.pending.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-emerald-600">Cleared</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        s.feeStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                        s.feeStatus === 'OVERDUE' ? 'bg-rose-100 text-rose-800' :
                        s.feeStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {s.feeStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Download Admission Slip PDF */}
                        <a
                          href={`/api/students/${s.id}/admission-pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                          title="Download Admission Slip PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>

                        <button
                          onClick={() => {
                            setSelectedStudentId(s.id);
                            setIsProfileOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="View Profile Dossier"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {s.status !== 'CANCELLED' && s.feeSummary?.pending > 0 && (
                          <button
                            onClick={() => onOpenFeeCollection(s.id)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                            title="Collect Fee"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}

                        {/* Cancel Admission */}
                        {s.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setCancelStudent({
                              id: s.id,
                              admissionNumber: s.admissionNumber,
                              fullName: s.fullName,
                              className: `${s.className} - Section ${s.sectionName || 'A'}`
                            })}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                            title="Cancel Student Admission"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs bg-slate-50 text-center sm:text-left">
            <span className="text-slate-500">
              Showing page <strong>{page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total students)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700 sm:hidden">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Profile Modal */}
      <StudentProfileModal
        studentId={selectedStudentId}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onCollectFee={(id) => onOpenFeeCollection(id)}
        onOpenReceipt={onOpenReceipt}
      />

      {/* Cancel Admission Modal */}
      <CancelAdmissionModal
        isOpen={!!cancelStudent}
        student={cancelStudent}
        onClose={() => setCancelStudent(null)}
        onSuccess={() => {
          fetchStudents();
        }}
      />
    </div>
  );
};
