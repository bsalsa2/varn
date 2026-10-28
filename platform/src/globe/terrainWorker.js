// Decodes AWS Terrarium elevation tiles off the main thread so fast zooms stay smooth.
// In: { id, url, size }. Out: { id, heights: Float32Array } or { id, error }.
self.onmessage = async ({ data: { id, url, size } }) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bmp = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const { data, width } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    bmp.close();
    const heights = new Float32Array(size * size);
    const step = (width - 1) / (size - 1);
    for (let j = 0; j < size; j++) {
      const py = Math.round(j * step);
      for (let i = 0; i < size; i++) {
        const k = (py * width + Math.round(i * step)) * 4;
        // Terrarium: metres = R * 256 + G + B / 256 - 32768. Seafloor is held at sea level so
        // coastlines sit cleanly under the imagery.
        heights[j * size + i] = Math.max(0, data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768);
      }
    }
    self.postMessage({ id, heights }, [heights.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
