import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Users,
  GraduationCap,
  FileText,
  CreditCard,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  Calendar,
  Building,
  Check,
  Plus,
  Layers,
  Settings,
  Clock,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../api/client.js';
import { SessionManagerTab } from '../components/admissions/SessionManagerTab.js';
import { SessionRegisterTab } from '../components/admissions/SessionRegisterTab.js';
import { SessionPromotionTab } from '../components/admissions/SessionPromotionTab.js';
import { CreateEditSessionModal } from '../components/admissions/CreateEditSessionModal.js';
import { toast } from 'sonner';

interface AdmissionsPageProps {
  onOpenFeeCollectionForStudent: (studentId: string) => void;
}

export const AdmissionsPage: React.FC<AdmissionsPageProps> = ({ onOpenFeeCollectionForStudent }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active top-level tab: 'wizard' | 'sessions' | 'register' | 'promote'
  const activeTabParam = searchParams.get('tab') as 'wizard' | 'sessions' | 'register' | 'promote' | null;
  const [activeTab, setActiveTab] = useState<'wizard' | 'sessions' | 'register' | 'promote'>(
    activeTabParam || 'wizard'
  );

  useEffect(() => {
    if (activeTabParam && ['wizard', 'sessions', 'register', 'promote'].includes(activeTabParam)) {
      setActiveTab(activeTabParam);
    }
  }, [activeTabParam]);

  const handleTabChange = (tab: 'wizard' | 'sessions' | 'register' | 'promote') => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const updated = new URLSearchParams(prev);
      updated.set('tab', tab);
      return updated;
    });
  };

  const [currentStep, setCurrentStep] = useState(1);

  // Metadata dropdowns
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);

  // Session Manager modal state
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<any | null>(null);
  const [selectedSessionForRegister, setSelectedSessionForRegister] = useState<string>('');

  // Step 1: Student Information
  const [studentInfo, setStudentInfo] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '2016-04-15',
    gender: 'MALE',
    bloodGroup: 'B+',
    aadhaarNumber: '',
    nationality: 'Indian',
    religion: 'Hindu',
    category: 'General',
    address: '',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    emergencyPhone: '',
    photoUrl: ''
  });

  // Step 2: Parent/Guardian
  const [parentInfo, setParentInfo] = useState({
    fatherName: '',
    motherName: '',
    guardianName: '',
    primaryPhone: '',
    alternatePhone: '',
    email: '',
    occupation: 'Professional',
    annualIncome: '12,00,000',
    relationship: 'Father',
    address: ''
  });

  // Step 3: Academic Information
  const [academicInfo, setAcademicInfo] = useState({
    admissionNumber: '',
    academicYearId: '',
    classId: '',
    sectionId: '',
    admissionDate: new Date().toISOString().split('T')[0],
    previousSchool: '',
    previousClass: '',
    rollNumber: ''
  });

  // Step 4: Documents Upload Simulation
  const [documents, setDocuments] = useState<any[]>([
    { documentType: 'BIRTH_CERTIFICATE', title: 'Birth Certificate', fileUrl: 'https://docs.google.com/sample_birth_cert.pdf', fileName: 'birth_cert.pdf', uploaded: true },
    { documentType: 'AADHAAR', title: 'Aadhaar Card Copy', fileUrl: 'https://docs.google.com/sample_aadhaar.pdf', fileName: 'aadhaar_card.pdf', uploaded: true },
    { documentType: 'TRANSFER_CERTIFICATE', title: 'Transfer Certificate (TC)', fileUrl: '', fileName: '', uploaded: false },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [admissionSuccess, setAdmissionSuccess] = useState<any | null>(null);

  // Fetch classes and academic years
  const fetchMetadata = async () => {
    try {
      const [yearsRes, classesRes] = await Promise.all([
        apiClient.get('/academic-years'),
        apiClient.get('/classes')
      ]);

      if (yearsRes.data?.success) {
        setAcademicYears(yearsRes.data.data);
        const activeYear = yearsRes.data.data.find((y: any) => y.isActive) || yearsRes.data.data[0];
        if (activeYear) {
          setAcademicInfo(prev => ({
            ...prev,
            academicYearId: prev.academicYearId || activeYear.id
          }));
          if (!selectedSessionForRegister) {
            setSelectedSessionForRegister(activeYear.id);
          }
        }
      }

      if (classesRes.data?.success) {
        setClasses(classesRes.data.data);
        if (classesRes.data.data.length > 0 && !academicInfo.classId) {
          const firstClass = classesRes.data.data[0];
          setAcademicInfo(prev => ({ ...prev, classId: firstClass.id }));
          setAvailableSections(firstClass.sections || []);
          if (firstClass.sections?.[0]) {
            setAcademicInfo(prev => ({ ...prev, sectionId: firstClass.sections[0].id }));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Update sections and fetch fee structures when class changes
  useEffect(() => {
    if (academicInfo.classId) {
      const cls = classes.find(c => c.id === academicInfo.classId);
      if (cls) {
        setAvailableSections(cls.sections || []);
        if (cls.sections?.length > 0 && !cls.sections.find(s => s.id === academicInfo.sectionId)) {
          setAcademicInfo(prev => ({ ...prev, sectionId: cls.sections[0].id }));
        }
      }

      if (academicInfo.academicYearId) {
        apiClient.get(`/fee-structures?academicYearId=${academicInfo.academicYearId}`).then(res => {
          if (res.data?.success) {
            const struct = res.data.data.find((s: any) => s.classId === academicInfo.classId);
            setFeeStructures(struct ? [struct] : []);
          }
        }).catch(console.error);
      }
    }
  }, [academicInfo.classId, academicInfo.academicYearId, classes]);

  const selectedSession = academicYears.find(y => y.id === academicInfo.academicYearId);

  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!studentInfo.firstName.trim() || !studentInfo.lastName.trim() || !studentInfo.dateOfBirth) {
        setErrorMessage('Student first name, last name, and date of birth are required.');
        return false;
      }
    } else if (step === 2) {
      if (!parentInfo.primaryPhone.trim()) {
        setErrorMessage('Parent primary mobile phone number is required for communications.');
        return false;
      }
      if (!parentInfo.fatherName.trim() && !parentInfo.motherName.trim() && !parentInfo.guardianName.trim()) {
        setErrorMessage('Please provide at least Father, Mother, or Guardian name.');
        return false;
      }
    } else if (step === 3) {
      if (!academicInfo.academicYearId || !academicInfo.classId) {
        setErrorMessage('Please select Academic Session and Class.');
        return false;
      }
      if (selectedSession && selectedSession.admissionStatus === 'CLOSED') {
        setErrorMessage(`Admissions are marked CLOSED for Academic Session "${selectedSession.name}". Please choose an active session or reopen admissions in the Session Manager.`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setErrorMessage(null);
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmitAdmission = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post('/admissions', {
        studentInfo,
        parentInfo,
        academicInfo,
        documents: documents.filter(d => d.uploaded)
      });

      if (res.data?.success) {
        setAdmissionSuccess(res.data.data);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        fetchMetadata(); // update enrollment stats
      } else {
        setErrorMessage(res.data?.message || 'Admission failed');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Admission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Student Info', icon: User },
    { number: 2, title: 'Parent Details', icon: Users },
    { number: 3, title: 'Session & Class', icon: GraduationCap },
    { number: 4, title: 'Documents', icon: FileText },
    { number: 5, title: 'Fee Review & Submit', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Student Admissions & Academic Session Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage academic intake sessions, multi-step student enrollment, cohort registers, and class rollovers.
          </p>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 border border-slate-300/60 w-full lg:w-auto max-w-full overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => handleTabChange('wizard')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'wizard'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Admission</span>
          </button>

          <button
            onClick={() => handleTabChange('sessions')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'sessions'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Session Manager</span>
            {selectedSession?.isActive && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('register')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'register'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Session Register</span>
          </button>

          <button
            onClick={() => handleTabChange('promote')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[38px] ${
              activeTab === 'promote'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Rollover / Promote</span>
          </button>
        </div>
      </div>

      {/* TAB 1: NEW ADMISSION WIZARD */}
      {activeTab === 'wizard' && (
        <div className="max-w-4xl mx-auto">
          {admissionSuccess ? (
            /* Success Screen */
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Student Admission Completed!</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                The student has been enrolled for Session <strong>{admissionSuccess.sessionName || selectedSession?.name}</strong> in MySQL, academic cohort linked, and fee schedule initialized.
              </p>

              {/* Admission ID Badge */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 max-w-md mx-auto text-left space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Admission Number</span>
                    <div className="text-lg font-mono font-bold text-indigo-700">
                      {admissionSuccess.admissionNumber}
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    Session {admissionSuccess.sessionName || selectedSession?.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px]">Student Name:</span>
                    <div className="font-bold text-slate-900">{admissionSuccess.studentName}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Enrolled Class:</span>
                    <div className="font-bold text-slate-900">
                      {classes.find(c => c.id === academicInfo.classId)?.name} (
                      {availableSections.find(s => s.id === academicInfo.sectionId)?.name || 'A'})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Parent Phone:</span>
                    <div className="font-medium text-slate-800">{parentInfo.primaryPhone}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Admission Date:</span>
                    <div className="font-medium text-slate-800">{academicInfo.admissionDate}</div>
                  </div>
                </div>
              </div>

              {/* Next Action Buttons */}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => onOpenFeeCollectionForStudent(admissionSuccess.studentId)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Collect Initial Fee</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedSessionForRegister(academicInfo.academicYearId);
                    handleTabChange('register');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                >
                  <Users className="h-4 w-4" />
                  <span>View in Session Register</span>
                </button>

                <button
                  onClick={() => navigate(`/students?studentId=${admissionSuccess.studentId}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                >
                  <span>Student Profile</span>
                </button>

                <button
                  onClick={() => {
                    setAdmissionSuccess(null);
                    setCurrentStep(1);
                    setStudentInfo({
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      dateOfBirth: '2016-04-15',
                      gender: 'MALE',
                      bloodGroup: 'B+',
                      aadhaarNumber: '',
                      nationality: 'Indian',
                      religion: 'Hindu',
                      category: 'General',
                      address: '',
                      city: 'Bangalore',
                      state: 'Karnataka',
                      pincode: '560001',
                      emergencyPhone: '',
                      photoUrl: ''
                    });
                    setParentInfo({
                      fatherName: '',
                      motherName: '',
                      guardianName: '',
                      primaryPhone: '',
                      alternatePhone: '',
                      email: '',
                      occupation: 'Professional',
                      annualIncome: '12,00,000',
                      relationship: 'Father',
                      address: ''
                    });
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <span>Enroll Another Student</span>
                </button>
              </div>
            </div>
          ) : (
            /* Wizard Card */
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              {/* Stepper Header: Mobile Step X of Y, Desktop 5 nodes */}
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-4">
                {/* Mobile Stepper */}
                <div className="sm:hidden flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      Step {currentStep} of {steps.length}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {steps[currentStep - 1]?.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {steps.map((s) => (
                      <div
                        key={s.number}
                        className={`h-2 rounded-full transition-all ${
                          s.number === currentStep
                            ? 'w-7 bg-indigo-600'
                            : s.number < currentStep
                            ? 'w-3.5 bg-emerald-500'
                            : 'w-2 bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Desktop Stepper */}
                <div className="hidden sm:grid grid-cols-5 gap-2">
                  {steps.map((s) => {
                    const Icon = s.icon;
                    const isCompleted = currentStep > s.number;
                    const isCurrent = currentStep === s.number;
                    return (
                      <div key={s.number} className="flex flex-col items-center text-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isCompleted ? <Check className="h-4 w-4" /> : s.number}
                        </div>
                        <span
                          className={`mt-1.5 text-[11px] font-semibold ${
                            isCurrent ? 'text-indigo-600' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                          }`}
                        >
                          {s.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="m-4 sm:m-6 mb-0 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Step Content */}
              <div className="p-4 sm:p-6 md:p-8">
                {/* Step 1: Student Information */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                      Step 1: Student Personal Details
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          First Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Aarav"
                          value={studentInfo.firstName}
                          onChange={(e) => setStudentInfo({ ...studentInfo, firstName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Middle Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Kumar"
                          value={studentInfo.middleName}
                          onChange={(e) => setStudentInfo({ ...studentInfo, middleName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Last Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sharma"
                          value={studentInfo.lastName}
                          onChange={(e) => setStudentInfo({ ...studentInfo, lastName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Date of Birth <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={studentInfo.dateOfBirth}
                          onChange={(e) => setStudentInfo({ ...studentInfo, dateOfBirth: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Gender</label>
                        <select
                          value={studentInfo.gender}
                          onChange={(e) => setStudentInfo({ ...studentInfo, gender: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Blood Group</label>
                        <select
                          value={studentInfo.bloodGroup}
                          onChange={(e) => setStudentInfo({ ...studentInfo, bloodGroup: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                        >
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Aadhaar / National ID</label>
                        <input
                          type="text"
                          placeholder="e.g. 7482-9102-3841"
                          value={studentInfo.aadhaarNumber}
                          onChange={(e) => setStudentInfo({ ...studentInfo, aadhaarNumber: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Nationality</label>
                        <input
                          type="text"
                          value={studentInfo.nationality}
                          onChange={(e) => setStudentInfo({ ...studentInfo, nationality: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Religion (Optional)</label>
                        <input
                          type="text"
                          value={studentInfo.religion}
                          onChange={(e) => setStudentInfo({ ...studentInfo, religion: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                        <select
                          value={studentInfo.category}
                          onChange={(e) => setStudentInfo({ ...studentInfo, category: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs bg-white"
                        >
                          <option value="General">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="EWS">EWS</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Residential Address</label>
                      <textarea
                        rows={2}
                        placeholder="House/Flat number, Street, Locality..."
                        value={studentInfo.address}
                        onChange={(e) => setStudentInfo({ ...studentInfo, address: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Parent / Guardian */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                      Step 2: Parent & Guardian Details
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Father's Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Rajesh Sharma"
                          value={parentInfo.fatherName}
                          onChange={(e) => setParentInfo({ ...parentInfo, fatherName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Mother's Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Meenakshi Sharma"
                          value={parentInfo.motherName}
                          onChange={(e) => setParentInfo({ ...parentInfo, motherName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Primary Relationship</label>
                        <select
                          value={parentInfo.relationship}
                          onChange={(e) => setParentInfo({ ...parentInfo, relationship: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs bg-white"
                        >
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Guardian">Guardian</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Primary Contact Phone <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="+91 98765 43210"
                          value={parentInfo.primaryPhone}
                          onChange={(e) => setParentInfo({ ...parentInfo, primaryPhone: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Email (For Fee Receipts)</label>
                        <input
                          type="email"
                          placeholder="parent@example.com"
                          value={parentInfo.email}
                          onChange={(e) => setParentInfo({ ...parentInfo, email: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Occupation</label>
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer"
                          value={parentInfo.occupation}
                          onChange={(e) => setParentInfo({ ...parentInfo, occupation: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Academic Information & Session Allocation */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h2 className="text-sm font-bold text-slate-900">
                        Step 3: Academic Session, Class & Section Allocation
                      </h2>
                      <button
                        type="button"
                        onClick={() => handleTabChange('sessions')}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Manage Academic Sessions</span>
                      </button>
                    </div>

                    {/* Academic Session Selector Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 block">
                          Academic Admission Session <span className="text-rose-500">*</span>
                        </label>
                        {selectedSession && (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                selectedSession.admissionStatus === 'OPEN'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : selectedSession.admissionStatus === 'CLOSING_SOON'
                                  ? 'bg-amber-100 text-amber-800'
                                  : selectedSession.admissionStatus === 'CLOSED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              Intake: {selectedSession.admissionStatus || 'OPEN'}
                            </span>
                            {selectedSession.isActive && (
                              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                                Primary Active
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <select
                        value={academicInfo.academicYearId}
                        onChange={(e) => setAcademicInfo({ ...academicInfo, academicYearId: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white font-bold text-slate-900 focus:border-indigo-500 cursor-pointer"
                      >
                        {academicYears.map((y) => (
                          <option key={y.id} value={y.id}>
                            Session {y.name} {y.isActive ? '(Active Primary)' : ''} · [Status: {y.admissionStatus || 'OPEN'}]
                          </option>
                        ))}
                      </select>

                      {/* Warning if closed */}
                      {selectedSession?.admissionStatus === 'CLOSED' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            Admissions for Session <strong>{selectedSession.name}</strong> are marked CLOSED. Please switch to an open session or reopen admissions in Session Manager.
                          </span>
                        </div>
                      )}

                      {/* Session Seat Quota indicator */}
                      {selectedSession && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>
                            Enrolled: <strong>{selectedSession.enrolledStudentsCount || selectedSession._count?.studentsAcademic || 0}</strong> / {selectedSession.targetEnrollment || 300} seats target
                          </span>
                          <span>
                            Prefix: <strong className="font-mono text-indigo-700">{selectedSession.admissionPrefix || 'ADM'}-YYYY-XXXX</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Admitting Class <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={academicInfo.classId}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, classId: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs bg-white font-medium"
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Section</label>
                        <select
                          value={academicInfo.sectionId}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, sectionId: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs bg-white font-medium"
                        >
                          {availableSections.map((sec) => (
                            <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Admission Number (Auto-assigned if empty)
                        </label>
                        <input
                          type="text"
                          placeholder={`e.g. ${selectedSession?.admissionPrefix || 'ADM'}-2026-0001`}
                          value={academicInfo.admissionNumber}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, admissionNumber: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Enrollment Date</label>
                        <input
                          type="date"
                          value={academicInfo.admissionDate}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, admissionDate: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Previous School (if transfer)</label>
                        <input
                          type="text"
                          placeholder="e.g. St. Xavier's Convent"
                          value={academicInfo.previousSchool}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, previousSchool: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Documents Upload */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                      Step 4: Mandatory Enrollment Documents
                    </h2>

                    <div className="space-y-3">
                      {documents.map((doc, idx) => (
                        <div
                          key={doc.documentType}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${doc.uploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{doc.title}</div>
                              <div className="text-[11px] text-slate-500">
                                {doc.uploaded ? `${doc.fileName} · Verified` : 'Not uploaded yet'}
                              </div>
                            </div>
                          </div>

                          <div>
                            {doc.uploaded ? (
                              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Attached
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...documents];
                                  updated[idx].uploaded = true;
                                  updated[idx].fileName = `${doc.documentType.toLowerCase()}.pdf`;
                                  updated[idx].fileUrl = 'https://docs.sample/sample.pdf';
                                  setDocuments(updated);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                <span>Upload File</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 5: Fee Configuration & Review */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                      Step 5: Review Profile & Fee Structure
                    </h2>

                    {/* Profile Summary Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Profile</span>
                        <div className="font-bold text-sm text-slate-900">
                          {studentInfo.firstName} {studentInfo.middleName} {studentInfo.lastName}
                        </div>
                        <div className="text-slate-600">Gender: {studentInfo.gender} · DOB: {studentInfo.dateOfBirth}</div>
                        <div className="text-slate-600">Aadhaar: {studentInfo.aadhaarNumber || 'Not provided'}</div>
                        <div className="text-slate-600">Address: {studentInfo.address || 'Address on file'}</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Academic & Session Details</span>
                        <div className="font-bold text-sm text-slate-900">
                          Session {selectedSession?.name} · {classes.find(c => c.id === academicInfo.classId)?.name} (
                          {availableSections.find(s => s.id === academicInfo.sectionId)?.name || 'A'})
                        </div>
                        <div className="text-slate-600">Parent: {parentInfo.fatherName || parentInfo.motherName}</div>
                        <div className="text-slate-600">Contact: {parentInfo.primaryPhone}</div>
                        <div className="text-slate-600">Email: {parentInfo.email || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Applicable Fee Schedule Table */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-800 text-white px-4 py-2.5 text-xs font-bold flex justify-between items-center">
                        <span>Applicable Fee Schedule (Auto-Configured for Session {selectedSession?.name})</span>
                        <span className="text-[11px] font-normal text-slate-300">
                          Standard {classes.find(c => c.id === academicInfo.classId)?.name}
                        </span>
                      </div>

                      {feeStructures.length > 0 && feeStructures[0]?.items?.length > 0 ? (
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                            <tr>
                              <th className="py-2 px-4">Fee Head</th>
                              <th className="py-2 px-4">Billing Frequency</th>
                              <th className="py-2 px-4 text-right">Standard Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {feeStructures[0].items.map((item: any) => (
                              <tr key={item.id}>
                                <td className="py-2 px-4 font-semibold text-slate-800">{item.feeType?.name}</td>
                                <td className="py-2 px-4 text-slate-500">{item.frequency}</td>
                                <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                                  ₹{Number(item.amount).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Default tuition structure will apply on admission confirmation.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stepper Navigation Buttons */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[42px] order-2 sm:order-1 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </button>
                  ) : <div className="hidden sm:block" />}

                  {currentStep < 5 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs min-h-[42px] order-1 sm:order-2 transition-colors"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitAdmission}
                      disabled={submitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs min-h-[44px] order-1 sm:order-2 transition-colors"
                    >
                      {submitting ? 'Creating Student Records...' : 'Complete & Confirm Admission'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SESSION MANAGER */}
      {activeTab === 'sessions' && (
        <SessionManagerTab
          sessions={academicYears}
          onRefreshSessions={fetchMetadata}
          onOpenCreateSession={() => {
            setSessionToEdit(null);
            setCreateEditModalOpen(true);
          }}
          onEditSession={(session) => {
            setSessionToEdit(session);
            setCreateEditModalOpen(true);
          }}
          onSelectSessionForAdmission={(sessionId) => {
            setAcademicInfo(prev => ({ ...prev, academicYearId: sessionId }));
            handleTabChange('wizard');
          }}
          onViewSessionRegister={(sessionId) => {
            setSelectedSessionForRegister(sessionId);
            handleTabChange('register');
          }}
          onOpenPromotionTab={(sessionId) => {
            if (sessionId) setSelectedSessionForRegister(sessionId);
            handleTabChange('promote');
          }}
        />
      )}

      {/* TAB 3: SESSION REGISTER */}
      {activeTab === 'register' && (
        <SessionRegisterTab
          sessions={academicYears}
          selectedSessionId={selectedSessionForRegister || academicYears[0]?.id || ''}
          onSelectSessionId={(id) => setSelectedSessionForRegister(id)}
          onOpenFeeCollectionForStudent={onOpenFeeCollectionForStudent}
          onStartAdmissionForSession={(sessionId) => {
            setAcademicInfo(prev => ({ ...prev, academicYearId: sessionId }));
            handleTabChange('wizard');
          }}
          onOpenPromotionTab={(sessionId) => {
            setSelectedSessionForRegister(sessionId);
            handleTabChange('promote');
          }}
        />
      )}

      {/* TAB 4: STUDENT PROMOTION & ROLLOVER */}
      {activeTab === 'promote' && (
        <SessionPromotionTab
          sessions={academicYears}
          classes={classes}
          defaultFromSessionId={selectedSessionForRegister || academicYears[0]?.id}
          onPromotionComplete={fetchMetadata}
        />
      )}

      {/* Create / Edit Session Modal */}
      <CreateEditSessionModal
        isOpen={createEditModalOpen}
        onClose={() => {
          setCreateEditModalOpen(false);
          setSessionToEdit(null);
        }}
        sessionToEdit={sessionToEdit}
        onSuccess={fetchMetadata}
      />
    </div>
  );
};
