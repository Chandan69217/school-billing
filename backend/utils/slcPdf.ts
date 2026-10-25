import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

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
    classLeaving: string;
    admissionDate: string;
    leavingDate: string;
    leavingReason: string;
    feeDuesStatus: string;
    conduct: string;
    remarks?: string;
  };
}

export async function generateSlcPdf(data: SlcPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36, // 0.5 inch margins
        info: {
          Title: `School Leaving Certificate - ${data.slc.studentName}`,
          Author: data.school.name,
          Subject: 'School Leaving Certificate / Transfer Certificate',
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const isDuplicate = Boolean(data.slc.isDuplicate || data.slc.reprintCount > 0);

      // Outer Decorative Border
      doc.lineWidth(2).strokeColor('#1e3a8a').rect(24, 24, doc.page.width - 48, doc.page.height - 48).stroke();
      doc.lineWidth(0.75).strokeColor('#3b82f6').rect(28, 28, doc.page.width - 56, doc.page.height - 56).stroke();

      // DUPLICATE Watermark if reprint
      if (isDuplicate) {
        doc.save();
        doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.fontSize(52).fillColor('#ef4444').fillOpacity(0.12);
        doc.text('DUPLICATE COPY', 80, doc.page.height / 2 - 20, { align: 'center' });
        doc.restore();
      }

      let y = 45;

      // Duplicate Badge at Top Right
      if (isDuplicate) {
        doc.rect(doc.page.width - 170, y - 5, 130, 20).fillAndStroke('#fee2e2', '#ef4444');
        doc.fillColor('#b91c1c').fontSize(9).font('Helvetica-Bold').text('DUPLICATE COPY', doc.page.width - 170, y, { width: 130, align: 'center' });
      }

      // School Header
      doc.fillOpacity(1.0);
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#1e3a8a').text(data.school.name.toUpperCase(), 40, y, { align: 'center' });
      y += 24;

      if (data.school.tagline) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#475569').text(data.school.tagline, 40, y, { align: 'center' });
        y += 14;
      }

      doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(data.school.address, 40, y, { align: 'center' });
      y += 12;

      const contactLine = [
        data.school.phone ? `Phone: ${data.school.phone}` : '',
        data.school.email ? `Email: ${data.school.email}` : '',
        data.school.affiliationNumber ? `Affiliation No.: ${data.school.affiliationNumber}` : '',
        data.school.schoolCode ? `School Code: ${data.school.schoolCode}` : ''
      ].filter(Boolean).join('  |  ');

      if (contactLine) {
        doc.fontSize(8).fillColor('#64748b').text(contactLine, 40, y, { align: 'center' });
        y += 16;
      }

      // Header Divider
      doc.lineWidth(1).strokeColor('#cbd5e1').moveTo(45, y).lineTo(doc.page.width - 45, y).stroke();
      y += 14;

      // Certificate Title Ribbon
      const titleBoxWidth = 320;
      const titleBoxX = (doc.page.width - titleBoxWidth) / 2;
      doc.roundedRect(titleBoxX, y, titleBoxWidth, 24, 4).fillAndStroke('#1e3a8a', '#1e40af');
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text('SCHOOL LEAVING CERTIFICATE', titleBoxX, y + 6, {
        width: titleBoxWidth,
        align: 'center'
      });
      y += 36;

      // Metadata Bar: Certificate No. and Issue Date
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1e293b');
      doc.text(`SLC No.: ${data.slc.certificateNumber}`, 45, y);
      doc.text(`Issue Date: ${data.slc.issueDate}`, doc.page.width - 200, y, { align: 'right' });
      y += 20;

      // Student Photo Box (Top-Right of details)
      const photoWidth = 72;
      const photoHeight = 88;
      const photoX = doc.page.width - 45 - photoWidth;
      const photoY = y;

      let photoDrawn = false;
      if (data.slc.photoUrl) {
        try {
          const relativeClean = data.slc.photoUrl.replace(/^\/uploads\//, '');
          const localPhotoPath = path.resolve(config.storagePath, relativeClean);
          if (fs.existsSync(localPhotoPath)) {
            doc.image(localPhotoPath, photoX, photoY, { width: photoWidth, height: photoHeight });
            doc.lineWidth(1).strokeColor('#cbd5e1').rect(photoX, photoY, photoWidth, photoHeight).stroke();
            photoDrawn = true;
          }
        } catch {
          photoDrawn = false;
        }
      }

      if (!photoDrawn) {
        doc.lineWidth(0.75).strokeColor('#cbd5e1').rect(photoX, photoY, photoWidth, photoHeight).stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('Student Photo\n(Affixed/Digital)', photoX + 4, photoY + 30, {
          width: photoWidth - 8,
          align: 'center'
        });
      }

      // Main Certificate Fields (Numbered in official board format)
      const contentWidth = doc.page.width - 90 - (photoWidth + 15);
      const items: Array<{ label: string; value: string }> = [
        { label: '1. Admission Number (G.R. No.)', value: data.slc.admissionNumber },
        { label: '2. Name of Student (in full)', value: data.slc.studentName.toUpperCase() },
        { label: '3. Father\'s / Guardian\'s Name', value: data.slc.fatherName },
        { label: '4. Mother\'s Name', value: data.slc.motherName },
        { label: '5. Nationality', value: data.slc.nationality || 'Indian' },
        { label: '6. Category / Caste', value: data.slc.category || 'General' },
        { label: '7. Date of Birth', value: data.slc.dateOfBirth },
        { label: '8. Class in which student was admitted', value: data.slc.classAdmitted },
        { label: '9. Date of first admission in the school', value: data.slc.admissionDate },
        { label: '10. Class in which the student last studied', value: data.slc.classLeaving },
        { label: '11. Date of student\'s leaving the school', value: data.slc.leavingDate },
        { label: '12. Reason for leaving the school', value: data.slc.leavingReason },
        { label: '13. School fee dues clearance status', value: data.slc.feeDuesStatus },
        { label: '14. General Conduct & Character', value: data.slc.conduct || 'Good' },
        { label: '15. Any other remarks / concessions', value: data.slc.remarks || 'None' }
      ];

      items.forEach((item, index) => {
        // Switch to full width after clearing the photo box height
        const isPastPhoto = (y > photoY + photoHeight + 10);
        const currentItemWidth = isPastPhoto ? doc.page.width - 90 : contentWidth;
        const currentLabelWidth = 240;
        const currentValueWidth = currentItemWidth - currentLabelWidth;

        // Background alternate row stripe
        if (index % 2 === 0) {
          doc.rect(42, y - 3, (isPastPhoto ? doc.page.width - 84 : currentItemWidth + 6), 19).fill('#f8fafc');
        }

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155').text(item.label, 45, y, {
          width: currentLabelWidth
        });

        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(item.value || 'N/A', 45 + currentLabelWidth, y, {
          width: currentValueWidth
        });

        y += 20;
      });

      y = Math.max(y + 15, doc.page.height - 130);

      // Declaration Statement
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#475569').text(
        'Certified that the above mentioned information is in accordance with the School Register and Records.',
        45,
        y,
        { width: doc.page.width - 90, align: 'center' }
      );
      y += 35;

      // Signature Blocks
      const sigWidth = 140;
      const leftSigX = 55;
      const centerSigX = (doc.page.width - sigWidth) / 2;
      const rightSigX = doc.page.width - 55 - sigWidth;

      doc.lineWidth(0.75).strokeColor('#94a3b8');
      doc.moveTo(leftSigX, y).lineTo(leftSigX + sigWidth, y).stroke();
      doc.moveTo(centerSigX, y).lineTo(centerSigX + sigWidth, y).stroke();
      doc.moveTo(rightSigX, y).lineTo(rightSigX + sigWidth, y).stroke();

      y += 5;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b');
      doc.text('Prepared / Checked By', leftSigX, y, { width: sigWidth, align: 'center' });
      doc.text('Class Teacher', centerSigX, y, { width: sigWidth, align: 'center' });
      doc.text('Principal / Head of Institution', rightSigX, y, { width: sigWidth, align: 'center' });

      y += 12;
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
      doc.text('(Office In-charge)', leftSigX, y, { width: sigWidth, align: 'center' });
      doc.text('(Signature)', centerSigX, y, { width: sigWidth, align: 'center' });
      doc.text('(School Seal & Signature)', rightSigX, y, { width: sigWidth, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
