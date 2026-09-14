/** Load an image for canvas crop (blob: URLs work without crossOrigin). */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

/**
 * Export cropped region as JPEG blob.
 * @param {string} imageSrc Object URL or data URL
 * @param {{ x: number; y: number; width: number; height: number }} pixelCrop From react-easy-crop
 * @param {boolean} circular Clip to circle (profile avatars)
 */
export async function getCroppedImgBlob(imageSrc, pixelCrop, circular = false, jpegQuality = 0.92) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop image');

  const { width, height, x, y } = pixelCrop;

  if (circular) {
    const side = Math.round(Math.min(width, height));
    const sx = Math.round(x + (width - side) / 2);
    const sy = Math.round(y + (height - side) / 2);
    canvas.width = side;
    canvas.height = side;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, side, side);
    ctx.save();
    ctx.beginPath();
    ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, sx, sy, side, side, 0, 0, side, side);
    ctx.restore();
  } else {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(image, Math.round(x), Math.round(y), w, h, 0, 0, w, h);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Crop export failed'));
        else resolve(blob);
      },
      'image/jpeg',
      jpegQuality
    );
  });
}
