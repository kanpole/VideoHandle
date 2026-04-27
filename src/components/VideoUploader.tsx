import { useRef, useState } from 'react';

interface Props {
  onVideoLoad: (file: File) => void;
}

export default function VideoUploader({ onVideoLoad }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      onVideoLoad(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all select-none ${
        isDragging
          ? 'border-blue-400 bg-blue-900/20'
          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
      }`}
      style={{ minHeight: '300px' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="text-6xl mb-4">🎥</div>
      <p className="text-lg font-semibold text-slate-300 mb-1">Drop a video file here</p>
      <p className="text-sm text-slate-500 mb-4">or click to browse</p>
      <p className="text-xs text-slate-600">Supports MP4, WebM, MOV</p>
    </div>
  );
}
