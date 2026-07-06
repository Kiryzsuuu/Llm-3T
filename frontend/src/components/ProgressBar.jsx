function kelasUntukPersen(persen) {
  if (persen > 80) return 'hi';
  if (persen >= 50) return 'md';
  if (persen >= 30) return 'lo';
  return 'cr';
}

export default function ProgressBar({ persen = 0, label, showPercent = true }) {
  const nilai = Math.max(0, Math.min(100, Math.round(persen)));

  return (
    <div>
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-2" style={{ fontSize: 11, color: 'var(--muted)' }}>
          {label && <span>{label}</span>}
          {showPercent && <span style={{ fontWeight: 500 }}>{nilai}%</span>}
        </div>
      )}
      <div className="bar">
        <div className={kelasUntukPersen(nilai)} style={{ width: `${nilai}%` }} />
      </div>
    </div>
  );
}
