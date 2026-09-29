import PDFDocument from 'pdfkit';

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
}

export function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Outer Border
      doc.rect(20, 20, 555, 802).lineWidth(1.5).strokeColor('#0f172a').stroke();
      doc.rect(24, 24, 547, 794).lineWidth(0.5).strokeColor('#94a3b8').stroke();

      // Header Banner
      doc.rect(25, 25, 545, 90).fillColor('#1e293b').fill();

      // School Info
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text(data.school.name.toUpperCase(), 40, 40, { align: 'center', width: 515 });

      if (data.school.tagline) {
        doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Oblique')
          .text(data.school.tagline, 40, 62, { align: 'center', width: 515 });
      }

      doc.fillColor('#cbd5e1').fontSize(8.5).font('Helvetica')
        .text(`${data.school.address} | Phone: ${data.school.phone} | Email: ${data.school.email}`, 40, 77, { align: 'center', width: 515 });

      if (data.school.registrationNumber) {
        doc.fillColor('#94a3b8').fontSize(8)
          .text(`Affiliation / Reg No: ${data.school.registrationNumber}`, 40, 92, { align: 'center', width: 515 });
      }

      // Title Box
      doc.rect(190, 125, 215, 24).fillColor('#0284c7').fill();
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
        .text('FEE PAYMENT RECEIPT', 190, 131, { align: 'center', width: 215 });

      // Receipt Meta (2 columns)
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text('Receipt No: ', 45, 165);
      doc.font('Helvetica').text(data.receiptNumber, 120, 165);

      doc.font('Helvetica-Bold').text('Date: ', 400, 165);
      doc.font('Helvetica').text(data.paymentDate, 440, 165);

      doc.font('Helvetica-Bold').text('Academic Session: ', 45, 180);
      doc.font('Helvetica').text(data.academicYear, 140, 180);

      doc.font('Helvetica-Bold').text('Payment Method: ', 400, 180);
      doc.font('Helvetica').text(data.paymentMethod, 490, 180);

      // Student Information Card
      doc.rect(40, 205, 515, 75).fillColor('#f8fafc').fill();
      doc.rect(40, 205, 515, 75).lineWidth(0.8).strokeColor('#e2e8f0').stroke();

      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text('STUDENT PARTICULARS', 50, 213);

      doc.fontSize(8.5).font('Helvetica-Bold').text('Student Name:', 50, 230);
      doc.font('Helvetica').text(data.student.name, 130, 230);

      doc.font('Helvetica-Bold').text('Admission No:', 320, 230);
      doc.font('Helvetica').text(data.student.admissionNumber, 400, 230);

      doc.font('Helvetica-Bold').text('Class & Section:', 50, 246);
      doc.font('Helvetica').text(`${data.student.className} - ${data.student.sectionName || 'N/A'} (Roll: ${data.student.rollNumber || 'N/A'})`, 130, 246);

      doc.font('Helvetica-Bold').text('Parent / Guardian:', 320, 246);
      doc.font('Helvetica').text(data.student.fatherName || 'Parent', 415, 246);

      doc.font('Helvetica-Bold').text('Contact Phone:', 50, 262);
      doc.font('Helvetica').text(data.student.phone || 'N/A', 130, 262);

      if (data.transactionRef) {
        doc.font('Helvetica-Bold').text('Transaction Ref:', 320, 262);
        doc.font('Helvetica').text(data.transactionRef, 410, 262);
      }

      // Fee Breakdown Table
      let tableY = 295;
      doc.rect(40, tableY, 515, 22).fillColor('#334155').fill();
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('#', 50, tableY + 6);
      doc.text('Fee Description', 80, tableY + 6);
      doc.text('Term / Cycle', 340, tableY + 6);
      doc.text('Amount (INR)', 470, tableY + 6, { width: 75, align: 'right' });

      tableY += 22;
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');

      data.items.forEach((item, index) => {
        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(40, tableY, 515, 20).fillColor('#f8fafc').fill();
        }
        doc.rect(40, tableY, 515, 20).lineWidth(0.4).strokeColor('#e2e8f0').stroke();

        doc.fillColor('#1e293b');
        doc.text((index + 1).toString(), 50, tableY + 5);
        doc.text(item.title, 80, tableY + 5);
        doc.text(item.month || 'Current Cycle', 340, tableY + 5);
        doc.text(`Rs. ${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 470, tableY + 5, { width: 75, align: 'right' });

        tableY += 20;
      });

      // Summary Totals Box
      tableY += 10;
      const summaryWidth = 240;
      const summaryX = 315;

      doc.rect(summaryX, tableY, summaryWidth, 90).fillColor('#f1f5f9').fill();
      doc.rect(summaryX, tableY, summaryWidth, 90).lineWidth(0.8).strokeColor('#cbd5e1').stroke();

      doc.fontSize(8.5).fillColor('#334155');

      doc.font('Helvetica').text('Gross Amount Due:', summaryX + 15, tableY + 12);
      doc.text(`Rs. ${Number(data.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + 130, tableY + 12, { align: 'right', width: 95 });

      doc.text('Previous Outstanding:', summaryX + 15, tableY + 28);
      doc.text(`Rs. ${Number(data.previousBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + 130, tableY + 28, { align: 'right', width: 95 });

      // Amount Paid row highlighted
      doc.rect(summaryX, tableY + 44, summaryWidth, 22).fillColor('#0284c7').fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('AMOUNT PAID NOW:', summaryX + 15, tableY + 51);
      doc.text(`Rs. ${Number(data.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + 130, tableY + 51, { align: 'right', width: 95 });

      // Balance Remaining
      doc.fillColor(data.remainingBalance > 0 ? '#b91c1c' : '#15803d').font('Helvetica-Bold');
      doc.text('Balance Outstanding:', summaryX + 15, tableY + 72);
      doc.text(`Rs. ${Number(data.remainingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + 130, tableY + 72, { align: 'right', width: 95 });

      // Notes & Signatures
      const notesY = tableY + 110;
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('PAYMENT ACKNOWLEDGEMENT & TERMS:', 40, notesY);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
        .text('1. Fees once paid are non-refundable except caution deposits as per school guidelines.', 40, notesY + 12)
        .text('2. Please retain this original receipt for academic records, transport verification and fee reconciliation.', 40, notesY + 23)
        .text('3. Cheques/Online transfers are subject to realization.', 40, notesY + 34);

      // Signatures
      const sigY = notesY + 65;
      doc.strokeColor('#94a3b8').lineWidth(0.8)
        .moveTo(40, sigY + 30).lineTo(180, sigY + 30).stroke()
        .moveTo(380, sigY + 30).lineTo(545, sigY + 30).stroke();

      doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
      doc.text(data.collectedBy || 'Cashier / Bursar', 40, sigY + 35);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Collected / Verified By', 40, sigY + 46);

      doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold').text(data.school.authorizedSignatory || 'Authorized Official', 380, sigY + 35, { align: 'right', width: 165 });
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(`For ${data.school.name || 'Pragya Bharti Public School (PBPS)'}`, 380, sigY + 46, { align: 'right', width: 165 });

      // Footer
      doc.rect(25, 785, 545, 30).fillColor('#f8fafc').fill();
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(25, 785).lineTo(570, 785).stroke();

      doc.fillColor('#64748b').fontSize(7).font('Helvetica')
        .text(data.school.receiptFooter || 'System Generated Digital Receipt. Pragya Bharti Public School (PBPS).', 40, 796, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
