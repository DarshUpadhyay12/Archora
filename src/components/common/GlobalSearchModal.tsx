import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Compass, GraduationCap, Award, FolderKanban, BookOpen, ArrowRight } from 'lucide-react';
import { FEATURE_TOOLS, TUTOR_TOPICS, DEMO_PROJECTS } from '@/data/mockData';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global keyboard shortcut '/' or 'Cmd+K' to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !isOpen) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onClose(); // In a parent, or if we had a global search context
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  // Search Results
  const matchedTools = FEATURE_TOOLS.filter(
    (t) =>
      t.title.toLowerCase().includes(normalizedQuery) ||
      t.description.toLowerCase().includes(normalizedQuery)
  );

  const matchedTopics = TUTOR_TOPICS.filter(
    (top) =>
      top.title.toLowerCase().includes(normalizedQuery) ||
      top.description.toLowerCase().includes(normalizedQuery)
  );

  const matchedProjects = DEMO_PROJECTS.filter(
    (p) =>
      p.title.toLowerCase().includes(normalizedQuery) ||
      p.description.toLowerCase().includes(normalizedQuery) ||
      p.typology.toLowerCase().includes(normalizedQuery)
  );

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-chocolate/40 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-cream border border-archBorder shadow-arch-lg rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-archBorder/60 bg-cream-light">
          <Search className="w-5 h-5 text-taupe mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, 3 AM ideas, projects, or sanity (e.g. cantilever, Corbusier)..."
            className="w-full bg-transparent text-ink placeholder-taupe/80 text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-taupe hover:text-ink text-sm mr-2"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-taupe hover:text-ink rounded-md hover:bg-beige/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Quick Tools */}
          {matchedTools.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-taupe font-semibold px-2 mb-2">
                Studio Tools
              </div>
              <div className="space-y-1">
                {matchedTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleSelect(tool.path)}
                    className="w-full text-left p-3 rounded-xl hover:bg-beige/40 flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-beige/50 text-espresso">
                        {tool.id === 'tutor' && <GraduationCap className="w-4 h-4" />}
                        {tool.id === 'concepts' && <Compass className="w-4 h-4" />}
                        {tool.id === 'portfolio' && <Award className="w-4 h-4" />}
                        {tool.id === 'projects' && <FolderKanban className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-medium text-ink group-hover:text-espresso">
                          {tool.title}
                        </div>
                        <div className="text-xs text-ink-muted line-clamp-1">{tool.tagline}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-taupe group-hover:text-espresso group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Architectural Topics */}
          {matchedTopics.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-taupe font-semibold px-2 mb-2">
                Architecture Tutor Topics
              </div>
              <div className="space-y-1">
                {matchedTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleSelect(`/tutor?topic=${topic.id}`)}
                    className="w-full text-left p-3 rounded-xl hover:bg-beige/40 flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-beige/50 text-espresso">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-ink group-hover:text-espresso">
                          {topic.title}
                        </div>
                        <div className="text-xs text-ink-muted line-clamp-1">{topic.description}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-taupe group-hover:text-espresso group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {matchedProjects.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-taupe font-semibold px-2 mb-2">
                Project Library
              </div>
              <div className="space-y-1">
                {matchedProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(`/projects?id=${p.id}`)}
                    className="w-full text-left p-3 rounded-xl hover:bg-beige/40 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="font-medium text-ink group-hover:text-espresso">{p.title}</div>
                      <div className="text-xs text-ink-muted">
                        {p.semester} • {p.typology} • {p.siteLocation}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-taupe group-hover:text-espresso group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No matches */}
          {matchedTools.length === 0 && matchedTopics.length === 0 && matchedProjects.length === 0 && (
            <div className="py-12 text-center text-ink-muted">
              <Search className="w-8 h-8 mx-auto text-taupe/60 mb-2" />
              <p className="font-medium font-serif text-lg">No architectural artifacts found for "{query}" 💀</p>
              <p className="text-xs text-ink-faint mt-1">
                Try searching for "cantilever", "tutor", "vastu", "mandala", or "concepts".
              </p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-parchment-light border-t border-archBorder/40 text-xs text-ink-muted flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Navigation: Click or Enter</span>
            <span>Esc to close</span>
          </div>
          <span className="font-mono text-[11px] text-taupe">Archora Studio Index</span>
        </div>
      </div>
    </div>
  );
};

