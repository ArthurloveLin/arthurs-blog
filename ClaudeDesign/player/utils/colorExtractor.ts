/**
 * 从图片提取主色（Canvas 量化）
 */
export function extractColors(imgEl: HTMLImageElement, count = 5) {
  const canvas = document.createElement('canvas');
  const size = 60;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  ctx.drawImage(imgEl, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  const buckets: Record<string, any> = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    if (!buckets[key]) {
      buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
    }
    buckets[key].r += r;
    buckets[key].g += g;
    buckets[key].b += b;
    buckets[key].count += 1;
  }

  const sorted = Object.values(buckets)
    .map((b) => ({
      r: Math.round(b.r / b.count),
      g: Math.round(b.g / b.count),
      b: Math.round(b.b / b.count),
      count: b.count,
      sat: Math.max(b.r, b.g, b.b) / b.count - Math.min(b.r, b.g, b.b) / b.count,
    }))
    .filter((c) => {
      const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      return lum > 25 && lum < 235 && c.sat > 12;
    })
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, count);
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgb(c: RGB, a = 1): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

export function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
