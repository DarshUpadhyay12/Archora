import React, { useState, useRef } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Compass,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Grid,
  FileImage,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { PlacedRoom, VastuEvaluationResult, vastuClientService } from '@/services/vastuService';

interface VastuFloorPlanAnalyzerProps {
  onEvaluationComplete: (result: VastuEvaluationResult, rooms: PlacedRoom[], northDegrees: number, image: string | null) => void;
  initialRooms?: PlacedRoom[];
  initialNorthDegrees?: number;
  initialImageUrl?: string | null;
}

const COMMON_SPACE_TYPES = [
  'Main entrance',
  'Kitchen',
  'Master bedroom',
  "Children's bedroom",
  'Guest bedroom',
  'Prayer room',
  'Living room',
  'Dining area',
  'Study room',
  'Bathroom',
  'Staircase',
  'Water storage',
  'Garden and open spaces',
];

const VASTU_ZONES = [
  { id: 'NW', name: 'North-West', deity: 'Vayu (Wind)', shortName: 'NW', tag: 'Vayu', color: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900' },
  { id: 'N', name: 'North', deity: 'Kubera (Wealth)', shortName: 'N', tag: 'Kubera', color: 'bg-sky-500/5 border-sky-500/20 text-sky-900' },
  { id: 'NE', name: 'North-East', deity: 'Ishanya (Water/Ether)', shortName: 'NE', tag: 'Ishanya', color: 'bg-teal-500/8 border-teal-500/25 text-teal-900' },
  { id: 'W', name: 'West', deity: 'Varuna (Water)', shortName: 'W', tag: 'Varuna', color: 'bg-indigo-500/5 border-indigo-500/20 text-indigo-900' },
  { id: 'C', name: 'Center', deity: 'Brahmasthan (Ether)', shortName: 'Center', tag: 'Brahma', color: 'bg-amber-500/10 border-amber-500/30 text-amber-950 font-bold' },
  { id: 'E', name: 'East', deity: 'Indra / Surya (Light)', shortName: 'E', tag: 'Indra', color: 'bg-amber-500/5 border-amber-500/20 text-amber-900' },
  { id: 'SW', name: 'South-West', deity: 'Nairutya (Earth)', shortName: 'SW', tag: 'Nairutya', color: 'bg-stone-500/8 border-stone-500/25 text-stone-900' },
  { id: 'S', name: 'South', deity: 'Yama (Order)', shortName: 'S', tag: 'Yama', color: 'bg-orange-500/5 border-orange-500/20 text-orange-900' },
  { id: 'SE', name: 'South-East', deity: 'Agneya (Fire)', shortName: 'SE', tag: 'Agni', color: 'bg-rose-500/5 border-rose-500/20 text-rose-900' },
];

export const VastuFloorPlanAnalyzer: React.FC<VastuFloorPlanAnalyzerProps> = ({
  onEvaluationComplete,
  initialRooms = [],
  initialNorthDegrees = 0,
  initialImageUrl = null,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [useBlankGrid, setUseBlankGrid] = useState<boolean>(!initialImageUrl && initialRooms.length > 0);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [geographicNorthDegrees, setGeographicNorthDegrees] = useState<number>(initialNorthDegrees);
  const [buildingType, setBuildingType] = useState<string>('Residential');
  const [tradition, setTradition] = useState<string>('Manasara');
  const [rooms, setRooms] = useState<PlacedRoom[]>(initialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [showDirectionGrid, setShowDirectionGrid] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File Upload Processing
  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid architectural drawing image (PNG, JPG, WebP, SVG).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string);
      setUseBlankGrid(false);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  // Add Room manually
  const handleAddRoom = (defaultType?: string) => {
    const type = defaultType || COMMON_SPACE_TYPES[0];
    const newRoom: PlacedRoom = {
      id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: type,
      spaceType: type,
      x: 0.5,
      y: 0.5,
    };
    setRooms([...rooms, newRoom]);
    setSelectedRoomId(newRoom.id);
    if (!imageUrl && !useBlankGrid) {
      setUseBlankGrid(true);
    }
  };

  // Remove Room
  const handleRemoveRoom = (id: string) => {
    setRooms(rooms.filter((r) => r.id !== id));
    if (selectedRoomId === id) setSelectedRoomId(null);
  };

  // Update Room Details
  const handleUpdateRoom = (id: string, updates: Partial<PlacedRoom>) => {
    setRooms(rooms.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Canvas Click to Reposition Selected Room
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selectedRoomId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));

    handleUpdateRoom(selectedRoomId, { x, y });
  };

  // Run Deterministic Evaluation
  const handleRunEvaluation = async () => {
    if (rooms.length === 0) {
      setErrorMessage('Please place at least one room or spatial zone to evaluate.');
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    try {
      const result = await vastuClientService.evaluateLayout({
        rooms,
        geographicNorthDegrees,
        buildingType,
        tradition,
      });

      onEvaluationComplete(result, rooms, geographicNorthDegrees, imageUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete Vastu layout evaluation.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const isWorkspaceActive = !!imageUrl || useBlankGrid;

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* 1. Floor Plan Canvas / Interactive Overlay */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl glass-stat-card border border-archBorder/60 shadow-xs">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 transition shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{imageUrl ? 'Replace Drawing' : 'Upload Floor Plan'}</span>
            </button>

            {!imageUrl && !useBlankGrid && (
              <button
                onClick={() => setUseBlankGrid(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium glass-stat-card text-espresso hover:bg-cream transition"
              >
                <Grid className="w-3.5 h-3.5 text-bronze" />
                <span>Use Blank Vastu Grid</span>
              </button>
            )}

            {isWorkspaceActive && (
              <button
                onClick={() => {
                  setImageUrl(null);
                  setUseBlankGrid(false);
                }}
                className="text-xs text-mutedInk hover:text-red-700 underline px-2 py-1 transition"
              >
                Reset Canvas
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isWorkspaceActive && (
              <button
                onClick={() => setShowDirectionGrid(!showDirectionGrid)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  showDirectionGrid
                    ? 'bg-cream border border-bronze text-espresso font-semibold shadow-xs'
                    : 'text-mutedInk hover:bg-cream glass-stat-card'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-bronze" />
                <span>Vastu 9-Grid {showDirectionGrid ? 'On' : 'Off'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5 shadow-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* INTERACTIVE DRAWING WORKSPACE / DROPZONE                        */}
        {/* ============================================================== */}
        {!isWorkspaceActive ? (
          /* CLEAN, UNCLUTTERED UPLOAD DROPZONE (NO OVERLAPPING 9-GRID!) */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full aspect-[4/3] min-h-[360px] sm:min-h-[460px] rounded-3xl border-2 border-dashed transition-all duration-300 p-8 flex flex-col items-center justify-center text-center cursor-pointer select-none relative overflow-hidden ${
              isDraggingFile
                ? 'border-espresso bg-cream/90 shadow-glass-hover scale-[0.99]'
                : 'border-archBorder/70 hover:border-espresso/80 glass-surface-warm shadow-glass'
            }`}
          >
            {/* Subtle Drafting Blueprint Grid in Background */}
            <div className="absolute inset-0 architectural-grid-bg opacity-35 pointer-events-none" />

            <div className="relative z-10 max-w-md mx-auto space-y-4 flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl glass-panel-elevated flex items-center justify-center shadow-md border border-archBorder/60 group-hover:scale-110 transition-transform">
                <Upload className="w-9 h-9 text-espresso" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-espresso tracking-tight">
                  Upload Architectural Plan
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-sans max-w-sm mx-auto">
                  Drag and drop your floor-plan drawing, AutoCAD export, or blueprint sketch to analyze canonical orientations.
                </p>
                <span className="text-[11px] font-mono text-faintInk block pt-1">
                  Supports PNG, JPG, WebP, SVG • Up to 15MB
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-espresso text-cream hover:bg-espresso/90 shadow-md transition"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Choose Drawing File</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUseBlankGrid(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold glass-panel-elevated text-espresso hover:bg-cream border border-archBorder/70 transition"
                >
                  <Grid className="w-4 h-4 text-bronze" />
                  <span>Design on Blank Vastu Grid</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE ARCHITECTURAL CANVAS WITH CALIBRATED VASTU 9-GRID */
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="relative w-full aspect-[4/3] min-h-[360px] sm:min-h-[460px] rounded-3xl overflow-hidden glass-panel-elevated border border-archBorder/60 shadow-glass flex items-center justify-center cursor-crosshair select-none"
          >
            {/* Background Floor Plan Image */}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Uploaded Floor Plan"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none p-4"
              />
            ) : (
              /* Blank Blueprint Parchment Mode */
              <div className="absolute inset-0 architectural-grid-bg opacity-45 pointer-events-none" />
            )}

            {/* VASTU PURUSHA MANDALA 9-GRID OVERLAY (CLEAN CORNER PILLS, NEVER OVERLAPPING TEXT) */}
            {showDirectionGrid && (
              <div className="absolute inset-4 pointer-events-none grid grid-cols-3 grid-rows-3 border-2 border-archBorder/70 rounded-2xl overflow-hidden">
                {VASTU_ZONES.map((zone) => (
                  <div
                    key={zone.id}
                    className={`border border-archBorder/40 p-2 flex flex-col justify-between transition-colors relative ${zone.color}`}
                  >
                    {/* Subtle Corner Badge Pill */}
                    <div className="flex items-center justify-between w-full">
                      <span className="px-1.5 py-0.5 rounded-md bg-cream/95 backdrop-blur-md border border-archBorder/50 text-[10px] sm:text-[11px] font-mono font-bold text-espresso shadow-xs">
                        <span className="hidden sm:inline">{zone.name}</span>
                        <span className="sm:hidden">{zone.shortName}</span>
                      </span>

                      <span className="text-[9px] font-mono text-espresso/70 uppercase tracking-tight hidden sm:block">
                        {zone.tag}
                      </span>
                    </div>

                    {/* Center Brahmasthan Core Accent */}
                    {zone.id === 'C' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full border border-amber-600/40 bg-amber-500/10 flex items-center justify-center">
                          <span className="text-[8px] font-serif font-bold text-amber-900">ॐ</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* FLOATING GEOGRAPHIC NORTH INDICATOR BADGE (TOP-RIGHT) */}
            <div
              className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full glass-stat-card border border-archBorder/60 shadow-md flex items-center gap-2 pointer-events-none"
              title={`True Geographic North calibrated to ${geographicNorthDegrees}° azimuth`}
            >
              <div
                className="w-5 h-5 rounded-full border border-archBorder/80 bg-cream flex items-center justify-center transition-transform duration-300 relative shadow-xs"
                style={{ transform: `rotate(${geographicNorthDegrees}deg)` }}
              >
                <div className="w-0.5 h-3.5 bg-red-600 relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-2 border-x-transparent border-b-4 border-b-red-600" />
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-espresso">
                N {geographicNorthDegrees}°
              </span>
            </div>

            {/* PLACED ROOM PINS ON CANVAS */}
            {rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              const leftPct = (room.x ?? 0.5) * 100;
              const topPct = (room.y ?? 0.5) * 100;

              return (
                <div
                  key={room.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRoomId(room.id);
                  }}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30 transition-transform ${
                    isSelected ? 'scale-110 z-40' : 'hover:scale-105'
                  }`}
                >
                  <div
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md border flex items-center gap-1.5 whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-espresso text-cream border-bronze ring-2 ring-bronze/60 shadow-lg'
                        : 'bg-cream/95 text-espresso border-archBorder/80 backdrop-blur-md'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-bronze flex-shrink-0" />
                    <span className="font-serif">{room.name || room.spaceType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Canvas Placement Tip Bar */}
        {isWorkspaceActive && (
          <div className="flex flex-wrap items-center justify-between text-xs text-mutedInk px-2 gap-2">
            <span>
              {selectedRoomId
                ? 'Click anywhere on the plan to reposition the selected room pin.'
                : 'Click any room pin or add new rooms from the right panel.'}
            </span>
            <span className="font-mono text-[11px] font-semibold text-espresso">
              {rooms.length} spatial zone(s) placed
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. ROOM INSPECTOR & ALIGNMENT CONFIGURATION PANEL               */}
      {/* ============================================================== */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        {/* Geographic North & Canon Config */}
        <div className="glass-surface-warm rounded-2xl p-4 sm:p-5 border border-archBorder/60 shadow-glass space-y-3.5">
          <h4 className="text-sm font-serif font-bold text-espresso flex items-center gap-2">
            <Compass className="w-4 h-4 text-espresso" />
            <span>Geographic Calibration</span>
          </h4>

          {/* North Degrees Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink font-medium">True Geographic North:</span>
              <span className="font-mono font-bold text-espresso bg-cream px-2 py-0.5 rounded-md border border-archBorder/50">
                {geographicNorthDegrees}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              value={geographicNorthDegrees}
              onChange={(e) => setGeographicNorthDegrees(Number(e.target.value))}
              className="w-full accent-espresso cursor-pointer h-1.5 bg-archBorder/40 rounded-lg"
              aria-label="True Geographic North slider"
            />
            <span className="text-[10px] text-faintInk block">
              Adjust if the drawing&apos;s North needle deviates from canvas vertical.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Building Typology */}
            <div>
              <label className="text-[11px] font-medium text-faintInk block mb-1">Building Typology</label>
              <select
                value={buildingType}
                onChange={(e) => setBuildingType(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl glass-input-field"
              >
                <option value="Residential">Residential Villa</option>
                <option value="Apartment">Apartment Flat</option>
                <option value="Commercial">Commercial Studio</option>
                <option value="Institutional">Educational Campus</option>
              </select>
            </div>

            {/* Classical Tradition */}
            <div>
              <label className="text-[11px] font-medium text-faintInk block mb-1">Tradition Canon</label>
              <select
                value={tradition}
                onChange={(e) => setTradition(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl glass-input-field"
              >
                <option value="Manasara">Manasara (Universal)</option>
                <option value="Mayamata">Mayamata (Dravidian)</option>
                <option value="Brihat Samhita">Brihat Samhita</option>
                <option value="Vishvakarma Prakash">Vishvakarma Prakash</option>
              </select>
            </div>
          </div>
        </div>

        {/* Room Manager List */}
        <div className="glass-surface-warm rounded-2xl p-4 sm:p-5 border border-archBorder/60 shadow-glass flex-1 flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-serif font-bold text-espresso flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-espresso" />
              <span>Spatial Layout Rooms</span>
            </h4>
            <button
              onClick={() => handleAddRoom()}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl bg-espresso text-cream hover:bg-espresso/90 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Room</span>
            </button>
          </div>

          {/* Quick-add room chips */}
          <div className="flex flex-wrap gap-1.5">
            {['Main entrance', 'Kitchen', 'Master bedroom', 'Prayer room', 'Bathroom'].map((type) => (
              <button
                key={type}
                onClick={() => handleAddRoom(type)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-cream hover:bg-parchment-light border border-archBorder/60 text-espresso transition font-medium shadow-xs"
              >
                + {type}
              </button>
            ))}
          </div>

          {/* Rooms Scroll List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {rooms.length === 0 ? (
              <div className="p-5 rounded-2xl border border-dashed border-archBorder/70 text-center text-xs text-mutedInk space-y-1">
                <p className="font-serif font-semibold text-espresso">No rooms placed yet.</p>
                <p className="text-[11px]">Click &quot;Add Room&quot; or select one of the quick chips above to position your rooms.</p>
              </div>
            ) : (
              rooms.map((room) => {
                const isSelected = selectedRoomId === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-cream/95 border-espresso shadow-xs ring-1 ring-espresso/30'
                        : 'glass-stat-card border-archBorder/40 hover:bg-cream/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => handleUpdateRoom(room.id, { name: e.target.value })}
                        className="text-xs font-semibold bg-transparent border-none text-espresso focus:ring-0 p-0 w-36 font-serif"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRoom(room.id);
                        }}
                        className="text-mutedInk hover:text-red-700 p-1 transition"
                        title="Delete Room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={room.spaceType}
                        onChange={(e) => handleUpdateRoom(room.id, { spaceType: e.target.value })}
                        className="text-[11px] px-2.5 py-1 rounded-lg glass-input-field flex-1"
                      >
                        {COMMON_SPACE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <span className="text-[10px] font-mono text-faintInk bg-cream/80 px-1.5 py-0.5 rounded border border-archBorder/40">
                        {Math.round((room.x ?? 0.5) * 100)}%, {Math.round((room.y ?? 0.5) * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Evaluate Action Button */}
          <button
            onClick={handleRunEvaluation}
            disabled={isEvaluating || rooms.length === 0}
            className="w-full mt-auto py-3 rounded-xl font-serif font-bold text-sm bg-espresso text-cream hover:bg-espresso/90 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2"
          >
            {isEvaluating ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Evaluating Canons...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Run Vastu Analysis</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
