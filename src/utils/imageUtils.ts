export interface RemoveBackgroundOptions {
  colors: Array<{ r: number; g: number; b: number }>;
  tolerance: number;
  edgeSmoothing: number;
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
  const { colors, tolerance, edgeSmoothing } = options;
  const { width, height, data } = imageData;

  if (colors.length === 0) return imageData;

  const result = new ImageData(new Uint8ClampedArray(data), width, height);

  // mask: 0 = unvisited, 1 = background (remove), 2 = foreground (keep)
  const mask = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    const idx = y * width + x;
    if (mask[idx] !== 0) return;
    const pIdx = idx * 4;
    const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
    if (isColorMatch(r, g, b, colors, tolerance)) {
      mask[idx] = 1;
      queue.push(idx);
    } else {
      mask[idx] = 2;
    }
  };

  // Seed from all 4 edges
  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  // BFS flood fill
  const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    const x = idx % width;
    const y = Math.floor(idx / width);

    for (let d = 0; d < 4; d++) {
      const nx = x + dirs[d * 2];
      const ny = y + dirs[d * 2 + 1];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (mask[nIdx] !== 0) continue;
      const pIdx = nIdx * 4;
      const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
      if (isColorMatch(r, g, b, colors, tolerance)) {
        mask[nIdx] = 1;
        queue.push(nIdx);
      } else {
        mask[nIdx] = 2;
      }
    }
  }

  // Mark remaining unvisited as foreground
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) mask[i] = 2;
  }

  // Apply alpha
  for (let i = 0; i < width * height; i++) {
    if (mask[i] === 1) {
      result.data[i * 4 + 3] = 0;
    }
  }

  // Edge feathering
  if (edgeSmoothing > 0) {
    const alphaMap = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      alphaMap[i] = mask[i] === 1 ? 0 : 255;
    }

    const smoothed = new Float32Array(width * height);
    const radius = edgeSmoothing;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += alphaMap[ny * width + nx];
              count++;
            }
          }
        }
        smoothed[y * width + x] = sum / count;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let nearEdge = false;
        for (let dy = -1; dy <= 1 && !nearEdge; dy++) {
          for (let dx = -1; dx <= 1 && !nearEdge; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
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
