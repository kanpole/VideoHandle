import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { ExtractedFrame, RemovedColor } from '../types';
import ColorPicker from './ColorPicker';
import { removeBackground, imageDataToDataUrl, dataUrlToImageData, getPixelColor } from '../utils/imageUtils';

interface Props {
  frame: ExtractedFrame;
  onFrameUpdate: (frame: ExtractedFrame) => void;
}

type Mode = 'navigate' | 'pick' | 'select';

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function FrameEditor({ frame, onFrameUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const [mode, setMode] = useState<Mode>('pick');
  const [pickedColors, setPickedColors] = useState<RemovedColor[]>([]);
  const [tolerance, setTolerance] = useState(30);
  const [edgeSmoothing, setEdgeSmoothing] = useState(2);
  const [removeAllOccurrences, setRemoveAllOccurrences] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<SelectionRect | null>(null);
  const [selectionDrag, setSelectionDrag] = useState<DragState | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [overlayRect, setOverlayRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const originalDataUrl = useRef<string>(frame.dataUrl);
  const currentImageData = useRef<ImageData | null>(null);
  const [displayUrl, setDisplayUrl] = useState(frame.dataUrl);

  // When frame changes, reset all state
  useEffect(() => {
    originalDataUrl.current = frame.dataUrl;
    setDisplayUrl(frame.dataUrl);
    setPickedColors([]);
    setSelectedRegion(null);
    setSelectionDrag(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    currentImageData.current = null;
  }, [frame.id, frame.dataUrl]);

  // Draw to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      currentImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCanvasDimensions({ width: canvas.width, height: canvas.height });
    };
    img.src = displayUrl;
  }, [displayUrl]);

  // Keep the SVG overlay rect in sync with the canvas's rendered position
  useLayoutEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setOverlayRect({
      left: canvasRect.left - containerRect.left,
      top: canvasRect.top - containerRect.top,
      width: canvasRect.width,
      height: canvasRect.height,
    });
  }, [zoom, offset, canvasDimensions]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
  }, []);

  // Convert a viewport-coordinate mouse event to canvas pixel coordinates
  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY),
    };
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'pick' || !currentImageData.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const color = getPixelColor(currentImageData.current, x, y);
    const hex = `#${[color.r, color.g, color.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

    setPickedColors(prev => {
      if (prev.some(c => c.hex === hex)) return prev;
      return [...prev, { ...color, hex }];
    });
  }, [mode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'navigate') {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    } else if (mode === 'select') {
      const coords = toCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;
      const canvas = canvasRef.current!;
      // Only start selection if the initial click is within canvas bounds
      if (coords.x < 0 || coords.x >= canvas.width || coords.y < 0 || coords.y >= canvas.height) return;
      setSelectionDrag({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'navigate' && isPanning) {
      setOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      });
    } else if (mode === 'select' && selectionDrag) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const coords = toCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;
      const x = Math.max(0, Math.min(canvas.width - 1, coords.x));
      const y = Math.max(0, Math.min(canvas.height - 1, coords.y));
      setSelectionDrag(prev => prev ? { ...prev, x2: x, y2: y } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mode === 'navigate') {
      setIsPanning(false);
    } else if (mode === 'select' && selectionDrag) {
      const canvas = canvasRef.current;
      let x2 = selectionDrag.x2;
      let y2 = selectionDrag.y2;
      if (canvas) {
        const coords = toCanvasCoords(e.clientX, e.clientY);
        if (coords) {
          x2 = Math.max(0, Math.min(canvas.width - 1, coords.x));
          y2 = Math.max(0, Math.min(canvas.height - 1, coords.y));
        }
      }
      const x1 = Math.min(selectionDrag.x1, x2);
      const y1 = Math.min(selectionDrag.y1, y2);
      const x2f = Math.max(selectionDrag.x1, x2);
      const y2f = Math.max(selectionDrag.y1, y2);
      // Only commit selection if it is large enough to be meaningful
      if (x2f - x1 >= 5 && y2f - y1 >= 5) {
        setSelectedRegion({ x: x1, y: y1, width: x2f - x1, height: y2f - y1 });
      }
      setSelectionDrag(null);
    }
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    setSelectionDrag(null);
  };

  const handleRemoveBackground = async () => {
    if (pickedColors.length === 0) return;
    setIsProcessing(true);

    const imageData = await dataUrlToImageData(originalDataUrl.current);
    const result = removeBackground(imageData, {
      colors: pickedColors,
      tolerance,
      edgeSmoothing,
      removeAllOccurrences,
      region: selectedRegion ?? undefined,
    });
    const newUrl = imageDataToDataUrl(result);
    setDisplayUrl(newUrl);
    setIsProcessing(false);
  };

  const handleReset = () => {
    setDisplayUrl(originalDataUrl.current);
    setPickedColors([]);
    setSelectedRegion(null);
    setSelectionDrag(null);
    currentImageData.current = null;
  };

  const handleExport = () => {
    const link = document.createElement('a');
    link.href = displayUrl;
    link.download = `frame-${frame.label.replace(/[:.]/g, '-')}.png`;
    link.click();
  };

  const handleApplyToFrame = () => {
    onFrameUpdate({ ...frame, dataUrl: displayUrl });
  };

  const hasEdits = displayUrl !== originalDataUrl.current;

  // Cursor style per mode
  const containerCursor =
    mode === 'pick' ? 'crosshair' :
    mode === 'select' ? 'crosshair' :
    isPanning ? 'grabbing' : 'grab';

  return (
    <div className="flex h-full">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 checkerboard overflow-hidden relative"
        style={{ cursor: containerCursor }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              display: 'block',
            }}
          />
        </div>

        {/* Selection overlay SVG — positioned in the container's coordinate space */}
        {overlayRect.width > 0 && canvasDimensions.width > 0 && (selectedRegion || selectionDrag) && (
          <svg
            style={{
              position: 'absolute',
              left: overlayRect.left,
              top: overlayRect.top,
              width: overlayRect.width,
              height: overlayRect.height,
              pointerEvents: 'none',
              zIndex: 10,
            }}
            viewBox={`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`}
          >
            {/* Committed selection */}
            {selectedRegion && !selectionDrag && (
              <rect
                x={selectedRegion.x}
                y={selectedRegion.y}
                width={selectedRegion.width}
                height={selectedRegion.height}
                fill="rgba(59, 130, 246, 0.15)"
                stroke="rgba(59, 130, 246, 0.9)"
                strokeWidth="2"
                strokeDasharray="8 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {/* Active drag */}
            {selectionDrag && (
              <rect
                x={Math.min(selectionDrag.x1, selectionDrag.x2)}
                y={Math.min(selectionDrag.y1, selectionDrag.y2)}
                width={Math.abs(selectionDrag.x2 - selectionDrag.x1)}
                height={Math.abs(selectionDrag.y2 - selectionDrag.y1)}
                fill="rgba(59, 130, 246, 0.15)"
                stroke="rgba(59, 130, 246, 0.9)"
                strokeWidth="2"
                strokeDasharray="8 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}

        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {Math.round(zoom * 100)}% · Scroll to zoom
        </div>
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          Frame: {frame.label}
        </div>
      </div>

      {/* Controls panel */}
      <div className="w-72 flex-shrink-0 bg-slate-800 border-l border-slate-700 flex flex-col overflow-y-auto">
        <div className="p-4 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-200 mb-3">Frame Editor</h2>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-600 mb-4">
              <button
                onClick={() => setMode('pick')}
                className={`flex-1 text-xs py-1.5 transition-colors ${mode === 'pick' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                🎨 Pick
              </button>
              <button
                onClick={() => { setMode('select'); setSelectionDrag(null); }}
                className={`flex-1 text-xs py-1.5 transition-colors ${mode === 'select' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ⬜ Select
              </button>
              <button
                onClick={() => setMode('navigate')}
                className={`flex-1 text-xs py-1.5 transition-colors ${mode === 'navigate' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ✋ Navigate
              </button>
            </div>
          </div>

          {/* Picked Colors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Colors to Remove</span>
              {pickedColors.length > 0 && (
                <button
                  onClick={() => setPickedColors([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear all
                </button>
              )}
            </div>
            <ColorPicker
              colors={pickedColors}
              onRemove={hex => setPickedColors(prev => prev.filter(c => c.hex !== hex))}
            />
          </div>

          {/* Selection region */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Region</span>
              {selectedRegion && (
                <button
                  onClick={() => setSelectedRegion(null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              )}
            </div>
            {selectedRegion ? (
              <div className="bg-blue-900/30 rounded px-2 py-1.5 text-xs text-blue-300">
                {selectedRegion.width} × {selectedRegion.height} px &nbsp;·&nbsp; ({selectedRegion.x}, {selectedRegion.y})
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {mode === 'select'
                  ? 'Drag on the canvas to select an area'
                  : 'No region — full image will be processed'}
              </p>
            )}
          </div>

          {/* Tolerance */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Tolerance</label>
              <span className="text-xs text-blue-400 font-mono">{tolerance}</span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              value={tolerance}
              onChange={e => setTolerance(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-0.5">
              <span>Exact</span>
              <span>Broad</span>
            </div>
          </div>

          {/* Edge Smoothing */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Edge Smoothing</label>
              <span className="text-xs text-blue-400 font-mono">{edgeSmoothing}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={edgeSmoothing}
              onChange={e => setEdgeSmoothing(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-0.5">
              <span>Sharp</span>
              <span>Smooth</span>
            </div>
          </div>

          {/* Remove All Occurrences toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Remove Everywhere</label>
              <button
                onClick={() => setRemoveAllOccurrences(prev => !prev)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${removeAllOccurrences ? 'bg-blue-600' : 'bg-slate-600'}`}
                aria-pressed={removeAllOccurrences}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${removeAllOccurrences ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {removeAllOccurrences
                ? 'Removes color everywhere, including inside the subject'
                : 'Only removes color connected to the boundary (flood fill)'}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleRemoveBackground}
              disabled={pickedColors.length === 0 || isProcessing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {isProcessing ? 'Processing...' : '✂️ Remove Background'}
            </button>

            {hasEdits && (
              <button
                onClick={handleApplyToFrame}
                className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                ✅ Apply Changes
              </button>
            )}

            <button
              onClick={handleReset}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              🔄 Reset to Original
            </button>

            <button
              onClick={handleExport}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              ⬇️ Export PNG
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">How to use:</p>
            <p>1. In <strong>Pick</strong> mode, click the canvas to sample colors</p>
            <p>2. Optionally use <strong>Select</strong> mode to drag a region on the canvas — removal will be limited to that area</p>
            <p>3. Toggle <strong>Remove Everywhere</strong> to also strip the color from inside the subject, not just the connected background</p>
            <p>4. Adjust tolerance and edge smoothing</p>
            <p>5. Click <strong>Remove Background</strong></p>
            <p>6. Export as PNG with transparency</p>
          </div>
        </div>
      </div>
    </div>
  );
}
