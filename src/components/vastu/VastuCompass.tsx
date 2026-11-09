import React from 'react';
import { Compass, Sparkles, Sun, Droplets, Flame, Wind, Mountain } from 'lucide-react';
import { VastuDirectionItem } from '@/services/vastuService';

interface VastuCompassProps {
  directions: VastuDirectionItem[];
  selectedDirection: string | null;
  onSelectDirection: (directionId: string) => void;
  geographicNorthDegrees: number;
  onNorthDegreesChange?: (degrees: number) => void;
  interactive?: boolean;
}

export const VastuCompass: React.FC<VastuCompassProps> = ({
  directions,
  selectedDirection,
  onSelectDirection,
  geographicNorthDegrees,
  onNorthDegreesChange,
  interactive = true,
}) => {
  const selectedItem = directions.find((d) => d.id === selectedDirection) || directions[0];

  const getElementIcon = (element: string) => {
    const lower = element.toLowerCase();
    if (lower.includes('fire') || lower.includes('agni')) return <Flame className="w-3.5 h-3.5 text-amber-600" />;
    if (lower.includes('water') || lower.includes('jala')) return <Droplets className="w-3.5 h-3.5 text-sky-600" />;
    if (lower.includes('wind') || lower.includes('air') || lower.includes('vayu')) return <Wind className="w-3.5 h-3.5 text-emerald-600" />;
    if (lower.includes('earth') || lower.includes('prithvi')) return <Mountain className="w-3.5 h-3.5 text-stone-600" />;
    return <Sparkles className="w-3.5 h-3.5 text-yellow-600" />;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start w-full">
      {/* 1. Compass Dial Display */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full p-2 glass-panel-elevated shadow-glass-hover flex items-center justify-center compass-3d-housing">
          {/* Subtle Outer Dial Ring */}
          <div className="absolute inset-2 rounded-full border border-archBorder/40 architectural-grid-bg opacity-30 pointer-events-none" />

          {/* Calibrated Degree Ring */}
          <div
            className="absolute inset-4 rounded-full border border-archBorder/60 compass-dial-plate"
            style={{ transform: `rotate(${geographicNorthDegrees}deg)` }}
          >
            {/* Cardinal Degree Markers */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-red-700">N</div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-espresso">S</div>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-espresso">E</div>
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-espresso">W</div>
          </div>

          {/* 8 Direction Radial Sectors */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full flex items-center justify-center">
            {directions
              .filter((d) => d.id !== 'Center')
              .map((dir) => {
                const angleRad = (dir.degrees - 90) * (Math.PI / 180);
                const radius = 100; // px
                const x = Math.round(Math.cos(angleRad) * radius);
                const y = Math.round(Math.sin(angleRad) * radius);
                const isSelected = selectedDirection === dir.id;

                return (
                  <button
                    key={dir.id}
                    onClick={() => onSelectDirection(dir.id)}
                    style={{
                      transform: `translate(${x}px, ${y}px)`,
                    }}
                    className={`absolute z-10 px-2.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-espresso text-cream shadow-lg scale-110 border border-bronze ring-2 ring-bronze/40'
                        : 'glass-stat-card text-espresso hover:bg-cream hover:scale-105'
                    }`}
                  >
                    <span className="text-[11px] leading-tight font-serif">{dir.id}</span>
                    <span className="text-[8px] font-mono opacity-80">{dir.degrees}°</span>
                  </button>
                );
              })}

            {/* Central Brahmasthan Button */}
            <button
              onClick={() => onSelectDirection('Center')}
              className={`absolute z-20 w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                selectedDirection === 'Center'
                  ? 'bg-amber-900 text-cream shadow-xl scale-110 ring-2 ring-amber-500'
                  : 'glass-panel text-espresso hover:bg-amber-50/80 shadow-md'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-700 animate-spin-slow" />
              <span className="text-[10px] font-bold font-serif leading-none mt-0.5">Center</span>
              <span className="text-[8px] font-mono opacity-70">Brahma</span>
            </button>

            {/* Rotatable Needle Displaying True Geographic North */}
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center transition-transform duration-500"
              style={{ transform: `rotate(${geographicNorthDegrees}deg)` }}
            >
              <div className="w-0.5 h-48 bg-gradient-to-t from-transparent via-red-600/70 to-red-600 relative">
                {/* Needle Arrowhead */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-b-8 border-b-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Geographic North Slider Adjustment */}
        {interactive && onNorthDegreesChange && (
          <div className="mt-4 w-full max-w-xs px-3 py-2.5 rounded-xl glass-stat-card flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-espresso flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-espresso" />
                True Geographic North
              </span>
              <span className="font-mono font-bold text-espresso">{geographicNorthDegrees}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              value={geographicNorthDegrees}
              onChange={(e) => onNorthDegreesChange(Number(e.target.value))}
              className="w-full accent-espresso cursor-pointer h-1.5 bg-archBorder/40 rounded-lg"
              aria-label="Geographic North orientation degrees"
            />
            <span className="text-[10px] text-mutedInk">
              Top of drawing corresponds to {geographicNorthDegrees === 0 ? 'True North (0°)' : `${geographicNorthDegrees}° azimuth`}.
            </span>
          </div>
        )}
      </div>

      {/* 2. Direction Detail & Classical Lore Card */}
      {selectedItem && (
        <div className="flex-1 w-full glass-surface-warm rounded-2xl p-5 border border-archBorder/60 shadow-glass space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-archBorder/40 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-serif font-bold text-espresso">{selectedItem.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-cream border border-archBorder/60 text-espresso">
                  {selectedItem.degrees}° Sector
                </span>
              </div>
              <p className="text-xs text-mutedInk font-serif italic mt-0.5">
                Presiding Deity: <strong className="text-espresso">{selectedItem.deity}</strong>
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cream/90 border border-archBorder/50 text-xs font-medium text-espresso">
              {getElementIcon(selectedItem.element)}
              <span>{selectedItem.element}</span>
            </div>
          </div>

          {/* Qualities & Classical Associations */}
          <div className="space-y-1">
            <h4 className="text-xs uppercase tracking-wider font-bold text-faintInk">Traditional Qualities</h4>
            <p className="text-xs text-ink leading-relaxed">{selectedItem.qualities}</p>
          </div>

          {/* Bioclimatic / Architectural Rationale */}
          <div className="p-3.5 rounded-xl bg-cream/70 border border-archBorder/50 space-y-1">
            <h4 className="text-xs uppercase tracking-wider font-bold text-espresso flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              Bioclimatic & Environmental Rationale
            </h4>
            <p className="text-xs text-espresso/90 leading-relaxed">{selectedItem.bioclimatic}</p>
          </div>

          {/* Auspicious Spaces */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-faintInk mb-1.5">
              Canonically Recommended Spaces
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedItem.favorableSpaces.map((space, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-xs"
                >
                  {space}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
