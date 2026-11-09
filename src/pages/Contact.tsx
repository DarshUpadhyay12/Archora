import React, { useState } from 'react';
import { Mail, MapPin, CheckCircle2 } from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { FormField } from '@/components/common/FormField';
import { PrimaryButton } from '@/components/common/Buttons';
import { showToast } from '@/components/common/Toast';

export const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Please provide your name';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errs.email = 'Please provide a valid email';
    if (!subject.trim()) errs.subject = 'Please provide a subject';
    if (!message.trim() || message.length < 10) errs.message = 'Message must be at least 10 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsSubmitting(false);
    setIsSubmitted(true);
    showToast({
      type: 'success',
      title: 'Message Transmitted',
      message: 'Thank you for your studio feedback. We will be in touch.',
    });
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setIsSubmitted(false);
    setErrors({});
  };

  return (
    <div className="relative min-h-screen py-16 lg:py-24 overflow-hidden">
      {/* Background Architectural Illustration: Classical stone arches and colonnade */}
      <ArchitectureBackground
        imageSrc="/images/architecture/contact_feathered.png"
        fallbackSrc="/images/architecture/contact_hero_bg.jpg"
        alt="Architectural pen and ink etching of classical stone arches and colonnade"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Page Heading */}
        <div className="max-w-3xl">
          <PageHeading
            kicker="STUDIO DISPATCH · COMMUNITY"
            title="Have feedback, feature requests, or studio trauma to share?"
            description="We read every dispatch from fellow architecture students. Let us know how we can make Archora even more legendary."
          />
        </div>

        {/* Contact Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Contact Information */}
          <div className="lg:col-span-5 space-y-8">
            <div className="p-8 rounded-3xl bg-cream/90 backdrop-blur-md border border-archBorder shadow-arch-sm space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-espresso">
                  Studio Headquarters
                </span>
                <h3 className="text-2xl font-serif font-semibold text-ink">
                  Archora Research Studio
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Developed for architectural researchers and studio students seeking an intelligent, design-first digital workspace.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-archBorder/40 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-beige/60 border border-archBorder/60 flex items-center justify-center text-espresso flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-taupe uppercase font-mono text-[10px] block">Email Inquiries</span>
                    <span className="font-medium text-ink">studio@archora.local</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-beige/60 border border-archBorder/60 flex items-center justify-center text-espresso flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-taupe uppercase font-mono text-[10px] block">Location</span>
                    <span className="font-medium text-ink">Local Studio Edition • India</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-archBorder/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-espresso block mb-2">
                  Connect & Contribute
                </span>
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span className="px-3 py-1 rounded-full bg-cream border border-archBorder/70">
                    GitHub / Local
                  </span>
                  <span className="px-3 py-1 rounded-full bg-cream border border-archBorder/70">
                    Discord Studio
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Contact Form */}
          <div className="lg:col-span-7 bg-cream-light/95 backdrop-blur-md border border-archBorder rounded-3xl p-8 sm:p-10 shadow-arch-lg">
            {isSubmitted ? (
              <div className="py-12 text-center space-y-4 animate-fadeIn">
                <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 mx-auto flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-ink">
                  Message Dispatched
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{name}</strong>. Your feedback on architectural features has been received in the local studio log.
                </p>
                <div className="pt-4">
                  <PrimaryButton onClick={handleReset} size="sm">
                    Send Another Note
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Your Name" error={errors.name} required>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Deeth Upadhyay"
                      className="w-full bg-cream border border-archBorder/70 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                    />
                  </FormField>

                  <FormField label="Email Address" error={errors.email} required>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="deeth@anchora.studio"
                      className="w-full bg-cream border border-archBorder/70 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                    />
                  </FormField>
                </div>

                <FormField label="Subject" error={errors.subject} required>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Suggestion for Dravidian Mandala geometric tools"
                    className="w-full bg-cream border border-archBorder/70 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
                  />
                </FormField>

                <FormField label="Message / Feedback" error={errors.message} required>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your architectural workflow ideas, critique suggestions, or feature requests..."
                    className="w-full bg-cream border border-archBorder/70 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-espresso resize-none"
                  />
                </FormField>

                <div className="pt-2">
                  <PrimaryButton
                    type="submit"
                    isLoading={isSubmitting}
                    className="w-full justify-center py-3"
                    showArrow
                  >
                    Send Message
                  </PrimaryButton>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
