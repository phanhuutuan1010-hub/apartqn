/** Browser helpers for the post / Marketplace photo kits. */

/** public (watermarked) WebP / PNG → JPEG File: what Facebook / Zalo accept everywhere */
export async function toJpeg(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const jpg = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.9));
  return new File([jpg], name, { type: 'image/jpeg' });
}

/** Files → one .zip download (fflate is loaded only when the button is used) */
export async function downloadZip(files: File[], name: string) {
  const { zipSync } = await import('fflate');
  const entries = Object.fromEntries(await Promise.all(files.map(async (x) => [x.name, new Uint8Array(await x.arrayBuffer())] as const)));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export const canShareFiles = () =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.jpg', { type: 'image/jpeg' })] });
