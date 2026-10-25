/**
 * Central Single Source of Truth for School Logo (Frontend)
 * Every UI component, modal, printable page, and document viewer
 * imports the logo path or helper function from this central module.
 */

export const DEFAULT_SCHOOL_LOGO = '/assets/images/school-logo.png';

/**
 * Returns the active school logo URL.
 * If a custom logo has been uploaded to School Settings (and is valid),
 * it returns that URL. Otherwise it falls back to the default PNG emblem.
 */
export function getSchoolLogo(customLogoUrl?: string | null): string {
  if (!customLogoUrl || customLogoUrl.trim() === '' || customLogoUrl === '/school-logo.svg') {
    return DEFAULT_SCHOOL_LOGO;
  }
  return customLogoUrl;
}

export const SCHOOL_NAME = 'Pragya Bharti Public School';
export const SCHOOL_SHORT_NAME = 'PBPS';
export const SCHOOL_MOTTO = 'Darkness to Light';
