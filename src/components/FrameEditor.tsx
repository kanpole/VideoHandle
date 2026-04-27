import { useState, useRef, useEffect, useCallback } from 'react';
import { ExtractedFrame, RemovedColor } from '../types';
import ColorPicker from './ColorPicker';
import { removeBackground, imageDataToDataUrl, dataUrlToImageData, getPixelColor } from '../utils/imageUtils';

interface Props {
  frame: ExtractedFrame;
  onFrameUpdate: (frame: ExtractedFrame) => void;
}

type Mode = 'navigate' | 'pick';

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
  const [isProcessing, setIsProcessing] = useState(false);

  const originalDataUrl = useRef<string>(frame.dataUrl);
  const currentImageData = useRef<ImageData | null>(null);
  const [displayUrl, setDisplayUrl] = useState(frame.dataUrl);

  // When frame changes, reset
  useEffect(() => {
    originalDataUrl.current = frame.dataUrl;
    setDisplayUrl(frame.dataUrl);
    setPickedColors([]);
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
    };
    img.src = displayUrl;
  }, [displayUrl]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
  }, []);

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
    if (mode !== 'navigate') return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || mode !== 'navigate') return;
    setOffset({
      x: panStart.current.ox + (e.clientX - panStart.current.x),
      y: panStart.current.oy + (e.clientY - panStart.current.y),
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleRemoveBackground = async () => {
    if (pickedColors.length === 0) return;
    setIsProcessing(true);

    const imageData = await dataUrlToImageData(originalDataUrl.current);
    const result = removeBackground(imageData, {
      colors: pickedColors,
      tolerance,
      edgeSmoothing,
    });
    const newUrl = imageDataToDataUrl(result);
    setDisplayUrl(newUrl);
    setIsProcessing(false);
  };

  const handleReset = () => {
    setDisplayUrl(originalDataUrl.current);
    setPickedColors([]);
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

  return (
    <div className="flex h-full">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 checkerboard overflow-hidden relative"
        style={{ cursor: mode === 'pick' ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
                🎨 Pick Color
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
            <p>1. In <strong>Pick Color</strong> mode, click the background to sample its color</p>
            <p>2. Pick multiple colors if needed</p>
            <p>3. Adjust tolerance and smoothing</p>
            <p>4. Click <strong>Remove Background</strong></p>
            <p>5. Export as PNG with transparency</p>
          </div>
        </div>
      </div>
    </div>
  );
}
