/**
 * errors.ts
 * Dịch các thông báo lỗi tiếng Anh từ backend sang tiếng Việt.
 * Thông báo không khớp được giữ nguyên.
 */
const EXACT: Record<string, string> = {
  'Invalid username or password.': 'Sai tài khoản hoặc mật khẩu.',
  'Username or email already exists.': 'Tên đăng nhập hoặc email đã tồn tại.',
  'Email already exists.': 'Email đã tồn tại.',
  'The first account must have the Admin role.': 'Tài khoản đầu tiên phải có vai trò Admin.',
  'At least one active Admin account is required.': 'Hệ thống phải còn ít nhất một tài khoản Admin đang hoạt động.',
  'You cannot lock your own account.': 'Bạn không thể khóa chính tài khoản của mình.',
  'Apartment not found.': 'Không tìm thấy căn hộ.',
  'Household not found.': 'Không tìm thấy hộ gia đình.',
  'Resident not found.': 'Không tìm thấy nhân khẩu.',
  'Household code already exists.': 'Mã hộ gia đình đã tồn tại.',
  'Household code already exists or the apartment reference is invalid.': 'Mã hộ đã tồn tại hoặc căn hộ không hợp lệ.',
  'Cannot delete a household that has residents.': 'Không thể xóa hộ gia đình đang có nhân khẩu.',
  'Cannot delete the household because related data exists.': 'Không thể xóa hộ gia đình vì còn dữ liệu liên quan.',
  'Identity number already exists.': 'Số CCCD/CMND đã tồn tại.',
  'Identity number already exists or the household reference is invalid.': 'Số CCCD đã tồn tại hoặc hộ gia đình không hợp lệ.',
  'Date of birth cannot be in the future.': 'Ngày sinh không được ở tương lai.',
  'Cannot delete a resident with related data.': 'Không thể xóa nhân khẩu đã có lịch sử cư trú / thanh toán liên quan.',
  'Cannot delete the resident because related data exists.': 'Không thể xóa nhân khẩu vì còn dữ liệu liên quan.',
  'The resident history could not be saved.': 'Không thể lưu biến động cư trú.',
  'Fee category name already exists.': 'Tên khoản thu đã tồn tại.',
  'Cannot delete a fee category referenced by fee charges.': 'Không thể xóa khoản thu đã được dùng trong khoản phải thu.',
  'Cannot delete the fee category because related data exists.': 'Không thể xóa khoản thu vì còn dữ liệu liên quan.',
  'Fee collection not found.': 'Không tìm thấy đợt thu.',
  'A fee collection already exists for this month and year.': 'Đã tồn tại đợt thu cho tháng/năm này.',
  'The period cannot be changed after fee charges have been created.': 'Không thể đổi tháng/năm khi đợt thu đã có khoản phải thu.',
  'Cannot delete a fee collection referenced by fee charges.': 'Không thể xóa đợt thu đang có khoản phải thu.',
  'Cannot delete the fee collection because related data exists.': 'Không thể xóa đợt thu vì còn dữ liệu liên quan.',
  'Fee charges can only be created in an open fee collection.': 'Chỉ tạo được khoản phải thu cho đợt thu đang mở (Open).',
  'Fee category not found.': 'Không tìm thấy khoản thu.',
  'The fee category is inactive.': 'Khoản thu đã ngừng áp dụng.',
  'A fee charge already exists for this apartment, collection, and category.': 'Căn hộ đã có khoản phải thu này trong đợt thu.',
  'Total amount cannot be less than the amount already paid.': 'Tổng tiền không được nhỏ hơn số tiền đã thu.',
  'Cannot delete a fee charge with payment history.': 'Không thể xóa khoản phải thu đã có thanh toán.',
  'Cannot delete the fee charge because related data exists.': 'Không thể xóa khoản phải thu vì còn dữ liệu liên quan.',
  'Status must be Unpaid, PartiallyPaid, or Paid.': 'Trạng thái phải là Unpaid, PartiallyPaid hoặc Paid.',
  'Receipt number already exists.': 'Mã phiếu thu đã tồn tại.',
  'Resident does not belong to the selected apartment.': 'Người nộp không thuộc căn hộ đã chọn.',
  'A fee charge may appear only once in a payment.': 'Mỗi khoản phải thu chỉ được xuất hiện một lần trong phiếu thu.',
  'One or more fee charges were not found.': 'Không tìm thấy một hoặc nhiều khoản phải thu.',
  'All fee charges must belong to the selected apartment.': 'Tất cả khoản phải thu phải thuộc căn hộ đã chọn.',
  'Payment total must be greater than zero.': 'Tổng tiền thanh toán phải lớn hơn 0.',
  'The payment could not be saved.': 'Không thể lưu thanh toán.',
  'EndDate cannot be earlier than StartDate.': 'Ngày kết thúc không được trước ngày bắt đầu.',
  'PreviousValue and NewValue are required for InformationChange.': 'Cần nhập giá trị cũ và giá trị mới khi thay đổi thông tin.',
  'One or more validation errors occurred.': 'Dữ liệu không hợp lệ.',
}

export function translateError(message: string): string {
  const trimmed = message.trim()
  if (EXACT[trimmed]) return EXACT[trimmed]
  if (/^Payment amount for fee charge \d+ exceeds its outstanding amount\.$/.test(trimmed)) {
    return 'Số tiền thanh toán vượt quá số tiền còn nợ của khoản phải thu.'
  }
  return trimmed
}

export function errorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra.'): string {
  return err instanceof Error && err.message ? err.message : fallback
}
