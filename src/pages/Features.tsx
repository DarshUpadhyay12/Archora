import React from 'react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { FeatureCard } from '@/components/common/FeatureCard';
import { FEATURE_TOOLS } from '@/data/mockData';
import { Layers, Wind, ShieldAlert } from 'lucide-react';

export const Features: React.FC = () => {
  return (
    <div className="relative min-h-screen py-14 lg:py-20 overflow-hidden animate-fadeIn">
      {/* Background Architectural Illustration */}
      <ArchitectureBackground
        imageSrc="/images/architecture/features_feathered.png"
        fallbackSrc="/images/architecture/features_hero_bg.jpg"
        alt="Architectural etching of historic stone temple and colonnade"
        alignment="right"
        opacity={0.18}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Page Heading */}
        <div className="max-w-2xl">
          <PageHeading
            kicker="INTEGRATED STUDIO SUITE"
            title="Powerful Tools for Every Stage"
            description="Archora empowers your workflow from historical precedent research to design ideation, portfolio curation, and jury critique in one cohesive studio environment."
          />
        </div>

        {/* 4 Core Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {FEATURE_TOOLS.map((tool) => (
            <FeatureCard key={tool.id} tool={tool} variant="detailed" />
          ))}
        </div>

        {/* Comparative Methodology Glass Panel */}
        <div className="mt-16 p-8 sm:p-12 rounded-3xl glass-panel shadow-glass space-y-8">
          <div className="max-w-xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-espresso">
              Studio Methodology
            </span>
            <h3 className="text-2xl sm:text-3xl font-serif font-medium text-ink">
              Engineered for Architectural Rigor
            </h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Archora models real tectonic constraints, passive microclimate physics, and jury critique frameworks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-archBorder/30">
            <div className="space-y-2.5 p-4 rounded-2xl bg-cream/60 border border-archBorder/30">
              <div className="w-8 h-8 rounded-xl bg-parchment/70 flex items-center justify-center text-espresso">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg font-semibold text-espresso">
                1. Tectonic Fidelity
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Suggested concepts respect structural load transfer, material authenticity, and realistic construction assembly depths.
              </p>
            </div>

            <div className="space-y-2.5 p-4 rounded-2xl bg-cream/60 border border-archBorder/30">
              <div className="w-8 h-8 rounded-xl bg-parchment/70 flex items-center justify-center text-espresso">
                <Wind className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg font-semibold text-espresso">
                2. Climatic Response
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Prioritizes passive solar orientation, courtyard stack ventilation, and vernacular thermal mass optimization.
              </p>
            </div>

            <div className="space-y-2.5 p-4 rounded-2xl bg-cream/60 border border-archBorder/30">
              <div className="w-8 h-8 rounded-xl bg-parchment/70 flex items-center justify-center text-espresso">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h4 className="font-serif text-lg font-semibold text-espresso">
                3. Jury Defense
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Equips you with precise vocabulary, historical precedents, and environmental rationale to defend design decisions before jurors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
