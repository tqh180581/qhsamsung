# QHSamsung

Kho ứng dụng cá nhân cho TV Samsung Tizen. Chủ tài khoản dự kiến: `tqh180581`.

## Bản đầu đã có

- Tên hiển thị **QHSamsung · Personal Store**.
- Danh sách từ kho Apps2Samsung/tizen-community-packages: **119 nhóm ứng dụng, 148 gói/biến thể**, bản `community-743`. Xem [danh sách ứng dụng](catalog/APPS.md).
- App cá nhân **Kosovo SamsungTV 0.7.6** đã thêm vào [danh sách riêng](catalog/PERSONAL-APPS.md). Bản `0.3.8-qh2` hiển thị app trên TV với nhãn Phone or PC vì tệp GitHub vẫn riêng tư; chưa hỗ trợ cài trực tiếp gói riêng tư từ TV.
- Mã giao diện và dịch vụ tải, xác thực, ký, cài ứng dụng từ TV-Store 0.3.8.
- Các mô-đun dịch vụ có thể chỉnh sửa trong `service-src/`.
- Đóng gói `.wgt` trên Windows bằng `scripts/build.ps1` (cần Node.js).

Đây là bản tùy biến ban đầu dùng cho cá nhân, lưu tại `tqh180581/qhsamsung`. Chưa cài lên TV, chưa xác nhận hoạt động của bản tùy biến trên thiết bị thật. Bản TV-Store gốc vẫn đang nằm trên TV.

## Nguồn ứng dụng hiện tại

Bản này tải danh sách đã ký từ `https://apps2samsung.com/catalog/resolved.json.signed`, dùng khóa công khai gốc và chỉ hiển thị provider `tizen-community` của kho người dùng đã chọn. Danh sách đã nhập nằm ở `catalog/catalog.json`, tệp cài tải từ Releases của kho gốc. Chưa phát hành endpoint danh sách riêng của QHSamsung. Không cần VPS để dùng nguồn hiện tại.

Cập nhật bản metadata trong mã nguồn bằng `node scripts/import-community.cjs`. Công cụ xác minh chữ ký danh sách và đối chiếu tên, URL, kích thước, SHA-256 với release GitHub mới nhất trước khi ghi. Nếu danh sách ký chưa theo kịp release, công cụ dừng để tránh trộn phiên bản. Việc cập nhật bản metadata trong repository chưa được lên lịch tự động.

Giữ nguyên thông tin tác giả, cờ ứng dụng người lớn, cờ root và yêu cầu cấu hình. Ứng dụng không tương thích hoặc cần máy tính không được coi là đã kiểm tra trên TV Tizen 5.0.

Để chuyển sang GitHub cá nhân cần tạo repository, chuẩn bị danh sách đúng cấu trúc, kiểm tra quyền phân phối từng gói, tính SHA-256, ký danh sách bằng khóa riêng, công bố danh sách qua GitHub Pages và cập nhật URL cùng khóa công khai trong `service-src/index.js` và `service-src/catalog-key.js`. URL và khóa phải được thay cùng nhau; không bỏ kiểm tra chữ ký.

## Đóng gói

Từ thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

Kết quả: `dist/QHSamsung.wgt`, chưa ký chứng chỉ Samsung. Có thể ký và cài bằng Apps2Samsung sau khi kiểm tra bản tùy biến.

**Định danh ứng dụng vẫn là `A2STVStore.Store` để giữ tương thích với chức năng Arm TV-Store. Cài bản này sẽ cập nhật/thay thế TV-Store hiện tại, không tạo ứng dụng thứ hai.** Nếu cần chạy song song phải đổi định danh, cổng dịch vụ và bổ sung công cụ kích hoạt riêng.

## Bảo vệ dữ liệu

Không đưa chứng chỉ Samsung, khóa riêng, token, mật khẩu hoặc thư mục dữ liệu trình cài lên GitHub. `.gitignore` đã loại các dạng tệp phổ biến nhưng vẫn phải kiểm tra trước khi đẩy mã. Chỉ khóa công khai xác minh danh sách được đưa vào ứng dụng.

## Nguồn gốc

Xem `UPSTREAM.md`. Dự án này không đại diện Samsung hoặc Apps2Samsung. Giữ các ghi chú tác giả trong mã nguồn. Chưa xác nhận giấy phép của toàn bộ TV-Store; không mặc định áp dụng giấy phép của kho Apps2Samsung khác cho mã này. Kiểm tra quyền tái phân phối trước khi công bố bản dẫn xuất công khai.
