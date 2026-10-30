# QHSamsung

Kho ứng dụng cá nhân cho TV Samsung Tizen. Chủ tài khoản dự kiến: `tqh180581`.

## Bản 0.4.3-qh9

- Tên hiển thị **QHSamsung · Personal Store**.
- Danh sách từ kho Apps2Samsung/tizen-community-packages: **119 nhóm ứng dụng, 148 gói/biến thể**, bản `community-743`. Xem [danh sách ứng dụng](catalog/APPS.md).
- App cá nhân **Kosovo SamsungTV / KOSOVO PANEL 0.8.2** ở **IPTV & Live TV**, dành cho Samsung Tizen 5.0 trở lên, tự nhận model/phiên bản và tối ưu kết xuất thẻ Trang chủ với số lớp hiển thị có giới hạn. URL cùng SHA-256 được ghim trong gói QHSamsung đã ký. Xem [danh sách cá nhân](catalog/PERSONAL-APPS.md).
- Release 0.8.0 và 0.7.6 giữ nguyên làm nguồn khôi phục có chủ đích. UI hiển thị release mới nhất, chưa có nút hạ phiên bản.
- Mã giao diện và dịch vụ tải, xác thực, ký, cài ứng dụng từ TV-Store 0.3.8.
- Các mô-đun dịch vụ có thể chỉnh sửa trong `service-src/`.
- Đóng gói `.wgt` trên Windows bằng `scripts/build.ps1` (cần Node.js).

Đây là bản tùy biến cá nhân tại `tqh180581/qhsamsung`. Bản 0.4.3-qh9 được tạo từ đúng nền 0.4.1-qh7 (`f3b3511`), chỉ cập nhật phiên bản Store và metadata KOSOVO 0.8.2; giao diện, trình cài, guard và các chức năng runtime giữ nguyên. Release dự kiến: `qhsamsung-v0.4.3-qh9`. Gói build ở đây chưa ký hoặc cài lên TV; kiểm thử offline không chứng minh cài đặt hay độ mượt trên TV.

## Nguồn ứng dụng hiện tại

Bản này tải danh sách đã ký từ `https://apps2samsung.com/catalog/resolved.json.signed`, dùng khóa công khai gốc và hiển thị provider `tizen-community` cùng các app cá nhân đã ghim. Danh sách cộng đồng đã nhập nằm ở `catalog/catalog.json`, tệp cài tải từ Releases của kho gốc. Danh sách cá nhân ở `catalog/personal-apps.json`; `scripts/bundle.cjs` sinh đồng thời metadata UI, metadata service và bundle dịch vụ. Không cần VPS.

Cập nhật bản metadata trong mã nguồn bằng `node scripts/import-community.cjs`. Công cụ xác minh chữ ký danh sách và đối chiếu tên, URL, kích thước, SHA-256 với release GitHub mới nhất trước khi ghi. Nếu danh sách ký chưa theo kịp release, công cụ dừng để tránh trộn phiên bản. Việc cập nhật bản metadata trong repository chưa được lên lịch tự động.

Giữ nguyên thông tin tác giả, cờ ứng dụng người lớn, cờ root và yêu cầu cấu hình. Ứng dụng không tương thích hoặc cần máy tính không được coi là đã kiểm tra trên TV Tizen 5.0.

App cá nhân chỉ được bổ sung bằng URL release và SHA-256 trong Store đã ký. Nguồn cộng đồng, khóa công khai và kiểm tra chữ ký giữ nguyên. Không có endpoint cho phép giao diện tùy ý ký một URL hoặc upload WGT. Nếu sau này thay hẳn nguồn danh sách cộng đồng, URL và khóa xác minh phải được đổi cùng nhau; không bỏ kiểm tra chữ ký.

## Đóng gói

Từ thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

Kết quả: `dist/QHSamsung.wgt`, chưa ký chứng chỉ Samsung. Có thể ký và cài bằng Apps2Samsung sau khi kiểm tra bản tùy biến.

Kiểm thử offline bằng Node.js hiện đại, chỉ vào file WGT 0.8.2 đã build nếu không có source KOSOVO PANEL ở thư mục bên cạnh:

```powershell
$env:KOSOVO_V082_WGT = 'C:\DUONG_DAN\kosovo-tizen5plus-unsigned.wgt'
node --test scripts/test-personal-update.cjs scripts/test-store-release.cjs
node scripts/test-sdb-connect.cjs
```

Bộ kiểm thử pin không dùng mạng/TV, không đọc certificate riêng và không thực hiện ký. Đường tải/cài được dừng ở boundary mô phỏng sau khi kiểm URL/hash thật của service. Kiểm tra SDB riêng chỉ dùng socket loopback mô phỏng. Kiểm thử gói cũng đối chiếu runtime 0.4.1 và đường dẫn ZIP dùng dấu `/`.

**Định danh ứng dụng vẫn là `A2STVStore.Store` để giữ tương thích với chức năng Arm TV-Store. Cài bản này sẽ cập nhật/thay thế TV-Store hiện tại, không tạo ứng dụng thứ hai.** Nếu cần chạy song song phải đổi định danh, cổng dịch vụ và bổ sung công cụ kích hoạt riêng.

Cập nhật Store bằng đúng chứng chỉ tác giả hiện có và distributor chứa DUID TV đích, giữ package `A2STVStore` và service `A2STVStore.sdbservice`. Không gỡ Store để cập nhật. Certificate đã Arm được lưu trong dữ liệu riêng của package; sau cập nhật cần xác nhận Store vẫn báo sẵn sàng trước khi chọn **Update** KOSOVO PANEL. Không gọi lại bước cấp certificate để thay một certificate đang dùng nếu chưa có chủ đích đổi nó. Developer Mode Host PC IP phải trỏ về chính TV khi Store tự cài app.

## Bảo vệ dữ liệu

Không đưa chứng chỉ Samsung, khóa riêng, token, mật khẩu hoặc thư mục dữ liệu trình cài lên GitHub. `.gitignore` đã loại các dạng tệp phổ biến nhưng vẫn phải kiểm tra trước khi đẩy mã. Chỉ khóa công khai xác minh danh sách được đưa vào ứng dụng.

## Nguồn gốc

Xem `UPSTREAM.md`. Dự án này không đại diện Samsung hoặc Apps2Samsung. Giữ các ghi chú tác giả trong mã nguồn. Chưa xác nhận giấy phép của toàn bộ TV-Store; không mặc định áp dụng giấy phép của kho Apps2Samsung khác cho mã này. Kiểm tra quyền tái phân phối trước khi công bố bản dẫn xuất công khai.
