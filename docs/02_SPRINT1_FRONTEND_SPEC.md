# ĐẶC TẢ FRONTEND SPRINT 1 — DỰ ÁN BLUEMOON (NHÓM SE\_01)

> **Tài liệu tham chiếu:**
> - Yêu cầu & Backlog: `docs/01_REQUIREMENTS_AND_BACKLOG.md`
> - Backend API: `src/BlueMoon.API/` (ASP.NET Core Web API, .NET 10)
> - Frontend scaffold: `frontend/` (React 19 + TypeScript + Vite)

---

## Phần 1 — Hiện trạng khung `frontend/`

### 1.1. Cấu trúc thư mục

```
frontend/
├── index.html
├── package.json          # react, react-dom, react-router-dom, axios, vite, typescript
├── vite.config.ts        # plugin: @vitejs/plugin-react, không proxy
├── .env.example          # VITE_API_BASE_URL=https://localhost:5001/api
├── tsconfig.json
└── src/
    ├── main.tsx           # Entry point, BrowserRouter, 1 route catch-all
    ├── styles.css         # Design system hoàn chỉnh (sidebar, card, table, badge, alert…)
    ├── vite-env.d.ts
    └── components/
        ├── Layout.tsx     # App shell: sidebar + header + <Outlet/>
        ├── PageHeader.tsx # Tiêu đề trang + action slot
        ├── Feedback.tsx   # Alert error/success
        └── StatusBadge.tsx# Badge trạng thái (Paid/Active → xanh, Partial/Open → vàng, khác → xám)
```

### 1.2. Các route đã khai báo (trong `Layout.tsx`)

| Route path | Label trong sidebar | Tình trạng |
|---|---|---|
| `/` | Dashboard | ⚠️ Chỉ hiện placeholder |
| `/apartments` | Apartments | ⚠️ Không có page component |
| `/households` | Households | ⚠️ Không có page component |
| `/residents` | Residents | ⚠️ Không có page component |
| `/fees` | Fees | ⚠️ Không có page component |
| `/payments` | Payments | ⚠️ Không có page component |

> Hiện tại `main.tsx` chỉ có 1 route catch-all `path="*"` render `<Placeholder/>`. Chưa có route con nào được khai báo.

### 1.3. Component dùng chung đã có sẵn

| Component | File | Mô tả | Giao diện |
|---|---|---|---|
| `Layout` | `components/Layout.tsx` | Shell ứng dụng: sidebar cố định 250px + header + `<Outlet/>` | Có đủ |
| `PageHeader` | `components/PageHeader.tsx` | `title`, `description?`, `action?` (ReactNode) | Có đủ |
| `Feedback` | `components/Feedback.tsx` | Hiện alert error (đỏ) hoặc success (xanh) | Có đủ |
| `StatusBadge` | `components/StatusBadge.tsx` | Badge trạng thái với 3 tone: success, warning, muted | Có đủ |

### 1.4. Những gì đang còn trống (cần triển khai Sprint 1)

| Hạng mục | Chi tiết |
|---|---|
| **API service layer** | Chưa có file `api.ts` / `apiClient.ts` nào. `axios` đã được cài nhưng chưa cấu hình instance (base URL, interceptor gắn JWT token, xử lý 401). |
| **Auth context / guard** | Chưa có `AuthContext`, `AuthProvider`, `PrivateRoute`. Chưa lưu token vào localStorage/sessionStorage. |
| **Trang đăng nhập** | Chưa có. |
| **Trang nghiệp vụ** | Tất cả 6 nav link trong sidebar đều chưa có page component tương ứng. |
| **Service modules** | Chưa có bất kỳ hàm gọi API nào (apartments, households, residents, fees, payments…). |
| **TypeScript interfaces/types** | Chưa có file types/interfaces ánh xạ DTO từ backend. |
| **Sidebar: thiếu menu** | Sidebar chưa có link cho Login, Logout, User Management, Fee Collections, Fee Charges, Resident Histories, Search/Statistics. |
| **Responsive / routing guard** | Chưa có redirect sau login, chưa có 404 page. |

---

## Phần 2 — Đặc tả chi tiết từng Màn hình Sprint 1

### Quy ước chung

- **Base URL Backend:** `http://localhost:5016/api` (profile `http` trong `launchSettings.json`).
- **Xác thực:** JWT Bearer. Gửi header `Authorization: Bearer <token>` cho mọi request trừ Login.
- **Role hệ thống:** `Admin` | `User` (định nghĩa trong `AccountDtos.cs` — xem Phần 3 về sai lệch tên role với tài liệu).
- **Trạng thái UI bắt buộc mỗi màn hình:** Loading (spinner/skeleton), Empty state (thông báo "Không có dữ liệu"), Error toast (hiển thị `message` từ server).

---

### Nhóm A — Tài khoản & Xác thực (EP-005)

#### A1. Màn hình Đăng nhập

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/login` |
| **PBI** | PBI-022 |
| **Mô tả** | Form đăng nhập, nếu thành công lưu token + thông tin user, redirect `/`. |
| **Trường nhập liệu** | `username` (text, bắt buộc, max 100), `password` (password, bắt buộc, min 8 max 200) |

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Đăng nhập | `POST` | `/api/auth/login` | `LoginRequest { Username, Password }` | `LoginResponse { AccessToken, ExpiresAtUtc, User: UserResponse }` | Không (AllowAnonymous) |

**Xử lý:**
- 200 → Lưu `AccessToken` vào localStorage, lưu `User` vào AuthContext, redirect `/`.
- 401 → Hiện thông báo "Sai tài khoản hoặc mật khẩu".

---

#### A2. Đăng xuất

| Thuộc tính | Giá trị |
|---|---|
| **Route** | Không có route riêng — nút trong header/sidebar |
| **PBI** | PBI-025 |
| **Mô tả** | Xóa token khỏi localStorage, reset AuthContext, redirect `/login`. |

**Ánh xạ API:** Không có endpoint logout phía server. Chỉ xử lý client-side.

---

#### A3. Quản lý Tài khoản (Danh sách User)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/users` |
| **PBI** | PBI-026 (Phân quyền truy cập) |
| **Mô tả** | Hiện danh sách user. Admin có quyền tạo mới, cập nhật, khóa tài khoản. |
| **Quyền truy cập** | Chỉ `Admin` |

**Các cột bảng:** ID, Username, Họ tên, Email, Role, Trạng thái (Active/Locked), Actions

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Lấy danh sách | `GET` | `/api/users` | — | `UserResponse[]` | Admin |
| Lấy chi tiết | `GET` | `/api/users/{id}` | — | `UserResponse` | Admin |
| Tạo user | `POST` | `/api/users` | `CreateUserRequest { Username, Password, FullName, Email, Role }` | `UserResponse` (201) | Admin* |
| Cập nhật | `PUT` | `/api/users/{id}` | `UpdateUserRequest { FullName, Email, Role, NewPassword? }` | `UserResponse` | Admin |
| Khóa tài khoản | `PATCH` | `/api/users/{id}/lock` | — | 204 No Content | Admin |

> \*Lưu ý: `POST /api/users` cho phép AllowAnonymous khi chưa có user nào trong hệ thống (tạo Admin đầu tiên). Khi đã có user thì yêu cầu Admin role.

**`UserResponse`:**
```
{ Id, Username, FullName, Email, Role, IsActive }
```

---

#### A4. Quản lý Thông tin Cá nhân / Đổi mật khẩu

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/profile` |
| **PBI** | PBI-023, PBI-024 |
| **Mô tả** | User xem và cập nhật thông tin cá nhân, đổi mật khẩu. |

**Ánh xạ API:** Dùng chung `PUT /api/users/{id}` với `UpdateUserRequest`. Frontend lấy `id` từ AuthContext (user đang login), chỉ cho phép sửa FullName, Email, NewPassword — **không cho sửa Role** (ẩn trường Role hoặc disable).

> ⚠️ Backend chưa có endpoint riêng `/api/users/me` hoặc `/api/auth/change-password`. Phải dùng `PUT /api/users/{id}` → yêu cầu role Admin. Xem cảnh báo ở Phần 3.

---

### Nhóm B — Căn hộ, Hộ gia đình, Nhân khẩu & Biến động cư trú (EP-001)

#### B1. Quản lý Căn hộ (Apartments)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/apartments` |
| **PBI** | Hỗ trợ PBI-001 (Quản lý hộ gia đình — Căn hộ là thực thể gốc) |
| **Mô tả** | CRUD danh sách căn hộ trong chung cư. |

**Các cột bảng:** Mã căn hộ (ApartmentCode), Tòa nhà (Building), Tầng (Floor), Diện tích (Area, m²), Trạng thái (Status), Actions

**Form tạo/sửa:** ApartmentCode (text, bắt buộc), Building (text, bắt buộc), Floor (number, 1–100), Area (number, 0.1–10000), Status (select: Available/Occupied/…, default "Available")

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/apartments` | — | `ApartmentResponseDto[]` | Không có `[Authorize]` |
| Chi tiết | `GET` | `/api/apartments/{id}` | — | `ApartmentResponseDto` | Không có `[Authorize]` |
| Tạo mới | `POST` | `/api/apartments` | `ApartmentCreateDto { ApartmentCode, Building, Floor, Area, Status }` | `ApartmentResponseDto` (201) | Không có `[Authorize]` |
| Cập nhật | `PUT` | `/api/apartments/{id}` | `ApartmentUpdateDto { ApartmentCode, Building, Floor, Area, Status }` | 204 No Content | Không có `[Authorize]` |
| Xóa | `DELETE` | `/api/apartments/{id}` | — | 204 No Content | Không có `[Authorize]` |

**`ApartmentResponseDto`:**
```
{ Id, ApartmentCode, Building, Floor, Area, Status }
```

**Validation đặc biệt:**
- 409 Conflict khi trùng `ApartmentCode`.
- 409 Conflict khi xóa căn hộ đang có Household/Vehicle/FeeCharge/Payment liên quan.

---

#### B2. Quản lý Hộ gia đình (Households)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/households` |
| **PBI** | PBI-001 |
| **Mô tả** | CRUD hộ gia đình, gắn với căn hộ. |

**Các cột bảng:** Mã hộ (HouseholdCode), Mã căn hộ (ApartmentCode), Tòa nhà (Building), Ngày tạo (CreatedAt), Trạng thái (IsActive), Actions

**Form tạo:** HouseholdCode (text, bắt buộc, max 50), ApartmentId (select dropdown từ danh sách Apartments)

**Form sửa:** HouseholdCode, ApartmentId, IsActive (checkbox)

**Query filters (GET):** `?apartmentId=&isActive=&householdCode=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/households?apartmentId=&isActive=&householdCode=` | — | `HouseholdResponseDto[]` | Không có `[Authorize]` |
| Chi tiết | `GET` | `/api/households/{id}` | — | `HouseholdResponseDto` | Không có `[Authorize]` |
| Tạo mới | `POST` | `/api/households` | `HouseholdCreateDto { HouseholdCode, ApartmentId }` | `HouseholdResponseDto` (201) | Không có `[Authorize]` |
| Cập nhật | `PUT` | `/api/households/{id}` | `HouseholdUpdateDto { HouseholdCode, ApartmentId, IsActive }` | 204 No Content | Không có `[Authorize]` |
| Xóa | `DELETE` | `/api/households/{id}` | — | 204 No Content | Không có `[Authorize]` |

**`HouseholdResponseDto`:**
```
{ Id, HouseholdCode, ApartmentId, ApartmentCode, Building, CreatedAt, IsActive }
```

**Validation đặc biệt:**
- 409 Conflict khi trùng `HouseholdCode`.
- 404 khi `ApartmentId` không tồn tại.
- 409 khi xóa hộ gia đình đang có nhân khẩu.

---

#### B3. Quản lý Nhân khẩu (Residents)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/residents` |
| **PBI** | PBI-002 |
| **Mô tả** | CRUD nhân khẩu thuộc hộ gia đình. |

**Các cột bảng:** Họ tên (FullName), CCCD (IdentityNumber), Ngày sinh (DateOfBirth), Giới tính (Gender), SĐT (PhoneNumber), Quan hệ (Relationship), Chủ hộ (IsHouseholdHead), Mã hộ (HouseholdCode), Mã căn hộ (ApartmentCode), Trạng thái (Status), Actions

**Form tạo/sửa:** HouseholdId (select), FullName (text, bắt buộc, max 200), IdentityNumber (text, bắt buộc, max 50), DateOfBirth (date, không được là tương lai), Gender (select/text, max 30), PhoneNumber (text, max 30), Relationship (text, max 50), IsHouseholdHead (checkbox), Status (text, max 30, default "Active")

**Query filters (GET):** `?householdId=&apartmentId=&name=&status=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/residents?householdId=&apartmentId=&name=&status=` | — | `ResidentResponseDto[]` | Không có `[Authorize]` |
| Chi tiết | `GET` | `/api/residents/{id}` | — | `ResidentResponseDto` | Không có `[Authorize]` |
| Tạo mới | `POST` | `/api/residents` | `ResidentCreateDto { HouseholdId, FullName, IdentityNumber, DateOfBirth?, Gender, PhoneNumber, Relationship, IsHouseholdHead, Status }` | `ResidentResponseDto` (201) | Không có `[Authorize]` |
| Cập nhật | `PUT` | `/api/residents/{id}` | `ResidentUpdateDto { HouseholdId, FullName, IdentityNumber, DateOfBirth?, Gender, PhoneNumber, Relationship, IsHouseholdHead, Status }` | 204 No Content | Không có `[Authorize]` |
| Xóa | `DELETE` | `/api/residents/{id}` | — | 204 No Content | Không có `[Authorize]` |

**`ResidentResponseDto`:**
```
{ Id, HouseholdId, HouseholdCode, ApartmentId, ApartmentCode, Building, FullName, DateOfBirth?, Gender, PhoneNumber, Relationship, IsHouseholdHead, Status }
```

**Validation đặc biệt:**
- 409 Conflict khi trùng `IdentityNumber` (CCCD).
- 404 khi `HouseholdId` không tồn tại.
- 400 khi `DateOfBirth` nằm trong tương lai.
- 409 khi xóa nhân khẩu đang có ResidenceHistory/Vehicle/Payment.

---

#### B4. Quản lý Biến động Cư trú (Residence Histories)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/resident-histories` |
| **PBI** | PBI-003 (Tạm trú, tạm vắng), PBI-004 (Chuyển đến, chuyển đi) |
| **Mô tả** | Ghi nhận lịch sử biến động cư trú của nhân khẩu. |
| **Quyền truy cập** | `Admin` (cả controller) |

**Các cột bảng:** Nhân khẩu (ResidentFullName), Mã hộ (HouseholdCode), Mã căn hộ (ApartmentCode), Loại biến động (HistoryType), Ngày bắt đầu (StartDate), Ngày kết thúc (EndDate), Nơi đến (Destination), Ghi chú (Note)

**Form tạo:** ResidentId (select từ danh sách Residents), HistoryType (select: `MoveIn` | `MoveOut` | `InformationChange`), StartDate (date, bắt buộc), EndDate (date, tùy chọn, ≥ StartDate), Destination (text, max 200, tùy chọn), Note (textarea, bắt buộc, max 1000), PreviousValue (text, max 2000 — bắt buộc nếu `InformationChange`), NewValue (text, max 2000 — bắt buộc nếu `InformationChange`)

**Query filters (GET):** `?residentId=&historyType=&fromDate=&toDate=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách (tìm kiếm) | `GET` | `/api/residence-histories?residentId=&historyType=&fromDate=&toDate=` | — | `ResidentHistoryResponseDto[]` | Admin |
| Chi tiết | `GET` | `/api/residence-histories/{id}` | — | `ResidentHistoryResponseDto` | Admin |
| Theo nhân khẩu | `GET` | `/api/residence-histories/resident/{residentId}` | — | `ResidentHistoryResponseDto[]` | Admin |
| Tạo mới | `POST` | `/api/residence-histories` | `ResidentHistoryCreateDto { ResidentId, HistoryType, StartDate, EndDate?, Destination?, Note, PreviousValue?, NewValue? }` | `ResidentHistoryResponseDto` (201) | Admin |

> ⚠️ **Không có** endpoint PUT/DELETE cho residence history → chỉ xem và tạo mới.

**`ResidentHistoryResponseDto`:**
```
{ Id, ResidentId, ResidentFullName, HouseholdId, HouseholdCode, ApartmentId, ApartmentCode, HistoryType, StartDate, EndDate?, Destination?, Note, PreviousValue?, NewValue?, CreatedByUserId }
```

**Lưu ý về HistoryType:**
- Backend sử dụng: `MoveIn`, `MoveOut`, `InformationChange`.
- Tài liệu yêu cầu (PBI-003): Tạm trú, Tạm vắng → xem cảnh báo Phần 3.

---

#### B5. Tra cứu Hộ gia đình & Cư dân (Search)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/search` hoặc tích hợp vào Dashboard |
| **PBI** | PBI-005 |
| **Mô tả** | Tìm kiếm thống nhất theo mã căn hộ, mã hộ, tên cư dân, CCCD, SĐT. |
| **Quyền truy cập** | `Admin` |

**Trường tìm kiếm:** search (text — tìm kiếm đa trường), apartmentId (select, tùy chọn), isActive (select, tùy chọn)

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Tra cứu hộ gia đình | `GET` | `/api/search-statistics/households?search=&apartmentId=&isActive=` | — | `HouseholdSearchResponseDto[]` | Admin |

**`HouseholdSearchResponseDto`:**
```
{
  Id, HouseholdCode, ApartmentId, ApartmentCode, Building, IsActive, ResidentCount,
  Residents: [{ Id, FullName, IdentityNumber, PhoneNumber, Relationship, IsHouseholdHead, Status }]
}
```

---

### Nhóm C — Danh mục Khoản thu, Đợt thu & Công nợ (EP-002 & EP-003)

#### C1. Danh mục Khoản thu (Fee Categories)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/fee-categories` |
| **PBI** | PBI-006, PBI-007, PBI-008, PBI-009, PBI-010 |
| **Mô tả** | CRUD danh mục khoản thu (phí dịch vụ, phí quản lý, đóng góp tự nguyện…). |
| **Quyền truy cập** | Không có `[Authorize]` trên controller (xem cảnh báo Phần 3) |

**Các cột bảng:** Tên khoản thu (Name), Mô tả (Description), Đơn vị (Unit), Đơn giá (UnitPrice), Cách tính (CalculationMethod), Bắt buộc (IsMandatory), Trạng thái (IsActive), Actions

**Form tạo:** Name (text, bắt buộc, 1–100), Description (textarea, max 500), Unit (text, bắt buộc, 1–50), UnitPrice (number, ≥ 0), CalculationMethod (text, bắt buộc, 1–50), IsMandatory (checkbox)

**Form sửa:** Tất cả trường của form tạo + IsActive (checkbox)

**Query filters (GET):** `?isActive=&name=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/feecategories?isActive=&name=` | — | `FeeCategoryResponseDto[]` | Không |
| Chi tiết | `GET` | `/api/feecategories/{id}` | — | `FeeCategoryResponseDto` | Không |
| Tạo mới | `POST` | `/api/feecategories` | `FeeCategoryCreateDto { Name, Description?, Unit, UnitPrice, CalculationMethod, IsMandatory }` | `FeeCategoryResponseDto` (201) | Không |
| Cập nhật | `PUT` | `/api/feecategories/{id}` | `FeeCategoryUpdateDto { Name, Description?, Unit, UnitPrice, CalculationMethod, IsMandatory, IsActive }` | 204 No Content | Không |
| Vô hiệu hóa | `PATCH` | `/api/feecategories/{id}/deactivate` | — | 204 No Content | Không |
| Xóa | `DELETE` | `/api/feecategories/{id}` | — | 204 No Content | Không |

**`FeeCategoryResponseDto`:**
```
{ Id, Name, Description?, Unit, UnitPrice, CalculationMethod, IsMandatory, IsActive }
```

---

#### C2. Đợt thu (Fee Collections)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/fee-collections` |
| **PBI** | PBI-011 (Lập danh sách phải thu — đợt thu là container) |
| **Mô tả** | Quản lý đợt thu phí theo tháng/năm. |
| **Quyền truy cập** | `Admin` (cả controller) |

**Các cột bảng:** Tên đợt thu (Name), Tháng (Month), Năm (Year), Người tạo (CreatedByUsername), Ngày tạo (CreatedAt), Trạng thái (Status: Open/Closed/Cancelled), Actions

**Form tạo:** Name (text, bắt buộc, 1–200), Month (number, 1–12), Year (number, 2000–2100)

**Form sửa:** Name, Month, Year, Status (select: Open/Closed/Cancelled)

**Query filters (GET):** `?month=&year=&status=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/feecollections?month=&year=&status=` | — | `FeeCollectionResponseDto[]` | Admin |
| Chi tiết | `GET` | `/api/feecollections/{id}` | — | `FeeCollectionResponseDto` | Admin |
| Tạo mới | `POST` | `/api/feecollections` | `FeeCollectionCreateDto { Name, Month, Year }` | `FeeCollectionResponseDto` (201) | Admin |
| Cập nhật | `PUT` | `/api/feecollections/{id}` | `FeeCollectionUpdateDto { Name, Month, Year, Status }` | 204 No Content | Admin |
| Đổi trạng thái | `PATCH` | `/api/feecollections/{id}/status` | `FeeCollectionStatusDto { Status }` | 204 No Content | Admin |
| Xóa | `DELETE` | `/api/feecollections/{id}` | — | 204 No Content | Admin |

**`FeeCollectionResponseDto`:**
```
{ Id, Name, Month, Year, CreatedAt, CreatedByUserId, CreatedByUsername, Status }
```

**Validation đặc biệt:**
- 409 khi trùng cặp Month+Year.
- 409 khi đổi Month/Year cho đợt thu đã có FeeCharge.
- 409 khi xóa đợt thu đang có FeeCharge.

---

#### C3. Khoản phải thu / Công nợ (Fee Charges)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/fee-charges` |
| **PBI** | PBI-011 (Lập danh sách phải thu), PBI-014 (Quản lý công nợ), PBI-015 (Đối chiếu thu phí) |
| **Mô tả** | Sinh và quản lý khoản phải thu cho từng căn hộ theo đợt thu & danh mục phí. Theo dõi công nợ. |
| **Quyền truy cập** | `Admin` (cả controller) |

**Các cột bảng:** Mã căn hộ (ApartmentCode), Tòa nhà (ApartmentBuilding), Đợt thu (FeeCollectionName, Tháng/Năm), Khoản phí (FeeCategoryName), Số lượng (Quantity), Đơn giá (UnitPrice), Tổng tiền (TotalAmount), Đã thu (PaidAmount), Còn nợ (OutstandingAmount), Hạn nộp (DueDate), Trạng thái (Status: Unpaid/PartiallyPaid/Paid)

**Form tạo:** FeeCollectionId (select), ApartmentId (select), FeeCategoryId (select), Quantity (number, ≥ 0.01), DueDate (date, tùy chọn)

**Form sửa:** Quantity, DueDate (không sửa được FeeCollectionId, ApartmentId, FeeCategoryId)

**Query filters (GET):** `?feeCollectionId=&apartmentId=&feeCategoryId=&status=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/fee-charges?feeCollectionId=&apartmentId=&feeCategoryId=&status=` | — | `FeeChargeResponseDto[]` | Admin |
| Chi tiết | `GET` | `/api/fee-charges/{id}` | — | `FeeChargeResponseDto` | Admin |
| Theo căn hộ (debt) | `GET` | `/api/fee-charges/apartment/{apartmentId}?feeCollectionId=&status=` | — | `FeeChargeDebtSummaryDto` | Admin |
| Theo đợt thu | `GET` | `/api/fee-charges/collection/{collectionId}?apartmentId=&status=` | — | `FeeChargeResponseDto[]` | Admin |
| Tổng nợ theo hộ | `GET` | `/api/fee-charges/debt-summary?apartmentId=&feeCollectionId=&status=` | — | `FeeChargeDebtSummaryDto` | Admin |
| Tạo mới | `POST` | `/api/fee-charges` | `FeeChargeCreateDto { FeeCollectionId, ApartmentId, FeeCategoryId, Quantity, DueDate? }` | `FeeChargeResponseDto` (201) | Admin |
| Cập nhật | `PUT` | `/api/fee-charges/{id}` | `FeeChargeUpdateDto { Quantity, DueDate? }` | 204 No Content | Admin |
| Xóa | `DELETE` | `/api/fee-charges/{id}` | — | 204 No Content | Admin |

**`FeeChargeResponseDto`:**
```
{ Id, FeeCollectionId, FeeCollectionName, FeeCollectionMonth, FeeCollectionYear, FeeCollectionStatus,
  ApartmentId, ApartmentCode, ApartmentBuilding,
  FeeCategoryId, FeeCategoryName, FeeCategoryUnit, CalculationMethod,
  Quantity, UnitPrice, TotalAmount, PaidAmount, OutstandingAmount, DueDate?, Status }
```

**`FeeChargeDebtSummaryDto`:**
```
{ ApartmentId, ApartmentCode, FeeCollectionId?, TotalAmount, PaidAmount, OutstandingAmount, ChargeCount, Charges: FeeChargeResponseDto[] }
```

**Validation đặc biệt:**
- 409 khi trùng bộ ba (FeeCollectionId, ApartmentId, FeeCategoryId).
- 409 khi tạo charge cho FeeCollection không ở trạng thái `Open`.
- 409 khi FeeCategory đã bị `inactive`.
- 409 khi sửa TotalAmount < PaidAmount.
- 409 khi xóa charge đã có payment.

---

### Nhóm D — Thanh toán & Thống kê (EP-003 & EP-004)

#### D1. Ghi nhận Thanh toán (Payments)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/payments` |
| **PBI** | PBI-013 (Ghi nhận thanh toán), PBI-016 (Tra cứu hóa đơn), PBI-017 (Lịch sử đóng góp) |
| **Mô tả** | Ghi nhận thanh toán cho 1 hoặc nhiều khoản phải thu cùng lúc. Xem lịch sử thanh toán. |
| **Quyền truy cập** | `Admin` (cả controller) |

**Các cột bảng danh sách:** Mã phiếu thu (ReceiptNumber), Mã căn hộ (ApartmentCode), Người nộp (ResidentFullName), Ngày thanh toán (PaymentDate), Tổng tiền (TotalAmount), Phương thức (PaymentMethod), Ghi chú (Note), Actions

**Form tạo thanh toán:**
- ApartmentId (select, bắt buộc)
- ResidentId (select, tùy chọn — lọc theo căn hộ đã chọn)
- ReceiptNumber (text, bắt buộc, 1–100)
- PaymentDate (date, tùy chọn — mặc định UTC now)
- PaymentMethod (text, bắt buộc, 1–50)
- Note (textarea, max 500)
- **Details** (bảng con — danh sách khoản thanh toán):
  - FeeChargeId (select từ danh sách FeeCharge còn nợ của căn hộ)
  - Amount (number, ≥ 0.01, không vượt quá OutstandingAmount)

**Query filters (GET):** `?apartmentId=&feeChargeId=&receiptNumber=`

**Ánh xạ API:**

| Hành động | Method | URL | Request DTO | Response DTO | Auth |
|---|---|---|---|---|---|
| Danh sách | `GET` | `/api/payments?apartmentId=&feeChargeId=&receiptNumber=` | — | `PaymentResponseDto[]` | Admin |
| Chi tiết | `GET` | `/api/payments/{id}` | — | `PaymentResponseDto` | Admin |
| Theo căn hộ | `GET` | `/api/payments/apartment/{apartmentId}` | — | `PaymentResponseDto[]` | Admin |
| Lịch sử theo khoản thu | `GET` | `/api/payments/fee-charge/{feeChargeId}` | — | `PaymentDetailHistoryDto[]` | Admin |
| Tạo thanh toán | `POST` | `/api/payments` | `PaymentCreateDto { ApartmentId, ResidentId?, ReceiptNumber, PaymentDate?, PaymentMethod, Note?, Details: [{ FeeChargeId, Amount }] }` | `PaymentResponseDto` (201) | Admin |

> ⚠️ **Không có** endpoint PUT/DELETE cho Payment → thanh toán không thể sửa/xóa sau khi tạo.

**`PaymentResponseDto`:**
```
{ Id, ApartmentId, ApartmentCode, ResidentId?, ResidentFullName, ReceivedByUserId, ReceiptNumber,
  PaymentDate, TotalAmount, PaymentMethod, Note,
  Details: [{ Id, FeeChargeId, FeeCategoryName, FeeCollectionId, FeeCollectionName, Amount }] }
```

**`PaymentDetailHistoryDto`:**
```
{ PaymentId, ReceiptNumber, PaymentDate, PaymentMethod, Amount }
```

**Validation đặc biệt:**
- 409 khi trùng `ReceiptNumber`.
- 400 khi Resident không thuộc Apartment đã chọn.
- 400 khi FeeChargeId xuất hiện 2 lần trong cùng 1 payment.
- 409 khi số tiền thanh toán vượt quá số tiền còn nợ của FeeCharge.

---

#### D2. Tra cứu Khoản thu & Thanh toán (Search)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/search/charges` và `/search/payments` (hoặc tab trong `/search`) |
| **PBI** | PBI-016 (Tra cứu hóa đơn), PBI-017 (Lịch sử đóng góp) |
| **Quyền truy cập** | `Admin` |

**Ánh xạ API:**

| Hành động | Method | URL | Query Params | Response DTO | Auth |
|---|---|---|---|---|---|
| Tra cứu khoản thu | `GET` | `/api/search-statistics/charges` | `?apartmentId=&feeCollectionId=&feeCategoryId=&status=&month=&year=` | `FinancialSearchResponseDto[]` | Admin |
| Tra cứu thanh toán | `GET` | `/api/search-statistics/payments` | `?apartmentId=&feeCollectionId=&fromDate=&toDate=&receiptNumber=` | `PaymentSearchResponseDto[]` | Admin |

**`FinancialSearchResponseDto`:**
```
{ FeeChargeId, ApartmentId, ApartmentCode, FeeCollectionId, FeeCollectionName, FeeCollectionMonth, FeeCollectionYear,
  FeeCategoryId, FeeCategoryName, TotalAmount, PaidAmount, OutstandingAmount, Status, DueDate? }
```

**`PaymentSearchResponseDto`:**
```
{ PaymentId, ApartmentId, ApartmentCode, ReceiptNumber, PaymentDate, Amount, PaymentMethod,
  FeeChargeId, FeeCategoryName, FeeCollectionId, FeeCollectionName }
```

---

#### D3. Thống kê Thu phí (Statistics / Dashboard)

| Thuộc tính | Giá trị |
|---|---|
| **Route** | `/` (Dashboard) hoặc `/statistics` |
| **PBI** | PBI-015 (Đối chiếu thu phí), PBI-018 (Thống kê khoản thu), PBI-019 (Báo cáo công nợ), PBI-020 (Báo cáo doanh thu) |
| **Quyền truy cập** | `Admin` |

**Ánh xạ API:**

| Hành động | Method | URL | Query Params | Response DTO | Auth |
|---|---|---|---|---|---|
| Thống kê theo đợt thu | `GET` | `/api/search-statistics/statistics/collections` | `?month=&year=&status=` | `CollectionStatisticsDto[]` | Admin |
| Thống kê tài chính tổng hợp | `GET` | `/api/search-statistics/statistics/financial` | `?apartmentId=&feeCollectionId=&feeCategoryId=` | `FinancialStatisticsDto` | Admin |
| Thống kê theo căn hộ | `GET` | `/api/search-statistics/statistics/apartments` | `?feeCollectionId=&apartmentId=` | `ApartmentContributionStatisticsDto[]` | Admin |

**`CollectionStatisticsDto`:**
```
{ FeeCollectionId, FeeCollectionName, Month, Year, Status, ChargeCount, TotalAmount, PaidAmount, OutstandingAmount, CollectionRate }
```

**`FinancialStatisticsDto`:**
```
{ ChargeCount, PaymentCount, TotalAmount, PaidAmount, OutstandingAmount, CollectionRate,
  UnpaidChargeCount, PartiallyPaidChargeCount, PaidChargeCount }
```

**`ApartmentContributionStatisticsDto`:**
```
{ ApartmentId, ApartmentCode, ChargeCount, TotalAmount, PaidAmount, OutstandingAmount, CollectionRate }
```

**Gợi ý hiển thị Dashboard:**
- Stat cards (sử dụng CSS class `.stat-value`, `.stat-label`, `.grid-4`): Tổng phải thu, Đã thu, Còn nợ, Tỷ lệ thu.
- Bảng thống kê theo đợt thu (CollectionStatistics).
- Bảng thống kê theo căn hộ (ApartmentStatistics) — đóng vai trò Báo cáo công nợ (PBI-019).

---

## Phần 3 — Cảnh báo Sai lệch giữa Tài liệu Yêu cầu và Backend thực tế

### 🔴 Mức Cao (Ảnh hưởng trực tiếp đến Frontend)

| # | Vấn đề | Tài liệu `docs/01` yêu cầu | Code thực tế `src/BlueMoon.API` | Khuyến nghị Frontend |
|---|---|---|---|---|
| 1 | **Tên Role** | "Ban quản trị" và "Kế toán" (mục 3.1) | Chỉ có `Admin` và `User` (`AccountDtos.cs` L53: `RegularExpression("^(Admin\|User)$")`) | Frontend hiển thị `Admin` = "Ban quản trị", `User` = "Kế toán". Không dùng Role khác. |
| 2 | **Loại biến động cư trú** | PBI-003: "Tạm trú, Tạm vắng"; PBI-004: "Chuyển đến, Chuyển đi" (4 loại) | `ResidentHistoryDtos.cs` L11: chỉ 3 giá trị `MoveIn`, `MoveOut`, `InformationChange`. Không có `TemporaryStay` hay `TemporaryAbsence`. | Frontend ánh xạ: `MoveIn` = Chuyển đến, `MoveOut` = Chuyển đi, `InformationChange` = Thay đổi thông tin. **Thiếu** chức năng Tạm trú/Tạm vắng ở backend. |
| 3 | **Endpoint đổi mật khẩu / thông tin cá nhân** | PBI-023 (Đổi mật khẩu), PBI-024 (Quản lý thông tin cá nhân): Cho phép **mọi User** đã đăng nhập tự đổi. | `PUT /api/users/{id}` yêu cầu `[Authorize(Roles = "Admin")]`. Không có endpoint `/api/users/me` hay `/api/auth/change-password`. | Với `Admin`: dùng `PUT /api/users/{id}`. Với `User`: **không thể tự đổi** thông tin/mật khẩu → cần backend bổ sung hoặc tạm ẩn chức năng. |
| 4 | **Thông báo thu phí** | PBI-012: "Tạo thông báo thu phí" | Không có NotificationsController hay endpoint nào liên quan đến thông báo. | **Không triển khai** màn hình thông báo thu phí ở Sprint 1. Ghi nhận thiếu endpoint. |

### 🟡 Mức Trung bình

| # | Vấn đề | Chi tiết |
|---|---|---|
| 5 | **Cổng chạy Backend** | `.env.example` ghi `VITE_API_BASE_URL=https://localhost:5001/api`. Thực tế `launchSettings.json` profile `http`: `http://localhost:5016`, profile `https`: `https://localhost:7018`. → Cần cập nhật `.env.example` thành `http://localhost:5016/api` (hoặc `https://localhost:7018/api`). |
| 6 | **CORS chưa cấu hình** | `Program.cs` **không có** `AddCors()` / `UseCors()`. Frontend (Vite chạy port 5173) gọi API sẽ bị trình duyệt chặn CORS. → Backend cần bổ sung CORS policy cho `http://localhost:5173`. |
| 7 | **Thiếu `[Authorize]` trên 3 controller** | `ApartmentsController`, `HouseholdsController`, `ResidentsController` **không có** `[Authorize]`. Mọi request (kể cả anonymous) đều truy cập được. `FeeCategoriesController` cũng không có `[Authorize]`. → Tuy BACKEND-ACCEPTANCE-REPORT đã ghi nhận (mức Medium), Frontend nên gửi JWT header cho mọi request để sẵn sàng khi backend bật auth. |
| 8 | **Phân quyền chưa phân biệt Admin/User** | Tất cả endpoint có `[Authorize]` đều yêu cầu `Roles = "Admin"`. Không có endpoint nào dành riêng cho role `User`. → Role `User` ("Kế toán") hiện tại chỉ đăng nhập được nhưng **không truy cập được bất kỳ chức năng nào có `[Authorize]`**. |

### 🟢 Mức Thấp (Thông tin bổ sung)

| # | Vấn đề | Chi tiết |
|---|---|---|
| 9 | **Mã khoản thu (PBI-009)** | Tài liệu yêu cầu "không cho phép trùng mã khoản thu". Backend FeeCategory chỉ có `Name`, không có trường `Code` riêng. Kiểm tra trùng bằng `Name` (case-insensitive). |
| 10 | **Báo cáo cư dân (PBI-021)** | Thuộc Sprint 1 theo đặc tả (Ưu tiên Trung bình). Backend có thể dùng `GET /api/residents` + filter, nhưng không có endpoint xuất báo cáo chuyên biệt. Frontend có thể dựng bảng từ dữ liệu residents + filter theo status. |
| 11 | **Model `Vehicle.cs` tồn tại** | Backend có entity `Vehicle.cs` nhưng **không có** `VehiclesController`. Entity này thuộc Sprint 2. Frontend không cần quan tâm. |
| 12 | **`IdentityNumber` (Backend) vs CCCD (Tài liệu)** | Backend dùng tên trường `IdentityNumber` cho khái niệm "Căn cước công dân (CCCD)" trong tài liệu. Frontend hiển thị label "CCCD/CMND" nhưng gửi/nhận trường `identityNumber`. |
| 13 | **HTTPS Redirection** | `Program.cs` có `app.UseHttpsRedirection()` nhưng profile `http` chỉ listen trên HTTP. Có thể gây redirect warning. Nếu Frontend gọi HTTP → không ảnh hưởng vì redirection chỉ hoạt động khi có HTTPS port. |

---

## Tổng hợp Route Map Sprint 1

```
/login                    → Đăng nhập (Public)
/                         → Dashboard / Thống kê (Admin)
/apartments               → Quản lý Căn hộ
/households               → Quản lý Hộ gia đình
/residents                → Quản lý Nhân khẩu
/resident-histories       → Biến động Cư trú (Admin)
/fee-categories           → Danh mục Khoản thu
/fee-collections          → Đợt thu (Admin)
/fee-charges              → Khoản phải thu / Công nợ (Admin)
/payments                 → Thanh toán (Admin)
/search                   → Tra cứu (Admin)
/users                    → Quản lý Tài khoản (Admin)
/profile                  → Thông tin Cá nhân (Authenticated)
```

## Tổng hợp Endpoint Map (Backend)

| Controller | Route Prefix | Auth | Endpoints |
|---|---|---|---|
| `AuthController` | `/api/auth` | AllowAnonymous | `POST /login` |
| `UsersController` | `/api/users` | Admin (trừ POST khi chưa có user) | `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `PATCH /{id}/lock` |
| `ApartmentsController` | `/api/apartments` | ❌ Không có | `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `HouseholdsController` | `/api/households` | ❌ Không có | `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `ResidentsController` | `/api/residents` | ❌ Không có | `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `ResidentHistoriesController` | `/api/residence-histories` | Admin | `GET /`, `GET /{id}`, `GET /resident/{residentId}`, `POST /` |
| `FeeCategoriesController` | `/api/feecategories` | ❌ Không có | `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `PATCH /{id}/deactivate`, `DELETE /{id}` |
| `FeeCollectionsController` | `/api/feecollections` | Admin | `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `PATCH /{id}/status`, `DELETE /{id}` |
| `FeeChargesController` | `/api/fee-charges` | Admin | `GET /`, `GET /{id}`, `GET /apartment/{id}`, `GET /collection/{id}`, `GET /debt-summary`, `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `PaymentsController` | `/api/payments` | Admin | `GET /`, `GET /{id}`, `GET /apartment/{id}`, `GET /fee-charge/{id}`, `POST /` |
| `SearchStatisticsController` | `/api/search-statistics` | Admin | `GET /households`, `GET /charges`, `GET /payments`, `GET /statistics/collections`, `GET /statistics/financial`, `GET /statistics/apartments` |
