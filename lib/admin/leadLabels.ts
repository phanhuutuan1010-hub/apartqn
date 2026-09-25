export const LEAD_STATUS = {
  new: { label: 'Mới', tone: 'warn' },
  contacted: { label: 'Đã liên hệ', tone: 'blue' },
  viewed: { label: 'Đã xem nhà', tone: 'blue' },
  won: { label: 'Chốt được', tone: 'ok' },
  lost: { label: 'Không thành', tone: 'muted' },
} as const;
export type LeadStatus = keyof typeof LEAD_STATUS;
export const LEAD_STATUSES = Object.keys(LEAD_STATUS) as LeadStatus[];

export const CHANNEL_LABEL: Record<string, string> = {
  web: 'Website', phone: 'Điện thoại', zalo: 'Zalo', telegram: 'Telegram', whatsapp: 'WhatsApp', walk_in: 'Trực tiếp', other: 'Khác',
};
