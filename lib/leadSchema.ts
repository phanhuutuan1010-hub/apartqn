import { z } from 'zod';

export const MAX_PHOTOS = 10;

const locale = z.enum(['vi', 'en', 'ru']);
const phone = z.string().trim().min(6).max(30).regex(/^[0-9+()\-.\s]+$/);
const name = z.string().trim().min(1).max(120);
const page = z.string().trim().max(500).optional().default('');
const small = z.string().trim().max(12).regex(/^[0-9.,\s]*$/).optional().default('');
/** Honeypot — must stay empty */
const website = z.string().max(200).optional().default('');

export const viewingSchema = z.object({
  type: z.literal('viewing'),
  code: z.string().trim().regex(/^QN-\d{3,5}$/i),
  name,
  phone,
  date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(''),
  duration: z.number().int().min(0).max(2),
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
  rent: z.string().trim().min(1).max(30),
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
  locale,
  page,
  website,
});

export const leadSchema = z.discriminatedUnion('type', [viewingSchema, consignSchema]);
export type Lead = z.infer<typeof leadSchema>;
