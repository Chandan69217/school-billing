/**
 * Central Single Source of Truth for School Logo (Frontend)
 * Every UI component, modal, printable page, and document viewer
 * imports the logo path or helper function from this central module.
 */

export const DEFAULT_SCHOOL_LOGO = '/assets/images/school-logo.png';
export const DEFAULT_SCHOOL_BG = '/assets/images/school-campus-bg.jpg';

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

export interface BrandFeature {
  id: string;
  title: string;
  description: string;
}

export interface BrandConfig {
  schoolName: string;
  shortName: string;
  tagline: string;
  motto: string;
  description: string;
  features: BrandFeature[];
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  schoolName: 'Pragya Bharti Public School',
  shortName: 'PBPS',
  tagline: 'Nurturing Minds, Building Futures',
  motto: 'Darkness to Light',
  description: 'A simple and secure platform to manage student admissions, fee collection, receipts and reports for our school.',
  features: [
    {
      id: 'fees',
      title: 'Fast Fee Collection',
      description: 'Rapid point-of-sale fee collection with automated term & monthly calculations'
    },
    {
      id: 'receipts',
      title: 'Instant Official Receipts',
      description: 'Tamper-proof computer generated receipts with email delivery and print preview'
    },
    {
      id: 'dues',
      title: 'Live Dues & Ledger Tracking',
      description: 'Head-wise fee structure, sibling concessions, and real-time student ledger'
    },
    {
      id: 'security',
      title: 'Secure Role-Based Access',
      description: 'Granular permissions, comprehensive audit logs, and account lock protections'
    }
  ]
};

