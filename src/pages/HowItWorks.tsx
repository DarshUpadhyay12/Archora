import React from 'react';
import { Link } from 'react-router-dom';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { PrimaryButton } from '@/components/common/Buttons';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Choose a Tool',
      tagline: 'Assemble everything you need – learn, generate, present, or organize.',
      description:
        'Select the appropriate specialized module for your current studio phase. Need historical precedents? Use the Tutor. Formulating a studio design brief? Open the Concept Generator. Preparing for a final review? Launch the Jury Assistant.',
      link: '/features',
      actionText: 'Browse Studio Tools',
    },
    {
      number: '02',
      title: 'Input Your Idea',
      tagline: 'Add parameters, site dimensions, or describe your concept.',
      description:
        'Provide your studio brief, site climate conditions, intended program, and tectonic preferences. Whether you are providing a 10-line studio synopsis or specific climatic constraints, Archora structures your parameters intelligently.',
      link: '/concepts',
      actionText: 'Try Concept Inputs',
    },
    {
      number: '03',
      title: 'Get AI-Powered Results',
      tagline: 'Receive detailed designs, structures, and architectural advice.',
      description:
        'Archora synthesizes an in-depth architectural narrative, spatial hierarchies, circulation patterns, daylight and ventilation vectors, material palettes, and anticipated jury questions—all formatted in professional architectural prose.',
      link: '/tutor',
      actionText: 'See Sample Analysis',
    },
    {
      number: '04',
      title: 'Save & Organize',
      tagline: 'Keep everything organized in your library and refine concepts.',
      description:
        'Store generated design concepts, studio notes, and jury sheets directly into your semester-based Project Library. Export project abstracts to PDF or copy architectural descriptions into your presentation boards.',
      link: '/projects',
      actionText: 'Open Project Library',
    },
  ];

  return (
    <div className="relative min-h-screen py-16 lg:py-24 overflow-hidden">
      {/* Background Architectural Illustration: High Gothic Cathedral with reflecting pool */}
      <ArchitectureBackground
        imageSrc="/images/architecture/how_it_works_feathered.png"
        fallbackSrc="/images/architecture/how_it_works_hero_bg.jpg"
        alt="Architectural etching of High Gothic Cathedral with reflecting canal"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Page Heading */}
        <div className="max-w-2xl">
          <PageHeading
            kicker="STUDIO WORKFLOW ARCHITECTURE"
            title="How Archora Works"
            description="A clear and powerful four-step workflow designed to support your architectural studio journey from blank sheet to confident jury defense."
          />
        </div>

        {/* 4 Step Sequential Process */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            {steps.map((step, idx) => (
              <div
                key={step.number}
                className="relative p-6 sm:p-8 rounded-3xl bg-cream/90 backdrop-blur-md border border-archBorder shadow-arch-sm hover:shadow-arch-md hover:border-espresso transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Step Number Badge */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-espresso text-cream flex items-center justify-center font-mono font-semibold text-lg shadow-sm">
                    {step.number}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-serif font-semibold text-ink">
                        {step.title}
                      </h3>
                      <span className="text-xs font-mono text-taupe hidden sm:inline">
                        Stage {idx + 1} of 4
                      </span>
                    </div>

                    <p className="text-sm font-medium text-espresso/90">
                      {step.tagline}
                    </p>

                    <p className="text-xs sm:text-sm text-ink-muted leading-relaxed pt-1">
                      {step.description}
                    </p>

                    <div className="pt-3">
                      <Link
                        to={step.link}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-espresso hover:text-chocolate hover:underline group"
                      >
                        <span>{step.actionText}</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Summary Card */}
          <div className="lg:col-span-4 sticky top-28 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-cream-light border border-archBorder shadow-arch-md space-y-6">
              <div className="w-10 h-10 rounded-xl bg-beige/60 border border-archBorder/60 flex items-center justify-center text-espresso">
                <Sparkles className="w-5 h-5" />
              </div>

              <div>
                <h4 className="font-serif text-xl font-semibold text-ink">
                  Designed for Local Privacy & Speed
                </h4>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                  Your studio projects, sketches, and notes are saved to your local workspace, ensuring fast offline access during late-night studio sessions.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-archBorder/40">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-800 flex-shrink-0" />
                  <span>No mandatory cloud sign-in required</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-800 flex-shrink-0" />
                  <span>Instant JSON backup and restore</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-800 flex-shrink-0" />
                  <span>Autonomous AI architectural reasoning</span>
                </div>
              </div>

              <div className="pt-2">
                <PrimaryButton to="/tutor" className="w-full text-center" showArrow>
                  Start First Session
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

