import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  Award,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Building,
  User,
  Calendar,
  FileText
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { toast } from 'sonner';

interface SLCModalProps {
  isOpen: boolean;
  onClose: () => void;
  slcData?: any | null;
  studentId?: string | null;
  onReprintSuccess?: () => void;
}

export const SLCModal: React.FC<SLCModalProps> = ({
  isOpen,
  onClose,
  slcData,
  studentId,
  onReprintSuccess
}) => {
  const [reprinting, setReprinting] = useState(false);
  const [currentSlc, setCurrentSlc] = useState<any>(slcData);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (slcData) {
      setCurrentSlc(slcData);
    } else if (studentId && isOpen) {
      setLoading(true);
      apiClient.get(`/students/${studentId}/slc`).then(res => {
        if (res.data?.success && res.data?.data) {
          setCurrentSlc(res.data.data);
        }
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [slcData, studentId, isOpen]);

  if (!isOpen) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="bg-white p-6 rounded-2xl shadow-xl text-center text-xs text-slate-500">
          Loading School Leaving Certificate...
        </div>
      </div>
    );
  }
  if (!currentSlc) return null;

  const isDuplicate = Boolean(currentSlc.reprintCount > 0);

  const formatDate = (d: any) => {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = dt.getDate().toString().padStart(2, '0');
    const month = (dt.getMonth() + 1).toString().padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const pdfUrl = `/api/slc/${currentSlc.id}/pdf`;
    window.open(pdfUrl, '_blank');
  };

  const handleRecordReprint = async () => {
    try {
      setReprinting(true);
      const res = await apiClient.post(`/slc/${currentSlc.id}/reprint`);
      if (res.data?.success) {
        toast.success(`Duplicate copy recorded (Print count: ${res.data.data.reprintCount})`);
        setCurrentSlc(res.data.data);
        if (onReprintSuccess) onReprintSuccess();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record reprint.');
    } finally {
      setReprinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Controls Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3 bg-slate-50/90 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                School Leaving Certificate (SLC)
              </h2>
              <span className="text-[11px] font-mono text-indigo-700 font-semibold">
                Certificate No: {currentSlc.certificateNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDuplicate && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                DUPLICATE COPY (Reprint #{currentSlc.reprintCount})
              </span>
            )}

            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Save as PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-2xs transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print SLC</span>
            </button>

            <button
              onClick={handleRecordReprint}
              disabled={reprinting}
              title="Issue Duplicate Copy"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${reprinting ? 'animate-spin' : ''}`} />
              <span>Duplicate Stamp</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable SLC Certificate Body */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 bg-white relative print:p-0 print:m-0">
          {/* Watermark for duplicate copy */}
          {isDuplicate && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
              <span className="text-7xl font-extrabold text-rose-500/10 -rotate-30 tracking-widest uppercase">
                DUPLICATE COPY
              </span>
            </div>
          )}

          {/* Certificate Frame */}
          <div className="relative border-4 border-double border-indigo-900 rounded-xl p-6 sm:p-8 space-y-5 bg-white">
            {/* Duplicate badge header */}
            {isDuplicate && (
              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-sm bg-rose-50 border border-rose-300 text-xs font-extrabold text-rose-800 tracking-wider">
                  DUPLICATE COPY
                </span>
              </div>
            )}

            {/* School Header */}
            <div className="text-center space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-indigo-950 uppercase tracking-wide">
                Pragya Bharti Public School
              </h1>
              <p className="text-xs text-slate-600 font-serif italic">
                Affiliated to CBSE / State Board · Affiliation No. CBSE-AFF-2026 · School Code: PBPS-8491
              </p>
              <p className="text-[11px] text-slate-500">
                Campus Road, PBPS Campus · Phone: +91 98765 43210 · Email: office@pbps.edu.in
              </p>
            </div>

            {/* Certificate Title Badge */}
            <div className="flex justify-center pt-1 pb-1">
              <div className="bg-indigo-900 text-white px-6 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wider uppercase shadow-xs">
                School Leaving Certificate / Transfer Certificate
              </div>
            </div>

            {/* Top Serial & Issue Date */}
            <div className="flex justify-between items-center text-xs font-semibold text-slate-800 border-b border-slate-200 pb-2">
              <div>
                SLC Certificate No: <strong className="font-mono text-indigo-900">{currentSlc.certificateNumber}</strong>
              </div>
              <div>
                Issue Date: <strong className="text-slate-900">{formatDate(currentSlc.issueDate)}</strong>
              </div>
            </div>

            {/* Student Details Grid & Photo */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Fields Table */}
              <div className="flex-1 space-y-2 text-xs divide-y divide-slate-100">
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">1. Admission No. (G.R. No.):</span>
                  <span className="font-mono font-bold text-slate-900">{currentSlc.admissionNumber}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">2. Student's Full Name:</span>
                  <span className="font-bold text-slate-900 uppercase">{currentSlc.studentName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">3. Father's / Guardian's Name:</span>
                  <span className="font-semibold text-slate-900">{currentSlc.fatherName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">4. Mother's Name:</span>
                  <span className="font-semibold text-slate-900">{currentSlc.motherName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">5. Date of Birth:</span>
                  <span className="font-bold text-slate-900">{formatDate(currentSlc.dateOfBirth)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">6. Nationality:</span>
                  <span className="font-medium text-slate-800">{currentSlc.nationality || 'Indian'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">7. Class in which student was admitted:</span>
                  <span className="font-semibold text-slate-900">{currentSlc.classAdmitted}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">8. Date of first admission:</span>
                  <span className="font-semibold text-slate-900">{formatDate(currentSlc.admissionDate)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">9. Class in which student last studied:</span>
                  <span className="font-semibold text-slate-900">{currentSlc.classLeaving}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">10. Date of leaving school:</span>
                  <span className="font-bold text-slate-900">{formatDate(currentSlc.leavingDate)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">11. Reason for leaving:</span>
                  <span className="font-semibold text-rose-800">{currentSlc.leavingReason}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">12. Fee Dues Status:</span>
                  <span className="font-bold text-emerald-700">{currentSlc.feeDuesStatus}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 font-medium">13. General Conduct & Character:</span>
                  <span className="font-semibold text-slate-900">{currentSlc.conduct || 'Good'}</span>
                </div>
              </div>

              {/* Photo Box */}
              <div className="w-28 shrink-0 flex flex-col items-center">
                <div className="w-24 h-28 border border-slate-300 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center shadow-xs">
                  {currentSlc.photoUrl ? (
                    <img
                      src={currentSlc.photoUrl}
                      alt={currentSlc.studentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-[10px] text-slate-400">
                      Student Photograph
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 font-mono">Photo ID</span>
              </div>
            </div>

            {/* Declaration Note */}
            <div className="pt-2 text-center text-[11px] text-slate-500 italic border-t border-slate-200">
              Certified that the above mentioned information is in accordance with the School General Register and Records.
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-3 gap-4 pt-10 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">
                  Prepared By
                </div>
                <span className="text-[10px] text-slate-500">(Office Staff)</span>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">
                  Class Teacher
                </div>
                <span className="text-[10px] text-slate-500">(Signature)</span>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">
                  Principal
                </div>
                <span className="text-[10px] text-slate-500">(Seal & Signature)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
