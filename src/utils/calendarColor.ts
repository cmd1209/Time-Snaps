const palette = [
  ['--color-calendar-purple', '#c8b7e6'],
  ['--color-calendar-teal', '#8dccc4'],
  ['--color-calendar-sand', '#b09b80'],
  ['--color-calendar-peach', '#e6b2a4']
];

export function calendarColor(color: string | null | undefined, index: number): string {
  return color || `var(${palette[Math.max(0, index) % palette.length][0]})`;
}

export function colorPickerValue(color: string | null, index: number): string {
  if (color) return color;
  const [token, fallback] = palette[index % palette.length];
  const theme = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return /^#[0-9a-f]{6}$/i.test(theme) ? theme : fallback;
}

// Choose readable chip text even when the user selects a very dark color.
export function calendarTextColor(color: string | null | undefined): string {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return '#09090b';
  const [r, g, b] = [1, 3, 5].map(offset => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
