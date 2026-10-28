/**
 * Unified Professional PDF Generation Engine (Part B)
 * Built with PDFKit, embedded official PNG school emblem, brand layout,
 * zebra-striped tables, Indian currency formatting, amount in words,
 * repeated table headers across pages, watermarks, and signature lines.
 */

import PDFDocument from 'pdfkit';
import { getSchoolLogoBuffer } from '../config/logo.js';
import { numberToIndianWords } from './numberToWords.js';

export interface SchoolMetadata {
  name: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  affiliationNumber?: string;
  receiptFooter?: string;
  authorizedSignatory?: string;
  logoUrl?: string | null;
}

export interface ReceiptPdfPayload {
  school: SchoolMetadata;
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
    isHostelStudent?: boolean;
    studentType?: string;
  };
  academicYear: string;
  items: Array<{
    title: string;
    amount: number;
    month?: string;
    feeType?: string;
  }>;
  totalAmount: number;
  previousBalance: number;
  paidAmount: number;
  remainingBalance: number;
  collectedBy?: string;
  isDuplicate?: boolean;
  reprintCount?: number;
}

export interface SlcPdfPayload {
  school: SchoolMetadata;
  slc: {
    certificateNumber: string;
    issueDate: string;
    reprintCount: number;
    studentName: string;
    photoUrl?: string | null;
    admissionNumber: string;
    fatherName?: string | null;
    motherName?: string | null;
    dateOfBirth: string;
    nationality?: string | null;
    category?: string | null;
    classAdmitted: string;
    classLastStudied: string;
    admissionDate: string;
    leavingDate: string;
    reasonForLeaving: string;
    feeDuesStatus: string;
    conduct: string;
    remarks?: string | null;
  };
}

export interface ReportPdfPayload {
  school: SchoolMetadata;
  title: string;
  subtitle?: string;
  sessionName?: string;
  generatedBy?: string;
  kpis?: Array<{ label: string; value: string }>;
  columns: Array<{ header: string; key: string; width: number; align?: 'left' | 'center' | 'right'; type?: string }>;
  rows: Array<Record<string, any>>;
  totals?: Record<string, any>;
}

// -------------------------------------------------------------
// Formatters
// -------------------------------------------------------------
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return 'Rs. 0.00';
  return `Rs. ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDateStr(d: any): string {
  if (!d) return 'N/A';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const day = dt.getDate().toString().padStart(2, '0');
  const month = (dt.getMonth() + 1).toString().padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

// -------------------------------------------------------------
// Helper: Draw Header on any page
// -------------------------------------------------------------
function drawHeader(
  doc: PDFKit.PDFDocument,
  school: SchoolMetadata,
  startX: number,
  startY: number,
  contentWidth: number,
  isLandscape = false
): number {
  const safeSchool = school || {
    name: 'Pragya Bharti Public School',
    address: 'Alipur, P.O. Buniadgang, Manpur, Gaya, Bihar – 823003',
    phone: '+91 9430442800, +91 7247271212',
    email: 'pragyabhartigayabih@gmail.com'
  };
  const logoBuffer = getSchoolLogoBuffer(safeSchool.logoUrl);
  const logoSize = isLandscape ? 48 : 54;

  // Render logo on left
  if (logoBuffer && logoBuffer.length > 0) {
    try {
      doc.image(logoBuffer, startX, startY, {
        width: logoSize,
        height: logoSize,
        fit: [logoSize, logoSize],
        align: 'center',
        valign: 'center'
      });
    } catch (e) {
      // safe fallback if corrupted
    }
  }

  // School text details
  const textX = startX + logoSize + 14;
  const textWidth = contentWidth - logoSize - 14;

  const schoolName = (safeSchool.name || 'Pragya Bharti Public School').toUpperCase();
  doc.fillColor('#0f172a').fontSize(isLandscape ? 15 : 17).font('Helvetica-Bold');
  doc.text(schoolName, textX, startY + 2, { width: textWidth, align: 'left' });

  let curY = startY + (isLandscape ? 19 : 22);

  if (safeSchool.tagline) {
    doc.fillColor('#d97706').fontSize(isLandscape ? 8.5 : 9).font('Helvetica-Bold');
    doc.text(safeSchool.tagline, textX, curY, { width: textWidth, align: 'left' });
    curY += 12;
  }

  doc.fillColor('#475569').fontSize(isLandscape ? 7.5 : 8).font('Helvetica');
  const addressStr = safeSchool.address || 'Patna, Bihar';
  const phoneStr = safeSchool.phone || 'N/A';
  const emailStr = safeSchool.email || 'pragyabhartigayabih@gmail.com';
  const metaLine = `${addressStr} | Phone: ${phoneStr} | Email: ${emailStr}`;
  doc.text(metaLine, textX, curY, { width: textWidth, align: 'left' });
  curY += 11;

  if (safeSchool.affiliationNumber) {
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Oblique');
    doc.text(`CBSE Affiliation / Registration No: ${safeSchool.affiliationNumber}`, textX, curY, {
      width: textWidth,
      align: 'left'
    });
    curY += 12;
  }

  const dividerY = Math.max(curY + 4, startY + logoSize + 6);
  doc.strokeColor('#4338ca').lineWidth(1.5).moveTo(startX, dividerY).lineTo(startX + contentWidth, dividerY).stroke();
  doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, dividerY + 2).lineTo(startX + contentWidth, dividerY + 2).stroke();

  return dividerY + 8;
}

// -------------------------------------------------------------
// 1. Fee Receipt PDF Generator (A4 Full Page or A5 Compact)
// -------------------------------------------------------------
export function generateUnifiedReceiptPdf(
  data: ReceiptPdfPayload,
  options: { compact?: boolean } = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const isCompact = options.compact === true;
      const school = data?.school || {
        name: 'Pragya Bharti Public School',
        address: 'Alipur, P.O. Buniadgang, Manpur, Gaya, Bihar – 823003',
        phone: '+91 9430442800, +91 7247271212',
        email: 'pragyabhartigayabih@gmail.com'
      };
      const student = data?.student || {
        name: 'Student',
        admissionNumber: 'N/A',
        className: 'Class'
      };
      const receiptNumber = data?.receiptNumber || 'RCP-PENDING';
      const items = Array.isArray(data?.items) && data.items.length > 0 ? data.items : [
        { title: 'Fee Payment', amount: Number(data?.paidAmount) || 0 }
      ];
      const totalAmount = Number(data?.totalAmount) || 0;
      const previousBalance = Number(data?.previousBalance) || 0;
      const paidAmount = Number(data?.paidAmount) || 0;
      const remainingBalance = Number(data?.remainingBalance) || 0;
      const paymentDate = data?.paymentDate || new Date().toLocaleDateString('en-IN');
      const paymentMethod = data?.paymentMethod || 'CASH';
      const academicYear = data?.academicYear || '2026-27';

      const doc = new PDFDocument({
        size: isCompact ? 'A5' : 'A4',
        margin: 28,
        info: {
          Title: `Fee Receipt - ${receiptNumber}`,
          Author: school.name,
          Subject: 'Official Fee Payment Receipt'
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 28;
      const contentWidth = pageWidth - margin * 2;

      // Decorative Outer Frame
      doc.rect(margin - 8, margin - 8, contentWidth + 16, pageHeight - margin * 2 + 16)
        .lineWidth(1.2).strokeColor('#0f172a').stroke();
      doc.rect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10)
        .lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      // Watermark
      const isDuplicate = Boolean(data?.isDuplicate || (data?.reprintCount && data.reprintCount > 0));
      const logoBuf = getSchoolLogoBuffer(school.logoUrl);

      doc.save();
      if (logoBuf && logoBuf.length > 0) {
        doc.opacity(0.04);
        try {
          doc.image(logoBuf, pageWidth / 2 - 120, pageHeight / 2 - 120, { width: 240, height: 240 });
        } catch {}
      }

      if (isDuplicate) {
        doc.opacity(0.12);
        doc.rotate(-35, { origin: [pageWidth / 2, pageHeight / 2] });
        doc.fillColor('#b91c1c').fontSize(42).font('Helvetica-Bold')
          .text('DUPLICATE COPY', pageWidth / 2 - 190, pageHeight / 2 - 20, { align: 'center', width: 380 });
      }
      doc.restore();

      // Draw School Header
      let y = drawHeader(doc, school, margin, margin, contentWidth, false);

      // Title Banner
      const titleHeight = 22;
      doc.rect(margin, y, contentWidth, titleHeight).fillColor('#1e1b4b').fill();
      doc.fillColor('#ffffff').fontSize(10.5).font('Helvetica-Bold')
        .text('FEE PAYMENT RECEIPT', margin, y + 5, { align: 'center', width: contentWidth });
      y += titleHeight + 8;

      // Meta Grid (Receipt No, Date, Session, Payment Mode)
      const colW = contentWidth / 4;
      doc.rect(margin, y, contentWidth, 26).fillColor('#f8fafc').fill();
      doc.rect(margin, y, contentWidth, 26).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold');
      doc.text('RECEIPT NO', margin + 6, y + 4);
      doc.text('PAYMENT DATE', margin + colW + 6, y + 4);
      doc.text('ACADEMIC SESSION', margin + colW * 2 + 6, y + 4);
      doc.text('PAYMENT MODE', margin + colW * 3 + 6, y + 4);

      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');
      doc.text(receiptNumber, margin + 6, y + 14);
      doc.font('Helvetica').text(paymentDate, margin + colW + 6, y + 14);
      doc.text(academicYear, margin + colW * 2 + 6, y + 14);
      doc.text(
        `${paymentMethod}${data?.transactionRef ? ` (${data.transactionRef})` : ''}`,
        margin + colW * 3 + 6,
        y + 14,
        { width: colW - 10, ellipsis: true }
      );
      y += 32;

      // Student Particulars Box
      doc.rect(margin, y, contentWidth, 48).fillColor('#f1f5f9').fill();
      doc.rect(margin, y, contentWidth, 48).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      const halfW = contentWidth / 2;
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');

      doc.text('Student Name:', margin + 8, y + 6);
      doc.font('Helvetica').text(student.name, margin + 85, y + 6);

      doc.font('Helvetica-Bold').text('Admission No:', margin + halfW + 8, y + 6);
      doc.font('Helvetica').text(student.admissionNumber, margin + halfW + 90, y + 6);

      doc.font('Helvetica-Bold').text('Class & Section:', margin + 8, y + 20);
      doc.font('Helvetica').text(
        `${student.className || 'Class'} (${student.sectionName || 'A'})${student.rollNumber ? ` · Roll: ${student.rollNumber}` : ''}`,
        margin + 85,
        y + 20
      );

      doc.font('Helvetica-Bold').text('Student Category:', margin + halfW + 8, y + 20);
      doc.font('Helvetica').text(
        student.isHostelStudent ? 'Hostel Resident' : 'Day Scholar',
        margin + halfW + 90,
        y + 20
      );

      doc.font('Helvetica-Bold').text('Parent / Guardian:', margin + 8, y + 34);
      doc.font('Helvetica').text(student.fatherName || 'Parent / Guardian', margin + 85, y + 34);

      doc.font('Helvetica-Bold').text('Contact Phone:', margin + halfW + 8, y + 34);
      doc.font('Helvetica').text(student.phone || 'N/A', margin + halfW + 90, y + 34);
      y += 56;

      // Fee Breakdown Table Header
      const tableHeaders = [
        { title: '#', width: 30, align: 'center' },
        { title: 'Fee Particulars / Fee Head', width: contentWidth - 250, align: 'left' },
        { title: 'Billing Term', width: 100, align: 'center' },
        { title: 'Amount Paid', width: 120, align: 'right' }
      ];

      doc.rect(margin, y, contentWidth, 20).fillColor('#1e293b').fill();
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

      let curColX = margin;
      tableHeaders.forEach(th => {
        doc.text(th.title, curColX + 4, y + 5, { width: th.width - 8, align: th.align as any });
        curColX += th.width;
      });
      y += 20;

      // Table Rows
      doc.font('Helvetica').fontSize(8);
      items.forEach((item, index) => {
        const rowHeight = 19;
        const isEven = index % 2 === 0;

        if (isEven) {
          doc.rect(margin, y, contentWidth, rowHeight).fillColor('#f8fafc').fill();
        }
        doc.rect(margin, y, contentWidth, rowHeight).lineWidth(0.4).strokeColor('#e2e8f0').stroke();

        doc.fillColor('#1e293b');
        let colX = margin;

        doc.text((index + 1).toString(), colX + 4, y + 5, { width: tableHeaders[0].width - 8, align: 'center' });
        colX += tableHeaders[0].width;

        doc.text(item.title || 'Fee Head', colX + 4, y + 5, { width: tableHeaders[1].width - 8, align: 'left' });
        colX += tableHeaders[1].width;

        doc.text(item.month || 'Current Session', colX + 4, y + 5, { width: tableHeaders[2].width - 8, align: 'center' });
        colX += tableHeaders[2].width;

        doc.font('Helvetica-Bold').text(formatCurrency(Number(item.amount) || 0), colX + 4, y + 5, {
          width: tableHeaders[3].width - 8,
          align: 'right'
        });
        doc.font('Helvetica');

        y += rowHeight;
      });

      // Amount in Words Bar
      y += 6;
      const words = numberToIndianWords(paidAmount);
      doc.rect(margin, y, contentWidth, 20).fillColor('#e0e7ff').fill();
      doc.rect(margin, y, contentWidth, 20).lineWidth(0.5).strokeColor('#c7d2fe').stroke();
      doc.fillColor('#1e1b4b').fontSize(7.5).font('Helvetica-Bold');
      doc.text(`Amount in Words: ${words}`, margin + 8, y + 5, { width: contentWidth - 16, ellipsis: true });
      y += 26;

      // Summary Totals Calculation Card (Right aligned)
      const cardW = 230;
      const cardX = margin + contentWidth - cardW;

      doc.rect(cardX, y, cardW, 82).fillColor('#f8fafc').fill();
      doc.rect(cardX, y, cardW, 82).lineWidth(0.8).strokeColor('#cbd5e1').stroke();

      doc.fontSize(8).fillColor('#475569').font('Helvetica');
      doc.text('Total Scheduled Dues:', cardX + 10, y + 8);
      doc.text(formatCurrency(totalAmount), cardX + 110, y + 8, { width: 110, align: 'right' });

      doc.text('Previous Outstanding:', cardX + 10, y + 24);
      doc.text(formatCurrency(previousBalance), cardX + 110, y + 24, { width: 110, align: 'right' });

      // Highlight Amount Paid
      doc.rect(cardX, y + 38, cardW, 22).fillColor('#4338ca').fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('NET AMOUNT RECEIVED:', cardX + 10, y + 44);
      doc.text(formatCurrency(paidAmount), cardX + 110, y + 44, { width: 110, align: 'right' });

      // Balance Remaining
      doc.fillColor(remainingBalance > 0 ? '#b91c1c' : '#15803d').font('Helvetica-Bold');
      doc.text(remainingBalance > 0 ? 'Dues Outstanding:' : 'Current Balance:', cardX + 10, y + 66);
      doc.text(formatCurrency(remainingBalance), cardX + 110, y + 66, { width: 110, align: 'right' });

      // Payment Terms / Instructions on Left
      const termsW = contentWidth - cardW - 14;
      doc.fillColor('#64748b').fontSize(7.2).font('Helvetica');
      doc.text('Terms & Conditions:', margin, y + 6);
      doc.text('1. Fees once deposited are non-refundable & non-transferable under school rules.', margin, y + 17, { width: termsW });
      doc.text('2. Please preserve this receipt for academic verification, bus passes & income tax reconciliation.', margin, y + 28, { width: termsW });
      doc.text('3. Cheques/UPI payments are credited subject to bank clearance.', margin, y + 40, { width: termsW });
      y += 94;

      // Signature Blocks
      const sigY = pageHeight - margin - 50;
      doc.strokeColor('#94a3b8').lineWidth(0.8)
        .moveTo(margin + 10, sigY).lineTo(margin + 160, sigY).stroke()
        .moveTo(margin + contentWidth - 170, sigY).lineTo(margin + contentWidth - 10, sigY).stroke();

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
      doc.text(data?.collectedBy || 'Cashier / Bursar', margin + 10, sigY + 5);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Collected & Verified By', margin + 10, sigY + 16);

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
      doc.text(school.authorizedSignatory || 'Authorized Officer', margin + contentWidth - 170, sigY + 5, { align: 'right', width: 160 });
      doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(`For ${school.name}`, margin + contentWidth - 170, sigY + 16, { align: 'right', width: 160 });

      // Page Footer Bar
      const footerY = pageHeight - margin - 12;
      doc.fillColor('#94a3b8').fontSize(6.8).font('Helvetica')
        .text(
          `${school.receiptFooter || 'This is a computer generated fee receipt. Pragya Bharti Public School.'} · Page 1 of 1 · Generated on ${new Date().toLocaleString('en-IN')}`,
          margin,
          footerY,
          { align: 'center', width: contentWidth }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// -------------------------------------------------------------
// 2. School Leaving Certificate (SLC) Formal PDF Generator
// -------------------------------------------------------------
export function generateUnifiedSlcPdf(data: SlcPdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30,
        info: {
          Title: `School Leaving Certificate - ${data.slc.certificateNumber}`,
          Author: data.school.name,
          Subject: 'Official Transfer Certificate / School Leaving Certificate'
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 30;
      const contentWidth = pageWidth - margin * 2;

      // Certificate Ornate Double Border
      doc.rect(margin - 10, margin - 10, contentWidth + 20, pageHeight - margin * 2 + 20)
        .lineWidth(2).strokeColor('#1e1b4b').stroke();
      doc.rect(margin - 6, margin - 6, contentWidth + 12, pageHeight - margin * 2 + 12)
        .lineWidth(0.8).strokeColor('#d97706').stroke();
      doc.rect(margin - 3, margin - 3, contentWidth + 6, pageHeight - margin * 2 + 6)
        .lineWidth(0.4).strokeColor('#94a3b8').stroke();

      // Watermark
      const isDuplicate = data.slc.reprintCount > 0;
      const logoBuf = getSchoolLogoBuffer(data.school.logoUrl);

      doc.save();
      if (logoBuf && logoBuf.length > 0) {
        doc.opacity(0.04);
        try {
          doc.image(logoBuf, pageWidth / 2 - 130, pageHeight / 2 - 130, { width: 260, height: 260 });
        } catch {}
      }

      if (isDuplicate) {
        doc.opacity(0.12);
        doc.rotate(-35, { origin: [pageWidth / 2, pageHeight / 2] });
        doc.fillColor('#b91c1c').fontSize(46).font('Helvetica-Bold')
          .text('DUPLICATE COPY', pageWidth / 2 - 200, pageHeight / 2 - 20, { align: 'center', width: 400 });
      }
      doc.restore();

      // Top Centered Header with School Logo
      let y = margin + 5;
      if (logoBuf && logoBuf.length > 0) {
        try {
          doc.image(logoBuf, pageWidth / 2 - 32, y, { width: 64, height: 64 });
          y += 70;
        } catch {}
      }

      doc.fillColor('#1e1b4b').fontSize(19).font('Helvetica-Bold')
        .text(data.school.name.toUpperCase(), margin, y, { align: 'center', width: contentWidth });
      y += 24;

      if (data.school.tagline) {
        doc.fillColor('#d97706').fontSize(9.5).font('Helvetica-Bold')
          .text(data.school.tagline, margin, y, { align: 'center', width: contentWidth });
        y += 14;
      }

      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
        .text(`${data.school.address} | Phone: ${data.school.phone} | Email: ${data.school.email}`, margin, y, {
          align: 'center',
          width: contentWidth
        });
      y += 12;

      if (data.school.affiliationNumber) {
        doc.fillColor('#4338ca').fontSize(8.5).font('Helvetica-Bold')
          .text(`Affiliation No: ${data.school.affiliationNumber} · School Code: PBPS-8491`, margin, y, {
            align: 'center',
            width: contentWidth
          });
        y += 14;
      }

      doc.strokeColor('#d97706').lineWidth(1.5).moveTo(margin + 40, y).lineTo(margin + contentWidth - 40, y).stroke();
      y += 10;

      // Certificate Title
      doc.fillColor('#1e1b4b').fontSize(14).font('Helvetica-Bold')
        .text('SCHOOL LEAVING CERTIFICATE (TRANSFER CERTIFICATE)', margin, y, { align: 'center', width: contentWidth });
      y += 18;

      // Certificate Number & Issue Date Box
      doc.rect(margin, y, contentWidth, 22).fillColor('#f8fafc').fill();
      doc.rect(margin, y, contentWidth, 22).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');
      doc.text(`SLC Serial No: ${data.slc.certificateNumber}`, margin + 10, y + 6);
      doc.text(`Admission / SR No: ${data.slc.admissionNumber}`, margin + contentWidth / 2 - 50, y + 6);
      doc.text(`Issue Date: ${data.slc.issueDate}`, margin + contentWidth - 140, y + 6, { align: 'right', width: 130 });
      y += 30;

      // 18 Formal SLC Items Grid
      const fields = [
        { num: '1.', label: 'Name of the Pupil', value: data.slc.studentName.toUpperCase() },
        { num: '2.', label: "Father's / Guardian's Name", value: (data.slc.fatherName || 'N/A').toUpperCase() },
        { num: '3.', label: "Mother's Name", value: (data.slc.motherName || 'N/A').toUpperCase() },
        { num: '4.', label: 'Nationality', value: data.slc.nationality || 'Indian' },
        { num: '5.', label: 'Whether Candidate belongs to SC / ST / OBC / General', value: data.slc.category || 'General' },
        { num: '6.', label: 'Date of First Admission in the School with Class', value: `${data.slc.admissionDate} in Class ${data.slc.classAdmitted}` },
        { num: '7.', label: 'Date of Birth (in Christian Era)', value: data.slc.dateOfBirth },
        { num: '8.', label: 'Class in which Pupil Last Studied', value: data.slc.classLastStudied },
        { num: '9.', label: 'School / Board Annual Examination Last Taken', value: `Promoted/Completed Class ${data.slc.classLastStudied}` },
        { num: '10.', label: 'Whether Failed, If So Once / Twice in Same Class', value: 'No' },
        { num: '11.', label: 'Subjects Studied', value: 'English, Hindi, Mathematics, Science, Social Science' },
        { num: '12.', label: 'Whether Qualified for Promotion to Higher Class', value: 'Yes, Qualified' },
        { num: '13.', label: 'Month up to which Pupil has Paid School Dues', value: data.slc.feeDuesStatus },
        { num: '14.', label: 'Any Fee Concession Availed (Nature of Concession)', value: 'None' },
        { num: '15.', label: 'Total Number of Working Days in the Academic Session', value: '210 Days' },
        { num: '16.', label: 'General Conduct', value: data.slc.conduct || 'Good' },
        { num: '17.', label: 'Date of Application for Certificate / Leaving', value: data.slc.leavingDate },
        { num: '18.', label: 'Reason for Leaving the School', value: data.slc.reasonForLeaving || 'Parent Request / Relocation' }
      ];

      fields.forEach((f, idx) => {
        const rowH = 19;
        const isEven = idx % 2 === 0;

        if (isEven) {
          doc.rect(margin, y, contentWidth, rowH).fillColor('#f8fafc').fill();
        }
        doc.rect(margin, y, contentWidth, rowH).lineWidth(0.4).strokeColor('#e2e8f0').stroke();

        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
        doc.text(f.num, margin + 8, y + 5, { width: 20 });
        doc.text(f.label, margin + 28, y + 5, { width: 235 });

        doc.fillColor('#0f172a').font('Helvetica-Bold');
        doc.text(f.value, margin + 270, y + 5, { width: contentWidth - 278, ellipsis: true });

        y += rowH;
      });

      // 3 Signatures: Class Teacher, Checked By, Principal
      const sigY = pageHeight - margin - 45;
      const sigWidth = 120;
      const sigSpacing = (contentWidth - sigWidth * 3) / 2;

      const sigs = [
        { title: 'Class Teacher', x: margin },
        { title: 'Checked By (Office)', x: margin + sigWidth + sigSpacing },
        { title: 'Principal (With Seal)', x: margin + (sigWidth + sigSpacing) * 2 }
      ];

      sigs.forEach(s => {
        doc.strokeColor('#94a3b8').lineWidth(0.8).moveTo(s.x, sigY).lineTo(s.x + sigWidth, sigY).stroke();
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(s.title, s.x, sigY + 5, { align: 'center', width: sigWidth });
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// -------------------------------------------------------------
// 3. Multi-page Tabular Report PDF Generator (Landscape)
// -------------------------------------------------------------
export function generateReportPdf(data: ReportPdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 28,
        bufferPages: true,
        info: {
          Title: data.title,
          Author: data.school.name,
          Subject: 'Management Information System Report'
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width; // 841.89 pt
      const pageHeight = doc.page.height; // 595.28 pt
      const margin = 28;
      const contentWidth = pageWidth - margin * 2;

      // Draw Header on first page
      let y = drawHeader(doc, data.school, margin, margin, contentWidth, true);

      // Report Title Banner
      doc.rect(margin, y, contentWidth, 20).fillColor('#1e1b4b').fill();
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
      doc.text(data.title.toUpperCase(), margin, y + 5, { align: 'center', width: contentWidth });
      y += 24;

      // Subtitle & Session Details
      if (data.subtitle || data.sessionName || data.generatedBy) {
        doc.fillColor('#475569').fontSize(7.8).font('Helvetica');
        const details = [
          data.subtitle ? data.subtitle : '',
          data.sessionName ? `Session: ${data.sessionName}` : '',
          data.generatedBy ? `Generated By: ${data.generatedBy}` : '',
          `Date: ${new Date().toLocaleString('en-IN')}`
        ].filter(Boolean).join('  |  ');

        doc.text(details, margin, y, { align: 'center', width: contentWidth });
        y += 12;
      }

      // KPI Summary Cards
      if (data.kpis && data.kpis.length > 0) {
        const kpiW = Math.min(180, (contentWidth - (data.kpis.length - 1) * 8) / data.kpis.length);
        data.kpis.forEach((kpi, idx) => {
          const kx = margin + idx * (kpiW + 8);
          doc.rect(kx, y, kpiW, 30).fillColor('#f8fafc').fill();
          doc.rect(kx, y, kpiW, 30).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

          doc.fillColor('#64748b').fontSize(6.8).font('Helvetica-Bold').text(kpi.label.toUpperCase(), kx + 6, y + 4);
          doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(kpi.value, kx + 6, y + 15);
        });
        y += 36;
      }

      // Scale Column Widths to fit contentWidth
      const totalRequestedW = data.columns.reduce((sum, c) => sum + c.width, 0);
      const scaleFactor = contentWidth / totalRequestedW;
      const scaledCols = data.columns.map(c => ({
        ...c,
        width: c.width * scaleFactor
      }));

      // Function to draw Table Header
      const drawTableHeader = (atY: number) => {
        doc.rect(margin, atY, contentWidth, 18).fillColor('#1e293b').fill();
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');

        let colX = margin;
        scaledCols.forEach(col => {
          doc.text(col.header, colX + 4, atY + 5, {
            width: col.width - 8,
            align: (col.align || 'left') as any
          });
          colX += col.width;
        });
        return atY + 18;
      };

      y = drawTableHeader(y);

      // Render Rows with Multi-Page support
      const rowHeight = 17;
      const bottomLimit = pageHeight - margin - 25;

      data.rows.forEach((row, index) => {
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          y = margin;
          y = drawHeader(doc, data.school, margin, margin, contentWidth, true);
          y = drawTableHeader(y);
        }

        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(margin, y, contentWidth, rowHeight).fillColor('#f8fafc').fill();
        }
        doc.rect(margin, y, contentWidth, rowHeight).lineWidth(0.3).strokeColor('#e2e8f0').stroke();

        doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');

        let colX = margin;
        scaledCols.forEach(col => {
          const rawVal = row[col.key];
          let valStr = '';
          if (rawVal !== null && rawVal !== undefined) {
            const isCurrency = (col as any).type === 'currency' || col.header.includes('(₹)') || (typeof rawVal === 'number' && ['amount', 'billed', 'collected', 'dues', 'pending', 'total', 'totalBilled', 'totalPaid', 'totalDue', 'totalAmount'].includes(col.key));
            if (isCurrency && typeof rawVal === 'number') {
              valStr = `Rs. ${rawVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else if ((col as any).type === 'number' && typeof rawVal === 'number') {
              valStr = rawVal.toLocaleString('en-IN');
            } else if ((col as any).type === 'date' && rawVal) {
              valStr = String(rawVal).split('T')[0];
            } else {
              valStr = String(rawVal);
            }
          }

          doc.text(valStr, colX + 4, y + 4, {
            width: col.width - 8,
            align: (col.align || 'left') as any,
            ellipsis: true
          });
          colX += col.width;
        });

        y += rowHeight;
      });

      // Render Totals Row if provided
      if (data.totals) {
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          y = drawTableHeader(margin);
        }

        doc.rect(margin, y, contentWidth, rowHeight + 2).fillColor('#e2e8f0').fill();
        doc.strokeColor('#0f172a').lineWidth(1).moveTo(margin, y).lineTo(margin + contentWidth, y).stroke();
        doc.strokeColor('#0f172a').lineWidth(1).moveTo(margin, y + rowHeight + 2).lineTo(margin + contentWidth, y + rowHeight + 2).stroke();

        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
        let colX = margin;
        scaledCols.forEach((col, idx) => {
          let rawTot = data.totals![col.key];
          let valStr = '';
          if (rawTot !== undefined && rawTot !== null) {
            const isCurrency = (col as any).type === 'currency' || col.header.includes('(₹)') || (typeof rawTot === 'number' && ['amount', 'billed', 'collected', 'dues', 'pending', 'total', 'totalBilled', 'totalPaid', 'totalDue', 'totalAmount'].includes(col.key));
            if (isCurrency && typeof rawTot === 'number') {
              valStr = `Rs. ${rawTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else if (typeof rawTot === 'number') {
              valStr = rawTot.toLocaleString('en-IN');
            } else {
              valStr = String(rawTot);
            }
          } else {
            valStr = idx === 0 ? 'TOTAL' : '';
          }

          doc.text(valStr, colX + 4, y + 5, {
            width: col.width - 8,
            align: (col.align || 'left') as any
          });
          colX += col.width;
        });
        y += rowHeight + 4;
      }

      // Add "Page X of Y" to all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
          .text(
            `Pragya Bharti Public School · ${data.title} · Page ${i + 1} of ${range.count} · Computer Generated Document`,
            margin,
            pageHeight - margin + 8,
            { align: 'center', width: contentWidth }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
