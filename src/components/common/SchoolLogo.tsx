import React, { useState } from 'react';
import { DEFAULT_SCHOOL_LOGO, getSchoolLogo, SCHOOL_NAME, SCHOOL_SHORT_NAME } from '../../config/logo.js';

export interface SchoolLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  logoUrl?: string | null;
  alt?: string;
  showLabel?: boolean;
  withContainer?: boolean;
  containerClassName?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
  logoUrl,
  alt = `${SCHOOL_NAME} Emblem`,
  showLabel = false,
  withContainer = false,
  containerClassName = ''
}) => {
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = getSchoolLogo(logoUrl);

  const sizeDimensions = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
    '2xl': 'h-28 w-28'
  }[size];

  const finalImgClass = className || sizeDimensions;

  const logoElement = hasError ? (
    <div
      className={`${finalImgClass} rounded-full bg-linear-to-br from-indigo-700 via-indigo-900 to-slate-950 text-amber-300 font-extrabold flex items-center justify-center border border-amber-400/40 shadow-xs text-xs select-none`}
      title={SCHOOL_NAME}
    >
      {SCHOOL_SHORT_NAME}
    </div>
  ) : (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setHasError(true)}
      className={`${finalImgClass} object-contain shrink-0 select-none transition-transform hover:scale-105 duration-200`}
      style={{
        imageRendering: '-webkit-optimize-contrast',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))'
      }}
      loading="eager"
    />
  );

  if (withContainer) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${showLabel ? '' : 'shrink-0'}`}>
        <div
          className={`p-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-center backdrop-blur-xs ${containerClassName}`}
        >
          {logoElement}
        </div>
        {showLabel && (
          <div className="flex flex-col">
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
              {SCHOOL_NAME}
            </span>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 tracking-wider uppercase">
              Darkness to Light
            </span>
          </div>
        )}
      </div>
    );
  }

  if (showLabel) {
    return (
      <div className="inline-flex items-center gap-2.5 shrink-0">
        {logoElement}
        <div className="flex flex-col">
          <span className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
            {SCHOOL_NAME}
          </span>
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 tracking-wider uppercase">
            Darkness to Light
          </span>
        </div>
      </div>
    );
  }

  return logoElement;
};
