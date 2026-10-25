import { generateUnifiedReceiptPdf, ReceiptPdfPayload } from './pdfGenerator.js';

export interface ReceiptPdfData {
  school: {
    name: string;
    tagline?: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber?: string;
    receiptFooter?: string;
    authorizedSignatory?: string;
    logoUrl?: string | null;
  };
  receiptNumber: string;
  paymentDate: string;
  paymentMethod: string;
  transactionRef?: string;
  student: {
    admissionNumber: string;
    name: string;
    className: string;
    sectionName?: string;
    rollNumber?: string;
    fatherName?: string;
    phone?: string;
  };
  academicYear: string;
  items: Array<{
    title: string;
    amount: number;
    month?: string;
  }>;
  totalAmount: number;
  previousBalance: number;
  paidAmount: number;
  remainingBalance: number;
  collectedBy?: string;
  isDuplicate?: boolean;
  reprintCount?: number;
}

export function generateReceiptPdf(
  data: ReceiptPdfData,
  options: { compact?: boolean } = {}
): Promise<Buffer> {
  return generateUnifiedReceiptPdf(data as ReceiptPdfPayload, options);
}
