// 主色提取 — 采样 canvas 像素
const colorCache = new Map();

export function extractDominantColor(url) {
  if (colorCache.has(url)) return Promise.resolve(colorCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const samples = [
          [size/2, size/2], [size/4, size/4], [3*size/4, size/4],
          [size/4, 3*size/4], [3*size/4, 3*size/4],
          [size/2, size/4], [size/2, 3*size/4],
          [size/4, size/2], [3*size/4, size/2],
        ];
        let r = 0, g = 0, b = 0, count = 0;
        let bestSat = -1, best = [80, 80, 80];
        samples.forEach(([x, y]) => {
          const data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          const [pr, pg, pb] = [data[0], data[1], data[2]];
          r += pr; g += pg; b += pb; count++;
          const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
          const sat = max === 0 ? 0 : (max - min) / max;
          const score = sat * 1.5 + (max / 255) * 0.5;
          if (score > bestSat) { bestSat = score; best = [pr, pg, pb]; }
        });
        const avg = [Math.round(r/count), Math.round(g/count), Math.round(b/count)];
        const result = { dominant: best, average: avg };
        colorCache.set(url, result);
        resolve(result);
      } catch {
        const fallback = { dominant: [80, 80, 80], average: [80, 80, 80] };
        colorCache.set(url, fallback);
        resolve(fallback);
      }
    };
    img.onerror = () => {
      resolve({ dominant: [80, 80, 80], average: [80, 80, 80] });
    };
    img.src = url;
  });
}
