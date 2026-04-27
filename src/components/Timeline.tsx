import { useEffect, useRef, useState, useCallback } from 'react';
import { formatTime } from '../utils/videoUtils';

interface Props {
  duration: number;
  currentTime: number;
  markedTimes: number[];
  onSeek: (time: number) => void;
  onMark: (time: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const THUMBNAIL_COUNT = 20;
const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 45;

export default function Timeline({ duration, currentTime, markedTimes, onSeek, onMark, videoRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<{ time: number; url: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const isDragging = useRef(false);

  const generateThumbnails = useCallback(async () => {
    const video = videoRef.current;
    if (!video || duration === 0 || isGenerating) return;
    setIsGenerating(true);

    const count = Math.min(THUMBNAIL_COUNT, Math.floor(duration));
    const interval = duration / count;
    const thumbs: { time: number; url: string }[] = [];

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    const originalTime = video.currentTime;
    const originalPaused = video.paused;

    for (let i = 0; i < count; i++) {
      const t = i * interval;
      await new Promise<void>(res => {
        const onSeeked = () => {
          ctx.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
          thumbs.push({ time: t, url: canvas.toDataURL('image/jpeg', 0.5) });
          video.removeEventListener('seeked', onSeeked);
          res();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = t;
      });
    }

    video.currentTime = originalTime;
    if (!originalPaused) video.play();

    setThumbnails(thumbs);
    setIsGenerating(false);
  }, [duration, videoRef, isGenerating]);

  useEffect(() => {
    if (duration > 0) {
      generateThumbnails();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const getTimeFromX = (e: MouseEvent | React.MouseEvent): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    const time = getTimeFromX(e);
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onMark(time);
    } else {
      onSeek(time);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || e.ctrlKey || e.metaKey || e.shiftKey) return;
    onSeek(getTimeFromX(e));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    const time = getTimeFromX(e);
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onMark(time);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onMark(getTimeFromX(e));
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="bg-slate-800 rounded-lg p-2 select-none">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 font-medium">Timeline</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Ctrl+Click or Right-click to mark</span>
          {isGenerating && <span className="text-xs text-blue-400">Generating thumbnails...</span>}
        </div>
      </div>

      {/* Thumbnail strip + seek area */}
      <div
        ref={containerRef}
        className="relative rounded overflow-hidden cursor-crosshair"
        style={{ height: `${THUMB_HEIGHT + 20}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Thumbnail strip */}
        <div className="absolute inset-0 flex overflow-hidden bg-slate-900">
          {thumbnails.length > 0 ? (
            thumbnails.map((thumb, i) => (
              <img
                key={i}
                src={thumb.url}
                alt=""
                className="flex-shrink-0 object-cover"
                style={{ width: `${100 / thumbnails.length}%`, height: `${THUMB_HEIGHT}px` }}
                draggable={false}
              />
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-slate-600 text-xs">{isGenerating ? 'Generating...' : 'Timeline'}</span>
            </div>
          )}
        </div>

        {/* Time ruler at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-5 bg-slate-800/80 flex items-center px-1">
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <span
              key={ratio}
              className="absolute text-xs text-slate-400 font-mono"
              style={{ left: `${ratio * 100}%`, transform: ratio === 1 ? 'translateX(-100%)' : ratio === 0 ? 'none' : 'translateX(-50%)' }}
            >
              {formatTime(ratio * duration)}
            </span>
          ))}
        </div>

        {/* Marked time indicators */}
        {markedTimes.map(t => (
          <div
            key={t}
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10 pointer-events-none"
            style={{ left: `${(t / duration) * 100}%` }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rotate-45" />
          </div>
        ))}

        {/* Current time indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-3 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
        </div>
      </div>

      {/* Marked times list */}
      {markedTimes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {markedTimes.map(t => (
            <button
              key={t}
              onClick={() => onSeek(t)}
              onContextMenu={e => { e.preventDefault(); onMark(t); }}
              className="text-xs bg-yellow-900/40 border border-yellow-700 text-yellow-300 px-2 py-0.5 rounded font-mono hover:bg-yellow-900/60 transition-colors"
              title="Click to seek, right-click to remove"
            >
              {formatTime(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
