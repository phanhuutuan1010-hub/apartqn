/**
 * A tiny translator over an i18n/{locale}.json object for code outside React (route handlers, Telegram notes):
 * flat keys, {name} placeholders. Plural / select messages are not used through it.
 */
import vi from '@/i18n/vi.json';

type Messages = Record<string, unknown>;

export const plainT = (messages: Messages) => (key: string, values: Record<string, string | number> = {}) => {
  const m = messages[key];
  if (typeof m !== 'string') return key;
  return m.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
};

/** staff notes are Vietnamese */
export const tVi = plainT(vi as Messages);
