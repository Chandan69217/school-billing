import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Download,
  Trash2,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Camera,
  RefreshCw,
  HelpCircle,
  Award,
  Bus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../api/client.js';
import { SessionManagerTab } from '../components/admissions/SessionManagerTab.js';
import { SessionRegisterTab } from '../components/admissions/SessionRegisterTab.js';
import { SessionPromotionTab } from '../components/admissions/SessionPromotionTab.js';
import { CreateEditSessionModal } from '../components/admissions/CreateEditSessionModal.js';
import { SLCModal } from '../components/admissions/SLCModal.js';
import { formatAadhaar, validateAadhaar } from '../utils/verhoeff.js';
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
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);

  // Session Manager modal state
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<any | null>(null);
  const [selectedSessionForRegister, setSelectedSessionForRegister] = useState<string>('');

  // SLC Modal state for viewing generated certificate
  const [slcModalOpen, setSlcModalOpen] = useState(false);
  const [currentSlc, setCurrentSlc] = useState<any | null>(null);

  // Step 1: Student Information
  const [studentInfo, setStudentInfo] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    aadhaarNumber: '',
    nationality: 'Indian',
    religion: 'Hindu',
    category: 'General',
    // Residence (Permanent) Address
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Present Address (Part B3)
    sameAsResidence: true,
    presentAddress: '',
    presentCity: '',
    presentState: '',
    presentPincode: '',
    emergencyPhone: '',
    photoUrl: '',
    isHostelStudent: false,
    hostelRoomNumber: '',
    hostelAdmissionDate: new Date().toISOString().split('T')[0],
    // Transport fields
    usesTransport: false,
    transportRouteId: '',
    transportStopId: '',
    transportServiceType: 'TWO_WAY',
    transportPickupPoint: ''
  });

  // Photo upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Parent/Guardian (Part B2)
  const [parentInfo, setParentInfo] = useState({
    fatherName: '',
    fatherAadhaarNumber: '',
    motherName: '',
    motherAadhaarNumber: '',
    guardianName: '',
    primaryPhone: '',
    alternatePhone: '',
    email: '',
    occupation: 'Professional',
    annualIncome: '12,00,000',
    relationship: 'Father',
    address: ''
  });

  // Step 3: Academic Information (Part B4)
  const [academicInfo, setAcademicInfo] = useState({
    admissionNumber: '',
    academicYearId: '',
    classId: '',
    sectionId: '',
    admissionDate: new Date().toISOString().split('T')[0],
    rollNumber: '',
    isNonAttending: false,
    // Previous school details toggle & fields
    isPreviouslyEnrolled: false,
    previousSchoolName: '',
    previousClassPassed: 'Class 4',
    previousMedium: 'English',
    previousMediumOther: '',
    previousLeavingDate: '',
    previousTcNumber: '',
    previousTcDate: ''
  });

  // Discretionary custom fee
  const [customFeeInfo, setCustomFeeInfo] = useState({
    amount: '',
    feeHeadName: 'Discretionary Admission Fee',
    reason: ''
  });

  // Live admission quote bill
  const [admissionQuote, setAdmissionQuote] = useState<{
    items: Array<{ feeHead: string; component?: string; amount: number; frequency: string }>;
    totalAmount: number;
    hasConfiguredFee: boolean;
    note?: string;
  } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Immediate payment collection option on admission
  const [collectPaymentNow, setCollectPaymentNow] = useState(false);
  const [immediatePayment, setImmediatePayment] = useState({
    amount: '',
    paymentMethod: 'CASH',
    transactionRef: '',
    notes: 'Admission first fee collection'
  });

  // Step 4: Documents Upload
  const [documents, setDocuments] = useState<any[]>([
    { documentType: 'BIRTH_CERTIFICATE', title: 'Birth Certificate', fileUrl: '', fileName: '', uploaded: false },
    { documentType: 'AADHAAR', title: 'Aadhaar Card Copy', fileUrl: '', fileName: '', uploaded: false },
    { documentType: 'TRANSFER_CERTIFICATE', title: 'Transfer Certificate (TC)', fileUrl: '', fileName: '', uploaded: false },
    { documentType: 'PREVIOUS_MARKSHEET', title: 'Previous School Marksheet / Progress Card', fileUrl: '', fileName: '', uploaded: false },
  ]);

  const [uploadingDocIdx, setUploadingDocIdx] = useState<number | null>(null);
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [topErrorMessage, setTopErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [admissionSuccess, setAdmissionSuccess] = useState<any | null>(null);

  // Clear a specific field error as user types (Part C1)
  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
    if (topErrorMessage) setTopErrorMessage(null);
  };

  // Student Photo Upload Handler (Part B1)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    clearFieldError('photoUrl');

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowedMimes.includes(file.type.toLowerCase()) && !['jpg', 'jpeg', 'png'].includes(ext || '')) {
      setPhotoError('Invalid image type. Accepted formats are JPG, JPEG, and PNG.');
      return;
    }

    // Client-side 200 KB limit validation
    if (file.size > 200 * 1024) {
      setPhotoError(`Photo must be less than 200 KB (selected: ${(file.size / 1024).toFixed(1)} KB).`);
      return;
    }

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('photo', file);

      const res = await apiClient.post('/admissions/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setStudentInfo(prev => ({ ...prev, photoUrl: res.data.data.photoUrl }));
        toast.success('Student photograph uploaded and verified successfully.');
      } else {
        setPhotoError(res.data?.message || 'Failed to upload photo.');
      }
    } catch (err: any) {
      setPhotoError(err.response?.data?.message || 'Photo upload failed. Magic bytes check error.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setStudentInfo(prev => ({ ...prev, photoUrl: '' }));
    setPhotoError(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Sync residence address to present address if sameAsResidence is true (Part B3)
  const handleResidenceAddressChange = (key: 'address' | 'city' | 'state' | 'pincode', val: string) => {
    setStudentInfo(prev => {
      const updated = { ...prev, [key]: val };
      if (prev.sameAsResidence) {
        if (key === 'address') updated.presentAddress = val;
        if (key === 'city') updated.presentCity = val;
        if (key === 'state') updated.presentState = val;
        if (key === 'pincode') updated.presentPincode = val;
      }
      return updated;
    });
    clearFieldError(key);
  };

  const handleToggleSameAsResidence = (checked: boolean) => {
    setStudentInfo(prev => {
      if (checked) {
        return {
          ...prev,
          sameAsResidence: true,
          presentAddress: prev.address,
          presentCity: prev.city,
          presentState: prev.state,
          presentPincode: prev.pincode
        };
      } else {
        return {
          ...prev,
          sameAsResidence: false,
          presentAddress: '',
          presentCity: '',
          presentState: '',
          presentPincode: ''
        };
      }
    });
  };

  // Document upload handler
  const handleFileUpload = async (idx: number, file: File) => {
    if (!file) return;
    setUploadingDocIdx(idx);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post('/admissions/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const { fileUrl, fileName, fileSize, mimeType } = res.data.data;
        setDocuments(prev => {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            fileUrl,
            fileName: fileName || file.name,
            fileSize: fileSize || file.size,
            mimeType: mimeType || file.type,
            uploaded: true
          };
          return updated;
        });
        toast.success(`"${file.name}" uploaded successfully`);
      } else {
        toast.error(res.data?.message || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload document file');
    } finally {
      setUploadingDocIdx(null);
    }
  };

  const handleRemoveDoc = (idx: number) => {
    setDocuments(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        fileUrl: '',
        fileName: '',
        uploaded: false
      };
      return updated;
    });
  };

  const handleAddCustomDoc = () => {
    if (!customDocTitle.trim()) return;
    const docType = customDocTitle.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    setDocuments(prev => [
      ...prev,
      {
        documentType: docType,
        title: customDocTitle.trim(),
        fileUrl: '',
        fileName: '',
        uploaded: false
      }
    ]);
    setCustomDocTitle('');
  };

  // Fetch classes and academic years (includeArchived for SessionManager, but filter active for admission dropdown)
  const fetchMetadata = async () => {
    try {
      const [yearsRes, classesRes, routesRes] = await Promise.all([
        apiClient.get('/academic-years?includeArchived=true'),
        apiClient.get('/classes'),
        apiClient.get('/transport/routes').catch(() => ({ data: { success: false, data: [] } }))
      ]);

      if (routesRes.data?.success) {
        setTransportRoutes(routesRes.data.data.filter((r: any) => r.isActive));
      }

      if (yearsRes.data?.success) {
        const allSessions = yearsRes.data.data;
        setAcademicYears(allSessions);

        // Pick active session for admissions (Part A2)
        const unarchived = allSessions.filter((y: any) => !y.isArchived);
        const activeYear = unarchived.find((y: any) => y.isActive) || unarchived[0];
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

  // Fetch live admission quote bill from Director's configured fee structure
  const fetchAdmissionQuote = async () => {
    if (!academicInfo.classId || !academicInfo.academicYearId) return;
    setLoadingQuote(true);
    try {
      const monthNum = academicInfo.admissionDate
        ? new Date(academicInfo.admissionDate).getMonth() + 1
        : new Date().getMonth() + 1;

      const res = await apiClient.post('/fees/admission-bill', {
        classId: academicInfo.classId,
        academicYearId: academicInfo.academicYearId,
        isHostelStudent: studentInfo.isHostelStudent,
        admissionMonth: monthNum
      });

      if (res.data?.success) {
        setAdmissionQuote(res.data.data);
        if (res.data.data.totalAmount > 0 && !immediatePayment.amount) {
          setImmediatePayment(prev => ({
            ...prev,
            amount: res.data.data.totalAmount.toString()
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching admission bill quote:', err);
    } finally {
      setLoadingQuote(false);
    }
  };

  useEffect(() => {
    if (academicInfo.classId && academicInfo.academicYearId) {
      fetchAdmissionQuote();
    }
  }, [academicInfo.classId, academicInfo.academicYearId, studentInfo.isHostelStudent, academicInfo.admissionDate]);

  const selectedSession = academicYears.find(y => y.id === academicInfo.academicYearId);

  // Filtered unarchived sessions for admission dropdown (Part A2)
  const activeUnarchivedSessions = academicYears.filter(y => !y.isArchived);

  // Form Validation per step (Part C1)
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!studentInfo.firstName.trim()) {
        errors.firstName = 'First name is required.';
      } else if (!/^[A-Za-z\s.'-]+$/.test(studentInfo.firstName.trim()) || studentInfo.firstName.trim().length < 2) {
        errors.firstName = 'First name must contain at least 2 alphabetic characters.';
      }

      if (!studentInfo.lastName.trim()) {
        errors.lastName = 'Last name is required.';
      } else if (!/^[A-Za-z\s.'-]+$/.test(studentInfo.lastName.trim()) || studentInfo.lastName.trim().length < 2) {
        errors.lastName = 'Last name must contain at least 2 alphabetic characters.';
      }

      if (!studentInfo.dateOfBirth) {
        errors.dateOfBirth = 'Date of birth is required.';
      } else {
        const dob = new Date(studentInfo.dateOfBirth);
        const today = new Date();
        if (isNaN(dob.getTime())) {
          errors.dateOfBirth = 'Invalid date of birth.';
        } else if (dob >= today) {
          errors.dateOfBirth = 'Date of birth cannot be today or in the future.';
        } else {
          const age = (today.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          if (age < 2.5 || age > 25) {
            errors.dateOfBirth = 'Student age must be between 3 and 25 years for standard school enrollment.';
          }
        }
      }

      if (studentInfo.aadhaarNumber) {
        const valRes = validateAadhaar(studentInfo.aadhaarNumber);
        if (!valRes.valid) {
          errors.aadhaarNumber = valRes.message || 'Invalid student Aadhaar number.';
        }
      }
    } else if (step === 2) {
      if (!parentInfo.primaryPhone.trim()) {
        errors.primaryPhone = 'Parent mobile phone number is required.';
      } else if (!/^[6-9]\d{9}$/.test(parentInfo.primaryPhone.replace(/[\s-]/g, ''))) {
        errors.primaryPhone = 'Phone number must be a valid 10-digit Indian mobile number starting with 6-9.';
      }

      if (!parentInfo.fatherName.trim() && !parentInfo.motherName.trim() && !parentInfo.guardianName.trim()) {
        errors.parentName = 'Please provide at least Father, Mother, or Guardian full name.';
      }

      if (parentInfo.email && parentInfo.email.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentInfo.email.trim())) {
          errors.email = 'Invalid email address format.';
        }
      }

      // Parents' Aadhaar Validation (Part B2)
      if (parentInfo.fatherAadhaarNumber) {
        const valRes = validateAadhaar(parentInfo.fatherAadhaarNumber);
        if (!valRes.valid) {
          errors.fatherAadhaarNumber = valRes.message || 'Invalid Father\'s Aadhaar number.';
        }
      }

      if (parentInfo.motherAadhaarNumber) {
        const valRes = validateAadhaar(parentInfo.motherAadhaarNumber);
        if (!valRes.valid) {
          errors.motherAadhaarNumber = valRes.message || 'Invalid Mother\'s Aadhaar number.';
        }
      }
    } else if (step === 3) {
      if (!academicInfo.academicYearId) {
        errors.academicYearId = 'Academic Session is required.';
      } else if (selectedSession?.isArchived) {
        errors.academicYearId = `Session "${selectedSession.name}" is archived. Please select an active session.`;
      } else if (selectedSession?.admissionStatus === 'CLOSED') {
        errors.academicYearId = `Admissions are currently marked CLOSED for Session "${selectedSession.name}".`;
      }

      if (!academicInfo.classId) {
        errors.classId = 'Admitting Class is required.';
      }

      // Previous School Details validation (Part B4)
      if (academicInfo.isPreviouslyEnrolled) {
        if (!academicInfo.previousSchoolName.trim()) {
          errors.previousSchoolName = 'Previous school name is required for transfer students.';
        }
        if (!academicInfo.previousClassPassed.trim()) {
          errors.previousClassPassed = 'Class passed at previous school is required.';
        }
        if (!academicInfo.previousMedium.trim()) {
          errors.previousMedium = 'Medium of instruction is required.';
        } else if (academicInfo.previousMedium === 'Other' && !academicInfo.previousMediumOther.trim()) {
          errors.previousMediumOther = 'Please specify the medium of instruction.';
        }
        if (!academicInfo.previousLeavingDate) {
          errors.previousLeavingDate = 'Date of leaving previous school is required.';
        } else {
          const lDate = new Date(academicInfo.previousLeavingDate);
          const admDate = new Date(academicInfo.admissionDate || new Date());
          const today = new Date();
          if (isNaN(lDate.getTime())) {
            errors.previousLeavingDate = 'Invalid date of leaving previous school.';
          } else if (lDate > today) {
            errors.previousLeavingDate = 'Leaving date cannot be in the future.';
          } else if (lDate > admDate) {
            errors.previousLeavingDate = 'Leaving date cannot be after admission date.';
          }
        }
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstField = Object.keys(errors)[0];
      setTopErrorMessage(Object.values(errors)[0]);

      // Scroll to and focus the first invalid field (Part C1)
      setTimeout(() => {
        const el = document.getElementById(firstField) || document.querySelector(`[name="${firstField}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (el as HTMLElement).focus?.();
        }
      }, 50);

      return false;
    }

    setTopErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 4) {
        fetchAdmissionQuote();
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setTopErrorMessage(null);
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmitAdmission = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      // Jump to step with errors
      if (!validateStep(1)) setCurrentStep(1);
      else if (!validateStep(2)) setCurrentStep(2);
      else if (!validateStep(3)) setCurrentStep(3);
      return;
    }

    setSubmitting(true);
    setTopErrorMessage(null);

    try {
      const finalMedium = academicInfo.previousMedium === 'Other'
        ? academicInfo.previousMediumOther.trim()
        : academicInfo.previousMedium;

      const payload: any = {
        studentInfo: {
          ...studentInfo,
          // include parent aadhaar reference in student info for convenience
          fatherAadhaarNumber: parentInfo.fatherAadhaarNumber || undefined,
          motherAadhaarNumber: parentInfo.motherAadhaarNumber || undefined,
          isPreviouslyEnrolled: academicInfo.isPreviouslyEnrolled,
          previousSchoolName: academicInfo.isPreviouslyEnrolled ? academicInfo.previousSchoolName : undefined,
          previousClassPassed: academicInfo.isPreviouslyEnrolled ? academicInfo.previousClassPassed : undefined,
          previousMedium: academicInfo.isPreviouslyEnrolled ? finalMedium : undefined,
          previousLeavingDate: academicInfo.isPreviouslyEnrolled ? academicInfo.previousLeavingDate : undefined,
          previousTcNumber: academicInfo.isPreviouslyEnrolled ? academicInfo.previousTcNumber : undefined,
          previousTcDate: academicInfo.isPreviouslyEnrolled ? academicInfo.previousTcDate : undefined
        },
        parentInfo: {
          ...parentInfo
        },
        academicInfo: {
          ...academicInfo,
          previousSchool: academicInfo.isPreviouslyEnrolled ? academicInfo.previousSchoolName : undefined,
          previousClass: academicInfo.isPreviouslyEnrolled ? academicInfo.previousClassPassed : undefined
        },
        documents: documents.filter(d => d.uploaded)
      };

      if (customFeeInfo.amount) {
        payload.customFeeInfo = {
          amount: parseFloat(customFeeInfo.amount),
          feeHeadName: customFeeInfo.feeHeadName || 'Discretionary Admission Fee',
          reason: customFeeInfo.reason || 'Admission fee discretionary'
        };
      }

      if (collectPaymentNow && immediatePayment.amount && parseFloat(immediatePayment.amount) > 0) {
        payload.paymentInfo = {
          amount: parseFloat(immediatePayment.amount),
          paymentMethod: immediatePayment.paymentMethod,
          transactionRef: immediatePayment.transactionRef.trim() || undefined,
          notes: immediatePayment.notes.trim() || undefined
        };
      }

      const res = await apiClient.post('/admissions', payload);

      if (res.data?.success) {
        setAdmissionSuccess(res.data.data);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        fetchMetadata();
      } else {
        setTopErrorMessage(res.data?.message || 'Admission registration failed');
      }
    } catch (err: any) {
      const respData = err.response?.data;
      if (respData?.errors) {
        setFieldErrors(respData.errors);
      }
      setTopErrorMessage(respData?.message || err.message || 'Admission registration failed');
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
            Manage academic intake sessions, student admission lifecycle, cohort registers, and class rollovers.
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
            <Layers className="h-3.5 w-3.5" />
            <span>Session Promotion</span>
          </button>
        </div>
      </div>

      {/* TAB 1: NEW ADMISSION WIZARD */}
      {activeTab === 'wizard' && (
        <div className="max-w-4xl mx-auto">
          {admissionSuccess ? (
            /* Success Screen */
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Student Admission Completed!</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The student has been enrolled for Session <strong>{admissionSuccess.sessionName || selectedSession?.name}</strong>, academic cohort assigned, and initial fee schedule generated.
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

                {admissionSuccess.receiptId && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold">Initial Fee Payment Recorded:</span> Receipt #{admissionSuccess.receiptNumber}
                    </div>
                    <a
                      href={`/api/receipts/${admissionSuccess.receiptId}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Receipt</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Next Action Buttons */}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href={`/api/students/${admissionSuccess.studentId}/admission-pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Admission Slip (PDF)</span>
                </a>

                {!admissionSuccess.receiptId && (
                  <button
                    onClick={() => onOpenFeeCollectionForStudent(admissionSuccess.studentId)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Collect Initial Fee</span>
                  </button>
                )}

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
                      city: 'Patna',
                      state: 'Bihar',
                      pincode: '800001',
                      sameAsResidence: true,
                      presentAddress: '',
                      presentCity: 'Patna',
                      presentState: 'Bihar',
                      presentPincode: '800001',
                      emergencyPhone: '',
                      photoUrl: '',
                      isHostelStudent: false,
                      hostelRoomNumber: '',
                      hostelAdmissionDate: new Date().toISOString().split('T')[0],
                      usesTransport: false,
                      transportRouteId: '',
                      transportStopId: '',
                      transportServiceType: 'TWO_WAY',
                      transportPickupPoint: ''
                    });
                    setParentInfo({
                      fatherName: '',
                      fatherAadhaarNumber: '',
                      motherName: '',
                      motherAadhaarNumber: '',
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
              {/* Stepper Header */}
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

              {/* Error Banner / Summary at top (Part C1) */}
              {topErrorMessage && (
                <div className="m-4 sm:m-6 mb-0 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{topErrorMessage}</span>
                </div>
              )}

              {/* Form Step Content */}
              <div className="p-4 sm:p-6 md:p-8">
                {/* ============================================================== */}
                {/* STEP 1: Student Information with Photo Upload & Present Address */}
                {/* ============================================================== */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Step 1: Student Personal Details & Photograph
                        </h2>
                        <p className="text-xs text-slate-500">
                          Mandatory fields marked with red asterisk (<span className="text-rose-500 font-bold">*</span>).
                        </p>
                      </div>
                    </div>

                    {/* Part B1: Student Photograph Upload */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center gap-4">
                      <div className="relative h-24 w-24 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                        {studentInfo.photoUrl ? (
                          <img
                            src={studentInfo.photoUrl}
                            alt="Student Preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                            <Camera className="h-6 w-6 mb-1 text-slate-300" />
                            <span className="text-[10px] font-semibold leading-tight">No Photo</span>
                          </div>
                        )}
                        {uploadingPhoto && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-center sm:text-left flex-1">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                          <span className="text-xs font-bold text-slate-800">Student Photograph</span>
                          <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 font-medium">
                            JPG, JPEG, PNG (Max 200 KB)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Uploaded photo is securely verified via magic bytes and appears on student ID, profile, and leaving certificate (SLC).
                        </p>

                        <div className="flex items-center gap-2 justify-center sm:justify-start pt-1">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer">
                            <Upload className="h-3.5 w-3.5" />
                            <span>{studentInfo.photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                              className="hidden"
                              onChange={handlePhotoUpload}
                              disabled={uploadingPhoto}
                            />
                          </label>

                          {studentInfo.photoUrl && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {photoError && (
                          <p className="text-xs font-semibold text-rose-600 pt-1">{photoError}</p>
                        )}
                      </div>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          First Name <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          placeholder="e.g. Aarav"
                          value={studentInfo.firstName}
                          onChange={(e) => {
                            setStudentInfo({ ...studentInfo, firstName: e.target.value });
                            clearFieldError('firstName');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs transition-colors focus:outline-hidden ${
                            fieldErrors.firstName
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                          }`}
                        />
                        {fieldErrors.firstName && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.firstName}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Middle Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Kumar"
                          value={studentInfo.middleName}
                          onChange={(e) => setStudentInfo({ ...studentInfo, middleName: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Last Name <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          type="text"
                          placeholder="e.g. Sharma"
                          value={studentInfo.lastName}
                          onChange={(e) => {
                            setStudentInfo({ ...studentInfo, lastName: e.target.value });
                            clearFieldError('lastName');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs transition-colors focus:outline-hidden ${
                            fieldErrors.lastName
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                          }`}
                        />
                        {fieldErrors.lastName && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    {/* DOB, Gender, Blood Group, Aadhaar */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Date of Birth <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="dateOfBirth"
                          name="dateOfBirth"
                          type="date"
                          value={studentInfo.dateOfBirth}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            setStudentInfo({ ...studentInfo, dateOfBirth: e.target.value });
                            clearFieldError('dateOfBirth');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs transition-colors focus:outline-hidden ${
                            fieldErrors.dateOfBirth
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                          }`}
                        />
                        {fieldErrors.dateOfBirth && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.dateOfBirth}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Gender <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          value={studentInfo.gender}
                          onChange={(e) => setStudentInfo({ ...studentInfo, gender: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-indigo-500 focus:outline-hidden"
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
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-indigo-500 focus:outline-hidden"
                        >
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Student Aadhaar No. (Optional)
                        </label>
                        <input
                          id="aadhaarNumber"
                          name="aadhaarNumber"
                          type="text"
                          placeholder="e.g. 7482 9102 3841"
                          maxLength={14}
                          value={formatAadhaar(studentInfo.aadhaarNumber)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setStudentInfo({ ...studentInfo, aadhaarNumber: raw });
                            clearFieldError('aadhaarNumber');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs font-mono transition-colors focus:outline-hidden ${
                            fieldErrors.aadhaarNumber
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                          }`}
                        />
                        {fieldErrors.aadhaarNumber && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.aadhaarNumber}</p>
                        )}
                      </div>
                    </div>

                    {/* Nationality, Religion, Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Nationality</label>
                        <input
                          type="text"
                          value={studentInfo.nationality}
                          onChange={(e) => setStudentInfo({ ...studentInfo, nationality: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Religion (Optional)</label>
                        <input
                          type="text"
                          value={studentInfo.religion}
                          onChange={(e) => setStudentInfo({ ...studentInfo, religion: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                        <select
                          value={studentInfo.category}
                          onChange={(e) => setStudentInfo({ ...studentInfo, category: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white"
                        >
                          <option value="General">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="EWS">EWS</option>
                        </select>
                      </div>
                    </div>

                    {/* Part B3: Permanent (Residence) Address */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Permanent (Residence) Address</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder="House / Flat No., Street, Locality..."
                            value={studentInfo.address}
                            onChange={(e) => handleResidenceAddressChange('address', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="City / District"
                            value={studentInfo.city}
                            onChange={(e) => handleResidenceAddressChange('city', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="State"
                            value={studentInfo.state}
                            onChange={(e) => handleResidenceAddressChange('state', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="PIN Code"
                            value={studentInfo.pincode}
                            onChange={(e) => handleResidenceAddressChange('pincode', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <input
                            type="tel"
                            placeholder="Emergency Phone (Optional)"
                            value={studentInfo.emergencyPhone}
                            onChange={(e) => setStudentInfo({ ...studentInfo, emergencyPhone: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Part B3: Present Address Section with "Same as residence" Checkbox */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Present (Current) Address</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                          <input
                            type="checkbox"
                            checked={studentInfo.sameAsResidence}
                            onChange={(e) => handleToggleSameAsResidence(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Same as residence address</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder="Present House / Flat No., Street, Locality..."
                            disabled={studentInfo.sameAsResidence}
                            value={studentInfo.presentAddress}
                            onChange={(e) => setStudentInfo({ ...studentInfo, presentAddress: e.target.value })}
                            className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                              studentInfo.sameAsResidence
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                : 'bg-white border-slate-300 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Present City"
                            disabled={studentInfo.sameAsResidence}
                            value={studentInfo.presentCity}
                            onChange={(e) => setStudentInfo({ ...studentInfo, presentCity: e.target.value })}
                            className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                              studentInfo.sameAsResidence
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                : 'bg-white border-slate-300 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Present State"
                            disabled={studentInfo.sameAsResidence}
                            value={studentInfo.presentState}
                            onChange={(e) => setStudentInfo({ ...studentInfo, presentState: e.target.value })}
                            className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                              studentInfo.sameAsResidence
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                : 'bg-white border-slate-300 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Present PIN Code"
                            disabled={studentInfo.sameAsResidence}
                            value={studentInfo.presentPincode}
                            onChange={(e) => setStudentInfo({ ...studentInfo, presentPincode: e.target.value })}
                            className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                              studentInfo.sameAsResidence
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                : 'bg-white border-slate-300 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* STEP 2: Parent / Guardian with Aadhaar Numbers (Part B2) */}
                {/* ============================================================== */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Step 2: Parent & Guardian Details
                        </h2>
                        <p className="text-xs text-slate-500">
                          Father's and Mother's 12-digit Aadhaar numbers are auto-formatted and Verhoeff-validated.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Father's Name <span className="text-slate-400 font-normal">(or Guardian)</span>
                        </label>
                        <input
                          id="fatherName"
                          type="text"
                          placeholder="e.g. Rajesh Sharma"
                          value={parentInfo.fatherName}
                          onChange={(e) => {
                            setParentInfo({ ...parentInfo, fatherName: e.target.value });
                            clearFieldError('parentName');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden ${
                            fieldErrors.parentName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Father's Aadhaar No. (Part B2)
                        </label>
                        <input
                          id="fatherAadhaarNumber"
                          type="text"
                          placeholder="e.g. 5621 8934 1029"
                          maxLength={14}
                          value={formatAadhaar(parentInfo.fatherAadhaarNumber)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setParentInfo({ ...parentInfo, fatherAadhaarNumber: raw });
                            clearFieldError('fatherAadhaarNumber');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs font-mono focus:outline-hidden ${
                            fieldErrors.fatherAadhaarNumber
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500'
                          }`}
                        />
                        {fieldErrors.fatherAadhaarNumber && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.fatherAadhaarNumber}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Primary Relationship</label>
                        <select
                          value={parentInfo.relationship}
                          onChange={(e) => setParentInfo({ ...parentInfo, relationship: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white"
                        >
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Guardian">Guardian</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Mother's Name
                        </label>
                        <input
                          id="motherName"
                          type="text"
                          placeholder="e.g. Meenakshi Sharma"
                          value={parentInfo.motherName}
                          onChange={(e) => {
                            setParentInfo({ ...parentInfo, motherName: e.target.value });
                            clearFieldError('parentName');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs focus:border-indigo-500 focus:outline-hidden ${
                            fieldErrors.parentName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Mother's Aadhaar No. (Part B2)
                        </label>
                        <input
                          id="motherAadhaarNumber"
                          type="text"
                          placeholder="e.g. 8920 3412 7741"
                          maxLength={14}
                          value={formatAadhaar(parentInfo.motherAadhaarNumber)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setParentInfo({ ...parentInfo, motherAadhaarNumber: raw });
                            clearFieldError('motherAadhaarNumber');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs font-mono focus:outline-hidden ${
                            fieldErrors.motherAadhaarNumber
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500'
                          }`}
                        />
                        {fieldErrors.motherAadhaarNumber && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.motherAadhaarNumber}</p>
                        )}
                      </div>
                    </div>

                    {fieldErrors.parentName && (
                      <p className="text-[11px] font-semibold text-rose-600">{fieldErrors.parentName}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Primary Contact Mobile <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          id="primaryPhone"
                          name="primaryPhone"
                          type="tel"
                          placeholder="10-digit mobile (e.g. 9876543210)"
                          maxLength={10}
                          value={parentInfo.primaryPhone}
                          onChange={(e) => {
                            setParentInfo({ ...parentInfo, primaryPhone: e.target.value });
                            clearFieldError('primaryPhone');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs transition-colors focus:outline-hidden ${
                            fieldErrors.primaryPhone
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-300 focus:border-indigo-500'
                          }`}
                        />
                        {fieldErrors.primaryPhone && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.primaryPhone}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                        <input
                          id="email"
                          type="email"
                          placeholder="parent@example.com"
                          value={parentInfo.email}
                          onChange={(e) => {
                            setParentInfo({ ...parentInfo, email: e.target.value });
                            clearFieldError('email');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                            fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                          }`}
                        />
                        {fieldErrors.email && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.email}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Occupation</label>
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer"
                          value={parentInfo.occupation}
                          onChange={(e) => setParentInfo({ ...parentInfo, occupation: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* STEP 3: Academic Session, Class & Previous School (Part B4 & A2) */}
                {/* ============================================================== */}
                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Step 3: Academic Session, Class & Previous School Details
                        </h2>
                        <p className="text-xs text-slate-500">
                          Only active unarchived academic sessions appear below for new enrollment.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTabChange('sessions')}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Session Manager</span>
                      </button>
                    </div>

                    {/* Academic Session Selector Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 block">
                          Academic Admission Session <span className="text-rose-500 font-bold">*</span>
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

                      {/* Dropdown strictly renders only unarchived sessions (Part A2) */}
                      <select
                        id="academicYearId"
                        name="academicYearId"
                        value={academicInfo.academicYearId}
                        onChange={(e) => {
                          setAcademicInfo({ ...academicInfo, academicYearId: e.target.value });
                          clearFieldError('academicYearId');
                        }}
                        className={`w-full rounded-lg border py-2 px-3 text-xs bg-white font-bold text-slate-900 focus:outline-hidden cursor-pointer ${
                          fieldErrors.academicYearId
                            ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500'
                            : 'border-slate-300 focus:border-indigo-500'
                        }`}
                      >
                        {activeUnarchivedSessions.map((y) => (
                          <option key={y.id} value={y.id}>
                            Session {y.name} {y.isActive ? '(Active Primary)' : ''} · [Intake: {y.admissionStatus || 'OPEN'}]
                          </option>
                        ))}
                      </select>
                      {fieldErrors.academicYearId && (
                        <p className="text-[11px] font-semibold text-rose-600">{fieldErrors.academicYearId}</p>
                      )}

                      {/* Warning if closed */}
                      {selectedSession?.admissionStatus === 'CLOSED' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                          <span>
                            Admissions for Session <strong>{selectedSession.name}</strong> are currently CLOSED.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Class & Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Admitting Class <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <select
                          id="classId"
                          name="classId"
                          value={academicInfo.classId}
                          onChange={(e) => {
                            setAcademicInfo({ ...academicInfo, classId: e.target.value });
                            clearFieldError('classId');
                          }}
                          className={`w-full rounded-lg border py-2 px-3 text-xs bg-white font-medium focus:outline-hidden ${
                            fieldErrors.classId ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-indigo-500'
                          }`}
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {fieldErrors.classId && (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.classId}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Section</label>
                        <select
                          value={academicInfo.sectionId}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, sectionId: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white font-medium focus:border-indigo-500 focus:outline-hidden"
                        >
                          {availableSections.map((sec) => (
                            <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Admission Number (Auto-generated if blank)
                        </label>
                        <input
                          type="text"
                          placeholder={`e.g. ${selectedSession?.admissionPrefix || 'PBPS'}-2026-0001`}
                          value={academicInfo.admissionNumber}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, admissionNumber: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Admission Date</label>
                        <input
                          type="date"
                          value={academicInfo.admissionDate}
                          onChange={(e) => setAcademicInfo({ ...academicInfo, admissionDate: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                        />
                      </div>
                    </div>

                    {/* Part B4: Previous School Details (Conditional Toggle) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Previous School / Transfer Student Record (Part B4)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Has the student previously studied elsewhere or transferring from another school?
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              setAcademicInfo(prev => ({
                                ...prev,
                                isPreviouslyEnrolled: false,
                                previousSchoolName: '',
                                previousLeavingDate: '',
                                previousTcNumber: '',
                                previousTcDate: ''
                              }));
                              clearFieldError('previousSchoolName');
                              clearFieldError('previousClassPassed');
                              clearFieldError('previousMedium');
                              clearFieldError('previousLeavingDate');
                            }}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              !academicInfo.isPreviouslyEnrolled
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            No (Fresher)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicInfo(prev => ({ ...prev, isPreviouslyEnrolled: true }))}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              academicInfo.isPreviouslyEnrolled
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Yes (Transfer)
                          </button>
                        </div>
                      </div>

                      {/* Conditional Section shown only if Toggle is YES */}
                      {academicInfo.isPreviouslyEnrolled && (
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Previous School Name <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <input
                                id="previousSchoolName"
                                type="text"
                                placeholder="e.g. St. Xavier's High School"
                                value={academicInfo.previousSchoolName}
                                onChange={(e) => {
                                  setAcademicInfo({ ...academicInfo, previousSchoolName: e.target.value });
                                  clearFieldError('previousSchoolName');
                                }}
                                className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                                  fieldErrors.previousSchoolName
                                    ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500'
                                    : 'border-slate-300 focus:border-indigo-500'
                                }`}
                              />
                              {fieldErrors.previousSchoolName && (
                                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.previousSchoolName}</p>
                              )}
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Class Passed at Previous School <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <select
                                id="previousClassPassed"
                                value={academicInfo.previousClassPassed}
                                onChange={(e) => {
                                  setAcademicInfo({ ...academicInfo, previousClassPassed: e.target.value });
                                  clearFieldError('previousClassPassed');
                                }}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-indigo-500 focus:outline-hidden"
                              >
                                {classes.map(c => (
                                  <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                                <option value="UKG / Kindergarten">UKG / Kindergarten</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Medium of Instruction <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <select
                                id="previousMedium"
                                value={academicInfo.previousMedium}
                                onChange={(e) => {
                                  setAcademicInfo({ ...academicInfo, previousMedium: e.target.value });
                                  clearFieldError('previousMedium');
                                }}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-indigo-500 focus:outline-hidden"
                              >
                                <option value="English">English</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Marathi">Marathi</option>
                                <option value="Other">Other (Specify below)</option>
                              </select>

                              {academicInfo.previousMedium === 'Other' && (
                                <input
                                  type="text"
                                  placeholder="Specify other medium (e.g. Bengali, Urdu)..."
                                  value={academicInfo.previousMediumOther}
                                  onChange={(e) => {
                                    setAcademicInfo({ ...academicInfo, previousMediumOther: e.target.value });
                                    clearFieldError('previousMediumOther');
                                  }}
                                  className="mt-1.5 w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                                />
                              )}
                              {fieldErrors.previousMediumOther && (
                                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.previousMediumOther}</p>
                              )}
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Date of Leaving Previous School <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <input
                                id="previousLeavingDate"
                                type="date"
                                max={new Date().toISOString().split('T')[0]}
                                value={academicInfo.previousLeavingDate}
                                onChange={(e) => {
                                  setAcademicInfo({ ...academicInfo, previousLeavingDate: e.target.value });
                                  clearFieldError('previousLeavingDate');
                                }}
                                className={`w-full rounded-lg border py-2 px-3 text-xs focus:outline-hidden ${
                                  fieldErrors.previousLeavingDate
                                    ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500'
                                    : 'border-slate-300 focus:border-indigo-500'
                                }`}
                              />
                              {fieldErrors.previousLeavingDate && (
                                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.previousLeavingDate}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Previous School TC No. (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. TC-2026/894"
                                value={academicInfo.previousTcNumber}
                                onChange={(e) => setAcademicInfo({ ...academicInfo, previousTcNumber: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                TC Issue Date (Optional)
                              </label>
                              <input
                                type="date"
                                value={academicInfo.previousTcDate}
                                onChange={(e) => setAcademicInfo({ ...academicInfo, previousTcDate: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hostel Resident Option */}
                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Hostel Boarding Facility</div>
                          <div className="text-[11px] text-slate-500">Is the student taking school hostel accommodation?</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setStudentInfo(prev => ({ ...prev, isHostelStudent: false }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              !studentInfo.isHostelStudent
                                ? 'bg-white text-slate-800 shadow-2xs border border-slate-300'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            No (Day Scholar)
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentInfo(prev => ({ ...prev, isHostelStudent: true }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              studentInfo.isHostelStudent
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Yes (Hostel Student)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* School Transport Facility Option */}
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                            <Bus className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">School Transport Facility</div>
                            <div className="text-[11px] text-slate-500">Does the student require school bus / van transport?</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setStudentInfo(prev => ({
                              ...prev,
                              usesTransport: false,
                              transportRouteId: '',
                              transportStopId: '',
                              transportPickupPoint: ''
                            }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              !studentInfo.usesTransport
                                ? 'bg-white text-slate-800 shadow-2xs border border-slate-300'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const firstRoute = transportRoutes[0];
                              const firstStop = firstRoute?.stops?.[0];
                              setStudentInfo(prev => ({
                                ...prev,
                                usesTransport: true,
                                transportRouteId: prev.transportRouteId || firstRoute?.id || '',
                                transportStopId: prev.transportStopId || firstStop?.id || '',
                                transportServiceType: prev.transportServiceType || 'TWO_WAY'
                              }));
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              studentInfo.usesTransport
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Yes (Avails Transport)
                          </button>
                        </div>
                      </div>

                      {studentInfo.usesTransport && (
                        <div className="pt-3 border-t border-amber-200/70 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Transport Route <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <select
                                value={studentInfo.transportRouteId}
                                onChange={(e) => {
                                  const rId = e.target.value;
                                  const selR = transportRoutes.find(r => r.id === rId);
                                  setStudentInfo(prev => ({
                                    ...prev,
                                    transportRouteId: rId,
                                    transportStopId: selR?.stops?.[0]?.id || ''
                                  }));
                                }}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-amber-500 focus:outline-hidden"
                              >
                                {transportRoutes.length === 0 ? (
                                  <option value="">No active routes configured</option>
                                ) : (
                                  transportRoutes.map((r: any) => (
                                    <option key={r.id} value={r.id}>
                                      {r.code} - {r.name} ({r.stops?.length || 0} stops)
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Designated Stop <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <select
                                value={studentInfo.transportStopId}
                                onChange={(e) => setStudentInfo(prev => ({ ...prev, transportStopId: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-amber-500 focus:outline-hidden"
                              >
                                {(() => {
                                  const selR = transportRoutes.find(r => r.id === studentInfo.transportRouteId);
                                  const stops = selR?.stops || [];
                                  if (stops.length === 0) return <option value="">No stops in this route</option>;
                                  return stops.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} - ₹{Number(s.monthlyFee).toLocaleString('en-IN')}/mo
                                    </option>
                                  ));
                                })()}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Service Type
                              </label>
                              <select
                                value={studentInfo.transportServiceType}
                                onChange={(e) => setStudentInfo(prev => ({ ...prev, transportServiceType: e.target.value as any }))}
                                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-amber-500 focus:outline-hidden"
                              >
                                <option value="TWO_WAY">Two-way (Pick & Drop)</option>
                                <option value="ONE_WAY">One-way Only</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              Pickup / Drop Point Landmark (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Near Shiv Mandir gate, Main Road"
                              value={studentInfo.transportPickupPoint}
                              onChange={(e) => setStudentInfo(prev => ({ ...prev, transportPickupPoint: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs focus:border-amber-500 focus:outline-hidden"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* STEP 4: Documents Upload */}
                {/* ============================================================== */}
                {currentStep === 4 && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Step 4: Upload Admission Documents
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Upload digital copies (PDF, JPG, PNG up to 10MB) for verification and student record archive.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {documents.map((doc, idx) => (
                        <div
                          key={doc.documentType + idx}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all gap-3 ${
                            doc.uploaded
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-2.5 rounded-lg shrink-0 ${
                                doc.uploaded
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {doc.title}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                {doc.uploaded ? (
                                  <>
                                    <span className="font-medium text-emerald-800 font-mono truncate max-w-xs">
                                      {doc.fileName}
                                    </span>
                                    {doc.fileSize ? (
                                      <span className="text-[10px] text-slate-400">
                                        ({Math.round(doc.fileSize / 1024)} KB)
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-slate-400">PDF, JPG, PNG up to 10MB</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {doc.uploaded ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                  <Check className="h-3 w-3" /> Attached
                                </span>

                                {doc.fileUrl && (
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>View</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRemoveDoc(idx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Remove / Replace File"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs cursor-pointer transition-colors">
                                {uploadingDocIdx === idx ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-3.5 w-3.5" />
                                    <span>Choose File</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                                  disabled={uploadingDocIdx === idx}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(idx, file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Custom Document Input */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add another document (e.g. Income Certificate, Medical Record, Caste Certificate)"
                          value={customDocTitle}
                          onChange={(e) => setCustomDocTitle(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 py-1.5 px-3 text-xs focus:border-indigo-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomDoc}
                          disabled={!customDocTitle.trim()}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Document Head</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* STEP 5: Fee Review & Submit */}
                {/* ============================================================== */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Step 5: Review Admission Summary & Submit
                        </h2>
                        <p className="text-xs text-slate-500">
                          Confirm all student profile data and fee schedule before final admission submission.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchAdmissionQuote}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Recalculate Fees
                      </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Profile</span>
                          {studentInfo.photoUrl && (
                            <img src={studentInfo.photoUrl} alt="Photo" className="h-8 w-8 rounded-full object-cover border" />
                          )}
                        </div>
                        <div className="font-bold text-sm text-slate-900">
                          {studentInfo.firstName} {studentInfo.middleName} {studentInfo.lastName}
                        </div>
                        <div className="text-slate-600">Gender: {studentInfo.gender} · DOB: {studentInfo.dateOfBirth}</div>
                        <div className="text-slate-600">
                          Status: <strong className={studentInfo.isHostelStudent ? "text-indigo-700" : "text-slate-800"}>
                            {studentInfo.isHostelStudent ? 'Hostel Boarder' : 'Day Scholar'}
                          </strong>
                        </div>
                        {academicInfo.isPreviouslyEnrolled && (
                          <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                            Transfer from: <strong>{academicInfo.previousSchoolName}</strong> ({academicInfo.previousClassPassed})
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Session & Parent Information</span>
                        <div className="font-bold text-sm text-slate-900">
                          Session {selectedSession?.name} · {classes.find(c => c.id === academicInfo.classId)?.name}
                        </div>
                        <div className="text-slate-600">Parent: {parentInfo.fatherName || parentInfo.motherName}</div>
                        <div className="text-slate-600">Contact: {parentInfo.primaryPhone}</div>
                        <div className="text-slate-600">Admission Date: {academicInfo.admissionDate}</div>
                      </div>
                    </div>

                    {/* Itemized Fee Quote */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="bg-slate-900 text-white px-4 py-3 text-xs font-bold flex justify-between items-center">
                        <span>Standard Admission Fee Schedule</span>
                        <span className="font-mono text-emerald-400">
                          Total: ₹{(admissionQuote?.totalAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="p-4 bg-white space-y-2 text-xs">
                        {admissionQuote?.items && admissionQuote.items.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {admissionQuote.items.map((item, idx) => (
                              <div key={idx} className="py-1.5 flex justify-between items-center">
                                <div>
                                  <span className="font-semibold text-slate-800">{item.feeHead}</span>
                                  {item.frequency && (
                                    <span className="ml-2 text-[10px] text-slate-400 uppercase">({item.frequency})</span>
                                  )}
                                </div>
                                <span className="font-mono font-bold text-slate-900">
                                  ₹{item.amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-center py-2">
                            Standard class fee structure will be applied upon enrollment.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stepper Navigation Buttons */}
                <div className="mt-8 flex items-center justify-between pt-4 border-t border-slate-200">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Previous Step</span>
                    </button>
                  ) : <div />}

                  {currentStep < 5 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs"
                    >
                      <span>Proceed to {steps[currentStep]?.title}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitAdmission}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Finalizing Admission...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span>Complete & Submit Admission</span>
                        </>
                      )}
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
            handleTabChange('promote');
          }}
        />
      )}

      {/* TAB 3: SESSION REGISTER */}
      {activeTab === 'register' && (
        <SessionRegisterTab
          sessions={academicYears}
          classes={classes}
          selectedSessionId={selectedSessionForRegister || academicInfo.academicYearId}
          onSelectSession={(id) => setSelectedSessionForRegister(id)}
          onEnrollStudent={() => handleTabChange('wizard')}
        />
      )}

      {/* TAB 4: SESSION PROMOTION */}
      {activeTab === 'promote' && (
        <SessionPromotionTab
          sessions={academicYears}
          classes={classes}
          onPromotionComplete={fetchMetadata}
        />
      )}

      {/* Create / Edit Session Modal */}
      <CreateEditSessionModal
        isOpen={createEditModalOpen}
        onClose={() => setCreateEditModalOpen(false)}
        sessionToEdit={sessionToEdit}
        existingSessions={academicYears}
        onSuccess={fetchMetadata}
      />

      {/* SLC Certificate Modal */}
      <SLCModal
        isOpen={slcModalOpen}
        onClose={() => setSlcModalOpen(false)}
        slcData={currentSlc}
        onReprintSuccess={fetchMetadata}
      />
    </div>
  );
};
