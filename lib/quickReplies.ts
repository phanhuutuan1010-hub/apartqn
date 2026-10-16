/** "Trả lời nhanh": token rendering + placeholder split, shared by the admin page and its tests. */
export type QrLang = 'ru' | 'en' | 'vi';
export type QrPrices = { price_from_studio?: number | null; price_from_1br?: number | null; price_from_2br?: number | null };

const SEP: Record<QrLang, string> = { ru: ' ', en: ',', vi: '.' };

/** 8000000 → ru "8 000 000" · en "8,000,000" · vi "8.000.000" */
export const qrMoney = (n: number, l: QrLang) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, SEP[l]);

const TOKENS: Record<string, keyof QrPrices> = { price_studio: 'price_from_studio', price_1br: 'price_from_1br', price_2br: 'price_from_2br' };

/** {{price_studio}} {{price_1br}} {{price_2br}} → the "from" prices in Cài đặt; a token with no value is left as it is. */
export const renderQr = (body: string, l: QrLang, p: QrPrices) =>
  body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => {
    const v = TOKENS[k] ? p[TOKENS[k]] : null;
    return typeof v === 'number' && Number.isFinite(v) ? qrMoney(v, l) : m;
  });

/** text → parts; `hole` = a [..] placeholder the sender fills in (highlighted in the preview only) */
export const qrParts = (text: string) => text.split(/(\[[^\]\n]{1,80}\])/).filter(Boolean).map((s) => ({ s, hole: /^\[[^\]\n]+\]$/.test(s) }));

/** "Chép RU+EN": Russian, a blank line, English (either may be missing) */
export const qrRuEn = (ru: string, en: string) => [ru.trim(), en.trim()].filter(Boolean).join('\n\n');
