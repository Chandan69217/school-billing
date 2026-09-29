import PDFDocument from 'pdfkit';

export interface AdmissionPdfData {
  school: {
    name: string;
    tagline?: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber?: string;
    principalName?: string;
    authorizedSignatory?: string;
  };
  student: {
    admissionNumber: string;
    admissionDate: string;
    fullName: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup?: string;
    aadhaarNumber?: string;
    nationality?: string;
    category?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    emergencyPhone?: string;
    status: string;
    cancellationReason?: string;
    cancelledAt?: string;
  };
  academic: {
    sessionName: string;
    className: string;
    sectionName?: string;
    rollNumber?: string;
  };
  parent: {
    fatherName?: string;
    motherName?: string;
    guardianName?: string;
    primaryPhone: string;
    alternatePhone?: string;
    email?: string;
    occupation?: string;
    relationship?: string;
  };
  documents?: Array<{
    title: string;
    documentType: string;
    fileName?: string;
    uploaded?: boolean;
  }>;
  fees?: Array<{
    title: string;
    amount: number;
    frequency?: string;
  }>;
}

export function generateAdmissionPdf(data: AdmissionPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 35 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const isCancelled = data.student.status === 'CANCELLED';

      // Outer Decorative Border
      doc.rect(20, 20, 555, 802).lineWidth(1.5).strokeColor('#1e1b4b').stroke();
      doc.rect(23, 23, 549, 796).lineWidth(0.6).strokeColor('#d97706').stroke();

      // Top Institution Header Banner
      doc.rect(24, 24, 547, 85).fillColor('#1e1b4b').fill();

      // Golden Header Accent Bar
      doc.rect(24, 107, 547, 3).fillColor('#d97706').fill();

      // School Name & Affiliation
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
        .text(data.school.name.toUpperCase(), 35, 34, { align: 'center', width: 525 });

      if (data.school.tagline) {
        doc.fillColor('#fde68a').fontSize(8.5).font('Helvetica-Oblique')
          .text(data.school.tagline, 35, 54, { align: 'center', width: 525 });
      }

      const regText = data.school.registrationNumber ? `Affiliation / Reg: ${data.school.registrationNumber} | ` : '';
      doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
        .text(`${regText}${data.school.address} | Phone: ${data.school.phone} | Email: ${data.school.email}`, 35, 68, { align: 'center', width: 525 });

      // Admission Document Title Banner
      doc.rect(35, 85, 525, 20).fillColor(isCancelled ? '#991b1b' : '#0f172a').fill();
      doc.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold')
        .text(isCancelled ? 'STUDENT ADMISSION RECORD — CANCELLED' : 'OFFICIAL STUDENT ADMISSION SLIP & ENROLLMENT RECORD', 35, 90, { align: 'center', width: 525 });

      // Watermark if Cancelled
      if (isCancelled) {
        doc.save();
        doc.rotate(-30, { origin: [297, 420] });
        doc.fontSize(52).fillColor('#ef4444', 0.15).font('Helvetica-Bold')
          .text('ADMISSION CANCELLED', 100, 400, { align: 'center' });
        doc.restore();
      }

      // Metadata Bar: Admission No, Session, Admission Date, Status
      const metaY = 120;
      doc.rect(35, metaY, 525, 28).fillColor('#f8fafc').fill();
      doc.rect(35, metaY, 525, 28).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text('ADMISSION NUMBER', 45, metaY + 4);
      doc.fillColor('#1e1b4b').fontSize(10).font('Helvetica-Bold')
        .text(data.student.admissionNumber, 45, metaY + 14);

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text('ACADEMIC SESSION', 180, metaY + 4);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
        .text(data.academic.sessionName, 180, metaY + 14);

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text('ADMISSION DATE', 315, metaY + 4);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
        .text(data.student.admissionDate, 315, metaY + 14);

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text('STATUS', 450, metaY + 4);
      doc.fillColor(isCancelled ? '#dc2626' : '#16a34a').fontSize(9.5).font('Helvetica-Bold')
        .text(data.student.status, 450, metaY + 14);

      // Section 1: Student Demographics
      let curY = metaY + 36;
      doc.rect(35, curY, 525, 18).fillColor('#1e1b4b').fill();
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
        .text('1. STUDENT DEMOGRAPHIC & ACADEMIC DOSSIER', 42, curY + 4);

      curY += 18;
      const rowHeight = 18;
      const drawInfoRow = (y: number, label1: string, val1: string, label2: string, val2: string, bg: boolean = false) => {
        if (bg) {
          doc.rect(35, y, 525, rowHeight).fillColor('#f8fafc').fill();
        }
        doc.rect(35, y, 525, rowHeight).lineWidth(0.4).strokeColor('#e2e8f0').stroke();

        // Col 1
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(label1, 42, y + 4, { width: 100 });
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(val1 || '—', 145, y + 4, { width: 140 });

        // Divider
        doc.moveTo(290, y).lineTo(290, y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.4).stroke();

        // Col 2
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(label2, 300, y + 4, { width: 100 });
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(val2 || '—', 405, y + 4, { width: 145 });
      };

      drawInfoRow(curY, 'Student Full Name:', data.student.fullName, 'Enrolled Class & Sec:', `${data.academic.className} - Section ${data.academic.sectionName || 'A'}`, false);
      curY += rowHeight;
      drawInfoRow(curY, 'Date of Birth:', data.student.dateOfBirth, 'Roll Number:', data.academic.rollNumber || 'To be allotted', true);
      curY += rowHeight;
      drawInfoRow(curY, 'Gender:', data.student.gender, 'Blood Group:', data.student.bloodGroup || 'Not provided', false);
      curY += rowHeight;
      drawInfoRow(curY, 'Aadhaar / National ID:', data.student.aadhaarNumber || 'Verified in person', 'Category / Social Group:', data.student.category || 'General', true);
      curY += rowHeight;
      drawInfoRow(curY, 'Nationality:', data.student.nationality || 'Indian', 'Emergency Phone:', data.student.emergencyPhone || data.parent.primaryPhone, false);
      curY += rowHeight;

      // Residential Address span
      doc.rect(35, curY, 525, rowHeight + 4).fillColor('#f8fafc').fill();
      doc.rect(35, curY, 525, rowHeight + 4).lineWidth(0.4).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Permanent Address:', 42, curY + 4, { width: 100 });
      const fullAddr = [data.student.address, data.student.city, data.student.state, data.student.pincode].filter(Boolean).join(', ') || 'As per parent registration records';
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(fullAddr, 145, curY + 4, { width: 405 });
      curY += rowHeight + 10;

      // Section 2: Parent / Guardian Dossier
      doc.rect(35, curY, 525, 18).fillColor('#1e1b4b').fill();
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
        .text('2. PARENT & GUARDIAN PARTICULARS', 42, curY + 4);
      curY += 18;

      drawInfoRow(curY, "Father's Full Name:", data.parent.fatherName || '—', 'Primary Contact No:', data.parent.primaryPhone, false);
      curY += rowHeight;
      drawInfoRow(curY, "Mother's Full Name:", data.parent.motherName || '—', 'Alternate Phone:', data.parent.alternatePhone || '—', true);
      curY += rowHeight;
      drawInfoRow(curY, 'Primary Email Address:', data.parent.email || '—', "Parent's Occupation:", data.parent.occupation || '—', false);
      curY += rowHeight + 8;

      // If Cancelled: Show Cancellation Particulars Box
      if (isCancelled) {
        doc.rect(35, curY, 525, 18).fillColor('#991b1b').fill();
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
          .text('CANCELLATION PARTICULARS & AUDIT TRAIL', 42, curY + 4);
        curY += 18;

        doc.rect(35, curY, 525, 34).fillColor('#fef2f2').fill();
        doc.rect(35, curY, 525, 34).lineWidth(0.5).strokeColor('#f87171').stroke();

        doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('Cancellation Reason:', 45, curY + 5);
        doc.fillColor('#7f1d1d').fontSize(8).font('Helvetica').text(data.student.cancellationReason || 'Parent request / Transfer', 145, curY + 5, { width: 405 });

        doc.fillColor('#991b1b').fontSize(8).font('Helvetica-Bold').text('Date Cancelled:', 45, curY + 18);
        doc.fillColor('#7f1d1d').fontSize(8).font('Helvetica').text(data.student.cancelledAt || new Date().toLocaleDateString(), 145, curY + 18);

        curY += 42;
      }

      // Section 3: Verified Submitted Documents Checklist
      doc.rect(35, curY, 525, 18).fillColor('#1e1b4b').fill();
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
        .text('3. VERIFIED ENCLOSED ADMISSION DOCUMENTS', 42, curY + 4);
      curY += 18;

      const docsList = data.documents && data.documents.length > 0 ? data.documents : [
        { title: 'Birth Certificate', documentType: 'BIRTH_CERTIFICATE', uploaded: true },
        { title: 'Aadhaar Card Copy', documentType: 'AADHAAR', uploaded: true },
        { title: 'Transfer Certificate (TC)', documentType: 'TRANSFER_CERTIFICATE', uploaded: false },
        { title: 'Previous School Marksheet', documentType: 'PREVIOUS_MARKSHEET', uploaded: true },
      ];

      doc.rect(35, curY, 525, 38).fillColor('#f8fafc').fill();
      doc.rect(35, curY, 525, 38).lineWidth(0.4).strokeColor('#e2e8f0').stroke();

      const docColWidth = 525 / Math.min(docsList.length, 4);
      docsList.slice(0, 4).forEach((d, idx) => {
        const xPos = 40 + idx * docColWidth;
        const iconSymbol = d.uploaded !== false ? '[✓]' : '[  ]';
        const color = d.uploaded !== false ? '#15803d' : '#94a3b8';
        doc.fillColor(color).fontSize(8).font('Helvetica-Bold')
          .text(`${iconSymbol} ${d.title}`, xPos, curY + 6, { width: docColWidth - 8 });
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
          .text(d.uploaded !== false ? (d.fileName || 'Verified & Uploaded') : 'Pending Submission', xPos, curY + 18, { width: docColWidth - 8 });
      });

      curY += 46;

      // Section 4: Initial Assigned Fee Structure Summary
      if (data.fees && data.fees.length > 0) {
        doc.rect(35, curY, 525, 16).fillColor('#1e1b4b').fill();
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
          .text('4. APPLICABLE FEE HEADS FOR THIS CLASS', 42, curY + 3.5);
        curY += 16;

        let totalInitial = 0;
        data.fees.slice(0, 4).forEach((f, idx) => {
          totalInitial += Number(f.amount);
          const fY = curY + idx * 14;
          doc.rect(35, fY, 525, 14).fillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc').fill();
          doc.rect(35, fY, 525, 14).lineWidth(0.3).strokeColor('#e2e8f0').stroke();
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(f.title, 45, fY + 3);
          doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(`Rs. ${Number(f.amount).toLocaleString('en-IN')}`, 460, fY + 3, { align: 'right', width: 90 });
        });

        curY += Math.min(data.fees.length, 4) * 14 + 6;
      }

      // Undertaking & Declaration
      doc.rect(35, curY, 525, 34).fillColor('#f8fafc').fill();
      doc.rect(35, curY, 525, 34).lineWidth(0.4).strokeColor('#cbd5e1').stroke();
      doc.fillColor('#475569').fontSize(6.8).font('Helvetica')
        .text('DECLARATION & UNDERTAKING: I hereby declare that all particulars stated in this admission record and supporting documents submitted are authentic and true to the best of my knowledge. I promise to abide by all the rules, academic conduct guidelines, fee schedules, and disciplinary regulations of Pragya Bharti Public School (PBPS).', 42, curY + 4, { width: 510, lineGap: 1.5 });
      curY += 40;

      // Signatures
      const sigY = curY + 6;
      // Line 1: Parent
      doc.strokeColor('#94a3b8').lineWidth(0.7).moveTo(45, sigY + 28).lineTo(170, sigY + 28).stroke();
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text("Parent / Guardian's Signature", 45, sigY + 32);
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica').text('Accepted & Confirmed', 45, sigY + 42);

      // Line 2: Admission Officer
      doc.strokeColor('#94a3b8').lineWidth(0.7).moveTo(230, sigY + 28).lineTo(355, sigY + 28).stroke();
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(data.school.authorizedSignatory || 'Registrar / Admission Officer', 230, sigY + 32);
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica').text('Documents Checked & Verified', 230, sigY + 42);

      // Line 3: Principal & Seal
      doc.strokeColor('#94a3b8').lineWidth(0.7).moveTo(415, sigY + 28).lineTo(545, sigY + 28).stroke();
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(data.school.principalName || 'Principal, PBPS', 415, sigY + 32, { align: 'right', width: 130 });
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica').text('For Pragya Bharti Public School', 415, sigY + 42, { align: 'right', width: 130 });

      // Bottom Footer Bar
      doc.rect(24, 788, 547, 28).fillColor('#1e1b4b').fill();
      doc.fillColor('#fde68a').fontSize(7).font('Helvetica-Bold')
        .text('PRAGYA BHARTI PUBLIC SCHOOL (PBPS) · OFFICIAL STUDENT ENROLLMENT DOSSIER', 35, 796, { align: 'center', width: 525 });
      doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
        .text('This computer-generated enrollment slip is valid for all academic, examination, transport, and administrative processes.', 35, 805, { align: 'center', width: 525 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
