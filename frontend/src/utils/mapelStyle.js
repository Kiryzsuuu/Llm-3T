const GAYA_MAPEL = {
  ipa: { icon: 'ti-flask', warna: 'teal' },
  matematika: { icon: 'ti-math-symbols', warna: 'blue' },
  'b. indonesia': { icon: 'ti-book-2', warna: 'amber' },
  'bahasa indonesia': { icon: 'ti-book-2', warna: 'amber' },
  ips: { icon: 'ti-world', warna: 'purple' },
  'b. inggris': { icon: 'ti-language', warna: 'red' },
  'bahasa inggris': { icon: 'ti-language', warna: 'red' },
  ppkn: { icon: 'ti-flag', warna: 'blue' },
};

export function gayaMapel(mapel) {
  const key = (mapel || '').trim().toLowerCase();
  return GAYA_MAPEL[key] || { icon: 'ti-book', warna: 'teal' };
}

export const WARNA_HEX = {
  teal: 'var(--teal)',
  blue: 'var(--blue)',
  amber: 'var(--amber)',
  purple: 'var(--purple)',
  red: 'var(--red)',
};

export const BG_HEX = {
  teal: 'var(--teal-bg)',
  blue: 'var(--blue-bg)',
  amber: 'var(--amber-bg)',
  purple: 'var(--purple-bg)',
  red: 'var(--red-bg)',
};

export const ACC_HEX = {
  teal: 'var(--teal-acc)',
  blue: 'var(--blue-acc)',
  amber: 'var(--amber-acc)',
  purple: 'var(--purple-acc)',
  red: 'var(--red-acc)',
};
