/**
 * Central Single Source of Truth for School Logo (Backend)
 * Reads and caches the official school PNG emblem for embedding
 * directly into PDFKit documents, ExcelJS spreadsheets, and email templates.
 */

import fs from 'fs';
import path from 'path';

export const DEFAULT_LOGO_RELATIVE_PATH = '/assets/images/school-logo.png';
export const DEFAULT_LOGO_DISK_PATH = path.resolve(process.cwd(), 'public/assets/images/school-logo.png');

interface LogoCache {
  buffer: Buffer;
  base64: string;
  dataUri: string;
  mtime: number;
}

let defaultLogoCache: LogoCache | null = null;
const customLogoCache = new Map<string, LogoCache>();

/**
 * Loads and returns the raw Buffer of the school logo.
 * If customLogoUrl is provided and exists on disk, it uses that;
 * otherwise it returns the default school emblem PNG buffer.
 * Caches in memory for fast repeat document rendering.
 */
export function getSchoolLogoBuffer(customLogoUrl?: string | null): Buffer {
  // If custom logo exists on disk in uploads or public
  if (customLogoUrl && customLogoUrl.trim() !== '' && customLogoUrl !== '/school-logo.svg' && customLogoUrl !== DEFAULT_LOGO_RELATIVE_PATH) {
    const cleanUrl = customLogoUrl.startsWith('/') ? customLogoUrl.slice(1) : customLogoUrl;
    const possiblePaths = [
      path.resolve(process.cwd(), cleanUrl),
      path.resolve(process.cwd(), "public", cleanUrl),
    ];

    for(const customDiskPath of possiblePaths){
      if (!fs.existsSync(customDiskPath)) {
        continue;
      }

      try {
        const stats = fs.statSync(customDiskPath);
        const cached = customLogoCache.get(customDiskPath);
        if (cached && cached.mtime === stats.mtimeMs) {
          return cached.buffer;
        }

        const buf = fs.readFileSync(customDiskPath);
        const b64 = buf.toString('base64');
        const ext = path.extname(customDiskPath).toLowerCase().replace('.', '') || 'png';
        customLogoCache.set(customDiskPath, {
          buffer: buf,
          base64: b64,
          dataUri: `data:image/${ext};base64,${b64}`,
          mtime: stats.mtimeMs
        });
        return buf;
      } catch (err) {
        console.warn(`[Logo] Failed reading custom logo at ${customDiskPath}, falling back to default`, err);
      }

    }
    
  }

  // Fallback to default school logo PNG
  try {
    if (fs.existsSync(DEFAULT_LOGO_DISK_PATH)) {
      const stats = fs.statSync(DEFAULT_LOGO_DISK_PATH);
      if (defaultLogoCache && defaultLogoCache.mtime === stats.mtimeMs) {
        return defaultLogoCache.buffer;
      }

      const buf = fs.readFileSync(DEFAULT_LOGO_DISK_PATH);
      const b64 = buf.toString('base64');
      defaultLogoCache = {
        buffer: buf,
        base64: b64,
        dataUri: `data:image/png;base64,${b64}`,
        mtime: stats.mtimeMs
      };
      return buf;
    }
  } catch (err) {
    console.error(`[Logo] Error reading default logo at ${DEFAULT_LOGO_DISK_PATH}:`, err);
  }

  // Secondary fallback: check public/assets/aistudio/...
  const aistudioPath = path.resolve(process.cwd(), 'public/assets/aistudio/Pragya_Bharti_School_Emblem_07788460.png');
  if (fs.existsSync(aistudioPath)) {
    return fs.readFileSync(aistudioPath);
  }

  return Buffer.from('');
}

/**
 * Returns the Base64 string of the active school logo (suitable for embedding or offline HTML)
 */
export function getSchoolLogoBase64(customLogoUrl?: string | null): string {
  getSchoolLogoBuffer(customLogoUrl); // ensure cache populated
  if (defaultLogoCache) {
    return defaultLogoCache.base64;
  }
  return '';
}

/**
 * Returns the Data URI (data:image/png;base64,...) of the active school logo
 */
export function getSchoolLogoDataUri(customLogoUrl?: string | null): string {
  getSchoolLogoBuffer(customLogoUrl);
  if (defaultLogoCache) {
    return defaultLogoCache.dataUri;
  }
  return '';
}

/**
 * Invalidates the in-memory logo cache when a new logo is uploaded in School Settings.
 */
export function clearLogoCache(): void {
  defaultLogoCache = null;
  customLogoCache.clear();
}
