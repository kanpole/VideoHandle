export interface RemoveBackgroundOptions {
  colors: Array<{ r: number; g: number; b: number }>;
  tolerance: number;
  edgeSmoothing: number;
  /** When true, removes the matching color from every pixel instead of only flood-filling from edges. */
  removeAllOccurrences?: boolean;
  /** When set, restricts processing to this rectangular region (canvas pixel coordinates). */
  region?: { x: number; y: number; width: number; height: number };
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function isColorMatch(
  r: number, g: number, b: number,
  colors: Array<{ r: number; g: number; b: number }>,
  tolerance: number
): boolean {
  return colors.some(c => colorDistance(r, g, b, c.r, c.g, c.b) <= tolerance);
}

export function removeBackground(imageData: ImageData, options: RemoveBackgroundOptions): ImageData {
  const { colors, tolerance, edgeSmoothing, removeAllOccurrences = false, region } = options;
  const { width, height, data } = imageData;

  if (colors.length === 0) return imageData;

  const result = new ImageData(new Uint8ClampedArray(data), width, height);

  // mask: 0 = unvisited, 1 = background (remove), 2 = foreground (keep)
  const mask = new Uint8Array(width * height);

  // Compute region bounds (clamped to image dimensions)
  const rx = region ? Math.max(0, Math.floor(region.x)) : 0;
  const ry = region ? Math.max(0, Math.floor(region.y)) : 0;
  const rxEnd = region ? Math.min(width, Math.floor(region.x + region.width)) : width;
  const ryEnd = region ? Math.min(height, Math.floor(region.y + region.height)) : height;

  if (removeAllOccurrences) {
    // Directly mark every matching pixel within the region as background
    for (let y = ry; y < ryEnd; y++) {
      for (let x = rx; x < rxEnd; x++) {
        const idx = y * width + x;
        const pIdx = idx * 4;
        mask[idx] = isColorMatch(data[pIdx], data[pIdx + 1], data[pIdx + 2], colors, tolerance) ? 1 : 2;
      }
    }
  } else {
    // Flood fill from the edges of the region (or the image edges when no region is set)
    const queue: number[] = [];

    const enqueue = (x: number, y: number) => {
      const idx = y * width + x;
      if (mask[idx] !== 0) return;
      const pIdx = idx * 4;
      if (isColorMatch(data[pIdx], data[pIdx + 1], data[pIdx + 2], colors, tolerance)) {
        mask[idx] = 1;
        queue.push(idx);
      } else {
        mask[idx] = 2;
      }
    };

    if (region) {
      // Seed from the 4 edges of the selected region
      for (let x = rx; x < rxEnd; x++) {
        enqueue(x, ry);
        if (ryEnd - 1 > ry) enqueue(x, ryEnd - 1);
      }
      for (let y = ry + 1; y < ryEnd - 1; y++) {
        enqueue(rx, y);
        if (rxEnd - 1 > rx) enqueue(rxEnd - 1, y);
      }
    } else {
      // Seed from all 4 edges of the image
      for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }
      for (let y = 1; y < height - 1; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }
    }

    // BFS flood fill (constrained to region bounds)
    const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
    let qi = 0;
    while (qi < queue.length) {
      const idx = queue[qi++];
      const x = idx % width;
      const y = Math.floor(idx / width);

      for (let d = 0; d < 4; d++) {
        const nx = x + dirs[d * 2];
        const ny = y + dirs[d * 2 + 1];
        if (nx < rx || nx >= rxEnd || ny < ry || ny >= ryEnd) continue;
        const nIdx = ny * width + nx;
        if (mask[nIdx] !== 0) continue;
        const pIdx = nIdx * 4;
        if (isColorMatch(data[pIdx], data[pIdx + 1], data[pIdx + 2], colors, tolerance)) {
          mask[nIdx] = 1;
          queue.push(nIdx);
        } else {
          mask[nIdx] = 2;
        }
      }
    }
  }

  // Mark remaining unvisited pixels (outside region or enclosed foreground) as foreground
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) mask[i] = 2;
  }

  // Apply alpha
  for (let i = 0; i < width * height; i++) {
    if (mask[i] === 1) {
      result.data[i * 4 + 3] = 0;
    }
  }

  // Edge feathering (limited to region bounds to avoid bleeding across region boundary)
  if (edgeSmoothing > 0) {
    const alphaMap = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      alphaMap[i] = mask[i] === 1 ? 0 : 255;
    }

    const smoothed = new Float32Array(width * height);
    const radius = edgeSmoothing;

    for (let y = ry; y < ryEnd; y++) {
      for (let x = rx; x < rxEnd; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= rx && nx < rxEnd && ny >= ry && ny < ryEnd) {
              sum += alphaMap[ny * width + nx];
              count++;
            }
          }
        }
        smoothed[y * width + x] = sum / count;
      }
    }

    for (let y = ry; y < ryEnd; y++) {
      for (let x = rx; x < rxEnd; x++) {
        const idx = y * width + x;
        let nearEdge = false;
        for (let dy = -1; dy <= 1 && !nearEdge; dy++) {
          for (let dx = -1; dx <= 1 && !nearEdge; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= rx && nx < rxEnd && ny >= ry && ny < ryEnd) {
              if (mask[ny * width + nx] !== mask[idx]) nearEdge = true;
            }
          }
        }
        if (nearEdge) {
          result.data[idx * 4 + 3] = Math.round(smoothed[idx]);
        }
      }
    }
  }

  return result;
}

export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function dataUrlToImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.src = dataUrl;
  });
}

export function getPixelColor(imageData: ImageData, x: number, y: number): { r: number; g: number; b: number } {
  const idx = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[idx],
    g: imageData.data[idx + 1],
    b: imageData.data[idx + 2],
  };
}
