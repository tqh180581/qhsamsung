# QHSamsung

Kho ứng dụng cá nhân cho TV Samsung Tizen tại `tqh180581/qhsamsung`.

## Bản 0.5.0-qh10

- Tên hiển thị **QHSamsung · Personal Store**, phiên bản WGT `0.5.0`.
- Danh sách cộng đồng vẫn dùng nguồn Apps2Samsung đã ký và khóa công khai gốc. Bản nhập trong repository gồm 123 nhóm ứng dụng, 154 gói/biến thể (`community-755`); xem [danh sách ứng dụng](catalog/APPS.md).
- Danh sách cá nhân có nguồn trực tuyến được ký riêng. Release mới của ứng dụng đã đăng ký được nhận diện bằng định danh và phiên bản trong `config.xml` của WGT, kèm kích thước và SHA-256 thực tế. **Cập nhật ứng dụng cá nhân không cần build lại Store.**
- KOSOVO PANEL / Kosovo SamsungTV đã được đăng ký; metadata 0.8.2 cùng các bản cũ nằm trong gói làm nguồn dự phòng. Xem [ứng dụng cá nhân](catalog/PERSONAL-APPS.md).
- Danh mục cá nhân trực tuyến bổ sung TizenTube Old chính thức 2.1.1 (Tizen 4–5.5), Litefin Legacy 2.0.20 (Tizen 4+) và Moonlight NaCl 0.9.2 (Tizen 4–6). Store vẫn ở 0.5.0-qh10; chỉ cần làm mới danh mục. Xem [bộ app phổ biến](catalog/POPULAR-APPS.md) và [nguồn/giấy phép](catalog/THIRD-PARTY-APPS.md).
- Bộ ký Samsung, SDB, ZIP và khóa tin cậy Apps2Samsung được giữ từ nền `f74741a6e8bb2428d77164e741d7aa04780d387b`. Mã dịch vụ có thể chỉnh sửa trong `service-src/`.

Bản build trong repository chưa chứng minh đã ký, đã cài hay chạy thành công trên TV thật. Gói `dist/QHSamsung.wgt` là gói unsigned để ký bằng chứng chỉ tác giả đang dùng.

## Hai nguồn danh sách

Nguồn cộng đồng: `https://apps2samsung.com/catalog/resolved.json.signed`.

Nguồn cá nhân cố định: `https://raw.githubusercontent.com/tqh180581/qhsamsung/personal-catalog/catalog/personal.json.signed`.

Mỗi nguồn có khóa xác minh riêng. Khóa công khai cá nhân nằm trong Store; workflow nhận khóa riêng qua GitHub Actions secret `PERSONAL_CATALOG_PRIVATE_KEY`, còn bản sao quản trị được giữ ngoài repository. Chứng chỉ Samsung để ký và cài WGT là bộ khóa khác, tiếp tục được giữ trên TV sau bước Arm. Không cần VPS hoặc GitHub Pages.

Store chỉ cho cài URL có trong danh sách đã xác minh hoặc metadata dự phòng đã đóng gói. Sau khi tải, dịch vụ kiểm tra SHA-256 trước khi ký bằng certificate trên TV. Giao diện không được tùy ý gửi một URL ngoài danh sách để dịch vụ ký.

Trạng thái nguồn cá nhân và thời điểm tạo danh sách hiển thị trong **Settings**:

- **Online catalog** (`online`): vừa tải và xác minh danh sách cá nhân từ nguồn cố định.
- **Saved verified catalog** (`cache`): nguồn trực tuyến lỗi hoặc không hợp lệ; dùng bản đã lưu trong dữ liệu riêng của package, xác minh lại chữ ký và còn trong hạn 7 ngày.
- **Bundled fallback** (`bundled`): không có bản trực tuyến hoặc cache hợp lệ; chỉ dùng các phiên bản cá nhân dự phòng có sẵn trong WGT Store.

Danh sách cá nhân có thời điểm tương lai quá 5 phút, quá 7 ngày, sai chữ ký hoặc làm mất/hạ phiên bản ứng dụng đã biết bị từ chối; dữ liệu đó không được biến thành quyền cài đặt. Bản ký đã xác minh được ghi nguyên tử vào dữ liệu riêng của package để dùng sau khi khởi động lại khi vùng dữ liệu ghi được. Bộ nhớ danh sách của dịch vụ có thời gian 10 phút; **Settings → Refresh app catalog** yêu cầu tải lại nguồn ngay.

Nguồn cộng đồng mất kết nối vẫn có thể dùng nguồn cá nhân online/cache/bundled. Chữ ký nguồn cộng đồng sai tiếp tục là lỗi xác thực và không bị bỏ qua. **bundled không có nghĩa đã nhận được bản mới nhất**; kiểm tra trạng thái nguồn trước khi kết luận TV đã cập nhật danh sách.

## Phát hành ứng dụng cá nhân

1. Với ứng dụng đã đăng ký, giữ nguyên `app_id` và `package_id`, tăng phiên bản WGT trong `config.xml`, build và đính kèm `.wgt` vào GitHub Release chính thức tại `tqh180581/qhsamsung`.
2. Workflow `personal-catalog.yml` đọc release, kiểm tra manifest và tính kích thước/SHA-256; workflow ký danh sách rồi công bố lên nhánh `personal-catalog`.
3. TV làm mới danh sách để nhận phiên bản mới và chọn **Update**. Không phải đóng gói hoặc cài lại QHSamsung cho mỗi bản KOSOVO hay ứng dụng cá nhân đã đăng ký.

Workflow chạy khi release được xuất bản/chỉnh sửa, theo lịch 30 phút, chạy thủ công và khi các tệp cấu hình liên quan thay đổi trên nhánh chính. Lịch GitHub Actions có thể trễ; chỉ coi một bản cập nhật đã sẵn sàng khi workflow thành công và danh sách công bố có phiên bản đó.

Ứng dụng hoàn toàn mới phải được thêm vào `catalog/personal-apps-registry.json` với tên, nhóm, mô tả, định danh ứng dụng/package và phiên bản Tizen tối thiểu. Publisher không tự tin cậy mọi WGT xuất hiện trong Releases. Đổi định danh một ứng dụng là đăng ký ứng dụng khác, không phải cập nhật ứng dụng cũ. Xem [thiết lập GitHub](GITHUB-SETUP.md).

## Đóng gói và kiểm thử

Từ thư mục dự án, dùng Node.js hiện đại và PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
node --test scripts/test-personal-update.cjs scripts/test-store-release.cjs
node scripts/test-sdb-connect.cjs
```

Kết quả: `dist/QHSamsung.wgt`, chưa ký chứng chỉ Samsung. Kiểm thử phát hành kiểm tra định danh cập nhật, mã dịch vụ trong bundle, đường dẫn ZIP dùng `/`, nội dung gói khớp mã nguồn và không kèm khóa riêng/chứng chỉ. Kiểm thử socket chỉ dùng loopback mô phỏng; không chứng minh TV thật đã chấp nhận cài đặt.

## Cập nhật Store một lần

**Giữ `A2STVStore.Store`, package `A2STVStore` và service `A2STVStore.sdbservice`.** Bản này cập nhật Store đang có, không tạo ứng dụng thứ hai.

Ký bản Store mới bằng đúng chứng chỉ tác giả hiện có và distributor có DUID của TV đích, rồi cài đè theo quy trình cập nhật. **Không gỡ Store trước khi cập nhật.** Dữ liệu Arm nằm trong dữ liệu riêng của package; giữ package và dữ liệu để Store tiếp tục dùng certificate đã Arm. Sau cập nhật, mở Store và kiểm tra trạng thái sẵn sàng trước khi cập nhật ứng dụng.

Không cấp lại hoặc thay certificate đang dùng nếu không chủ đích đổi nó. Developer Mode Host PC IP phải trỏ về chính địa chỉ TV khi Store tự cài ứng dụng. Chỉ máy tính/điện thoại thực hiện bước cài Store hoặc Arm ban đầu mới cần cấu hình theo hướng dẫn của công cụ đó.

## Bảo vệ dữ liệu và nguồn gốc

Không đưa chứng chỉ Samsung, khóa riêng, token, mật khẩu hoặc dữ liệu trình cài lên GitHub hay vào WGT. `.gitignore` là lớp phòng tránh, vẫn cần kiểm tra nội dung trước khi phát hành. Chỉ khóa công khai xác minh danh sách được đóng gói trong Store.

Xem [UPSTREAM.md](UPSTREAM.md). Dự án này không đại diện Samsung hoặc Apps2Samsung; giữ thông tin tác giả trong mã nguồn. Chưa xác nhận giấy phép của toàn bộ TV-Store, nên không mặc định áp dụng giấy phép của một kho Apps2Samsung khác cho mã này.
