import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Sun } from 'lucide-react';
import { VastuKnowledgeRule, vastuClientService } from '@/services/vastuService';

export const VastuKnowledgeBrowser: React.FC = () => {
  const [rules, setRules] = useState<VastuKnowledgeRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedTradition, setSelectedTradition] = useState<string>('');
  const [selectedSpaceType, setSelectedSpaceType] = useState<string>('');

  useEffect(() => {
    loadRules();
  }, [selectedDirection, selectedTradition, selectedSpaceType]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await vastuClientService.getRules({
        direction: selectedDirection || undefined,
        tradition: selectedTradition || undefined,
        space_type: selectedSpaceType || undefined,
      });
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.topic.toLowerCase().includes(query) ||
      r.space_type.toLowerCase().includes(query) ||
      r.recommendation.toLowerCase().includes(query) ||
      r.explanation.toLowerCase().includes(query) ||
      r.source_reference.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 w-full">
      {/* Search & Filter Header Bar */}
      <div className="glass-surface-warm rounded-2xl p-4 border border-archBorder/60 shadow-glass flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mutedInk" />
          <input
            type="text"
            placeholder="Search Vastu canons (e.g. Kitchen fire placement, Courtyard light, Master bedroom)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 rounded-xl glass-input-field"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Direction Filter */}
          <select
            value={selectedDirection}
            onChange={(e) => setSelectedDirection(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-xl glass-input-field"
          >
            <option value="">All Directions</option>
            <option value="North">North</option>
            <option value="North-East">North-East</option>
            <option value="East">East</option>
            <option value="South-East">South-East</option>
            <option value="South">South</option>
            <option value="South-West">South-West</option>
            <option value="West">West</option>
            <option value="North-West">North-West</option>
            <option value="Center">Center (Brahmasthan)</option>
          </select>

          {/* Tradition Filter */}
          <select
            value={selectedTradition}
            onChange={(e) => setSelectedTradition(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-xl glass-input-field"
          >
            <option value="">All Traditions</option>
            <option value="Manasara">Manasara</option>
            <option value="Mayamata">Mayamata</option>
            <option value="Brihat Samhita">Brihat Samhita</option>
            <option value="Samarangana Sutradhara">Samarangana Sutradhara</option>
            <option value="Vishvakarma Prakash">Vishvakarma Prakash</option>
          </select>

          {(selectedDirection || selectedTradition || selectedSpaceType || searchQuery) && (
            <button
              onClick={() => {
                setSelectedDirection('');
                setSelectedTradition('');
                setSelectedSpaceType('');
                setSearchQuery('');
              }}
              className="text-xs text-mutedInk hover:text-espresso px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-mutedInk glass-surface-warm rounded-2xl">
          Loading authenticated Vastu canons...
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="p-12 text-center glass-surface-warm rounded-2xl border border-archBorder/60">
          <BookOpen className="w-8 h-8 text-espresso/40 mx-auto mb-2" />
          <h4 className="text-sm font-serif font-bold text-espresso">No Principles Found</h4>
          <p className="text-xs text-mutedInk mt-1">Try broadening your search query or clearing directional filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.rule_id}
              className="glass-panel-elevated rounded-2xl p-5 border border-archBorder/60 shadow-glass flex flex-col justify-between space-y-3 card-3d-tilt"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cream border border-archBorder/50 text-espresso font-bold">
                    {rule.rule_id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bronze/10 text-espresso border border-bronze/30 font-semibold">
                      {rule.direction}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {rule.confidence_level}
                    </span>
                  </div>
                </div>

                <h4 className="text-base font-serif font-bold text-espresso">{rule.topic}</h4>
                <p className="text-xs text-ink leading-relaxed">
                  <strong className="text-espresso font-semibold">Guidance: </strong>
                  {rule.recommendation}
                </p>

                <p className="text-xs text-mutedInk leading-relaxed">
                  <strong className="text-espresso/90 font-medium">Philosophy: </strong>
                  {rule.explanation}
                </p>

                {/* Architectural Rationale */}
                <div className="p-3 rounded-xl bg-cream/70 border border-archBorder/40 text-xs text-espresso/90 flex items-start gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-espresso">Bioclimatic Rationale: </span>
                    {rule.architectural_rationale}
                  </div>
                </div>

                {rule.variations && (
                  <p className="text-[11px] text-mutedInk italic">
                    <strong className="text-espresso not-italic font-medium">Tradition Variations: </strong>
                    {rule.variations}
                  </p>
                )}
              </div>

              {/* Source Reference Footer */}
              <div className="pt-2 border-t border-archBorder/40 flex items-center justify-between text-[11px] text-faintInk">
                <span className="font-serif italic">
                  Ref: {rule.source_reference}
                </span>
                <span className="font-mono text-espresso font-medium">
                  {rule.tradition}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
