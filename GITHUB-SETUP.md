# Thiết lập danh sách cá nhân trên GitHub

QHSamsung 0.5.0-qh10 dùng nhánh dữ liệu `personal-catalog` của `tqh180581/qhsamsung`. Không cần VPS hoặc GitHub Pages. Nguồn cố định mà Store đọc là:

`https://raw.githubusercontent.com/tqh180581/qhsamsung/personal-catalog/catalog/personal.json.signed`

Mã nguồn workflow đã chuẩn bị không đồng nghĩa nguồn trên đã hoạt động. Phải có khóa ký đúng trong GitHub Actions secret và ít nhất một lần chạy publisher thành công. Các URL WGT và danh sách raw phải tải được trên TV không có GitHub token; không nhúng token vào URL hoặc Store để đọc kho private.

## Thiết lập một lần

1. Giữ khóa riêng RSA tương ứng với `service-src/personal-key.js` ngoài repository. Không tạo khóa khác rồi dùng thay cho khóa đang đóng gói trong Store; đổi khóa tin cậy cần cập nhật Store có chủ đích.
2. Trong repository `tqh180581/qhsamsung`, mở **Settings → Secrets and variables → Actions** và tạo secret tên chính xác **`PERSONAL_CATALOG_PRIVATE_KEY`**, chứa PEM của khóa riêng đó. Không đưa khóa vào chat, commit, artifact hoặc log. Đây không phải certificate tác giả Samsung.
3. Cho phép GitHub Actions chạy workflow `personal-catalog.yml` với quyền ghi nội dung nhánh catalog. Workflow dùng token của Actions cho thao tác GitHub; không đưa token vào WGT.
4. Chạy workflow thủ công lần đầu. Kiểm tra thành công và tệp `catalog/personal.json.signed` đã xuất hiện trên nhánh `personal-catalog`.
5. Ký/cập nhật QHSamsung 0.5.0-qh10 một lần bằng đúng chứng chỉ tác giả đang dùng, giữ app/package/service ID và dữ liệu Arm. Không gỡ bản Store hiện có.
6. Mở Store, chọn **Settings → Refresh app catalog** và kiểm tra nguồn cá nhân báo **Online catalog** cùng thời điểm tạo hợp lệ. Nếu báo **Saved verified catalog** hoặc **Bundled fallback**, TV đang dùng nguồn dự phòng.

Workflow ký danh sách mỗi khi nội dung cần thay đổi hoặc cần làm mới thời điểm ký. Lịch 30 phút giúp giữ danh sách trong hạn 7 ngày mà TV chấp nhận; GitHub có thể chạy lịch trễ. Nếu nội dung không đổi và bản ký trước chưa quá 12 giờ, publisher có thể dùng lại nguyên byte đã ký thay vì tạo commit mới.

## Đăng ký một ứng dụng mới

Tệp `catalog/personal-apps-registry.json` chứa:

- `schemaVersion: 1` và repository nguồn `tqh180581/qhsamsung`.
- Metadata từng app: `name`, `group`, `category`, `description`, `app_id`, `package_id`, `min_tizen_version`, `repo`.

Định danh phải lấy từ WGT thật: `tizen:application/@id` và `@package` trong `config.xml`. Cấu hình registry phải được review trước khi workflow ký một ứng dụng hoàn toàn mới. Ứng dụng đã đăng ký không cần thêm metadata theo từng tên asset hoặc từng phiên bản.

Publisher bỏ qua draft, prerelease và gói Store. Trong các WGT được phát hành, nó kiểm tra định danh đã đăng ký và phiên bản manifest dạng số để chọn bản cập nhật. Kích thước và SHA-256 được tính từ gói tải thực tế, không tin tên file/tag hay mã băm do người dùng tự nhập. Khi đổi app/package ID, phải đăng ký như một ứng dụng khác.

## Phát hành bản mới của ứng dụng đã đăng ký

1. Giữ nguyên app/package ID và tăng `widget/@version` trong `config.xml`.
2. Build gói WGT và đính kèm vào một GitHub Release chính thức của repository nguồn.
3. Chờ workflow **personal-catalog** thành công. Nó chạy khi release được xuất bản/chỉnh sửa, khi cấu hình liên quan đổi trên nhánh chính, theo lịch 30 phút và khi được chạy thủ công.
4. Kiểm tra phiên bản trong catalog công bố rồi làm mới QHSamsung trên TV. Chọn **Update**, không gỡ ứng dụng trước.

Không cần build/cài lại Store cho quy trình này. Bản Store phải cập nhật lại nếu thay đổi địa chỉ nguồn hoặc khóa tin cậy đang đóng gói. Không chỉnh tay catalog công bố để vượt qua publisher hoặc bỏ kiểm tra chữ ký.

## Chạy publisher trên máy tính

CLI:

```text
node scripts/publish-personal-catalog.cjs [--output DIR] [--previous FILE]
```

Biến môi trường `PERSONAL_CATALOG_PRIVATE_KEY` chứa khóa PEM đúng với public key trong Store. `GITHUB_TOKEN` là tùy chọn để xác thực API khi cần. Không truyền khóa riêng trực tiếp trong tham số dòng lệnh. Thư mục mặc định là `work/personal-catalog`; đầu ra gồm `personal.json` và `personal.json.signed`. `--previous` dùng bản ký trước để kiểm tra tính liên tục và tái sử dụng chữ ký còn mới khi nội dung không đổi.

Thử nghiệm bằng khóa tạm không thay thế được bước công bố với khóa đúng của Store. Giữ thư mục đầu ra thử nghiệm tách khỏi nhánh nguồn đã tin cậy; chỉ công bố sau khi publisher và các kiểm thử xác minh thành công.

## Nguồn dự phòng và lỗi

Store xác minh độc lập chữ ký nguồn cộng đồng và cá nhân. Khi nguồn cá nhân lỗi mạng, chữ ký/schema/thời gian không hợp lệ hoặc cố hạ/xóa ứng dụng đã biết, Store không chấp nhận dữ liệu mới đó. Nó dùng bản cá nhân đã lưu nếu chữ ký hợp lệ và tuổi không quá 7 ngày; nếu không, dùng metadata cá nhân dự phòng trong WGT. Trạng thái lần lượt là **Online catalog** (`online`), **Saved verified catalog** (`cache`), **Bundled fallback** (`bundled`).

Cache đã ký được lưu trong dữ liệu riêng của package. Gỡ Store sẽ xóa dữ liệu này và có thể làm mất certificate đã Arm. Việc nguồn cộng đồng mất kết nối không chặn riêng danh sách cá nhân; chữ ký cộng đồng sai vẫn bị từ chối như trước.

Công cụ cũ `scripts/catalog.cjs sign/configure` phục vụ việc thay toàn bộ nguồn catalog kiểu trước. Không dùng nó cho quy trình cá nhân mới: địa chỉ và khóa Apps2Samsung phải được giữ nguyên, còn nguồn cá nhân có khóa riêng qua `service-src/personal-key.js`.
