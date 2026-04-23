// 不规则布局算法 — 基于网格 packing
export function generateLayout(tracks, cols, cellSize, gap) {
  const sizes = tracks.map((t, i) => {
    const r = t.rank;
    if (r <= 3 && i % 3 === 0) return { w: 2, h: 2 };
    if (r <= 10 && r % 4 === 1) return { w: 2, h: 1 };
    if (r <= 12 && r % 5 === 2) return { w: 1, h: 2 };
    if (r <= 25 && r % 7 === 3) return { w: 2, h: 1 };
    if (r <= 30 && r % 9 === 4) return { w: 1, h: 2 };
    return { w: 1, h: 1 };
  });

  const occupied = [];
  const result = [];
  let maxRow = 0;

  function isFree(row, col, w, h) {
    if (col + w > cols) return false;
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        if (occupied[r] && occupied[r][c]) return false;
      }
    }
    return true;
  }

  function markOccupied(row, col, w, h) {
    for (let r = row; r < row + h; r++) {
      if (!occupied[r]) occupied[r] = [];
      for (let c = col; c < col + w; c++) {
        occupied[r][c] = true;
      }
    }
    maxRow = Math.max(maxRow, row + h);
  }

  tracks.forEach((track, i) => {
    let { w, h } = sizes[i];
    let placed = false;
    for (let row = 0; row < 200 && !placed; row++) {
      for (let col = 0; col < cols && !placed; col++) {
        if (isFree(row, col, w, h)) {
          markOccupied(row, col, w, h);
          result.push({
            track, row, col, w, h,
            x: col * (cellSize + gap),
            y: row * (cellSize + gap),
            width: w * cellSize + (w - 1) * gap,
            height: h * cellSize + (h - 1) * gap,
          });
          placed = true;
        }
      }
    }
    if (!placed) {
      for (let row = 0; row < 300 && !placed; row++) {
        for (let col = 0; col < cols && !placed; col++) {
          if (isFree(row, col, 1, 1)) {
            markOccupied(row, col, 1, 1);
            result.push({
              track, row, col, w: 1, h: 1,
              x: col * (cellSize + gap),
              y: row * (cellSize + gap),
              width: cellSize, height: cellSize,
            });
            placed = true;
          }
        }
      }
    }
  });

  const totalHeight = maxRow * cellSize + (maxRow - 1) * gap;
  const totalWidth = cols * cellSize + (cols - 1) * gap;
  return { items: result, totalWidth, totalHeight, rows: maxRow };
}
