# Đưa QHSamsung lên GitHub

## Tình trạng

Đã chuẩn bị mã tùy biến và công cụ ký danh sách. Repository cá nhân: `https://github.com/tqh180581/qhsamsung`, khởi đầu ở chế độ private. Chưa xuất bản Pages. `qhsamsung.json` là địa chỉ dự kiến, chưa phải đường dẫn đang hoạt động. Đã nhập 119 nhóm ứng dụng với 148 gói/biến thể từ `community-743`; bản đóng gói dùng nguồn đã ký của Apps2Samsung và lọc chỉ còn `tizen-community` cho đến khi chạy `configure` và đóng gói lại.

## Repository

Tạo repository tên `qhsamsung` trong tài khoản `tqh180581`. Khởi đầu có thể dùng private để lưu mã cá nhân; khả năng dùng Pages cho repo private phụ thuộc gói GitHub. Nếu dùng public, cần xác minh quyền tái phân phối mã gốc trước. Không tải chứng chỉ hoặc khóa riêng lên repository.

## Danh sách riêng

`catalog/catalog.json` dùng cấu trúc resolved catalog của TV-Store, gồm `providers[].releases[].assets[]`. Mỗi tệp cần `name`, `browser_download_url` HTTPS, `size` và `digest` dạng `sha256:<64 ký tự hex>`. Phần metadata mô tả ứng dụng giữ cấu trúc danh sách gốc để giao diện nhận diện đúng. `catalog/community-import.json` ghi nhận nguồn và thời điểm nhập; `catalog/APPS.md` liệt kê liên kết tải.

1. Chuẩn bị khóa RSA riêng bên ngoài thư mục dự án và lưu bản sao an toàn. Không gửi khóa vào chat.
2. Thêm các ứng dụng được phép phân phối vào danh sách. Tệp `.wgt` có thể lưu ở GitHub Releases.
3. Chạy `node scripts/catalog.cjs sign <đường-dẫn-khóa-riêng>` để tạo `docs/catalog/resolved.json.signed`. Công cụ tự kiểm tra chữ ký trước khi ghi.
4. Công bố thư mục `docs/` bằng GitHub Pages. Phải cập nhật chữ ký trong vòng 7 ngày vì TV từ chối danh sách quá cũ; bản đầu chưa tự động hóa việc này.
5. Chạy `node scripts/catalog.cjs configure <đường-dẫn-khóa-công-khai>` để chuyển URL và khóa xác minh cùng lúc.
6. Đóng gói lại bằng `scripts/build.ps1`, sau đó ký/cài thử trên TV.

Chưa thử quy trình end-to-end với GitHub Pages hoặc TV thật. Việc ký danh sách dùng khóa riêng của kho; chứng chỉ Samsung dùng ký ứng dụng là bộ khóa khác và luôn giữ riêng.
