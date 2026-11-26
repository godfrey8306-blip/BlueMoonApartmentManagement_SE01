# TRUY VẾT USER STORY ↔ CHỨC NĂNG — DỰ ÁN BLUEMOON (NHÓM SE_01)

> **Nguồn:** bảng User Story trong `docs/image.png` (US-001 → US-016) và `docs/01_REQUIREMENTS_AND_BACKLOG.md`.
> **Cập nhật:** 26/11/2026, sau đợt bổ sung tìm kiếm quy mô lớn, hạn nộp / quá hạn, xác nhận thao tác nhạy cảm, thông báo và cổng cư dân.

---

## 1. Vai trò & ma trận quyền

| Vai trò trong tài liệu | Role hệ thống | Phạm vi |
|---|---|---|
| Ban quản trị | `Admin` | Toàn quyền |
| Kế toán | `User` | Thu phí, công nợ, thanh toán, thống kê; **chỉ xem** dữ liệu cư dân |
| Người dùng hệ thống (cư dân) | `Resident` | Chỉ cổng `/portal` của hộ mình |

| Chức năng | Admin | Kế toán | Cư dân |
|---|:--:|:--:|:--:|
| Xem căn hộ / hộ / nhân khẩu, tra cứu | ✔ | ✔ | ✘ |
| Thêm/sửa/xóa căn hộ, hộ, nhân khẩu; biến động cư trú | ✔ | ✘ | ✘ |
| Cấp tài khoản cổng cư dân | ✔ | ✘ | ✘ |
| Danh mục khoản thu, đợt thu, lập danh sách phải thu | ✔ | ✔ | ✘ |
| Ghi nhận thanh toán, công nợ, nhắc nợ, giấy báo phí | ✔ | ✔ | ✘ |
| Thống kê, báo cáo | ✔ | ✔ | ✘ |
| Quản lý tài khoản & phân quyền | ✔ | ✘ | ✘ |
| Xem phí / giấy báo / biên nhận / thông tin hộ **của mình** | ✘ | ✘ | ✔ |
| Hồ sơ cá nhân, đổi mật khẩu, thông báo | ✔ | ✔ | ✔ |

Quyền được kiểm tra ở **cả backend** (`[Authorize(Roles = …)]`, `src/BlueMoon.API/Roles.cs`) **và frontend** (`ProtectedRoute roles`, menu lọc theo vai trò).

---

## 2. Bảng truy vết

| US | Vai trò | Mong muốn | Màn hình | API chính | Trạng thái |
|---|---|---|---|---|---|
| US-001 | Ban quản trị | Thêm mới hộ gia đình | `/households` | `POST /api/households` | ✅ Hoàn thành. Chặn trùng mã hộ và chặn 2 hộ cùng ở một căn; trạng thái căn hộ tự cập nhật. |
| US-002 | Ban quản trị | Cập nhật thông tin hộ gia đình | `/households` | `PUT /api/households/{id}` | ✅ Hoàn thành. Ngừng hoạt động hộ có bước xác nhận. |
| US-003 | Ban quản trị | Thêm nhân khẩu vào hộ | `/residents` | `POST /api/residents` | ✅ Hoàn thành. Chặn trùng CCCD (có unique index), mỗi hộ chỉ một chủ hộ; chọn hộ bằng ô gõ-để-tìm. |
| US-004 | Ban quản trị | Ghi nhận tạm trú, tạm vắng, chuyển đến, chuyển đi | `/resident-histories` | `POST /api/residence-histories` | ✅ Hoàn thành. Có đủ 4 loại thật (`TemporaryResidence`, `TemporaryAbsence`, `MoveIn`, `MoveOut`) và thay đổi thông tin; tình trạng cư trú tự cập nhật trong cùng giao dịch. |
| US-005 | Ban quản trị | Tra cứu thông tin cư dân | `/residents`, `/search`, ô tìm toàn cục Ctrl+K | `GET /api/residents?q=…`, `/api/search-statistics/global`, `/households` | ✅ Hoàn thành. Tìm không dấu theo tên, CCCD, SĐT, mã hộ, mã căn; lọc tòa, độ tuổi, giới tính, tình trạng; phân trang phía server; dưới 0,3 giây với 20.000 nhân khẩu. |
| US-006 | Kế toán | Tạo danh mục khoản thu và các đợt thu phí hàng tháng | `/fee-categories`, `/fee-collections` | `POST /api/feecategories`, `POST /api/feecollections` | ✅ Hoàn thành. Kế toán được phép thao tác; tạo hoặc đổi đơn giá đều phải xác nhận; đợt thu có **hạn nộp**. |
| US-007 | Ban quản trị | Tạo các đợt đóng góp tự nguyện | — | — | ⏭ **Sprint 2.** Hiện chỉ khai báo được khoản thu tự nguyện; hệ thống chặn lập hàng loạt vì đóng góp tự nguyện không phải công nợ. |
| US-008 | Kế toán | Ghi nhận thanh toán của cư dân | `/payments` | `POST /api/payments` | ✅ Hoàn thành. Có bước xác nhận tóm tắt (không sửa/xóa được sau khi lưu); đánh dấu khoản nộp trễ; cư dân nhận biên nhận qua cổng. |
| US-009 | Kế toán | Theo dõi công nợ các hộ | `/fee-charges` | `GET /api/fee-charges?overdue=…`, `POST /api/fee-charges/reminders` | ✅ Hoàn thành. Lọc nhanh: còn nợ / quá hạn / sắp đến hạn. Có tổng tiền theo bộ lọc, nhắc nợ hàng loạt và xuất CSV. |
| US-010 | Ban quản trị | Tra cứu hóa đơn và lịch sử đóng góp | `/payments`, `/search` (tab Hóa đơn) | `GET /api/payments`, `/api/search-statistics/payments` | ✅ Hoàn thành. |
| US-011 | Ban quản trị | Báo cáo doanh thu theo tháng, quý, năm | Dashboard `/` | `GET /api/search-statistics/statistics/revenue?groupBy=month\|quarter\|year` | ✅ Hoàn thành. Tính theo **ngày thu thực tế**, chia theo khoản thu. |
| US-012 | Ban quản trị | Xem báo cáo công nợ | Dashboard `/`, `/fee-charges` | `GET /api/search-statistics/statistics/aging` | ✅ Hoàn thành. Tuổi nợ (1–30 / 31–60 / trên 60 ngày) và danh sách căn quá hạn nhiều nhất kèm nút nhắc nợ. |
| US-013 | Ban quản trị | Báo cáo cư dân và lịch sử khiếu nại, tranh chấp | `/residents` (xuất CSV) | `GET /api/residents` | 🟡 **Một phần.** Đã có báo cáo cư dân (lọc + xuất CSV toàn bộ). Module khiếu nại / tranh chấp chuyển **Sprint 2**. |
| US-014 | Người dùng hệ thống | Đăng nhập | `/login` | `POST /api/auth/login` | ✅ Hoàn thành. Điều hướng theo vai trò; tài khoản dùng mật khẩu tạm bị buộc đổi mật khẩu. |
| US-015 | Người dùng hệ thống | Thay đổi mật khẩu cá nhân | `/profile`, `/portal/profile` | `POST /api/auth/change-password` | ✅ Hoàn thành. **Mọi vai trò**, bắt buộc nhập mật khẩu hiện tại. |
| US-016 | Quản trị hệ thống | Phân quyền người dùng | `/users` | `/api/users` (+ `/lock`, `/unlock`) | ✅ Hoàn thành. Ba vai trò; đổi vai trò hoặc khóa tài khoản đều phải xác nhận; có mở khóa. |

---

## 3. Yêu cầu bổ sung đã xử lý

| Yêu cầu | Cách đáp ứng |
|---|---|
| Hàng vạn cư dân, nhiều tòa | Phân trang phía server (header `X-Total-Count`). Index trigram (`pg_trgm`) cho tên không dấu, CCCD, SĐT, mã căn, mã hộ, mã phiếu. Ô chọn gõ-để-tìm thay cho dropdown tải toàn bộ. Bộ lọc đồng bộ lên URL. |
| Hạn nộp & quá hạn | `FeeCollection.DueDate` (mặc định ngày cuối tháng). Khoản phải thu kế thừa hạn của đợt. `IsOverdue` / `DaysOverdue` / `IsDueSoon` tính theo giờ VN. |
| Thông báo thu phí (PBI-012) | Phát hành **giấy báo phí** theo đợt (in được, mỗi căn một trang). **Nhắc nợ** các căn quá hạn. Cả hai được lưu thành `FeeNotice`. |
| Thông báo trong ứng dụng | Chuông thông báo cho nhân viên và cư dân, lưu ở bảng `Notification`. Sinh khi: tạo / đổi giá khoản thu, đóng / mở / hủy đợt thu, lập danh sách phải thu, thu tiền, phát hành giấy báo, nhắc nợ. |
| Xác nhận thao tác nhạy cảm | Hộp xác nhận có bảng tóm tắt và cảnh báo hậu quả. Thao tác rất nguy hiểm (hủy đợt thu, xóa khoản thu, khóa Admin) yêu cầu gõ mã. Các thao tác áp dụng: tạo / đổi giá / ngừng / xóa khoản thu; tạo, đổi hạn, đóng / hủy đợt thu; lập danh sách phải thu; thu tiền; nhắc nợ; phát hành giấy báo; ghi biến động cư trú; cấp tài khoản; đổi vai trò, khóa tài khoản; đăng xuất. |
| Data mẫu | `dotnet run -- --seed --reset`: khoảng 260 nhân khẩu, 108 căn, 3 tòa, 6 đợt thu với các trường hợp đóng đủ, một phần, trễ hạn, quá hạn; 30 tài khoản cư dân. |

---

## 4. Ngoài phạm vi (Sprint 2)

- **US-007:** Đợt đóng góp tự nguyện (đóng số tiền tùy ý, tổng hợp theo đợt).
- **US-013 (phần còn lại):** Khiếu nại / tranh chấp.
- Quản lý phương tiện và phí gửi xe; thu hộ điện, nước, Internet (theo `01_REQUIREMENTS_AND_BACKLOG.md` mục 3.2).
- Gửi thông báo qua email / SMS (hiện chỉ có thông báo trong ứng dụng và giấy báo in).
