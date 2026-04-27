import { useState, useRef } from 'react';
import { ExtractedFrame } from './types';
import VideoUploader from './components/VideoUploader';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import FrameGallery from './components/FrameGallery';
import FrameEditor from './components/FrameEditor';
import { captureFrame } from './utils/videoUtils';

function formatTimeLabel(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [markedTimes, setMarkedTimes] = useState<number[]>([]);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<ExtractedFrame | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoLoad = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setMarkedTimes([]);
    setExtractedFrames([]);
    setSelectedFrame(null);
    setCurrentTime(0);
  };

  const handleMarkTime = (time: number) => {
    setMarkedTimes(prev => {
      const exists = prev.some(t => Math.abs(t - time) < 0.05);
      if (exists) return prev.filter(t => Math.abs(t - time) >= 0.05);
      return [...prev, time].sort((a, b) => a - b);
    });
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleExtractCurrent = async () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    const dataUrl = await captureFrame(videoRef.current, time);
    const frame: ExtractedFrame = {
      id: `frame-${Date.now()}`,
      time,
      dataUrl,
      label: formatTimeLabel(time),
    };
    setExtractedFrames(prev => [...prev, frame]);
  };

  const handleExtractMarked = async () => {
    if (!videoRef.current || markedTimes.length === 0) return;
    setIsExtracting(true);
    const newFrames: ExtractedFrame[] = [];
    for (const time of markedTimes) {
      const dataUrl = await captureFrame(videoRef.current, time);
      newFrames.push({
        id: `frame-${Date.now()}-${Math.round(time * 1000)}`,
        time,
        dataUrl,
        label: formatTimeLabel(time),
      });
    }
    setExtractedFrames(prev => [...prev, ...newFrames]);
    setIsExtracting(false);
  };

  const handleDeleteFrame = (id: string) => {
    setExtractedFrames(prev => prev.filter(f => f.id !== id));
    if (selectedFrame?.id === id) setSelectedFrame(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">VH</span>
        </div>
        <h1 className="text-xl font-bold text-white">VideoHandle</h1>
        <span className="text-slate-400 text-sm">Video Frame Processing Tool</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-96 flex-shrink-0 flex flex-col border-r border-slate-700 overflow-y-auto">
          {!videoUrl ? (
            <div className="flex-1 p-4">
              <VideoUploader onVideoLoad={handleVideoLoad} />
            </div>
          ) : (
            <>
              <div className="p-3">
                <VideoPlayer
                  videoRef={videoRef}
                  src={videoUrl}
                  onDurationLoad={setVideoDuration}
                  onTimeUpdate={setCurrentTime}
                />
              </div>
              {videoDuration > 0 && (
                <div className="px-3 pb-3">
                  <Timeline
                    duration={videoDuration}
                    currentTime={currentTime}
                    markedTimes={markedTimes}
                    onSeek={handleSeek}
                    onMark={handleMarkTime}
                    videoRef={videoRef}
                  />
                </div>
              )}
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={handleExtractCurrent}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  Extract Current
                </button>
                <button
                  onClick={handleExtractMarked}
                  disabled={markedTimes.length === 0 || isExtracting}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  {isExtracting ? 'Extracting...' : `Extract Marked (${markedTimes.length})`}
                </button>
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={() => { setVideoUrl(''); setVideoDuration(0); }}
                  className="text-slate-400 hover:text-slate-200 text-xs underline"
                >
                  ← Change Video
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {extractedFrames.length > 0 && (
            <div className="border-b border-slate-700 flex-shrink-0">
              <FrameGallery
                frames={extractedFrames}
                selectedId={selectedFrame?.id}
                onSelect={setSelectedFrame}
                onDelete={handleDeleteFrame}
              />
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {selectedFrame ? (
              <FrameEditor
                frame={selectedFrame}
                onFrameUpdate={(updated) => {
                  setExtractedFrames(prev => prev.map(f => f.id === updated.id ? updated : f));
                  setSelectedFrame(updated);
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                {extractedFrames.length === 0 ? (
                  <div className="text-center">
                    <div className="text-5xl mb-4">🎬</div>
                    <p className="text-lg font-medium text-slate-400">Upload a video to get started</p>
                    <p className="text-sm mt-2 text-slate-500">Mark frames on the timeline, then extract them</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-4xl mb-3">👆</div>
                    <p className="text-slate-400">Click a frame thumbnail above to edit it</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
