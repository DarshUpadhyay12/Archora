import React from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { Button } from './Buttons';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`p-10 text-center rounded-3xl bg-cream/70 border border-dashed border-archBorder/80 max-w-lg mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-beige/60 border border-archBorder mx-auto flex items-center justify-center text-espresso mb-4">
        {icon || <Compass className="w-6 h-6" />}
      </div>
      <h4 className="text-lg font-serif font-semibold text-ink mb-1.5">{title}</h4>
      <p className="text-xs text-ink-muted max-w-sm mx-auto leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  subtext?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Synthesizing architectural analysis...',
  subtext = 'Consulting historical precedents & tectonic principles',
  className = '',
}) => {
  return (
    <div className={`p-12 text-center space-y-4 ${className}`}>
      <div className="relative w-12 h-12 mx-auto">
        <Loader2 className="w-12 h-12 animate-spin text-espresso/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-espresso rounded-full animate-ping" />
        </div>
      </div>
      <div>
        <p className="font-serif text-lg font-medium text-ink">{message}</p>
        <p className="text-xs text-ink-muted mt-1">{subtext}</p>
      </div>
    </div>
  );
};

