function warnaUntukPersen(persen) {
  if (persen > 80) return 'bg-green-500';
  if (persen >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function ProgressBar({ persen = 0, label, showPercent = true }) {
  const nilai = Math.max(0, Math.min(100, Math.round(persen)));

  return (
    <div>
      {(label || showPercent) && (
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-medium">{nilai}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${warnaUntukPersen(nilai)}`}
          style={{ width: `${nilai}%` }}
        />
      </div>
    </div>
  );
}
