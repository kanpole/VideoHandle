import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../utils/videoUtils';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  onDurationLoad: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
}

export default function VideoPlayer({ videoRef, src, onDurationLoad, onTimeUpdate }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Validate src is a safe blob or data URL (guards against javascript: URLs)
  const safeSrc = /^(blob:|data:video\/)/.test(src) ? src : '';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration);
      onDurationLoad(video.duration);
    };
    const onTimeUpd = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate(video.currentTime);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpd);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpd);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [videoRef, onDurationLoad, onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !videoRef.current) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * duration;
  };

  const handleSkip = (delta: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={safeSrc}
        className="w-full"
        style={{ maxHeight: '240px', display: 'block' }}
      />
      <div className="bg-slate-800 px-3 py-2">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1.5 bg-slate-600 rounded-full mb-2 cursor-pointer relative"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSkip(-5)}
            className="text-slate-400 hover:text-white transition-colors text-xs px-1"
            title="-5s"
          >
            ⏮ 5s
          </button>
          <button
            onClick={togglePlay}
            className="bg-blue-600 hover:bg-blue-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => handleSkip(5)}
            className="text-slate-400 hover:text-white transition-colors text-xs px-1"
            title="+5s"
          >
            5s ⏭
          </button>
          <span className="text-slate-400 text-xs ml-1 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
