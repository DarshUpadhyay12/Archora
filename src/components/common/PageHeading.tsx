import React from 'react';

interface PageHeadingProps {
  kicker?: string;
  title: string;
  description?: string;
  alignment?: 'left' | 'center' | 'right';
  className?: string;
  children?: React.ReactNode;
}

export const PageHeading: React.FC<PageHeadingProps> = ({
  kicker,
  title,
  description,
  alignment = 'left',
  className = '',
  children,
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  }[alignment];

  return (
    <div className={`space-y-3 ${alignClass} ${className}`}>
      {kicker && (
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-espresso/80 font-sans">
          {kicker}
        </p>
      )}

      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-medium text-ink tracking-tight leading-[1.12]">
        {title}
      </h1>

      {description && (
        <p className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl font-sans">
          {description}
        </p>
      )}

      {children && <div className="pt-2">{children}</div>}
    </div>
  );
};

