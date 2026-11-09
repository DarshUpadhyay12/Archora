import React, { useState, useRef, useEffect } from 'react';
import { Layers, Eye, Compass, RotateCcw } from 'lucide-react';

interface ArchitecturalBuilding3DProps {
  className?: string;
}

export const ArchitecturalBuilding3D: React.FC<ArchitecturalBuilding3DProps> = ({ className = '' }) => {
  const [rotX, setRotX] = useState<number>(24);
  const [rotY, setRotY] = useState<number>(-35);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [explodedView, setExplodedView] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-rotation effect
  useEffect(() => {
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (autoRotate && !isDragging) {
        setRotY((prev) => (prev + delta * 12) % 360);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [autoRotate, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotY((prev) => prev + dx * 0.5);
    setRotX((prev) => Math.max(-60, Math.min(80, prev - dy * 0.5)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    setRotY((prev) => prev + dx * 0.5);
    setRotX((prev) => Math.max(-60, Math.min(80, prev - dy * 0.5)));
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const resetView = () => {
    setRotX(24);
    setRotY(-35);
    setExplodedView(false);
  };

  // Exploded layer offsets
  const roofY = explodedView ? -90 : -50;
  const upperFloorY = explodedView ? -35 : -20;
  const groundFloorY = explodedView ? 25 : 10;
  const foundationY = explodedView ? 75 : 40;

  return (
    <div
      className={`relative w-full h-[400px] sm:h-[480px] rounded-2xl overflow-hidden glass-panel-elevated select-none ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      aria-label="Interactive 3D Architectural Model Preview"
    >
      {/* Background Architectural Blueprint Grid */}
      <div className="absolute inset-0 architectural-grid-bg opacity-75 pointer-events-none" />

      {/* Floating 3D Scene Container */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '1100px' }}>
        <div
          className="relative transition-transform duration-75 ease-out"
          style={{
            width: '240px',
            height: '240px',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          }}
        >
          {/* Foundation Grid / Site Plan Base */}
          <div
            className="absolute inset-0 border border-archBorder/60 bg-cream/30 backdrop-blur-sm"
            style={{
              transform: `translateY(${foundationY}px) rotateX(90deg)`,
              transformStyle: 'preserve-3d',
              boxShadow: '0 20px 40px rgba(72,42,24,0.12)',
            }}
          >
            {/* Ground Grid Lines */}
            <div className="w-full h-full grid grid-cols-4 grid-rows-4 divide-x divide-y divide-archBorder/40">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                  {i === 5 && <div className="w-2 h-2 rounded-full bg-bronze/60 animate-ping" />}
                </div>
              ))}
            </div>
          </div>

          {/* Ground Floor Slab & Core */}
          <div
            className={`absolute inset-4 transition-all duration-500 ${
              showWireframe
                ? 'border-2 border-dashed border-espresso/80 bg-transparent'
                : 'border border-archBorder/80 bg-cream/80 backdrop-blur-md shadow-md'
            }`}
            style={{
              transform: `translateY(${groundFloorY}px) rotateX(90deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Entrance Axis Indicator */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-bronze/50 rounded-t" />
          </div>

          {/* Structural Vertical Glass Columns */}
          {[
            { x: '16px', y: '16px' },
            { x: '200px', y: '16px' },
            { x: '16px', y: '200px' },
            { x: '200px', y: '200px' },
            { x: '108px', y: '16px' },
            { x: '108px', y: '200px' },
          ].map((col, idx) => (
            <div
              key={idx}
              className={`absolute w-2 transition-all duration-500 ${
                showWireframe ? 'border border-espresso bg-transparent' : 'bg-espresso/70 backdrop-blur'
              }`}
              style={{
                left: col.x,
                top: col.y,
                height: `${foundationY - roofY}px`,
                transform: `translateY(${roofY}px)`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            />
          ))}

          {/* Upper Floor Glass Mezzanine */}
          <div
            className={`absolute inset-8 transition-all duration-500 ${
              showWireframe
                ? 'border border-espresso/70 bg-transparent'
                : 'border border-archBorder bg-parchment/75 backdrop-blur-lg shadow-lg'
            }`}
            style={{
              transform: `translateY(${upperFloorY}px) rotateX(90deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Cantilever Terrace */}
            <div className="absolute -top-3 left-4 right-4 h-3 border-t border-dashed border-bronze/70 bg-cream/40" />
          </div>

          {/* Roof Canopy / Bioclimatic Skylight Louver */}
          <div
            className={`absolute inset-2 transition-all duration-500 ${
              showWireframe
                ? 'border-2 border-espresso bg-transparent'
                : 'border border-bronze/70 bg-gradient-to-br from-cream/95 to-parchment/80 backdrop-blur-xl shadow-xl'
            }`}
            style={{
              transform: `translateY(${roofY}px) rotateX(90deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Skylight Aperture */}
            <div className="absolute inset-8 border border-archBorder/60 bg-blue-50/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-[9px] font-mono uppercase tracking-widest text-espresso/60">Atrium Core</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Header Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full glass-stat-card border border-archBorder/50">
        <Compass className="w-3.5 h-3.5 text-espresso animate-spin-slow" />
        <span className="text-xs font-serif font-bold text-espresso tracking-wide">3D Architectural Pavilion</span>
        <span className="text-[10px] font-mono text-mutedInk">[{Math.round(rotY)}°, {Math.round(rotX)}°]</span>
      </div>

      {/* Interactive Controls Overlay */}
      <div className="absolute bottom-4 inset-x-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        <div className="text-[11px] text-mutedInk font-sans bg-cream/70 backdrop-blur-md px-2.5 py-1 rounded-md border border-archBorder/40 hidden sm:block">
          Drag to rotate • Real-time CSS 3D Projection
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Exploded / Layer View Toggle */}
          <button
            onClick={() => setExplodedView(!explodedView)}
            title="Toggle Exploded Spatial Layers"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              explodedView
                ? 'bg-espresso text-cream shadow-md'
                : 'glass-stat-card text-espresso hover:bg-cream'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{explodedView ? 'Joined' : 'Explode'}</span>
          </button>

          {/* Wireframe Mode Toggle */}
          <button
            onClick={() => setShowWireframe(!showWireframe)}
            title="Toggle Architectural Wireframe"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              showWireframe
                ? 'bg-espresso text-cream shadow-md'
                : 'glass-stat-card text-espresso hover:bg-cream'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>{showWireframe ? 'Solid' : 'Wireframe'}</span>
          </button>

          {/* Auto-Rotation Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Continuous Rotation"
            className={`px-2 py-1 rounded-lg text-xs font-medium glass-stat-card text-espresso hover:bg-cream ${
              autoRotate ? 'border-bronze text-espresso font-semibold' : ''
            }`}
          >
            {autoRotate ? 'Pause' : 'Rotate'}
          </button>

          {/* Reset View Button */}
          <button
            onClick={resetView}
            title="Reset Perspective Angle"
            className="p-1 rounded-lg glass-stat-card text-espresso hover:bg-cream"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
