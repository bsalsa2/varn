// Fetches an AWS Terrarium elevation tile, shades it, and returns an overlay bitmap.
import { hillshade } from './hillshade.js';

self.onmessage = async ({ data: { id, url, mpp, exaggeration } }) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bmp = await createImageBitmap(await res.blob());
    const n = bmp.width;
    const canvas = new OffscreenCanvas(n, n);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, n, n);
    bmp.close();
    const h = new Float32Array(n * n);
    // Seafloor and lakes are held at 0 so only land is shaded.
    for (let i = 0; i < h.length; i++) h[i] = Math.max(0, data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768);
    const rgba = hillshade(h, n, mpp, { exaggeration });
    const image = await createImageBitmap(new ImageData(rgba, n, n));
    self.postMessage({ id, image }, [image]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
