import React from 'react';
import { Link } from 'react-router-dom';
import { AnchoraLogo } from './AnchoraLogo';
import { Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-cream-dark/90 border-t border-archBorder/60 text-ink-muted transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <AnchoraLogo size="md" />
            <p className="text-xs leading-relaxed text-ink-muted">
              Archora is an intelligent architecture workspace dedicated to architecture students.
              Synthesizing historical architectural knowledge, generative design concepts, jury preparation,
              and studio project archiving.
            </p>
            <div className="flex items-center gap-3 pt-2 text-espresso text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-beige/60 border border-archBorder/60">
                <Sparkles className="w-3 h-3" />
                Local Studio Ready
              </span>
            </div>
          </div>

          {/* Core Tools */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold text-espresso mb-4">
              Core Features
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/tutor" className="hover:text-espresso transition-colors">
                  Architecture Tutor
                </Link>
              </li>
              <li>
                <Link to="/concepts" className="hover:text-espresso transition-colors">
                  Design Concept Generator
                </Link>
              </li>
              <li>
                <Link to="/portfolio" className="hover:text-espresso transition-colors">
                  Jury & Portfolio Assistant
                </Link>
              </li>
              <li>
                <Link to="/projects" className="hover:text-espresso transition-colors">
                  Project Library & Archive
                </Link>
              </li>
            </ul>
          </div>

          {/* Studio Suite */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold text-espresso mb-4">
              Studio Suite
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/features" className="hover:text-espresso transition-colors">
                  All Features Overview
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-espresso transition-colors">
                  Studio Sign In
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-espresso transition-colors">
                  Preferences & Settings
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-espresso transition-colors">
                  Studio Feedback
                </Link>
              </li>
            </ul>
          </div>

          {/* Workspace Settings */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold text-espresso mb-4">
              Workspace Environment
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/profile" className="hover:text-espresso transition-colors">
                  Studio Profile & Data Backup
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-espresso transition-colors">
                  AI Token & Usage Metrics
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-espresso transition-colors">
                  Studio Feedback & Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-12 pt-8 border-t border-archBorder/40 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-faint gap-4">
          <p>© 2026 Archora Workspace. All rights reserved. Designed for architectural education.</p>
          <div className="flex items-center gap-6">
            <span>Parchment Edition 1.0</span>
            <span>Local Windows Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
