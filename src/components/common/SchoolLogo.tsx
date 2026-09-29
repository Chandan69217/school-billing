import React from 'react';

interface SchoolLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'crest' | 'shield' | 'icon';
  showLabel?: boolean;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = 'h-10 w-10',
  size,
  variant = 'crest',
  showLabel = false,
}) => {
  const sizeClasses = size
    ? {
        xs: 'h-6 w-6',
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-14 w-14',
        xl: 'h-20 w-20',
      }[size]
    : className;

  return (
    <div className={`inline-flex items-center gap-2.5 ${showLabel ? '' : 'shrink-0'}`}>
      <svg
        viewBox="0 0 200 200"
        className={`${sizeClasses} shrink-0 select-none drop-shadow-sm`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Pragya Bharti Public School (PBPS) Logo"
      >
        <defs>
          {/* Background Radial Gradient */}
          <radialGradient id="slBgGrad" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stop-color="#1e1b4b" />
            <stop offset="65%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </radialGradient>

          {/* Premium Gold Gradient */}
          <linearGradient id="slGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="30%" stop-color="#f59e0b" />
            <stop offset="70%" stop-color="#d97706" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>

          {/* Sun & Light Gradient */}
          <linearGradient id="slSunGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#ea580c" />
            <stop offset="50%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#fef08a" />
          </linearGradient>
        </defs>

        {/* Outer Circular Medallion */}
        <circle cx="100" cy="100" r="95" fill="url(#slBgGrad)" stroke="url(#slGoldGrad)" strokeWidth="4.5" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3.5,3.5" opacity="0.8" />
        <circle cx="100" cy="100" r="82" fill="none" stroke="url(#slGoldGrad)" strokeWidth="2" />

        {/* Circular School Name Top Arc */}
        <path id="slTopTextArc" d="M 28 100 A 72 72 0 0 1 172 100" fill="none" />
        <text
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontSize="10"
          fontWeight="800"
          fill="#fef08a"
          letterSpacing="2.2"
        >
          <textPath href="#slTopTextArc" startOffset="50%" textAnchor="middle">
            PRAGYA BHARTI PUBLIC SCHOOL
          </textPath>
        </text>

        {/* Inner Shield Ring */}
        <circle cx="100" cy="108" r="54" fill="#0f172a" stroke="url(#slGoldGrad)" strokeWidth="2.5" />

        {/* Rays of Wisdom / Pragya */}
        <g opacity="0.85">
          <line x1="100" y1="92" x2="100" y2="62" stroke="url(#slSunGrad)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="84" y1="94" x2="71" y2="69" stroke="url(#slSunGrad)" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="116" y1="94" x2="129" y2="69" stroke="url(#slSunGrad)" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="71" y1="101" x2="52" y2="83" stroke="url(#slSunGrad)" strokeWidth="2" strokeLinecap="round" />
          <line x1="129" y1="101" x2="148" y2="83" stroke="url(#slSunGrad)" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Radiant Sun of Enlightenment */}
        <circle cx="100" cy="104" r="17" fill="url(#slSunGrad)" />

        {/* Open Academic Book */}
        <g transform="translate(0, 15)">
          <path
            d="M 100 95 C 90 92, 74 91, 62 95 C 60 96, 59 98, 59 101 L 59 122 C 73 118, 89 119, 100 124 C 111 119, 127 118, 141 122 L 141 101 C 141 98, 140 96, 138 95 C 126 91, 110 92, 100 95 Z"
            fill="#f8fafc"
            stroke="#334155"
            strokeWidth="1.2"
          />
          <path d="M 100 98 C 91 95, 77 94, 63 98 L 63 119 C 75 116, 89 116, 100 121 Z" fill="#f1f5f9" />
          <line x1="68" y1="104" x2="94" y2="101" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="68" y1="109" x2="94" y2="106" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="68" y1="114" x2="92" y2="111" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

          <path d="M 100 98 C 109 95, 123 94, 137 98 L 137 119 C 125 116, 111 116, 100 121 Z" fill="#e2e8f0" />
          <line x1="106" y1="101" x2="132" y2="104" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="106" y1="106" x2="132" y2="109" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="108" y1="111" x2="132" y2="114" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="100" y1="95" x2="100" y2="124" stroke="#d97706" strokeWidth="2.5" />
          <path d="M 100 124 L 98 131 L 100 129 L 102 131 Z" fill="#d97706" />
        </g>

        {/* Laurel Wreath */}
        <g fill="url(#slGoldGrad)">
          <ellipse cx="44" cy="98" rx="4.5" ry="2.2" transform="rotate(-35 44 98)" />
          <ellipse cx="40" cy="110" rx="4.8" ry="2.3" transform="rotate(-15 40 110)" />
          <ellipse cx="41" cy="122" rx="4.8" ry="2.3" transform="rotate(10 41 122)" />
          <ellipse cx="47" cy="134" rx="4.8" ry="2.3" transform="rotate(35 47 134)" />

          <ellipse cx="156" cy="98" rx="4.5" ry="2.2" transform="rotate(35 156 98)" />
          <ellipse cx="160" cy="110" rx="4.8" ry="2.3" transform="rotate(15 160 110)" />
          <ellipse cx="159" cy="122" rx="4.8" ry="2.3" transform="rotate(-10 159 122)" />
          <ellipse cx="153" cy="134" rx="4.8" ry="2.3" transform="rotate(-35 153 134)" />
        </g>

        {/* Ribbon with PBPS */}
        <g>
          <path d="M 36 166 L 50 150 L 50 172 Z" fill="#92400e" />
          <path d="M 30 166 L 46 150 L 46 172 Z" fill="#b45309" />
          <path d="M 164 166 L 150 150 L 150 172 Z" fill="#92400e" />
          <path d="M 170 166 L 154 150 L 154 172 Z" fill="#b45309" />

          <path
            d="M 44 154 Q 100 146 156 154 L 152 176 Q 100 168 48 176 Z"
            fill="url(#slGoldGrad)"
            stroke="#78350f"
            strokeWidth="1.2"
          />

          <text
            x="100"
            y="170"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontSize="16"
            fontWeight="900"
            fill="#0f172a"
            textAnchor="middle"
            letterSpacing="3.5"
          >
            PBPS
          </text>
        </g>

        {/* Bottom Arc Stars & Subtitle */}
        <path id="slBottomTextArc" d="M 60 186 A 78 78 0 0 0 140 186" fill="none" />
        <text
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontSize="7.5"
          fontWeight="700"
          fill="#fef08a"
          letterSpacing="2"
        >
          <textPath href="#slBottomTextArc" startOffset="50%" textAnchor="middle">
            ★ ESTD · EXCELLENCE ★
          </textPath>
        </text>
      </svg>

      {showLabel && (
        <div className="min-w-0">
          <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight truncate">
            PBPS
          </span>
          <span className="text-[11px] font-medium text-slate-500 block truncate">
            Pragya Bharti Public School
          </span>
        </div>
      )}
    </div>
  );
};
