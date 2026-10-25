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
  AlertTriangle,
  Award,
  MoreVertical,
  Activity,
  UserMinus,
  LogOut,
  RefreshCw,
  Camera
} from 'lucide-react';
import { apiClient } from '../api/client.js';
import { StudentProfileModal } from '../components/students/StudentProfileModal.js';
import { CancelAdmissionModal } from '../components/admissions/CancelAdmissionModal.js';
import { StatusChangeModal } from '../components/students/StatusChangeModal.js';
import { SLCModal } from '../components/admissions/SLCModal.js';
import { toast } from 'sonner';

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

  // Modals
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [cancelStudent, setCancelStudent] = useState<any | null>(null);
  const [statusStudent, setStatusStudent] = useState<any | null>(null);
  const [slcModalOpen, setSlcModalOpen] = useState(false);
  const [activeSlc, setActiveSlc] = useState<any | null>(null);

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

  const handleViewSlc = async (studentId: string) => {
    try {
      const res = await apiClient.get(`/students/${studentId}/slc`);
      if (res.data?.success && res.data.data) {
        setActiveSlc(res.data.data);
        setSlcModalOpen(true);
      } else {
        toast.info('No School Leaving Certificate has been issued for this student yet.');
      }
    } catch (err: any) {
      toast.info('No School Leaving Certificate found for this student.');
    }
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
            Student dossiers, photograph records, class allocations, status transitions, and fee ledger summaries.
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Name, Adm #, Phone, Aadhaar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[42px] focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter (Part C3) */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[42px] focus:outline-hidden focus:border-indigo-500 cursor-pointer font-semibold text-slate-800"
            >
              <option value="ACTIVE">Active Students</option>
              <option value="INACTIVE">Inactive Students</option>
              <option value="WITHDRAWN">Withdrawn Students</option>
              <option value="CANCELLED">Cancelled Admissions</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>

          {/* Fee Status Filter */}
          <div>
            <select
              value={feeStatusFilter}
              onChange={(e) => setFeeStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[42px] focus:outline-hidden focus:border-indigo-500 cursor-pointer"
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
              className="flex-1 py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 min-h-[42px] transition-colors"
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
              className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 min-h-[42px] transition-colors shrink-0"
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
            Loading student directory...
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
            <table className="w-full text-xs text-left min-w-[850px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Adm #</th>
                  <th className="py-3 px-4">Student & Photo</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Parent Details</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Outstanding Dues</th>
                  <th className="py-3 px-4 text-center">Fee Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Adm Number */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.admissionNumber}</td>

                    {/* Student Name & Photo (Part B1) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {s.photoUrl ? (
                            <img src={s.photoUrl} alt={s.fullName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-slate-500">{s.firstName?.[0] || 'S'}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{s.fullName}</div>
                          <div className="text-[10px] text-slate-400">
                            DOB: {new Date(s.dateOfBirth).toLocaleDateString('en-IN')}
                            {s.aadhaarNumber && (
                              <span className="ml-1.5 font-mono">· {s.aadhaarNumber}</span>
                            )}
                          </div>
                          {s.status === 'CANCELLED' && s.cancellationReason && (
                            <div className="text-[10px] text-rose-600 font-medium italic mt-0.5 truncate max-w-xs" title={s.cancellationReason}>
                              Cancelled: {s.cancellationReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Class & Section */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{s.className} ({s.sectionName})</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {s.isHostelStudent ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">Hostel</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">Day</span>
                        )}
                        {s.isNonAttending && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Non-Attending</span>
                        )}
                        <span className="text-[10px] text-slate-400">Roll: {s.rollNumber || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Parent */}
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{s.parentName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.parentPhone}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        s.status === 'INACTIVE' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        s.status === 'WITHDRAWN' ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>

                    {/* Total Outstanding */}
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      {s.feeSummary?.pending > 0 ? (
                        <span className="text-rose-600">₹{s.feeSummary.pending.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-emerald-600">Cleared</span>
                      )}
                    </td>

                    {/* Fee Status Badge */}
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

                    {/* Actions Menu (Part C3) */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {/* Profile Dossier */}
                        <button
                          onClick={() => {
                            setSelectedStudentId(s.id);
                            setIsProfileOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="View Profile Dossier"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Status Transition Action (Active, Inactive, Withdraw) */}
                        {s.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setStatusStudent({
                              id: s.id,
                              admissionNumber: s.admissionNumber,
                              fullName: s.fullName,
                              currentStatus: s.status
                            })}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                            title="Change Status (Inactive / Active / Withdraw)"
                          >
                            <Activity className="h-4 w-4" />
                          </button>
                        )}

                        {/* Collect Fee */}
                        {s.status === 'ACTIVE' && s.feeSummary?.pending > 0 && (
                          <button
                            onClick={() => onOpenFeeCollection(s.id)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                            title="Collect Pending Fee"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}

                        {/* View SLC if Withdrawn or Cancelled */}
                        {(s.status === 'CANCELLED' || s.status === 'WITHDRAWN') && (
                          <button
                            onClick={() => handleViewSlc(s.id)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                            title="View School Leaving Certificate (SLC)"
                          >
                            <Award className="h-4 w-4" />
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
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                            title="Cancel Student Admission (Dues check & SLC issuance)"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}

                        {/* Admission Slip PDF */}
                        <a
                          href={`/api/students/${s.id}/admission-pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          title="Download Admission Slip PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>
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
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
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
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
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

      {/* Cancel Admission Modal (Part C2) */}
      <CancelAdmissionModal
        isOpen={!!cancelStudent}
        student={cancelStudent}
        onClose={() => setCancelStudent(null)}
        onSuccess={(slc) => {
          fetchStudents();
          if (slc) {
            setActiveSlc(slc);
            setSlcModalOpen(true);
          }
        }}
      />

      {/* Status Change Modal (Part C3) */}
      <StatusChangeModal
        isOpen={!!statusStudent}
        student={statusStudent}
        onClose={() => setStatusStudent(null)}
        onSuccess={(slc) => {
          fetchStudents();
          if (slc) {
            setActiveSlc(slc);
            setSlcModalOpen(true);
          }
        }}
      />

      {/* SLC Certificate Modal */}
      <SLCModal
        isOpen={slcModalOpen}
        onClose={() => setSlcModalOpen(false)}
        slcData={activeSlc}
        onReprintSuccess={fetchStudents}
      />
    </div>
  );
};
