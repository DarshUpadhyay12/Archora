import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  hint,
  required,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-espresso">
          {label} {required && <span className="text-red-800">*</span>}
        </label>
        {hint && <span className="text-[11px] text-taupe">{hint}</span>}
      </div>

      <div>{children}</div>

      {error && (
        <p className="text-xs text-red-800 font-medium animate-fadeIn">
          {error}
        </p>
      )}
    </div>
  );
};

