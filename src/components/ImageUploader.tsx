import { useRef, useState } from 'react';

interface Props {
  onImagesLoad: (files: File[]) => void;
}

export default function ImageUploader({ onImagesLoad }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) onImagesLoad(imageFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
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
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <div className="text-6xl mb-4">🖼️</div>
      <p className="text-lg font-semibold text-slate-300 mb-1">Drop image files here</p>
      <p className="text-sm text-slate-500 mb-4">or click to browse</p>
      <p className="text-xs text-slate-600">Supports PNG, JPG, WebP, GIF, and more</p>
    </div>
  );
}
