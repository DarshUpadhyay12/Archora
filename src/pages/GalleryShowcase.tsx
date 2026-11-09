import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Eye, MapPin } from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { Modal } from '@/components/common/Modal';
import { GALLERY_ITEMS } from '@/data/mockData';
import { GalleryItem, GalleryTradition } from '@/types';

export const GalleryShowcase: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTradition, setSelectedTradition] = useState<string>('All');
  const [activeModalItem, setActiveModalItem] = useState<GalleryItem | null>(null);

  const traditions: (GalleryTradition | 'All')[] = [
    'All',
    'Hindu Temples',
    'Classical European',
    'Gothic',
    'Renaissance',
    'Courtyards & Haveli',
    'Stepwells & Water',
  ];

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const match = GALLERY_ITEMS.find((item) => item.id === idParam);
      if (match) setActiveModalItem(match);
    }
  }, [searchParams]);

  const filteredItems = GALLERY_ITEMS.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTradition =
      selectedTradition === 'All' || item.tradition === selectedTradition;
    return matchesSearch && matchesTradition;
  });

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration: Angkor Wat temple complex across water */}
      <ArchitectureBackground
        imageSrc="/images/architecture/gallery_feathered.png"
        fallbackSrc="/images/architecture/gallery_hero_bg.jpg"
        alt="Architectural pen and ink etching of monumental temple skyline across water"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Page Heading */}
        <div className="max-w-2xl">
          <PageHeading
            kicker="ARCHITECTURAL PRECEDENTS & ETCHINGS"
            title="Inspiration for Your Next Idea"
            description="Explore a curated collection of architectural monuments, pen-and-ink etchings, and tectonic precedents across European and Indian traditions."
          />
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-cream/90 backdrop-blur-md border border-archBorder shadow-arch-sm">
          {/* Tradition Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {traditions.map((trad) => (
              <button
                key={trad}
                onClick={() => setSelectedTradition(trad)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedTradition === trad
                    ? 'bg-espresso text-cream border-espresso shadow-sm'
                    : 'bg-cream-light text-ink hover:bg-beige/40 border-archBorder/60'
                }`}
              >
                {trad}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-taupe absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search precedents, elements..."
              className="w-full bg-cream-light border border-archBorder/60 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-espresso"
            />
          </div>
        </div>

        {/* Gallery Image Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveModalItem(item)}
              className="group cursor-pointer rounded-3xl bg-cream/95 backdrop-blur-md border border-archBorder hover:border-espresso shadow-arch-sm hover:shadow-arch-md transition-all duration-300 overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Image Container with parchment multiply */}
                <div className="h-60 bg-parchment relative overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-cream/90 backdrop-blur-sm border border-archBorder/70 text-xs font-serif text-espresso">
                    {item.tradition}
                  </div>
                  <div className="absolute inset-0 bg-chocolate/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="p-3 rounded-full bg-cream/90 text-espresso shadow-md">
                      <Eye className="w-5 h-5" />
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 space-y-2">
                  <h3 className="font-serif text-xl font-semibold text-ink group-hover:text-espresso transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <div className="text-xs text-taupe font-mono">
                    {item.era} • {item.location}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed line-clamp-3 pt-1">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Tectonic Elements Tags */}
              <div className="px-6 py-4 border-t border-archBorder/40 bg-cream-light/60 flex flex-wrap gap-1.5">
                {item.architecturalElements.slice(0, 3).map((elem, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-beige/50 text-espresso"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Detail Modal */}
      {activeModalItem && (
        <Modal
          isOpen={!!activeModalItem}
          onClose={() => setActiveModalItem(null)}
          title={activeModalItem.title}
          subtitle={`${activeModalItem.tradition} • ${activeModalItem.era}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            <div className="h-72 rounded-2xl bg-parchment overflow-hidden border border-archBorder">
              <img
                src={activeModalItem.image}
                alt={activeModalItem.title}
                className="w-full h-full object-cover mix-blend-multiply"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-espresso">
                <MapPin className="w-3.5 h-3.5" />
                <span>{activeModalItem.location}</span>
              </div>

              <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso">
                Architectural Significance & Tectonics
              </h4>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                {activeModalItem.description}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-espresso mb-2">
                Key Architectural Elements
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeModalItem.architecturalElements.map((elem, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-mono px-3 py-1 rounded-full bg-cream border border-archBorder text-ink-muted"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
