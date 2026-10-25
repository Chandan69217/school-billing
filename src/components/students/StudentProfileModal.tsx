import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Users,
  CreditCard,
  FileText,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  Printer,
  Receipt,
  Download,
  ShieldCheck,
  AlertTriangle,
  UserX,
  Upload,
  Check,
  ExternalLink,
  Loader2,
  History,
  Award,
  Eye,
  EyeOff,
  Building,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/client.js';
import { CancelAdmissionModal } from '../admissions/CancelAdmissionModal.js';
import { SLCModal } from '../admissions/SLCModal.js';
import { StatusChangeModal } from './StatusChangeModal.js';
import { maskAadhaar } from '../../utils/verhoeff.js';

interface StudentProfileModalProps {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCollectFee: (studentId: string) => void;
  onOpenReceipt: (receiptId: string) => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  studentId,
  isOpen,
  onClose,
  onCollectFee,
  onOpenReceipt
}) => {
  const [student, setStudent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fees' | 'payments' | 'documents' | 'timeline'>('overview');
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSlcModal, setShowSlcModal] = useState(false);
  const [showUnmaskedAadhaar, setShowUnmaskedAadhaar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('OTHER');

  // Change Hostel Status Modal state
  const [showHostelModal, setShowHostelModal] = useState(false);
  const [hostelForm, setHostelForm] = useState({
    isHostelStudent: false,
    effectiveMonth: new Date().getMonth() + 1,
    hostelRoomNumber: ''
  });
  const [updatingHostel, setUpdatingHostel] = useState(false);

  const reloadStudent = () => {
    if (studentId) {
      apiClient.get(`/students/${studentId}`).then(res => {
        if (res.data?.success) {
          setStudent(res.data.data);
          setHostelForm({
            isHostelStudent: res.data.data.isHostelStudent || false,
            effectiveMonth: new Date().getMonth() + 1,
            hostelRoomNumber: res.data.data.hostelRoomNumber || ''
          });
        }
      }).catch(console.error);
    }
  };

  const handleUpdateHostelStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setUpdatingHostel(true);
    try {
      const res = await apiClient.put(`/students/${studentId}/hostel-status`, {
        isHostelStudent: hostelForm.isHostelStudent,
        effectiveMonth: Number(hostelForm.effectiveMonth),
        hostelRoomNumber: hostelForm.hostelRoomNumber || undefined
      });
      if (res.data?.success) {
        toast.success(res.data?.message || 'Hostel status updated successfully');
        setShowHostelModal(false);
        reloadStudent();
      } else {
        toast.error(res.data?.message || 'Failed to update hostel status');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update hostel status');
    } finally {
      setUpdatingHostel(false);
    }
  };

  useEffect(() => {
    if (studentId && isOpen) {
      setLoading(true);
      apiClient.get(`/students/${studentId}`).then(res => {
        if (res.data?.success) {
          setStudent(res.data.data);
        }
      }).catch(console.error).finally(() => setLoading(false));
    } else {
      setStudent(null);
    }
  }, [studentId, isOpen]);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studentId) return;

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', newDocTitle.trim() || file.name);
      formData.append('documentType', newDocType);

      const res = await apiClient.post(`/students/${studentId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        toast.success('Document uploaded successfully');
        setNewDocTitle('');
        reloadStudent();
      } else {
        toast.error(res.data?.message || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (!isOpen) return null;

  const primaryParent = student?.parents?.[0]?.parent;
  const currentAcademic = student?.academicRecords?.[0];
  const latestSlc = student?.schoolLeavingCertificates?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Photo & Student Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {student?.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={`${student.firstName} ${student.lastName}`}
                  className="h-14 w-14 sm:h-12 sm:w-12 shrink-0 rounded-xl object-cover border-2 border-white shadow-sm ring-1 ring-slate-200"
                />
              ) : (
                <div className="h-14 w-14 sm:h-12 sm:w-12 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl sm:text-lg shadow-xs">
                  {student?.firstName?.[0] || 'S'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {student?.firstName} {student?.middleName ? student.middleName + ' ' : ''}{student?.lastName}
                  </h2>
                  <span className="font-mono text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-semibold">
                    {student?.admissionNumber}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    student?.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : student?.status === 'CANCELLED'
                      ? 'bg-rose-100 text-rose-800'
                      : student?.status === 'WITHDRAWN'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {student?.status}
                  </span>
                  {student?.isHostelStudent ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Hostel Resident {student.hostelRoomNumber ? `· Room ${student.hostelRoomNumber}` : ''}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Day Scholar
                    </span>
                  )}
                  {student?.isNonAttending && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Non-Attending
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                  <span>Class: <strong>{currentAcademic?.class?.name || 'Class'} ({currentAcademic?.section?.name || 'A'})</strong></span>
                  <span className="hidden sm:inline">·</span>
                  <span>Roll: <strong>{currentAcademic?.rollNumber || 'N/A'}</strong></span>
                  <span className="hidden sm:inline">·</span>
                  <span>Session: <strong>{currentAcademic?.academicYear?.name || '2026-27'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 flex-wrap">
              {/* Status Change Button */}
              {student && (
                <button
                  type="button"
                  onClick={() => setShowStatusModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 text-xs font-semibold min-h-[40px] transition-colors"
                  title="Change Student Status (Active / Inactive / Withdrawn)"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Change Status</span>
                </button>
              )}

              {/* View SLC Button if available */}
              {latestSlc && (
                <button
                  type="button"
                  onClick={() => setShowSlcModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-semibold min-h-[40px] transition-colors"
                  title="View / Print School Leaving Certificate"
                >
                  <Award className="h-4 w-4" />
                  <span>View SLC</span>
                </button>
              )}

              {/* Admission PDF Download Button */}
              {student && (
                <a
                  href={`/api/students/${student.id}/admission-pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-2xs min-h-[40px] transition-colors"
                  title="Download Official Admission Slip PDF"
                >
                  <Download className="h-4 w-4" />
                  <span>Admission PDF</span>
                </a>
              )}

              {/* Cancel Admission Button if active */}
              {student && student.status !== 'CANCELLED' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold min-h-[40px] transition-colors"
                  title="Cancel Student Admission"
                >
                  <UserX className="h-4 w-4" />
                  <span>Cancel Admission</span>
                </button>
              )}

              {student?.feeSummary?.pending > 0 && student.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    onClose();
                    onCollectFee(student.id);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-2xs min-h-[40px] transition-colors"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Collect Fee</span>
                </button>
              )}

              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Cancellation Alert Banner if Cancelled */}
        {student?.status === 'CANCELLED' && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Admission Cancelled:</strong>{' '}
              {student.cancellationReason || 'De-registered from school roll'}
              {student.cancelledAt && (
                <span className="text-rose-600 ml-1.5">
                  (Cancelled on {new Date(student.cancelledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
                </span>
              )}
              {student.cancellationNotes && (
                <p className="text-[11px] text-rose-700 mt-0.5 italic">Remarks: {student.cancellationNotes}</p>
              )}
            </div>
          </div>
        )}

        {/* Fee Metrics Bar: 2x2 on mobile, 4-col on tablet/desktop */}
        {student && (
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 bg-slate-50/50 p-3 text-center text-xs gap-2 sm:gap-0 sm:divide-x divide-slate-200">
            <div className="bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Billed</span>
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                ₹{Number(student.feeSummary?.totalFee || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Paid</span>
              <div className="text-sm font-bold text-emerald-600 tabular-nums">
                ₹{Number(student.feeSummary?.paid || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Outstanding Due</span>
              <div className="text-sm font-bold text-rose-600 tabular-nums">
                ₹{Number(student.feeSummary?.pending || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Overdue Fines</span>
              <div className="text-sm font-bold text-amber-600 tabular-nums">
                ₹{Number(student.feeSummary?.overdue || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}

        {/* Tab Controls: Scrollable on mobile */}
        <div className="flex border-b border-slate-200 px-3 sm:px-6 bg-white gap-2 sm:gap-6 text-xs font-medium overflow-x-auto whitespace-nowrap scrollbar-none">
          {[
            { id: 'overview', label: 'Overview & Profile' },
            { id: 'fees', label: `Fee Ledger (${student?.studentFees?.length || 0})` },
            { id: 'payments', label: `Payment History (${student?.payments?.length || 0})` },
            { id: 'timeline', label: `Status History & SLC (${student?.statusHistory?.length || 0})` },
            { id: 'documents', label: `Documents (${student?.documents?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 sm:py-3.5 px-1 border-b-2 font-semibold transition-colors shrink-0 min-h-[44px] flex items-center ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
              Loading student dossier...
            </div>
          ) : student ? (
            <>
              {/* Tab 1: Overview & Profile */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Personal & Demographics */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Demographic & Personal Profile
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowUnmaskedAadhaar(v => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {showUnmaskedAadhaar ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        <span>{showUnmaskedAadhaar ? 'Mask Aadhaar' : 'Show Full Aadhaar'}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Date of Birth</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(student.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Gender</span>
                        <span className="font-semibold text-slate-800">{student.gender}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Blood Group</span>
                        <span className="font-semibold text-slate-800">{student.bloodGroup || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Student Aadhaar</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {student.aadhaarNumber
                            ? (showUnmaskedAadhaar ? student.aadhaarNumber : maskAadhaar(student.aadhaarNumber))
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Nationality</span>
                        <span className="font-semibold text-slate-800">{student.nationality}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Admission Date</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(student.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 text-[11px] block">Permanent Residence Address</span>
                        <span className="font-medium text-slate-800">{student.address || 'Address on file'}</span>
                      </div>
                      <div className="sm:col-span-4 border-t border-slate-200 pt-2.5 mt-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-400 text-[11px] block font-semibold">Present Address</span>
                          {student.sameAsResidence && (
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Same as permanent residence
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-slate-800">
                          {student.sameAsResidence ? student.address : (student.presentAddress || student.address || 'Same as residence')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parent Details with Parents' Aadhaar */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Parent / Guardian Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Father's Name</span>
                        <span className="font-bold text-slate-900">{primaryParent?.fatherName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Mother's Name</span>
                        <span className="font-bold text-slate-900">{primaryParent?.motherName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Primary Phone</span>
                        <span className="font-mono font-bold text-indigo-700">{primaryParent?.primaryPhone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Father's Aadhaar No.</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {primaryParent?.fatherAadhaar
                            ? (showUnmaskedAadhaar ? primaryParent.fatherAadhaar : maskAadhaar(primaryParent.fatherAadhaar))
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Mother's Aadhaar No.</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {primaryParent?.motherAadhaar
                            ? (showUnmaskedAadhaar ? primaryParent.motherAadhaar : maskAadhaar(primaryParent.motherAadhaar))
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Email</span>
                        <span className="font-medium text-slate-800">{primaryParent?.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Occupation</span>
                        <span className="font-medium text-slate-800">{primaryParent?.occupation || 'Private Sector'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Annual Income</span>
                        <span className="font-medium text-slate-800">{primaryParent?.annualIncome || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Previous School Details Card (Part B4) */}
                  {student.hasPreviousSchool && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5" />
                        <span>Previous School & Transfer History</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 text-[11px] block">Previous School Name</span>
                          <span className="font-bold text-slate-900">{student.previousSchoolName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Class Passed</span>
                          <span className="font-semibold text-slate-800">{student.previousClassPassed || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Medium of Instruction</span>
                          <span className="font-semibold text-slate-800">
                            {student.previousSchoolMedium === 'OTHER'
                              ? student.previousMediumOther || 'Other'
                              : student.previousSchoolMedium || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Date of Leaving Previous School</span>
                          <span className="font-semibold text-slate-800">
                            {student.previousLeavingDate
                              ? new Date(student.previousLeavingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Transfer Certificate (TC) No. & Date</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {student.previousTcNumber || 'N/A'}
                            {student.previousTcDate && ` (${new Date(student.previousTcDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hostel Boarding & Accommodation Details (SRS Section 3) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Hostel Boarding & Accommodation Status
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowHostelModal(true)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Change Hostel Status
                      </button>
                    </div>

                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-slate-400 text-[11px] block">Resident Category</span>
                          <span className="font-bold text-slate-900">
                            {student.isHostelStudent ? 'Hostel Resident (Boarder)' : 'Day Scholar'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Assigned Room / Bed</span>
                          <span className="font-semibold text-slate-800">
                            {student.hostelRoomNumber || (student.isHostelStudent ? 'Pending Allocation' : 'N/A')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Allotment Date</span>
                          <span className="font-semibold text-slate-800">
                            {student.hostelAdmissionDate
                              ? new Date(student.hostelAdmissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Fees Schedule */}
              {activeTab === 'fees' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left min-w-[550px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Fee Title</th>
                          <th className="py-2.5 px-3">Term / Month</th>
                          <th className="py-2.5 px-3 text-right">Net Amount</th>
                          <th className="py-2.5 px-3 text-right">Paid</th>
                          <th className="py-2.5 px-3 text-right">Remaining</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {student.studentFees?.map((fee: any) => (
                          <tr key={fee.id}>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{fee.title}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {fee.month ? `Month ${fee.month}/${fee.year}` : `Session ${fee.year}`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              ₹{Number(fee.netAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">
                              ₹{Number(fee.paidAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-bold">
                              ₹{Number(fee.remainingAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {new Date(fee.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                fee.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                fee.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {fee.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Payment History */}
              {activeTab === 'payments' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Receipt No</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Collected By</th>
                          <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {student.payments?.map((p: any) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {p.receipt?.receiptNumber || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                {p.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {typeof p.collectedBy === 'object'
                                ? p.collectedBy?.fullName || p.collectedBy?.username || 'Staff'
                                : p.collectedBy || 'Online'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {p.receipt?.id && (
                                <button
                                  onClick={() => {
                                    onClose();
                                    onOpenReceipt(p.receipt.id);
                                  }}
                                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                  View Receipt
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab: Status History & SLC (Part C2 & C3) */}
              {activeTab === 'timeline' && (
                <div className="space-y-5">
                  {/* SLC Information Card if exists */}
                  {latestSlc && (
                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 text-xs">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
                            <Award className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">School Leaving Certificate</span>
                              <span className="font-mono text-[11px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                {latestSlc.certificateNumber}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              Issued on {new Date(latestSlc.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {latestSlc.reprintCount > 0 && ` · Reprints: ${latestSlc.reprintCount}`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSlcModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-2xs transition-colors shrink-0"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>View & Print SLC</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status History Timeline */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        <span>Status Transition Log & Audit History</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowStatusModal(true)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        + Change Status
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {student.statusHistory && student.statusHistory.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {student.statusHistory.map((item: any) => (
                            <div key={item.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className={`p-1.5 rounded-full mt-0.5 ${
                                  item.toStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                  item.toStatus === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                                  item.toStatus === 'WITHDRAWN' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  <Clock className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-slate-800">
                                      {item.fromStatus ? `${item.fromStatus} → ` : 'Initial: '}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      item.toStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                                      item.toStatus === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                                      item.toStatus === 'WITHDRAWN' ? 'bg-amber-100 text-amber-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                      {item.toStatus}
                                    </span>
                                    <span className="text-slate-400 text-[11px]">
                                      Effective: {new Date(item.effectiveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 text-xs mt-1">
                                    Reason: <span className="font-medium text-slate-800">{item.reason}</span>
                                    {item.remarks && <span className="text-slate-500 italic ml-1">({item.remarks})</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-slate-400 self-end sm:self-center font-mono">
                                <div>By: {item.changedByName || 'Admin'}</div>
                                <div>{new Date(item.createdAt).toLocaleDateString('en-IN')}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No status change history recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Documents */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  {/* Upload New Document Box */}
                  <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Upload Supporting Document
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        placeholder="Document Title (e.g. TC, Marksheet)"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        className="rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white focus:outline-hidden"
                      />
                      <select
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value)}
                        className="rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                      >
                        <option value="BIRTH_CERTIFICATE">Birth Certificate</option>
                        <option value="AADHAAR">Aadhaar Card Copy</option>
                        <option value="TRANSFER_CERTIFICATE">Transfer Certificate (TC)</option>
                        <option value="PREVIOUS_MARKSHEET">Previous School Marksheet</option>
                        <option value="PHOTO">Passport Photo</option>
                        <option value="OTHER">Other Official Document</option>
                      </select>
                      <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-2xs cursor-pointer transition-colors">
                        {uploadingDoc ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" />
                            <span>Choose & Upload File</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploadingDoc}
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          onChange={handleDocUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {student.documents?.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{doc.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">{doc.fileName || doc.documentType}</div>
                            {doc.uploadedAt && (
                              <div className="text-[10px] text-slate-400">
                                Uploaded on {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                        </div>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>View</span>
                        </a>
                      </div>
                    ))}
                    {(!student.documents || student.documents.length === 0) && (
                      <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                        No documents uploaded for this student yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Change Hostel Status Modal (SRS Section 3: Applies from chosen month onward) */}
      {showHostelModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Change Hostel Boarding Status</h3>
              <button
                type="button"
                onClick={() => setShowHostelModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateHostelStatus} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Resident Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHostelForm(prev => ({ ...prev, isHostelStudent: false }))}
                    className={`py-2 px-3 rounded-lg border font-semibold ${
                      !hostelForm.isHostelStudent
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Day Scholar
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostelForm(prev => ({ ...prev, isHostelStudent: true }))}
                    className={`py-2 px-3 rounded-lg border font-semibold ${
                      hostelForm.isHostelStudent
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Hostel Resident
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Effective From Month <span className="text-rose-500">*</span>
                </label>
                <p className="text-[10px] text-slate-400 mb-1">
                  Fee changes apply from the chosen billing month onward.
                </p>
                <select
                  value={hostelForm.effectiveMonth}
                  onChange={(e) => setHostelForm(prev => ({ ...prev, effectiveMonth: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-slate-200 py-1.5 px-3 bg-white font-medium"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Month {idx + 1} - {m}
                    </option>
                  ))}
                </select>
              </div>

              {hostelForm.isHostelStudent && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Room / Bed Allocation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Block A - Room 102"
                    value={hostelForm.hostelRoomNumber}
                    onChange={(e) => setHostelForm(prev => ({ ...prev, hostelRoomNumber: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowHostelModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingHostel}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updatingHostel ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cancel Admission Confirmation Modal */}
      <CancelAdmissionModal
        isOpen={showCancelModal}
        student={student ? {
          id: student.id,
          admissionNumber: student.admissionNumber,
          fullName: `${student.firstName} ${student.lastName}`,
          className: currentAcademic?.class?.name
        } : null}
        onClose={() => setShowCancelModal(false)}
        onSuccess={() => {
          reloadStudent();
        }}
      />

      {/* Student Status Change Modal */}
      <StatusChangeModal
        isOpen={showStatusModal}
        student={student ? {
          id: student.id,
          admissionNumber: student.admissionNumber,
          fullName: `${student.firstName} ${student.lastName}`,
          currentStatus: student.status
        } : null}
        onClose={() => setShowStatusModal(false)}
        onSuccess={() => {
          reloadStudent();
        }}
      />

      {/* School Leaving Certificate Modal */}
      <SLCModal
        isOpen={showSlcModal}
        studentId={student?.id || null}
        onClose={() => setShowSlcModal(false)}
      />
    </div>
  );
};
