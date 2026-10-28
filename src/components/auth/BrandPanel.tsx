import React from 'react';
import {
  CreditCard,
  FileCheck2,
  TrendingDown,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import { SchoolLogo } from '../common/SchoolLogo.js';
import { BrandConfig, DEFAULT_SCHOOL_BG } from '../../config/logo.js';

interface BrandPanelProps {
  config: BrandConfig;
  logoUrl?: string | null;
  bgImageUrl?: string;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  fees: <CreditCard className="h-5 w-5 text-sky-300 shrink-0" />,
  receipts: <FileCheck2 className="h-5 w-5 text-emerald-300 shrink-0" />,
  dues: <TrendingDown className="h-5 w-5 text-amber-300 shrink-0" />,
  security: <ShieldCheck className="h-5 w-5 text-indigo-300 shrink-0" />
};

export const BrandPanel: React.FC<BrandPanelProps> = ({
  config,
  logoUrl,
  bgImageUrl = DEFAULT_SCHOOL_BG
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="hidden lg:flex lg:w-[50%] xl:w-[52%] flex-col justify-between p-10 xl:p-14 text-white relative overflow-hidden select-none bg-slate-900">
      {/* High-Resolution School Campus Background Photo */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-102"
        style={{
          backgroundImage: `url('${bgImageUrl}')`
        }}
      />

      {/* Atmospheric Brand Gradient Overlay ensuring perfect WCAG contrast while highlighting the school facade */}
      <div
        className="absolute inset-0 backdrop-blur-[0.5px]"
        style={{
          background: 'linear-gradient(150deg, rgba(15, 23, 42, 0.88) 0%, rgba(22, 39, 68, 0.82) 50%, rgba(15, 23, 42, 0.90) 100%)'
        }}
      />
      {/* Subtle Geometric Background Vector (CSS/SVG only - zero raster weight) */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden" aria-hidden="true">
        <svg
          className="absolute -top-24 -left-24 w-[600px] h-[600px] text-white/10"
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="300" cy="300" r="280" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
          <circle cx="300" cy="300" r="200" stroke="currentColor" strokeWidth="1" />
          <circle cx="300" cy="300" r="120" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <svg
          className="absolute -bottom-36 -right-36 w-[650px] h-[650px] text-sky-400/10"
          viewBox="0 0 650 650"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="325,40 600,560 50,560"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="8 6"
          />
          <circle cx="325" cy="380" r="150" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Ambient radial glows */}
        <div className="absolute top-1/4 right-10 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      {/* Top Header: Logo & School Identity */}
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 p-2 rounded-2xl bg-white shadow-xl shadow-black/20 flex items-center justify-center border border-white/60 shrink-0">
            <SchoolLogo size="lg" logoUrl={logoUrl} className="h-12 w-12 object-contain" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-amber-300 tracking-wide uppercase">
              <span>Official ERP Portal</span>
            </div>
            <h1 className="text-xl xl:text-2xl font-black tracking-tight text-white mt-1 leading-tight">
              {config.schoolName}
            </h1>
            <p className="text-xs font-medium text-slate-300 tracking-wide">
              {config.tagline}
            </p>
          </div>
        </div>

        {/* Short platform description */}
        <p className="text-sm text-slate-200/90 leading-relaxed max-w-lg mb-8 font-normal">
          {config.description}
        </p>

        {/* Feature Highlights List */}
        <div className="space-y-4 max-w-lg">
          {config.features.map((feature) => (
            <div
              key={feature.id}
              className="flex items-start gap-3.5 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs transition hover:bg-white/10 hover:border-white/20"
            >
              <div className="p-2 rounded-lg bg-white/10 border border-white/10 shrink-0">
                {FEATURE_ICONS[feature.id] || <CheckCircle className="h-5 w-5 text-sky-300" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-white tracking-wide">
                  {feature.title}
                </h3>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Line */}
      <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
        <span>© {currentYear} {config.schoolName}. All rights reserved.</span>
        <span className="font-semibold text-amber-300/90">Design By Chandan</span>
      </div>
    </div>
  );
};

export const CompactBrandHeader: React.FC<BrandPanelProps> = ({
  config,
  logoUrl
}) => {
  return (
    <div className="lg:hidden text-center mb-6 pt-1">
      <div className="inline-flex p-3 rounded-2xl bg-white shadow-md border border-slate-200/80 mb-3">
        <SchoolLogo size="lg" logoUrl={logoUrl} className="h-14 w-14 object-contain" />
      </div>
      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-snug">
        {config.schoolName}
      </h1>
      <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
        {config.tagline}
      </p>
    </div>
  );
};
