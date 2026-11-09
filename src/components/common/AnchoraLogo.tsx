import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_WORDMARK } from '@/data/mockData';

interface AnchoraLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  linkToHome?: boolean;
}

export const AnchoraLogo: React.FC<AnchoraLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  linkToHome = true,
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Custom Vector Arch Logo */}
      <div className={`relative flex items-center justify-center ${iconSizes[size]} text-espresso transition-transform hover:scale-105 duration-200`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Outer Arch Vault */}
          <path
            d="M14 56V26C14 16.0589 22.0589 8 32 8C41.9411 8 50 16.0589 50 26V56"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner Arch Vault */}
          <path
            d="M23 56V28C23 23.0294 27.0294 19 32 19C36.9706 19 41 23.0294 41 28V56"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Keystone / Central Crown */}
          <path
            d="M30 11.5H34V18.5H30Z"
            fill="currentColor"
          />
          {/* Plinth Base Line */}
          <line
            x1="9"
            y1="56"
            x2="55"
            y2="56"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showText && (
        <span
          className={`font-serif tracking-tight text-ink font-semibold lowercase ${textSizes[size]}`}
          style={{ letterSpacing: '-0.02em' }}
        >
          {BRAND_WORDMARK}
        </span>
      )}
    </div>
  );

  if (linkToHome) {
    return (
      <Link to="/" className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso rounded-md">
        {content}
      </Link>
    );
  }

  return content;
};

export const ArchoraLogo = AnchoraLogo;
