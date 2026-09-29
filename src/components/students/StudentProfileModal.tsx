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
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '../../api/client.js';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'fees' | 'payments' | 'documents'>('overview');
  const [loading, setLoading] = useState(false);

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

  if (!isOpen) return null;

  const primaryParent = student?.parents?.[0]?.parent;
  const currentAcademic = student?.academicRecords?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Mobile: Photo stacks on top with student info; Desktop: Photo | Student Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="h-12 w-12 sm:h-11 sm:w-11 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg sm:text-base shadow-xs">
                {student?.firstName?.[0] || 'S'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {student?.firstName} {student?.middleName ? student.middleName + ' ' : ''}{student?.lastName}
                  </h2>
                  <span className="font-mono text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-semibold">
                    {student?.admissionNumber}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    student?.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {student?.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                  <span>Class: <strong>{currentAcademic?.class?.name || 'Class 8'} ({currentAcademic?.section?.name || 'A'})</strong></span>
                  <span className="hidden sm:inline">·</span>
                  <span>Roll: <strong>{currentAcademic?.rollNumber || 'N/A'}</strong></span>
                  <span className="hidden sm:inline">·</span>
                  <span>Session: <strong>{currentAcademic?.academicYear?.name || '2026-27'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
              {student?.feeSummary?.pending > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    onCollectFee(student.id);
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-2xs min-h-[40px] transition-colors"
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Demographic & Personal Profile
                    </h3>
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
                        <span className="text-slate-400 text-[11px] block">Aadhaar Number</span>
                        <span className="font-mono font-semibold text-slate-800">{student.aadhaarNumber || 'N/A'}</span>
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
                        <span className="text-slate-400 text-[11px] block">Address</span>
                        <span className="font-medium text-slate-800">{student.address || 'Address on file'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Parent Details */}
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
                        <span className="text-slate-400 text-[11px] block">Occupation</span>
                        <span className="font-medium text-slate-800">{primaryParent?.occupation || 'Private Sector'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Primary Contact Phone</span>
                        <span className="font-mono font-bold text-indigo-700">{primaryParent?.primaryPhone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Email</span>
                        <span className="font-medium text-slate-800">{primaryParent?.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Annual Income</span>
                        <span className="font-medium text-slate-800">{primaryParent?.annualIncome || 'N/A'}</span>
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
                            <td className="py-2.5 px-3 text-slate-600">{p.collectedBy?.fullName || 'Online'}</td>
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

              {/* Tab 4: Documents */}
              {activeTab === 'documents' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {student.documents?.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{doc.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{doc.documentType}</div>
                          </div>
                        </div>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View File
                        </a>
                      </div>
                    ))}
                    {(!student.documents || student.documents.length === 0) && (
                      <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                        No documents uploaded for this student.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
