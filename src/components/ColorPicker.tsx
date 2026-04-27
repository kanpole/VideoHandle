interface ColorSwatch {
  r: number;
  g: number;
  b: number;
  hex: string;
}

interface Props {
  colors: ColorSwatch[];
  onRemove: (hex: string) => void;
}

export default function ColorPicker({ colors, onRemove }: Props) {
  if (colors.length === 0) {
    return (
      <div className="text-xs text-slate-500 italic">No colors selected. Click on the image to pick colors.</div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(c => (
        <div
          key={c.hex}
          className="flex items-center gap-1.5 bg-slate-700 rounded-lg px-2 py-1"
        >
          <div
            className="w-5 h-5 rounded border border-slate-500 flex-shrink-0"
            style={{ backgroundColor: c.hex }}
          />
          <span className="text-xs font-mono text-slate-300">{c.hex}</span>
          <button
            onClick={() => onRemove(c.hex)}
            className="text-slate-400 hover:text-red-400 ml-0.5 text-sm leading-none transition-colors"
            title="Remove color"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
