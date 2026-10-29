# Nguồn gốc mã

Bản tùy biến cá nhân từ Apps2Samsung TV-Store 0.3.8.

- Mã gốc: https://github.com/Apps2Samsung/TV-Store
- Gói gốc: https://github.com/Apps2Samsung/tizen-community-packages/releases/download/community-743/TV-Store.wgt
- SHA-256 của gói gốc: `0f5f6ead867408418977bbe6e18c1b656c228e91e8d24a5f643abb4a31913a1e`
- Thư viện QR giữ nguyên phần ghi nhận MIT của tác giả trong `tizen-app/js/qrcode.js`.

Thay đổi: tên hiển thị QHSamsung, nhãn phiên bản tùy biến, tách mô-đun dịch vụ từ gói phát hành, bổ sung công cụ đóng gói và tài liệu. Định danh, giao thức kích hoạt, cơ chế kiểm tra chữ ký và nguồn danh sách giữ nguyên.

Các mô-đun dịch vụ được tách từ bản bundle của tệp phát hành, không phải bản clone đầy đủ lịch sử Git. Không kèm chứng chỉ Samsung hay thông tin đăng nhập.

Danh sách ứng dụng được nhập từ provider `tizen-community` trong danh sách có chữ ký Apps2Samsung, đối chiếu với release `community-743` của https://github.com/Apps2Samsung/tizen-community-packages. Giữ metadata và liên kết tải gốc; không sao chép tệp cài ứng dụng sang repository này. Mỗi ứng dụng giữ quyền và giấy phép riêng từ tác giả tương ứng.
