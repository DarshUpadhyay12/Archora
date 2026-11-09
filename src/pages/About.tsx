import React from 'react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { PrimaryButton } from '@/components/common/Buttons';
import { Eye, Target, Heart } from 'lucide-react';
import { BRAND_NAME } from '@/data/mockData';

export const About: React.FC = () => {
  const pillars = [
    {
      title: 'Our Vision',
      tagline: 'To make architectural education and design more accessible, rigorous, and intuitive.',
      description:
        'We envision a design studio culture where every aspiring architect has instant access to deep architectural history, structural tectonics, and environmental physics without getting lost in generic internet noise.',
      icon: Eye,
    },
    {
      title: 'Our Mission',
      tagline: 'To empower creators everywhere with AI tools that nurture pure architectural creativity.',
      description:
        'Archora does not replace the architect; it amplifies human intuition. We provide students with the contextual vocabulary, passive microclimate simulations, and jury preparation to articulate their unique vision.',
      icon: Target,
    },
    {
      title: 'For Architecture Students',
      tagline: 'Designed to support future architects throughout their entire studio journey.',
      description:
        'From midnight design concept blockages to nervous 10-minute final viva reviews, Archora is crafted as a trusted studio companion that respects the sacred discipline of building.',
      icon: Heart,
    },
  ];

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration: French Château on lake with turrets */}
      <ArchitectureBackground
        imageSrc="/images/architecture/about_feathered.png"
        fallbackSrc="/images/architecture/about_hero_bg.jpg"
        alt="Architectural pen and ink etching of French Renaissance Chateau on lake"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Page Heading */}
        <div className="max-w-2xl">
          <PageHeading
            kicker="STUDIO ETHOS & ORIGIN"
            title={`About ${BRAND_NAME}`}
            description="Built by architecture students, driven by a passion for design, historical literacy, and architectural integrity."
          />
        </div>

        {/* 3 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-cream/90 backdrop-blur-md border border-archBorder shadow-arch-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-beige/60 border border-archBorder/60 flex items-center justify-center text-espresso">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-serif font-semibold text-ink">
                    {pillar.title}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-espresso">
                    {pillar.tagline}
                  </p>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deep Architectural Journal Manifesto */}
        <div className="p-8 sm:p-12 rounded-3xl bg-cream-light/95 border border-archBorder shadow-arch-md space-y-8 max-w-4xl">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-espresso">
              The Architectural Journal Aesthetic
            </span>
            <h3 className="text-3xl font-serif font-medium text-ink">
              Why Parchment & Pen-and-Ink Etchings?
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Modern digital design software has become sterile, dominated by cold gray palettes and corporate SaaS gradients. In contrast, historical architectural treatises—from Sebastiano Serlio and Palladio to Piranesi and Stella Kramrisch—drew their timeless power from the interplay of warm paper and black ink linework.
            </p>
            <p className="text-sm text-ink-muted leading-relaxed">
              Archora brings that tactile reverence into a digital workspace. We believe that when students work in an environment reminiscent of a master architect’s sketch journal, they think more deeply about proportion, light, and material truth.
            </p>
          </div>

          <div className="pt-4 border-t border-archBorder/40 flex flex-wrap items-center gap-4">
            <PrimaryButton to="/tutor" showArrow>
              Explore Architecture Tutor
            </PrimaryButton>
            <PrimaryButton to="/concepts" variant="secondary">
              Generate Studio Concept
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};
