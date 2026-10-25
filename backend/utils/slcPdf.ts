import { generateUnifiedSlcPdf, SlcPdfPayload } from './pdfGenerator.js';

export interface SlcPdfData {
  school: {
    name: string;
    tagline?: string;
    address: string;
    phone: string;
    email: string;
    affiliationNumber?: string;
    schoolCode?: string;
    principalName?: string;
    logoUrl?: string | null;
  };
  slc: {
    certificateNumber: string;
    issueDate: string;
    reprintCount: number;
    isDuplicate?: boolean;
    studentName: string;
    photoUrl?: string | null;
    admissionNumber: string;
    fatherName: string;
    motherName: string;
    dateOfBirth: string;
    nationality: string;
    category?: string;
    classAdmitted: string;
    classLeaving?: string;
    classLastStudied?: string;
    admissionDate: string;
    leavingDate: string;
    leavingReason?: string;
    reasonForLeaving?: string;
    feeDuesStatus: string;
    conduct: string;
    remarks?: string;
  };
}

export function generateSlcPdf(data: SlcPdfData): Promise<Buffer> {
  const payload: SlcPdfPayload = {
    school: {
      name: data.school.name,
      tagline: data.school.tagline,
      address: data.school.address,
      phone: data.school.phone,
      email: data.school.email,
      affiliationNumber: data.school.affiliationNumber,
      logoUrl: data.school.logoUrl
    },
    slc: {
      certificateNumber: data.slc.certificateNumber,
      issueDate: data.slc.issueDate,
      reprintCount: data.slc.reprintCount,
      studentName: data.slc.studentName,
      photoUrl: data.slc.photoUrl,
      admissionNumber: data.slc.admissionNumber,
      fatherName: data.slc.fatherName,
      motherName: data.slc.motherName,
      dateOfBirth: data.slc.dateOfBirth,
      nationality: data.slc.nationality,
      category: data.slc.category,
      classAdmitted: data.slc.classAdmitted,
      classLastStudied: data.slc.classLastStudied || data.slc.classLeaving || 'Standard',
      admissionDate: data.slc.admissionDate,
      leavingDate: data.slc.leavingDate,
      reasonForLeaving: data.slc.reasonForLeaving || data.slc.leavingReason || 'Parent Request',
      feeDuesStatus: data.slc.feeDuesStatus,
      conduct: data.slc.conduct,
      remarks: data.slc.remarks
    }
  };

  return generateUnifiedSlcPdf(payload);
}
