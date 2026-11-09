import React from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Compass, 
  Award, 
  FolderKanban, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { FeatureTool } from '@/types';

interface FeatureCardProps {
  tool: FeatureTool;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  tool,
  variant = 'compact',
  className = '',
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-espresso" />;
      case 'Compass':
        return <Compass className="w-5 h-5 text-espresso" />;
      case 'Award':
        return <Award className="w-5 h-5 text-espresso" />;
      case 'FolderKanban':
        return <FolderKanban className="w-5 h-5 text-espresso" />;
      default:
        return <Sparkles className="w-5 h-5 text-espresso" />;
    }
  };

  if (variant === 'compact') {
    return (
      <Link
        to={tool.path}
        className={`group block p-5 rounded-2xl glass-card transition-all duration-300 ${className}`}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-parchment/60 border border-archBorder/50 flex items-center justify-center group-hover:bg-espresso group-hover:text-cream shadow-sm transition-all duration-200">
            <span className="group-hover:text-cream transition-colors">
              {getIcon(tool.icon)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-semibold text-ink group-hover:text-espresso transition-colors">
                {tool.title}
              </h3>
              <ArrowRight className="w-4 h-4 text-taupe group-hover:text-espresso group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed line-clamp-2">
              {tool.description}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={`group p-7 sm:p-8 rounded-3xl glass-panel shadow-glass hover:shadow-glass-hover transition-all duration-300 flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-2xl bg-parchment/60 border border-archBorder/60 flex items-center justify-center group-hover:bg-espresso group-hover:text-cream shadow-sm transition-all duration-200">
            <span className="group-hover:text-cream transition-colors">
              {getIcon(tool.icon)}
            </span>
          </div>
          <span className="text-xs font-mono font-medium text-taupe px-3 py-1 rounded-full bg-parchment/50 border border-archBorder/40">
            {tool.number}
          </span>
        </div>

        <h3 className="text-2xl font-serif font-semibold text-ink group-hover:text-espresso transition-colors mb-2">
          {tool.title}
        </h3>

        <p className="text-sm font-medium text-espresso/90 mb-3">{tool.tagline}</p>

        <p className="text-sm text-ink-muted leading-relaxed mb-6 font-sans">{tool.description}</p>

        {tool.highlights && tool.highlights.length > 0 && (
          <ul className="space-y-2.5 mb-6 pt-5 border-t border-archBorder/30">
            {tool.highlights.map((h, i) => (
              <li key={i} className="text-xs text-ink-muted flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-espresso flex-shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-4 border-t border-archBorder/30">
        <Link
          to={tool.path}
          className="inline-flex items-center justify-between w-full py-2.5 px-4 rounded-xl bg-parchment/40 hover:bg-espresso hover:text-cream text-xs font-semibold text-espresso transition-all group-hover:shadow-arch-sm"
        >
          <span>Open {tool.title}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
};
