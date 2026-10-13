/**
 * `sizes` for photos shown with object-fit: cover. A photo wider than its slot is drawn LARGER than the slot (it is
 * scaled up until the height fits, the sides are cropped), so the browser must be told that width — otherwise it picks
 * a file that is too small and the photo looks soft. Photos narrower than the slot are drawn at the slot width.
 */

/** how much wider than the slot a `ratio` (w/h) photo is drawn in a `box` (w/h) slot */
export const coverScale = (ratio: number | undefined, box: number) => (ratio && ratio > box * 1.02 ? Math.ceil((ratio / box) * 100) / 100 : 1);

const scaled = (len: string, k: number) => (k === 1 ? len : `calc(${len} * ${k})`);

/** scale every length of a `sizes` string: "(min-width:768px) 50vw, 100vw" × 1.5 */
export function scaleSizes(sizes: string, k: number): string {
  if (k === 1) return sizes;
  return sizes.split(',').map((part) => {
    const p = part.trim(), i = p.lastIndexOf(' ');
    return i < 0 ? scaled(p, k) : `${p.slice(0, i)} ${scaled(p.slice(i + 1), k)}`;
  }).join(', ');
}

export type Slot = { media?: string; width: string; /** slot width / height */ box: number };
/** `sizes` from slots that have a different shape per breakpoint */
export const coverSizes = (slots: Slot[], ratio?: number) =>
  slots.map((s) => `${s.media ? s.media + ' ' : ''}${scaled(s.width, coverScale(ratio, s.box))}`).join(', ');
