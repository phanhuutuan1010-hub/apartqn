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

export const LEAD_TYPE = {
  rent: { label: 'Thuê', tone: 'gray' },
  search: { label: 'Nhờ tìm giúp', tone: 'blue' },
  consign: { label: 'Ký gửi', tone: 'warn' },
} as const;
export type LeadType = keyof typeof LEAD_TYPE;
export const LEAD_TYPES = Object.keys(LEAD_TYPE) as LeadType[];

/** consign request (leads.payload) → "Altara · Tầng 14 · 72 m² · 2 PN · 12 triệu" */
export const consignLine = (p: Record<string, string | undefined>, buildingName: Map<string, string>) =>
  p.source === 'callback' && !p.building_id && !p.building_text ? '📞 Nhờ gọi lại — chưa có thông tin căn' : [
    (p.building_id && buildingName.get(p.building_id)) || p.building_text || 'Chưa chọn toà nhà',
    p.floor && `Tầng ${p.floor}`,
    p.area && `${p.area.replace(/\s*m2?²?$/i, '')} m²`,
    p.beds && `${p.beds} PN`,
    p.rent && `giá mong muốn ${p.rent}`,
  ].filter(Boolean).join(' · ');
