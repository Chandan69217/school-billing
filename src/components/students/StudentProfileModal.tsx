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
  RefreshCw,
  Bus,
  ShoppingBag,
  Tag,
  Percent,
  ArrowRightLeft,
  StopCircle,
  PlusCircle,
  Plus,
  CheckCircle2
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
  const [activeTab, setActiveTab] = useState<'overview' | 'fees' | 'payments' | 'transport' | 'concessions' | 'store' | 'documents' | 'timeline'>('overview');
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSlcModal, setShowSlcModal] = useState(false);
  const [showUnmaskedAadhaar, setShowUnmaskedAadhaar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('OTHER');

  // Transport state & modals
  const [showAssignTransportModal, setShowAssignTransportModal] = useState(false);
  const [showChangeStopModal, setShowChangeStopModal] = useState(false);
  const [showStopTransportModal, setShowStopTransportModal] = useState(false);
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);
  const [transportForm, setTransportForm] = useState({
    routeId: '',
    stopId: '',
    serviceType: 'TWO_WAY',
    startMonth: new Date().getMonth() + 1,
    startYear: new Date().getFullYear(),
    pickupPoint: '',
    reason: ''
  });
  const [processingTransport, setProcessingTransport] = useState(false);

  // Concessions state & modals
  const [showAssignConcessionModal, setShowAssignConcessionModal] = useState(false);
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [concessionForm, setConcessionForm] = useState({
    discountRuleId: '',
    startMonth: new Date().getMonth() + 1,
    startYear: new Date().getFullYear(),
    customAmount: '',
    reason: ''
  });
  const [processingConcession, setProcessingConcession] = useState(false);
  const [detectingSibling, setDetectingSibling] = useState(false);
  const [siblingResult, setSiblingResult] = useState<any | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      apiClient.get('/transport/routes').then(res => {
        if (res.data?.success) setTransportRoutes(res.data.data.filter((r: any) => r.isActive));
      }).catch(console.error);

      apiClient.get('/discounts/rules').then(res => {
        if (res.data?.success) setDiscountRules(res.data.data);
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleAssignTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !transportForm.routeId || !transportForm.stopId) return;
    setProcessingTransport(true);
    try {
      const res = await apiClient.post('/transport/assign', {
        studentId,
        routeId: transportForm.routeId,
        stopId: transportForm.stopId,
        serviceType: transportForm.serviceType,
        startMonth: Number(transportForm.startMonth),
        startYear: Number(transportForm.startYear),
        pickupPoint: transportForm.pickupPoint
      });
      if (res.data?.success) {
        toast.success('Transport assigned successfully');
        setShowAssignTransportModal(false);
        reloadStudent();
      } else {
        toast.error(res.data?.message || 'Failed to assign transport');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign transport');
    } finally {
      setProcessingTransport(false);
    }
  };

  const handleChangeStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !transportForm.stopId) return;
    setProcessingTransport(true);
    try {
      const res = await apiClient.put(`/transport/students/${studentId}/change-stop`, {
        newRouteId: transportForm.routeId || undefined,
        newStopId: transportForm.stopId,
        effectiveMonth: Number(transportForm.startMonth),
        effectiveYear: Number(transportForm.startYear),
        reason: transportForm.reason || 'Requested by parent'
      });
      if (res.data?.success) {
        toast.success('Transport stop updated successfully');
        setShowChangeStopModal(false);
        reloadStudent();
      } else {
        toast.error(res.data?.message || 'Failed to change stop');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change stop');
    } finally {
      setProcessingTransport(false);
    }
  };

  const handleStopTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setProcessingTransport(true);
    try {
      const res = await apiClient.put(`/transport/students/${studentId}/stop`, {
        effectiveMonth: Number(transportForm.startMonth),
        effectiveYear: Number(transportForm.startYear),
        reason: transportForm.reason || 'Transport discontinued by student'
      });
      if (res.data?.success) {
        toast.success('Transport stopped successfully');
        setShowStopTransportModal(false);
        reloadStudent();
      } else {
        toast.error(res.data?.message || 'Failed to stop transport');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to stop transport');
    } finally {
      setProcessingTransport(false);
    }
  };

  const handleAssignConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !concessionForm.discountRuleId) return;
    setProcessingConcession(true);
    try {
      const res = await apiClient.post(`/discounts/students/${studentId}/assign`, {
        discountRuleId: concessionForm.discountRuleId,
        startMonth: Number(concessionForm.startMonth),
        startYear: Number(concessionForm.startYear),
        customAmount: concessionForm.customAmount ? Number(concessionForm.customAmount) : undefined,
        reason: concessionForm.reason || 'Concession assigned'
      });
      if (res.data?.success) {
        toast.success('Fee concession assigned successfully');
        setShowAssignConcessionModal(false);
        reloadStudent();
      } else {
        toast.error(res.data?.message || 'Failed to assign concession');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign concession');
    } finally {
      setProcessingConcession(false);
    }
  };

  const handleCheckSibling = async () => {
    setDetectingSibling(true);
    try {
      const res = await apiClient.get('/discounts/sibling-detector');
      if (res.data?.success) {
        const matches = res.data.data?.matches || [];
        const studentMatches = matches.filter((m: any) =>
          m.students?.some((s: any) => s.id === studentId || s.admissionNumber === student?.admissionNumber)
        );
        setSiblingResult({
          totalDetected: studentMatches.length,
          matches: studentMatches,
          allRules: res.data.data?.suggestedRules || []
        });
        toast.success(`Sibling scan finished: found ${studentMatches.length} matching student family cluster(s).`);
      }
    } catch (err: any) {
      toast.error('Failed to run sibling detector');
    } finally {
      setDetectingSibling(false);
    }
  };

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
            { id: 'transport', label: `Transport (${student?.transportAssignments?.length || 0})` },
            { id: 'concessions', label: `Concessions (${student?.discountApplications?.length || 0})` },
            { id: 'store', label: `Store Purchases (${student?.storeSales?.length || 0})` },
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

              {/* TAB: TRANSPORT */}
              {activeTab === 'transport' && (
                <div className="space-y-6">
                  {/* Current Transport Status */}
                  {(() => {
                    const activeAssignment = student.transportAssignments?.find((a: any) => a.isActive);
                    return activeAssignment ? (
                      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                              <Bus className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                Route: {activeAssignment.route?.name} ({activeAssignment.route?.code})
                              </div>
                              <div className="text-xs text-slate-600">
                                Designated Stop: <span className="font-semibold text-slate-900">{activeAssignment.stop?.name}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTransportForm(prev => ({
                                  ...prev,
                                  routeId: activeAssignment.routeId,
                                  stopId: activeAssignment.stopId,
                                  serviceType: activeAssignment.serviceType || 'TWO_WAY',
                                  startMonth: new Date().getMonth() + 1,
                                  startYear: new Date().getFullYear(),
                                  reason: ''
                                }));
                                setShowChangeStopModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Change Stop / Route</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTransportForm(prev => ({
                                  ...prev,
                                  startMonth: new Date().getMonth() + 1,
                                  startYear: new Date().getFullYear(),
                                  reason: ''
                                }));
                                setShowStopTransportModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                            >
                              <StopCircle className="h-3.5 w-3.5 text-rose-600" />
                              <span>Stop Transport</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-amber-200/60 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-500">Monthly Fare</span>
                            <div className="font-bold text-slate-900 font-mono text-sm">
                              ₹{Number(activeAssignment.monthlyFee).toLocaleString('en-IN')}/mo
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500">Service Mode</span>
                            <div className="font-bold text-slate-900">
                              {activeAssignment.serviceType === 'TWO_WAY' ? 'Two-way (Pick & Drop)' : 'One-way Only'}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500">Effective Since</span>
                            <div className="font-semibold text-slate-800">
                              Month {activeAssignment.startMonth} / {activeAssignment.startYear}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500">Pickup Landmark</span>
                            <div className="font-semibold text-slate-800 truncate">
                              {activeAssignment.pickupPoint || 'Standard stop point'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
                        <Bus className="h-8 w-8 text-slate-400 mx-auto" />
                        <div>
                          <div className="text-sm font-bold text-slate-800">No Active School Transport</div>
                          <div className="text-xs text-slate-500">This student is not enrolled in bus or van transport.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const firstR = transportRoutes[0];
                            setTransportForm({
                              routeId: firstR?.id || '',
                              stopId: firstR?.stops?.[0]?.id || '',
                              serviceType: 'TWO_WAY',
                              startMonth: new Date().getMonth() + 1,
                              startYear: new Date().getFullYear(),
                              pickupPoint: '',
                              reason: 'Initial assignment'
                            });
                            setShowAssignTransportModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-2xs"
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span>Enroll in Transport</span>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Transport History Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Transport Assignment & Route History
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Action</th>
                            <th className="py-2.5 px-3">From / To Route & Stop</th>
                            <th className="py-2.5 px-3">Effective Month</th>
                            <th className="py-2.5 px-3">Reason & User</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {student.transportHistory?.length > 0 ? (
                            student.transportHistory.map((h: any) => (
                              <tr key={h.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                  {new Date(h.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="py-2.5 px-3 font-semibold">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    h.action === 'ASSIGNED' ? 'bg-emerald-100 text-emerald-800' :
                                    h.action === 'STOPPED' ? 'bg-rose-100 text-rose-800' :
                                    'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {h.action.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">
                                  {h.action === 'STOPPED' ? (
                                    <span className="text-rose-600 font-medium">
                                      Discontinued {h.route ? `(${h.route.name} - ${h.stop?.name || ''})` : ''}
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-slate-900">
                                        {h.route?.name || h.route?.code || 'Route'}
                                      </span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-700">{h.stop?.name || 'Stop'}</span>
                                      {h.monthlyFee && (
                                        <span className="text-xs font-mono font-semibold text-indigo-600">
                                          (₹{Number(h.monthlyFee).toLocaleString('en-IN')}/mo)
                                        </span>
                                      )}
                                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                                        {h.serviceType === 'ONE_WAY' ? '1-Way' : '2-Way'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">
                                  Month {h.effectiveMonth} / {h.effectiveYear}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  <div>{h.reason || 'N/A'}</div>
                                  <div className="text-[10px] text-slate-400">By {h.changedByName || 'Staff'}</div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                                No transport modifications recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: CONCESSIONS */}
              {activeTab === 'concessions' && (
                <div className="space-y-6">
                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Student Fee Concessions & Waivers
                      </div>
                      <div className="text-xs text-slate-400">
                        Active discounts automatically deducted from monthly fee demands
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCheckSibling}
                        disabled={detectingSibling}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5 text-purple-600" />
                        <span>{detectingSibling ? 'Scanning...' : 'Check Sibling Match'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const firstR = discountRules[0];
                          setConcessionForm({
                            discountRuleId: firstR?.id || '',
                            startMonth: new Date().getMonth() + 1,
                            startYear: new Date().getFullYear(),
                            customAmount: '',
                            reason: 'Family / merit concession'
                          });
                          setShowAssignConcessionModal(true);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Assign Concession</span>
                      </button>
                    </div>
                  </div>

                  {/* Sibling detector results banner */}
                  {siblingResult && (
                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                        <Users className="h-4 w-4 text-purple-600" />
                        <span>Sibling Detector Scan Result</span>
                      </div>
                      {siblingResult.matches.length > 0 ? (
                        <div className="text-xs text-purple-800 space-y-1">
                          <p>Sibling cluster found sharing parent contact information:</p>
                          <ul className="list-disc list-inside space-y-1 font-medium pl-1">
                            {siblingResult.matches.map((m: any, idx: number) => (
                              <li key={idx}>
                                Matched by: <span className="font-bold">{m.matchCriteria}</span> ({m.matchValue}) · Siblings: {m.students?.map((s: any) => `${s.name} (${s.admissionNumber})`).join(', ')}
                              </li>
                            ))}
                          </ul>
                          <p className="text-[11px] text-purple-700 pt-1">
                            Tip: You can assign a Sibling Concession rule to this student using the "Assign Concession" button above.
                          </p>
                        </div>
                      ) : (
                        <div className="text-xs text-purple-700">
                          No other active students found sharing primary parent phone or Aadhaar records.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active Concessions Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {student.discountApplications?.length > 0 ? (
                      student.discountApplications.map((app: any) => (
                        <div
                          key={app.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                                <Tag className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">
                                  {app.discountRule?.name || app.discountName}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  Code: {app.discountRule?.code || 'CONC'}
                                </div>
                              </div>
                            </div>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {app.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-[11px] text-slate-400">Benefit Rate</span>
                              <div className="font-bold text-indigo-700 font-mono">
                                {app.discountRule?.type === 'PERCENTAGE'
                                  ? `${app.discountRule.value}% off`
                                  : `₹${Number(app.amount || app.discountRule?.value || 0).toLocaleString('en-IN')}/mo`}
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400">Applicable Heads</span>
                              <div className="font-semibold text-slate-800 truncate">
                                {app.discountRule?.applicableFeeHeads || 'All Fee Heads'}
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400">Effective Month</span>
                              <div className="font-semibold text-slate-800">
                                Month {app.startMonth} / {app.startYear}
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-400">Reason</span>
                              <div className="font-semibold text-slate-800 truncate">
                                {app.reason || 'Standard concession'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 py-10 text-center text-xs text-slate-400">
                        <Tag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <div>No fee concessions currently assigned to this student.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: STORE PURCHASES */}
              {activeTab === 'store' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Books & Uniform Purchase Ledger
                      </div>
                      <div className="text-xs text-slate-400">
                        POS counter purchases, bundles, uniforms, and printable receipts
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {student.storeSales?.length > 0 ? (
                      student.storeSales.map((sale: any) => (
                        <div
                          key={sale.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-indigo-700">{sale.receiptNumber}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  sale.paymentStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {sale.paymentStatus}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Method: {sale.paymentMethod}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Sold on {new Date(sale.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block uppercase">Net Total</span>
                                <span className="text-sm font-black font-mono text-slate-900">
                                  ₹{Number(sale.netAmount).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <a
                                href={`/api/store/sales/${sale.id}/receipt-pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>PDF Receipt</span>
                              </a>
                            </div>
                          </div>

                          {/* Items Breakdown */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {sale.items?.map((it: any) => (
                              <div key={it.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-slate-800">{it.item?.name || 'Item'}</div>
                                  <div className="text-[10px] text-slate-400">
                                    Qty: {it.quantity} {it.selectedSize ? `· Size: ${it.selectedSize}` : ''} @ ₹{Number(it.unitPrice).toLocaleString('en-IN')}
                                  </div>
                                </div>
                                <div className="font-mono font-bold text-slate-700">
                                  ₹{Number(it.lineTotal).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <div>No store purchases recorded for this student.</div>
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

      {/* Assign Transport Modal */}
      {showAssignTransportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bus className="h-4 w-4 text-amber-600" />
                <span>Enroll Student in School Transport</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignTransportModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTransport} className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Route</label>
                <select
                  value={transportForm.routeId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    const r = transportRoutes.find(x => x.id === rId);
                    setTransportForm(prev => ({
                      ...prev,
                      routeId: rId,
                      stopId: r?.stops?.[0]?.id || ''
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {transportRoutes.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Designated Stop</label>
                <select
                  value={transportForm.stopId}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, stopId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {(() => {
                    const r = transportRoutes.find(x => x.id === transportForm.routeId);
                    const stops = r?.stops || [];
                    return stops.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - ₹{Number(s.monthlyFee).toLocaleString('en-IN')}/mo
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Service Type</label>
                  <select
                    value={transportForm.serviceType}
                    onChange={(e) => setTransportForm(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                  >
                    <option value="TWO_WAY">Two-way (Pick & Drop)</option>
                    <option value="ONE_WAY">One-way</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Start Month</label>
                  <select
                    value={transportForm.startMonth}
                    onChange={(e) => setTransportForm(prev => ({ ...prev, startMonth: parseInt(e.target.value, 10) }))}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                  >
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Month {idx + 1} ({m})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Pickup Landmark (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Near Shiv Mandir, Gate 2"
                  value={transportForm.pickupPoint}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, pickupPoint: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignTransportModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingTransport}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {processingTransport ? 'Assigning...' : 'Assign Transport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Stop Modal */}
      {showChangeStopModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                <span>Change Transport Route / Stop</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowChangeStopModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleChangeStop} className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Route</label>
                <select
                  value={transportForm.routeId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    const r = transportRoutes.find(x => x.id === rId);
                    setTransportForm(prev => ({
                      ...prev,
                      routeId: rId,
                      stopId: r?.stops?.[0]?.id || ''
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {transportRoutes.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Designated Stop</label>
                <select
                  value={transportForm.stopId}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, stopId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {(() => {
                    const r = transportRoutes.find(x => x.id === transportForm.routeId);
                    const stops = r?.stops || [];
                    return stops.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - ₹{Number(s.monthlyFee).toLocaleString('en-IN')}/mo
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Effective Month</label>
                <select
                  value={transportForm.startMonth}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, startMonth: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Month {idx + 1} ({m})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason for Stop Revision</label>
                <input
                  type="text"
                  placeholder="e.g. Student relocated to new address"
                  value={transportForm.reason}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowChangeStopModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingTransport}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {processingTransport ? 'Updating...' : 'Confirm Stop Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stop Transport Modal */}
      {showStopTransportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <StopCircle className="h-4 w-4 text-rose-600" />
                <span>Discontinue School Transport</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowStopTransportModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStopTransport} className="space-y-3.5 text-xs">
              <p className="text-slate-600 text-xs">
                Transport fee billing will stop from the selected effective month. Past billed or paid dues remain unchanged.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Effective Month to Discontinue</label>
                <select
                  value={transportForm.startMonth}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, startMonth: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Month {idx + 1} ({m})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Discontinuation Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Parent providing personal conveyance"
                  value={transportForm.reason}
                  onChange={(e) => setTransportForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStopTransportModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingTransport}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
                >
                  {processingTransport ? 'Stopping...' : 'Stop Transport Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Concession Modal */}
      {showAssignConcessionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="h-4 w-4 text-indigo-600" />
                <span>Assign Concession / Waiver Rule</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignConcessionModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignConcession} className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Concession Rule</label>
                <select
                  value={concessionForm.discountRuleId}
                  onChange={(e) => setConcessionForm(prev => ({ ...prev, discountRuleId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                  required
                >
                  <option value="">Choose a discount rule...</option>
                  {discountRules.map((rule: any) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name} ({rule.type === 'PERCENTAGE' ? `${rule.value}%` : `₹${rule.value}/mo`}) [{rule.category}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Effective Month</label>
                <select
                  value={concessionForm.startMonth}
                  onChange={(e) => setConcessionForm(prev => ({ ...prev, startMonth: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 bg-white"
                >
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Month {idx + 1} ({m})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Custom Amount Override (Optional)</label>
                <input
                  type="number"
                  placeholder="Leave blank to use default rule benefit"
                  value={concessionForm.customAmount}
                  onChange={(e) => setConcessionForm(prev => ({ ...prev, customAmount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason / Approval Basis</label>
                <input
                  type="text"
                  placeholder="e.g. Sibling discount second child"
                  value={concessionForm.reason}
                  onChange={(e) => setConcessionForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignConcessionModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingConcession}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {processingConcession ? 'Applying...' : 'Assign Concession'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
