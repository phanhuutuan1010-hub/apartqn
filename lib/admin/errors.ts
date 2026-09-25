/** Postgres / PostgREST errors → Vietnamese */
export function vnError(e: { message?: string; code?: string } | null): string {
  const m = e?.message ?? '';
  if (e?.code === '23505' || /duplicate key|đã có trong hệ thống/.test(m)) return 'Căn này đã có trong hệ thống (toà nhà + tầng + số căn trùng).';
  if (/missing required fields/.test(m)) return 'Còn thiếu thông tin bắt buộc để đăng tin.';
  if (/needs approval/.test(m)) return 'Bạn chưa có quyền đăng trực tiếp — hãy bấm “Gửi duyệt”.';
  if (/only admins can reassign/.test(m)) return 'Chỉ quản trị viên được đổi người phụ trách.';
  if (/permanent/.test(m)) return 'Mã căn không thể thay đổi.';
  if (e?.code === '42501' || /row-level security|not allowed|permission denied/.test(m)) return 'Bạn không có quyền với căn này.';
  if (/check constraint/.test(m)) return 'Có giá trị không hợp lệ (ngoài khoảng cho phép).';
  return 'Lỗi: ' + m;
}

