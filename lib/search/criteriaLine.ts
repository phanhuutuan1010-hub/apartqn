/**
 * What the visitor asked for (results-page filters, lib/filters.ts names) → short localized parts:
 * building · type · budget · features. Words come from i18n/{locale}.json through `t` (useTranslations on the client,
 * lib/i18nPlain.ts on the server).
 */
import type { Feature } from '@/lib/unitTypes';

export type Criteria = { b?: string; t?: string; pmax?: string; ft?: string[]; near?: string; q?: string };
export type T = (key: string, values?: Record<string, string | number>) => string;

export function criteriaParts(c: Criteria, t: T, decimal: string, buildingName?: string): string[] {
  const parts: string[] = [];
  if (c.b) parts.push(buildingName ?? c.b);
  if (c.t) parts.push(t(`crType_${c.t}`));
  if (c.pmax) parts.push(t('crBudget', { n: c.pmax.replace('.', decimal) }));
  for (const f of c.ft ?? []) parts.push(t(`f_${f as Feature}`));
  if (c.near === 'sea' && !(c.ft ?? []).includes('sea_view')) parts.push(t('crNear'));
  return parts;
}

/** Staff line (Vietnamese): "Altara · 2PN · ≤ 12 triệu · View biển · “gần chợ”" */
export const criteriaLine = (c: Criteria, t: T, buildingName?: string) =>
  [...criteriaParts(c, t, ',', buildingName), ...(c.q ? [`“${c.q}”`] : [])].join(' · ');

/** The message typed into Zalo / WhatsApp / Telegram from a search with no match: the search text + the parsed criteria. */
export function findHelpMessage(t: T, query: string, parts: string[]): string {
  const q = query.trim();
  const what = [q && `“${q}”`, ...parts].filter(Boolean).join(' · ');
  return what ? t('fhMsg', { what }) : t('fhMsgEmpty');
}
