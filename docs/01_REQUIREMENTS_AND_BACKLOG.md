\# ĐẶC TẢ YÊU CẦU \& PRODUCT BACKLOG - DỰ ÁN BLUEMOON (NHÓM SE\_01)



> \*\*Lưu ý kiến trúc (Cập nhật từ NFR-006):\*\* Hệ thống được triển khai dưới dạng ứng dụng Web tách rời gồm \*\*Frontend (React + TypeScript + Vite)\*\* kết nối REST API với \*\*Backend (ASP.NET Core Web API - `src/BlueMoon.API`)\*\* và cơ sở dữ liệu tập trung.



\---



\## 1. Danh sách Yêu cầu Chức năng (Product Backlog - 26 PBIs)



\### EP-001: Quản lý Hộ gia đình \& Nhân khẩu

| PBI ID | Feature | Tên chức năng | User Story | Acceptance Criteria (Tiêu chí nghiệm thu) | Ưu tiên |

| :--- | :--- | :--- | :--- | :--- | :--- |

| \*\*PBI-001\*\* | FE-001 | Quản lý hộ gia đình | Là Ban quản trị, tôi muốn thêm, cập nhật và quản lý hộ gia đình để lưu trữ tập trung thông tin các hộ đang sinh sống tại chung cư. | Tạo được hộ gia đình khi nhập đủ dữ liệu bắt buộc; không cho phép trùng mã căn hộ; cập nhật thông tin hợp lệ thành công; hiển thị lỗi khi dữ liệu không hợp lệ. | Cao |

| \*\*PBI-002\*\* | FE-002 | Quản lý nhân khẩu | Là Ban quản trị, tôi muốn quản lý nhân khẩu thuộc từng hộ gia đình để theo dõi đầy đủ thành viên đang cư trú. | Thêm được nhân khẩu vào đúng hộ; cập nhật được thông tin nhân khẩu; không cho phép trùng CCCD; hiển thị lỗi khi thiếu thông tin bắt buộc. | Cao |

| \*\*PBI-003\*\* | FE-003 | Quản lý tạm trú, tạm vắng | Là Ban quản trị, tôi muốn ghi nhận tình trạng tạm trú và tạm vắng để theo dõi tình trạng cư trú thực tế của nhân khẩu. | Ghi nhận được loại biến động; lưu ngày bắt đầu và ngày kết thúc; cập nhật trạng thái cư trú; lưu lịch sử thay đổi. | Cao |

| \*\*PBI-004\*\* | FE-004 | Quản lý biến động nhân khẩu | Là Ban quản trị, tôi muốn ghi nhận việc chuyển đến và chuyển đi để dữ liệu cư dân phản ánh đúng tình hình thực tế. | Ghi nhận được chuyển đến hoặc chuyển đi; bắt buộc nhập ngày biến động; cập nhật trạng thái nhân khẩu; không làm mất lịch sử cư trú. | Cao |

| \*\*PBI-005\*\* | FE-005 | Tra cứu thông tin cư dân | Là Ban quản trị, tôi muốn tra cứu hộ gia đình và nhân khẩu để nhanh chóng tìm được thông tin cần thiết. | Tìm kiếm được theo mã căn hộ, tên chủ hộ, họ tên hoặc CCCD; hiển thị đúng kết quả; thông báo khi không tìm thấy dữ liệu. | Cao |



\### EP-002: Quản lý Danh mục Khoản thu \& Đóng góp

| PBI ID | Feature | Tên chức năng | User Story | Acceptance Criteria (Tiêu chí nghiệm thu) | Ưu tiên |

| :--- | :--- | :--- | :--- | :--- | :--- |

| \*\*PBI-006\*\* | FE-006 | Quản lý phí dịch vụ chung cư | Là Kế toán, tôi muốn quản lý phí dịch vụ để áp dụng đúng mức phí cho các hộ dân. | Tạo được phí dịch vụ; cập nhật được mức phí; kiểm tra mức phí hợp lệ; lưu được thời gian áp dụng; không cho phép dữ liệu âm. | Cao |

| \*\*PBI-007\*\* | FE-007 | Quản lý phí quản lý chung cư | Là Kế toán, tôi muốn quản lý phí quản lý để tính đúng nghĩa vụ thanh toán định kỳ của từng hộ. | Tạo được phí quản lý; thiết lập được đơn giá; cập nhật thời gian áp dụng; lưu lịch sử thay đổi mức phí. | Cao |

| \*\*PBI-008\*\* | FE-008 | Quản lý khoản đóng góp tự nguyện | Là Ban quản trị, tôi muốn tạo các khoản đóng góp tự nguyện để quản lý các chương trình quyên góp của cộng đồng. | Tạo được đợt đóng góp; nhập được tên, mục đích và thời gian; ghi nhận được số tiền đóng góp; tổng hợp được kết quả theo đợt. | Trung bình |

| \*\*PBI-009\*\* | FE-009 | Tạo danh mục khoản thu | Là Kế toán, tôi muốn tạo danh mục khoản thu để tái sử dụng các loại phí trong nhiều kỳ thu. | Tạo được khoản thu mới; phân loại được bắt buộc hoặc tự nguyện; không cho phép trùng mã khoản thu; kiểm tra dữ liệu bắt buộc. | Cao |

| \*\*PBI-010\*\* | FE-010 | Cập nhật khoản thu | Là Kế toán, tôi muốn cập nhật thông tin khoản thu để phản ánh những thay đổi về mức phí và thời gian áp dụng. | Cập nhật được tên, mức phí và thời gian áp dụng; không làm thay đổi dữ liệu lịch sử đã thu; thông báo khi dữ liệu không hợp lệ. | Cao |



\### EP-003: Quản lý Kỳ thu, Thanh toán \& Công nợ

| PBI ID | Feature | Tên chức năng | User Story | Acceptance Criteria (Tiêu chí nghiệm thu) | Ưu tiên |

| :--- | :--- | :--- | :--- | :--- | :--- |

| \*\*PBI-011\*\* | FE-011 | Lập danh sách phải thu | Là Kế toán, tôi muốn lập danh sách các khoản phải thu theo kỳ để xác định nghĩa vụ thanh toán của từng hộ dân. | Chọn được kỳ thu và khoản thu; sinh được danh sách phải thu; tính đúng số tiền từng hộ; không tạo trùng nghĩa vụ thu trong cùng kỳ. | Cao |

| \*\*PBI-012\*\* | FE-012 | Thông báo thu phí | Là Ban quản trị, tôi muốn tạo thông báo thu phí để các hộ dân biết khoản tiền và thời hạn phải đóng. | Tạo được nội dung thông báo; hiển thị đúng khoản tiền và hạn nộp; liên kết thông báo với đúng hộ dân và kỳ thu. | Trung bình |

| \*\*PBI-013\*\* | FE-013 | Ghi nhận thanh toán | Là Kế toán, tôi muốn ghi nhận thanh toán của cư dân để cập nhật chính xác tình trạng đóng phí. | Chọn được hộ dân và khoản phải thu; ghi nhận được số tiền và ngày thanh toán; cập nhật trạng thái đã thanh toán; không chấp nhận số tiền không hợp lệ. | Cao |

| \*\*PBI-014\*\* | FE-014 | Quản lý công nợ | Là Kế toán, tôi muốn theo dõi công nợ để biết các hộ dân còn khoản phí chưa thanh toán. | Hiển thị được danh sách hộ còn nợ; tính đúng số tiền còn nợ; lọc được theo kỳ, căn hộ và khoản thu; cập nhật công nợ sau thanh toán. | Cao |

| \*\*PBI-015\*\* | FE-015 | Đối chiếu thu phí | Là Kế toán, tôi muốn đối chiếu số tiền phải thu và đã thu để phát hiện chênh lệch. | Hiển thị tổng phải thu, đã thu và còn nợ; xác định được khoản chênh lệch; đối chiếu được theo kỳ và theo hộ dân. | Cao |



\### EP-004: Tra cứu, Thống kê \& Báo cáo

| PBI ID | Feature | Tên chức năng | User Story | Acceptance Criteria (Tiêu chí nghiệm thu) | Ưu tiên |

| :--- | :--- | :--- | :--- | :--- | :--- |

| \*\*PBI-016\*\* | FE-016 | Tra cứu hóa đơn | Là Ban quản trị, tôi muốn tra cứu hóa đơn để nhanh chóng hỗ trợ cư dân khi cần đối chiếu. | Tìm kiếm được theo mã hóa đơn, căn hộ, khoản thu hoặc thời gian; hiển thị đúng chi tiết hóa đơn; thông báo khi không có kết quả. | Cao |

| \*\*PBI-017\*\* | FE-017 | Tra cứu lịch sử đóng góp | Là Ban quản trị, tôi muốn xem lịch sử đóng góp của từng hộ để đối chiếu các khoản đã thanh toán. | Hiển thị được toàn bộ giao dịch của hộ dân; lọc được theo thời gian và loại khoản thu; hiển thị ngày đóng và số tiền đã đóng. | Cao |

| \*\*PBI-018\*\* | FE-018 | Thống kê khoản thu | Là Ban quản trị, tôi muốn thống kê khoản thu để theo dõi kết quả thu phí theo từng loại và từng kỳ. | Thống kê được theo khoản thu và thời gian; hiển thị tổng phải thu, đã thu và còn thiếu; kết quả khớp với dữ liệu giao dịch. | Cao |

| \*\*PBI-019\*\* | FE-019 | Báo cáo công nợ | Là Ban quản trị, tôi muốn xem báo cáo công nợ để xác định các hộ chưa hoàn thành nghĩa vụ thanh toán. | Hiển thị danh sách hộ còn nợ; hiển thị chi tiết từng khoản nợ; lọc được theo kỳ, căn hộ và khoản thu; tính đúng tổng công nợ. | Cao |

| \*\*PBI-020\*\* | FE-020 | Báo cáo doanh thu | Là Ban quản trị, tôi muốn xem báo cáo doanh thu theo tháng, quý và năm để đánh giá hiệu quả thu phí. | Chọn được khoảng thời gian báo cáo; tổng hợp đúng số tiền đã thu; phân nhóm được theo loại khoản thu; hiển thị số liệu tháng, quý và năm. | Cao |

| \*\*PBI-021\*\* | FE-021 | Báo cáo cư dân | Là Ban quản trị, tôi muốn tạo báo cáo cư dân để cung cấp thông tin phục vụ công tác quản lý và cơ quan chức năng. | Tổng hợp được danh sách hộ và nhân khẩu; lọc được theo tình trạng cư trú; dữ liệu báo cáo khớp với hồ sơ cư dân; chỉ người có quyền được xem báo cáo. | Trung bình |



\### EP-005: Quản lý Tài khoản \& Phân quyền

| PBI ID | Feature | Tên chức năng | User Story | Acceptance Criteria (Tiêu chí nghiệm thu) | Ưu tiên |

| :--- | :--- | :--- | :--- | :--- | :--- |

| \*\*PBI-022\*\* | FE-022 | Đăng nhập | Là Người dùng hệ thống, tôi muốn đăng nhập để truy cập các chức năng được cấp quyền. | Cho phép đăng nhập khi thông tin hợp lệ; từ chối khi sai tài khoản hoặc mật khẩu; không xác thực tài khoản không tồn tại; chuyển đến màn hình phù hợp sau khi đăng nhập. | Cao |

| \*\*PBI-023\*\* | FE-023 | Đổi mật khẩu | Là Người dùng hệ thống, tôi muốn đổi mật khẩu để bảo vệ tài khoản cá nhân. | Xác thực đúng mật khẩu hiện tại; kiểm tra mật khẩu mới hợp lệ; yêu cầu xác nhận mật khẩu mới; cập nhật mật khẩu thành công. | Cao |

| \*\*PBI-024\*\* | FE-024 | Quản lý thông tin cá nhân | Là Người dùng hệ thống, tôi muốn cập nhật thông tin cá nhân để hồ sơ tài khoản luôn chính xác. | Hiển thị được thông tin hiện tại; cập nhật được trường cho phép; kiểm tra dữ liệu hợp lệ; lưu thay đổi thành công. | Trung bình |

| \*\*PBI-025\*\* | FE-025 | Đăng xuất | Là Người dùng hệ thống, tôi muốn đăng xuất để kết thúc phiên làm việc an toàn. | Kết thúc phiên đăng nhập; quay về màn hình đăng nhập; không thể truy cập màn hình bảo vệ sau khi đăng xuất. | Cao |

| \*\*PBI-026\*\* | FE-026 | Phân quyền truy cập | Là Quản trị hệ thống, tôi muốn phân quyền người dùng để kiểm soát việc sử dụng các chức năng. | Gán được vai trò cho tài khoản; lưu được thay đổi quyền; chỉ cho phép truy cập chức năng được cấp; từ chối truy cập chức năng không có quyền. | Cao |



\---



\## 2. Yêu cầu Phi chức năng (Non-Functional Requirements)

\- \*\*NFR-001 (Bảo mật):\*\* Người dùng phải đăng nhập trước khi sử dụng các màn hình nghiệp vụ.

\- \*\*NFR-002 (Bảo mật):\*\* Mật khẩu được xử lý và lưu trữ an toàn (không lộ plain text).

\- \*\*NFR-003 (Xác thực):\*\* Chỉ người có tài khoản hợp lệ mới được truy cập hệ thống.

\- \*\*NFR-004 (Kiến trúc):\*\* Dữ liệu lưu tập trung trên CSDL quan hệ thông qua Backend API.

\- \*\*NFR-005 (Hiệu năng):\*\* Thời gian tìm kiếm hộ dân và tra cứu dữ liệu dưới 3 giây.

\- \*\*NFR-006 (Công nghệ):\*\* Ứng dụng Web SPA (React/TypeScript) giao tiếp REST API với ASP.NET Core Web API.

\- \*\*NFR-007 (Độ tin cậy):\*\* Dữ liệu phải được lưu thành công và phản hồi trạng thái rõ ràng sau khi cập nhật.

\- \*\*NFR-008 (Khả dụng):\*\* Giao diện trực quan, dễ sử dụng cho Ban quản trị và Kế toán.

\- \*\*NFR-009 (Chất lượng dữ liệu):\*\* Thông tin cư dân phải chính xác, nhất quán, kiểm tra trùng lặp và ràng buộc hợp lệ.

\- \*\*NFR-010 (Sao lưu):\*\* Hệ thống hỗ trợ sao lưu dữ liệu định kỳ.



\---



\## 3. Phân định Phạm vi Sprint 1 (v1.0) vs Sprint 2 (v2.0)



\### 3.1. Trong phạm vi Sprint 1 (BẮT BUỘC hoàn thiện để bảo vệ)

1\. \*\*Xác thực \& Tài khoản (`EP-005`):\*\* Đăng nhập, đăng xuất, quản lý thông tin cá nhân, đổi mật khẩu và phân quyền Ban quản trị / Kế toán.

2\. \*\*Quản lý Căn hộ, Hộ gia đình \& Nhân khẩu (`EP-001`):\*\* Danh sách \& CRUD căn hộ, hộ gia đình (kiểm tra không trùng mã căn hộ), quản lý nhân khẩu (kiểm tra không trùng CCCD), ghi nhận biến động cư trú (chuyển đến, chuyển đi, tạm trú, tạm vắng) và tra cứu nhanh.

3\. \*\*Danh mục Khoản thu \& Đợt thu (`EP-002` \& `EP-003`):\*\* Khai báo danh mục khoản thu (bắt buộc / tự nguyện), tạo đợt thu theo kỳ, sinh danh sách khoản phải thu theo hộ, theo dõi công nợ.

4\. \*\*Ghi nhận Thanh toán \& Thống kê cơ bản (`EP-003` \& `EP-004`):\*\* Ghi nhận số tiền đã đóng, ngày đóng, xem lịch sử thanh toán, tra cứu \& thống kê tình hình thu phí/đóng góp cơ bản.



\### 3.2. Ngoài phạm vi Sprint 1 (Tách sang Sprint 2 — KHÔNG làm giao diện ở bước này)

\- Quản lý phương tiện (xe máy, ô tô, biển số) và tính phí gửi xe tháng.

\- Thu hộ tiền điện, nước, Internet theo chỉ số nhà cung cấp.

\- Báo cáo thống kê doanh thu/công nợ nâng cao đa chiều theo quý/năm.

