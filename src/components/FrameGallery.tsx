import { ExtractedFrame } from '../types';

interface Props {
  frames: ExtractedFrame[];
  selectedId?: string;
  onSelect: (frame: ExtractedFrame) => void;
  onDelete: (id: string) => void;
}

export default function FrameGallery({ frames, selectedId, onSelect, onDelete }: Props) {
  return (
    <div className="bg-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-300">Extracted Frames ({frames.length})</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {frames.map(frame => (
          <div
            key={frame.id}
            className={`relative flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
              selectedId === frame.id
                ? 'border-blue-500 shadow-lg shadow-blue-500/30'
                : 'border-slate-600 hover:border-slate-400'
            }`}
            style={{ width: 100, height: 70 }}
            onClick={() => onSelect(frame)}
          >
            <img
              src={frame.dataUrl}
              alt={frame.label}
              className="w-full h-full object-cover"
              draggable={false}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5">
              <span className="text-xs text-white font-mono">{frame.label}</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(frame.id); }}
              className="absolute top-1 right-1 w-5 h-5 bg-red-600/80 hover:bg-red-600 rounded-full text-white text-xs flex items-center justify-center leading-none transition-colors"
              title="Delete frame"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
