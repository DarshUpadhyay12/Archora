import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  Compass,
  GraduationCap,
  Award,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PrimaryButton, SecondaryButton } from '@/components/common/Buttons';
import { FeatureCard } from '@/components/common/FeatureCard';
import { ArchitecturalBuilding3D } from '@/components/common/ArchitecturalBuilding3D';
import { FEATURE_TOOLS } from '@/data/mockData';
import { GENZ_VOICE } from '@/config/genzVoice';

export const Home: React.FC = () => {
  const [activePreviewTab, setActivePreviewTab] = useState<'precedents' | 'concepts' | 'jury'>('precedents');

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ============================================================== */}
      {/* 1. HERO SECTION WITH ARCHITECTURAL GLASS WORKSPACE PREVIEW      */}
      {/* ============================================================== */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-32 overflow-hidden">
        {/* Architectural Etching Background */}
        <ArchitectureBackground
          imageSrc="/images/architecture/home_feathered.png"
          fallbackSrc="/images/architecture/home_hero_bg.jpg"
          alt="Architectural pen and ink etching of South Indian Hindu Temple Gopuram"
          alignment="right"
          opacity={0.18}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">

            {/* Left Column: Hero Text & Actions */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-7">
              {/* Kicker badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel text-espresso text-xs font-semibold tracking-[0.16em] uppercase shadow-arch-sm">
                <Sparkles className="w-3.5 h-3.5 text-espresso" />
                <span>{GENZ_VOICE.taglines.heroKicker}</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-6xl xl:text-7xl font-serif font-medium text-ink tracking-tight leading-[1.08]">
                Bro has a concept. <br />
                <span className="italic font-normal text-espresso">Now explain it to the jury. 💀</span>
              </h1>

              {/* Supporting description */}
              <p className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-xl font-sans font-normal">
                {GENZ_VOICE.taglines.heroSubtitle}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <PrimaryButton to="/tutor" size="lg" showArrow className="shadow-arch-md">
                  Launch Architecture Tutor
                </PrimaryButton>
                <SecondaryButton to="/concepts" size="lg" className="glass-panel hover:bg-cream">
                  Generate Concepts
                </SecondaryButton>
              </div>

              {/* 3 Real Studio Architecture Metrics */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-archBorder/40 max-w-lg">
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-serif font-semibold text-espresso">
                    5
                  </div>
                  <div className="text-xs text-ink-muted font-medium">
                    Studio AI Modules
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-serif font-semibold text-espresso">
                    100%
                  </div>
                  <div className="text-xs text-ink-muted font-medium">
                    Local Autonomy (SQLite)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-serif font-semibold text-espresso">
                    Zero-Cost
                  </div>
                  <div className="text-xs text-ink-muted font-medium">
                    Free Tier Guarantee
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Architectural Glass Workspace Interactive Preview */}
            <div className="lg:col-span-5 xl:col-span-5">
              <div className="glass-panel rounded-3xl p-6 sm:p-7 shadow-glass space-y-5 border border-white/60">
                {/* Header bar */}
                <div className="flex items-center justify-between pb-4 border-b border-archBorder/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-espresso">
                      Studio Intelligence Engine
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-parchment/60 border border-archBorder/40 text-taupe">
                    Active Session
                  </span>
                </div>

                {/* Module switcher tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-parchment/50 border border-archBorder/40">
                  <button
                    onClick={() => setActivePreviewTab('precedents')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl transition-all ${activePreviewTab === 'precedents'
                      ? 'bg-cream text-espresso shadow-arch-sm font-semibold'
                      : 'text-ink-muted hover:text-ink'
                      }`}
                  >
                    Tutor Precedents
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('concepts')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl transition-all ${activePreviewTab === 'concepts'
                      ? 'bg-cream text-espresso shadow-arch-sm font-semibold'
                      : 'text-ink-muted hover:text-ink'
                      }`}
                  >
                    Concepts
                  </button>
                  <button
                    onClick={() => setActivePreviewTab('jury')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl transition-all ${activePreviewTab === 'jury'
                      ? 'bg-cream text-espresso shadow-arch-sm font-semibold'
                      : 'text-ink-muted hover:text-ink'
                      }`}
                  >
                    Jury Critique
                  </button>
                </div>

                {/* Tab content display */}
                {activePreviewTab === 'precedents' && (
                  <div className="space-y-3.5 p-4 rounded-2xl bg-cream/70 border border-archBorder/30 animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs font-semibold text-espresso">
                      <GraduationCap className="w-4 h-4 text-espresso" />
                      <span>Dravidian Gopuram Tectonics</span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Sacred geometry, Vastu Purusha Mandala layout, and stepped granite ashlar proportioning
                      synthesized with natural cross-ventilation corridors.
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[11px] text-taupe font-mono">
                      <span>Source: Historical Precedent Engine</span>
                      <Link to="/tutor" className="text-espresso font-medium hover:underline flex items-center gap-1">
                        <span>Open Tutor</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'concepts' && (
                  <div className="space-y-3.5 p-4 rounded-2xl bg-cream/70 border border-archBorder/30 animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs font-semibold text-espresso">
                      <Compass className="w-4 h-4 text-espresso" />
                      <span>Passive Courtyard Microclimate</span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Thermal stack effect ventilation with cantilevered recycled timber brise-soleil,
                      inducing diurnal night-flush cooling through double-skin masonry.
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[11px] text-taupe font-mono">
                      <span>Typology: Sustainable Cultural Pavilion</span>
                      <Link to="/concepts" className="text-espresso font-medium hover:underline flex items-center gap-1">
                        <span>Generate</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {activePreviewTab === 'jury' && (
                  <div className="space-y-3.5 p-4 rounded-2xl bg-cream/70 border border-archBorder/30 animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs font-semibold text-espresso">
                      <Award className="w-4 h-4 text-espresso" />
                      <span>Structural Load Transfer Defense</span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Anticipated jury question: <em>&ldquo;How does the cantilevering roof slab transfer lateral wind loads back to the core without visible column bulk?&rdquo;</em>
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[11px] text-taupe font-mono">
                      <span>Module: Jury Prep</span>
                      <Link to="/portfolio" className="text-espresso font-medium hover:underline flex items-center gap-1">
                        <span>Prepare</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Footer specs */}
                <div className="pt-3 border-t border-archBorder/30 flex items-center justify-between text-[11px] text-taupe">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Local Database Persisted</span>
                  </div>
                  <Link to="/features" className="text-espresso hover:underline font-medium">
                    All Studio Features &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 1.5. 3D ARCHITECTURAL PAVILION INTERACTION SECTION             */}
      {/* ============================================================== */}
      <section className="relative z-10 py-16 bg-cream/40 border-t border-archBorder/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-espresso/80">
                Interactive 3D Playground
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif font-medium text-ink leading-tight">
                {GENZ_VOICE.taglines.model3dTitle}
              </h2>
              <p className="text-sm text-ink-muted leading-relaxed">
                {GENZ_VOICE.taglines.model3dSubtitle}
              </p>
              <div className="pt-2 flex items-center gap-4">
                <Link
                  to="/vastu"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 shadow-sm transition"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Launch VastuVision</span>
                </Link>
                <Link
                  to="/projects"
                  className="text-xs font-semibold text-espresso hover:underline flex items-center gap-1"
                >
                  <span>Explore Project Vault &rarr;</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <ArchitecturalBuilding3D />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. CORE STUDIO SUITE GRID SECTION                               */}
      {/* ============================================================== */}
      <section className="relative z-10 py-20 bg-cream/60 backdrop-blur-sm border-t border-b border-archBorder/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-espresso/80">
              Integrated Studio Suite
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-medium text-ink">
              Specialized Tools for Architectural Synthesis
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Every stage of your studio work, from conceptual ideation and Vastu Shastra planning to jury defense, supported by specialized architectural intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {FEATURE_TOOLS.map((tool) => (
              <div key={tool.id} className="card-3d-tilt">
                <FeatureCard tool={tool} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. STUDIO PHILOSOPHY EDITORIAL SECTION                          */}
      {/* ============================================================== */}
      <section className="py-24 bg-parchment/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-espresso/80">
                Studio Philosophy · The Real Story
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-medium text-ink leading-tight">
                An Architecture Studio That Actually Understands the Struggle
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed font-sans font-normal">
                Architecture education requires balancing historical literacy, environmental physics,
                and tectonic clarity while surviving 3 AM deadlines on iced coffee and pure hope. Archora was built
                by students who survived the studio trenches — combining the tactile elegance of classic architectural
                treatises with modern Gen-Z AI tools to keep your sanity intact.
              </p>

              <div className="space-y-3.5 pt-2">
                {[
                  'Precedent research without the intimidating professor side-eye',
                  'Climate-responsive concepts with real spatial logic (not just random buzzwords)',
                  'Jury defense rehearsals to roast-proof your circulation before review day',
                  'Local SQLite persistence so Revit crashes never destroy your studio notes'
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-espresso flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-ink-muted">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center gap-4">
                <PrimaryButton to="/tutor" showArrow>
                  Start Architecture Tutor
                </PrimaryButton>
                <SecondaryButton to="/concepts" className="glass-panel">
                  Generate Concepts
                </SecondaryButton>
              </div>
            </div>

            {/* Visual Etching Panel with Glass Frame */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl overflow-hidden glass-panel p-2.5 shadow-glass">
                <div className="relative rounded-2xl overflow-hidden bg-parchment h-80 sm:h-96">
                  <img
                    src="/images/architecture/how_it_works_feathered.png"
                    alt="High Gothic Cathedral architectural etching"
                    className="w-full h-full object-cover mix-blend-multiply opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-chocolate/90 via-chocolate/40 to-transparent flex items-end p-6 sm:p-8">
                    <div className="text-cream space-y-1">
                      <span className="text-xs font-mono uppercase tracking-wider text-beige">
                        Architectural Precedent Engine
                      </span>
                      <h4 className="text-xl sm:text-2xl font-serif font-medium text-cream">
                        High Gothic Skeletalism to Indian Stepwell Microclimates
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. REFINED ARCHITECTURAL GLASS CALL-TO-ACTION                   */}
      {/* ============================================================== */}
      <section className="py-20 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-dark-panel rounded-3xl p-10 sm:p-14 text-center space-y-6 relative overflow-hidden">
            {/* Subtle architectural background grid */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#E6D1B5_1px,transparent_1px)] [background-size:24px_24px]" />

            <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-beige">
                Begin Your Studio Session
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif font-medium text-cream tracking-tight">
                Ready to Elevate Your Architectural Synthesis?
              </h2>
              <p className="text-sm text-beige/80 leading-relaxed font-sans">
                Analyze classical proportions, formulate passive environmental strategies,
                and prepare rigorous jury presentations — all in one free, autonomous workspace.
              </p>

              <div className="pt-4 flex flex-wrap justify-center gap-4">
                <PrimaryButton
                  to="/tutor"
                  size="lg"
                  className="bg-cream text-espresso hover:bg-parchment font-semibold shadow-arch-md"
                  showArrow
                >
                  Start Architecture Tutor
                </PrimaryButton>
                <SecondaryButton
                  to="/concepts"
                  size="lg"
                  className="border-white/30 text-cream bg-white/10 hover:bg-white/20 backdrop-blur-md"
                >
                  Generate Design Concept
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
