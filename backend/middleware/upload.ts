import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/index.js';

const documentDir = path.resolve(config.storagePath, 'documents');
const photoDir = path.resolve(config.storagePath, 'photos');

[documentDir, photoDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Document Upload Storage
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(documentDir)) {
      fs.mkdirSync(documentDir, { recursive: true });
    }
    cb(null, documentDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${cleanBase}_${uniqueSuffix}${ext}`);
  }
});

export const documentUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Student Photo Upload Storage (Max 200 KB, JPG/JPEG/PNG)
const photoStorage = multer.memoryStorage(); // keep in memory first to verify magic bytes before writing to disk

export const photoUpload = multer({
  storage: photoStorage,
  limits: {
    fileSize: 200 * 1024 // 200 KB strict limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png'];

    if (allowedMimes.includes(file.mimetype.toLowerCase()) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type. Only JPG, JPEG, and PNG files are accepted.'));
    }
  }
});

/**
 * Verify real magic bytes of an image buffer
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47 0D 0A 1A 0A
 */
export function verifyImageMagicBytes(buffer: Buffer): { isValid: boolean; extension: string; mime: string } {
  if (!buffer || buffer.length < 8) {
    return { isValid: false, extension: '', mime: '' };
  }

  // Check JPEG (FF D8 FF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, extension: '.jpg', mime: 'image/jpeg' };
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, extension: '.png', mime: 'image/png' };
  }

  return { isValid: false, extension: '', mime: '' };
}

export function savePhotoBuffer(buffer: Buffer, originalExt: string): string {
  if (!fs.existsSync(photoDir)) {
    fs.mkdirSync(photoDir, { recursive: true });
  }
  const cleanExt = originalExt.startsWith('.') ? originalExt : `.${originalExt}`;
  const filename = `student_photo_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${cleanExt}`;
  const filePath = path.join(photoDir, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/photos/${filename}`;
}
