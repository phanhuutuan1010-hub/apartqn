import { z } from 'zod';
import { LOCALES, type Locale } from '@/i18n/locales';
import { CONTACT_CHANNELS, FEATURES, UNIT_TYPE_KINDS } from '@/lib/unitTypes';

export const MAX_PHOTOS = 10;

const locale = z.enum(LOCALES as [Locale, ...Locale[]]);
const phone = z.string().trim().min(6).max(30).regex(/^[0-9+()\-.\s]+$/);
const name = z.string().trim().min(1).max(120);
const page = z.string().trim().max(500).optional().default('');
const small = z.string().trim().max(12).regex(/^[0-9.,\s]*$/).optional().default('');
/** Honeypot — must stay empty */
const website = z.string().max(200).optional().default('');

/** "Kiểm tra căn trống" on a unit type page: what the visitor wants + how to reach them (no unit is ever named) */
export const availabilitySchema = z.object({
  type: z.literal('availability'),
  /** the page's unit type */
  code: z.string().trim().regex(/^[A-Z]{3}-(STUDIO|1PN|2PN|3PN)$/i),
  /** the type picked in the form (another type of the same building is fine) */
  unitType: z.enum(UNIT_TYPE_KINDS),
  moveIn: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(''),
  duration: z.number().int().min(0).max(2),
  /** VND / month, digits as typed ("12.000.000", "12tr") */
  budget: z.string().trim().max(30).optional().default(''),
  name: z.string().trim().max(120).optional().default(''),
  /** phone number, or a Telegram / WhatsApp handle */
  contact: z.string().trim().min(3).max(60),
  channel: z.enum(CONTACT_CHANNELS),
  locale,
  page,
  website,
});

export const consignSchema = z.object({
  type: z.literal('consign'),
  building: z.string().trim().max(40).optional().default(''),
  floor: small,
  area: small,
  beds: small,
  /** required for the full form (checked in the route); empty for a callback */
  rent: z.string().trim().max(30).optional().default(''),
  owner: name,
  phone,
  // storage paths in the private consign-inbox bucket issued by /api/consign/upload: <uploadId>/<n>.<ext>
  photos: z
    .array(z.string().regex(/^[0-9a-f-]{36}\/\d{1,2}\.(jpg|png|webp)$/))
    .max(MAX_PHOTOS)
    .refine((ps) => new Set(ps.map((x) => x.split('/')[0])).size <= 1, 'photos from one upload only')
    .optional()
    .default([]),
  photosFailed: z.number().int().min(0).max(MAX_PHOTOS).optional().default(0),
  /** 'callback' = "Để lại số, chúng tôi gọi lại" (name + VN mobile only) */
  source: z.enum(['form', 'callback']).optional().default('form'),
  locale,
  page,
  website,
});

const mil = z.string().regex(/^(\d{1,4}(\.\d)?)?$/).optional();
/** results-page filters at the time of the request (lib/filters.ts names) */
export const searchCriteria = z.object({
  b: z.string().regex(/^[a-z0-9-]{0,40}$/).optional(),
  t: z.enum(['', ...UNIT_TYPE_KINDS, '01']).optional(),
  pmax: mil,
  ft: z.array(z.enum(FEATURES)).max(FEATURES.length).optional(),
  near: z.enum(['', 'sea']).optional(),
  q: z.string().trim().max(80).optional(),
}).strip();

/** "Nhờ tìm giúp" from a results page with no match */
export const searchRequestSchema = z.object({
  type: z.literal('search_request'),
  name,
  phone,
  need: z.string().trim().max(500).optional().default(''),
  query: z.string().trim().max(80).optional().default(''),
  criteria: searchCriteria.optional().default({}),
  locale,
  page,
  website,
});

/** "Nhờ tìm giúp (nhắn tin)": a tap on Zalo / WhatsApp / Telegram under a search with no match (/api/intent, no PII) */
export const searchIntentSchema = z.object({
  kind: z.literal('search'),
  channel: z.enum(['zalo', 'whatsapp', 'telegram']),
  query: z.string().trim().max(80).optional().default(''),
  criteria: searchCriteria.optional().default({}),
  locale,
  page: z.string().trim().max(200).regex(/^\//).optional(),
});
export type SearchCriteria = z.infer<typeof searchCriteria>;

export const leadSchema = z.discriminatedUnion('type', [availabilitySchema, consignSchema, searchRequestSchema]);
export type Lead = z.infer<typeof leadSchema>;
