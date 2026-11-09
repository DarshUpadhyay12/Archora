import React from 'react';

interface ArchitectureBackgroundProps {
  imageSrc: string;
  fallbackSrc?: string;
  alt?: string;
  alignment?: 'right' | 'center' | 'left' | 'full';
  opacity?: number;
  className?: string;
}

export const ArchitectureBackground: React.FC<ArchitectureBackgroundProps> = ({
  imageSrc,
  fallbackSrc,
  alt = 'Architectural etching sketch',
  alignment = 'right',
  opacity = 0.20,
  className = '',
}) => {
  const [currentSrc, setCurrentSrc] = React.useState(imageSrc);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  const objectPosition = {
    right: 'object-right lg:object-[82%_center]',
    left: 'object-left lg:object-[18%_center]',
    center: 'object-center',
    full: 'object-center',
  }[alignment];

  // Mathematical feathered gradient mask:
  // Fades softly on all boundaries (top, bottom, left, right) to 100% transparent
  // Zero harsh borders, cut-offs, or boxes.
  const maskStyle: React.CSSProperties = {
    maskImage:
      alignment === 'right'
        ? 'radial-gradient(ellipse 65% 75% at 82% 50%, #000 15%, rgba(0, 0, 0, 0.65) 45%, rgba(0, 0, 0, 0.15) 70%, transparent 88%)'
        : alignment === 'left'
        ? 'radial-gradient(ellipse 65% 75% at 18% 50%, #000 15%, rgba(0, 0, 0, 0.65) 45%, rgba(0, 0, 0, 0.15) 70%, transparent 88%)'
        : 'radial-gradient(ellipse 65% 70% at 50% 50%, #000 20%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.15) 72%, transparent 90%)',
    WebkitMaskImage:
      alignment === 'right'
        ? 'radial-gradient(ellipse 65% 75% at 82% 50%, #000 15%, rgba(0, 0, 0, 0.65) 45%, rgba(0, 0, 0, 0.15) 70%, transparent 88%)'
        : alignment === 'left'
        ? 'radial-gradient(ellipse 65% 75% at 18% 50%, #000 15%, rgba(0, 0, 0, 0.65) 45%, rgba(0, 0, 0, 0.15) 70%, transparent 88%)'
        : 'radial-gradient(ellipse 65% 70% at 50% 50%, #000 20%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.15) 72%, transparent 90%)',
  };

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {/* Background Architectural Illustration with feathered mask */}
      <div className="absolute inset-0 w-full h-full" style={maskStyle}>
        <img
          src={currentSrc}
          alt={alt}
          onError={handleError}
          className={`w-full h-full object-cover mix-blend-multiply transition-opacity duration-700 ${objectPosition}`}
          style={{ opacity }}
        />
      </div>

      {/* Gentle full-width parchment gradient for flawless text readability with zero seams */}
      {alignment === 'right' && (
        <div
          className="absolute inset-0 w-full pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, #F3E5CF 0%, #F3E5CF 32%, rgba(243, 229, 207, 0.85) 55%, rgba(243, 229, 207, 0.25) 78%, transparent 100%)',
          }}
        />
      )}

      {alignment === 'left' && (
        <div
          className="absolute inset-0 w-full pointer-events-none"
          style={{
            background:
              'linear-gradient(270deg, #F3E5CF 0%, #F3E5CF 32%, rgba(243, 229, 207, 0.85) 55%, rgba(243, 229, 207, 0.25) 78%, transparent 100%)',
          }}
        />
      )}

      {/* Soft feather at the bottom to transition smoothly into following sections */}
      <div
        className="absolute inset-x-0 bottom-0 h-36 pointer-events-none"
        style={{
          background:
            'linear-gradient(0deg, #F3E5CF 0%, rgba(243, 229, 207, 0.8) 35%, transparent 100%)',
        }}
      />

      {/* Subtle soft feather at the top */}
      <div
        className="absolute inset-x-0 top-0 h-20 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, #F3E5CF 0%, rgba(243, 229, 207, 0.6) 40%, transparent 100%)',
        }}
      />
    </div>
  );
};
