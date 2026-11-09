import React, { useState, useEffect } from 'react';
import { Copy, Check, Bookmark, Sparkles, BookOpen, ArrowRight } from 'lucide-react';
import { showToast } from './Toast';

/**
 * Safe markdown text renderer: transforms **bold** and *italic* tokens into
 * React elements without dangerouslySetInnerHTML, completely preventing XSS.
 */
function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*[^*]+?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="text-ink font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} className="text-espresso font-serif">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

interface AIResponsePanelProps {
  title?: string;
  content: string;
  citations?: string[];
  followUpSuggestions?: string[];
  onSelectFollowUp?: (suggestion: string) => void;
  onSave?: () => void;
  isSaved?: boolean;
  className?: string;
}

export const AIResponsePanel: React.FC<AIResponsePanelProps> = ({
  title,
  content,
  citations = [],
  followUpSuggestions = [],
  onSelectFollowUp,
  onSave,
  isSaved = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [savedLocal, setSavedLocal] = useState(isSaved);

  useEffect(() => {
    setSavedLocal(isSaved);
  }, [isSaved]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      showToast({
        type: 'success',
        title: 'Copied to Clipboard',
        message: 'Analysis copied! Ready for presentation slides or jury notes 📋',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', title: 'Failed to copy', message: 'Could not access clipboard' });
    }
  };

  const handleSave = () => {
    setSavedLocal(!savedLocal);
    if (onSave) onSave();
    showToast({
      type: 'success',
      title: savedLocal ? 'Removed from Vault' : 'Saved to Studio Vault',
      message: savedLocal ? 'Removed from saved outputs. Rip to that iteration 💀' : 'Saved to studio notes. Character development 💾',
    });
  };

  return (
    <div
      className={`rounded-3xl glass-panel shadow-glass p-6 sm:p-8 space-y-6 animate-fadeIn ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-archBorder/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-beige/60 border border-archBorder/60 flex items-center justify-center text-espresso">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-serif text-lg font-semibold text-ink">
              {title || 'Archora Studio Synthesis'}
            </h4>
            <span className="text-[11px] text-taupe font-mono">
              Let him cook: AI Studio Synthesis 🔥
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            title="Copy analysis"
            className="p-2 text-taupe hover:text-espresso hover:bg-beige/40 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSave}
            title="Save to notes"
            className={`p-2 rounded-lg transition-colors ${
              savedLocal
                ? 'text-espresso bg-beige/60'
                : 'text-taupe hover:text-espresso hover:bg-beige/40'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${savedLocal ? 'fill-espresso' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content with architectural typography */}
      <div className="prose prose-stone max-w-none text-sm text-ink-muted leading-relaxed space-y-4">
        {content.split('\n\n').map((paragraph, index) => {
          if (paragraph.startsWith('### ')) {
            return (
              <h3 key={index} className="text-xl font-serif font-semibold text-ink pt-2 text-espresso">
                {paragraph.replace('### ', '')}
              </h3>
            );
          }
          if (paragraph.startsWith('#### ')) {
            return (
              <h4 key={index} className="text-base font-serif font-medium text-ink pt-1 text-chocolate">
                {paragraph.replace('#### ', '')}
              </h4>
            );
          }
          if (paragraph.startsWith('* ') || paragraph.startsWith('- ')) {
            const items = paragraph.split('\n');
            return (
              <ul key={index} className="space-y-1.5 pl-4 list-disc marker:text-taupe">
                {items.map((it, i) => (
                  <li key={i} className="text-xs sm:text-sm text-ink-muted">
                    <span>
                      {renderFormattedText(it.replace(/^[\*\-]\s+/, ''))}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="text-xs sm:text-sm leading-relaxed">
              {renderFormattedText(paragraph)}
            </p>
          );
        })}
      </div>

      {/* Citations & Precedents */}
      {citations.length > 0 && (
        <div className="pt-4 border-t border-archBorder/40">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-espresso mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Academic Precedents & Citations</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {citations.map((cite, i) => (
              <span
                key={i}
                className="text-xs px-3 py-1 rounded-full bg-parchment border border-archBorder/60 text-ink-muted font-serif italic"
              >
                {cite}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up suggestions */}
      {followUpSuggestions.length > 0 && onSelectFollowUp && (
        <div className="pt-4 border-t border-archBorder/40">
          <span className="block text-xs font-semibold uppercase tracking-wider text-taupe mb-2.5">
            Suggested Studio Inquiries
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {followUpSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSelectFollowUp(suggestion)}
                className="text-left p-2.5 rounded-xl bg-beige/30 hover:bg-beige/60 border border-archBorder/50 text-xs text-ink hover:text-espresso flex items-center justify-between group transition-colors"
              >
                <span className="line-clamp-2">{suggestion}</span>
                <ArrowRight className="w-3.5 h-3.5 text-taupe group-hover:text-espresso group-hover:translate-x-1 flex-shrink-0 ml-2 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

