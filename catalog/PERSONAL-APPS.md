# Ứng dụng cá nhân QHSamsung

QHSamsung **0.5.0-qh10** đọc danh sách cá nhân đã ký từ nguồn cố định:

`https://raw.githubusercontent.com/tqh180581/qhsamsung/personal-catalog/catalog/personal.json.signed`

Nguồn này bổ sung ứng dụng cá nhân bên cạnh danh sách Apps2Samsung; không thay khóa công khai hoặc nguồn cộng đồng. Khóa ký danh sách cá nhân và certificate Samsung dùng để ký WGT là hai bộ khóa khác nhau.

## Ứng dụng đã đăng ký

| Ứng dụng | App ID | Package ID | Tizen tối thiểu |
|---|---|---|---|
| Kosovo SamsungTV / KOSOVO PANEL | `KsvTv2019A.KosovoTV` | `KsvTv2019A` | 5.0 |

Metadata được quản lý tại `catalog/personal-apps-registry.json`. Publisher chỉ chấp nhận các WGT khớp định danh đã đăng ký; tên release hoặc tên tệp có chữ “Kosovo” không đủ để cho phép cài. Phiên bản lấy từ `widget/@version` trong `config.xml`, còn kích thước và SHA-256 được tính từ chính WGT tải về.

KOSOVO PANEL cần tài khoản dịch vụ riêng. Khả năng phát còn phụ thuộc codec, DRM, nguồn nội dung và thiết bị thực tế; Tizen 5.0 tối thiểu không bảo đảm mọi nguồn đều phát được.

## Nhận bản cập nhật

Với ứng dụng đã đăng ký, chỉ cần tăng phiên bản trong manifest, phát hành WGT lên GitHub Releases rồi để workflow `personal-catalog.yml` cập nhật và ký danh sách. **Không cần build lại hoặc cài lại QHSamsung cho mỗi phiên bản ứng dụng.** Ứng dụng hoàn toàn mới cần metadata registry được review trước; không tự nhận mọi WGT trong Releases.

Sau khi workflow thành công, mở QHSamsung, chọn **Settings → Refresh app catalog**, rồi vào **IPTV & Live TV** → **Kosovo SamsungTV** → **Update** hoặc **Install**. Kiểm tra trạng thái nguồn cá nhân trong **Settings**:

| Nguồn | Ý nghĩa |
|---|---|
| Online catalog (`online`) | Danh sách vừa tải và đã xác minh bằng public key cá nhân trong Store. |
| Saved verified catalog (`cache`) | Nguồn trực tuyến lỗi/không hợp lệ; đang dùng danh sách đã ký lưu trên TV, còn trong hạn 7 ngày. |
| Bundled fallback (`bundled`) | Không có nguồn trực tuyến/cache hợp lệ; chỉ có các bản dự phòng đã đóng gói trong Store. |

Dữ liệu chữ ký sai, thời điểm tương lai quá 5 phút, quá 7 ngày hoặc cố hạ/xóa ứng dụng đã biết không được chấp nhận. Bộ nhớ danh sách của service dùng tối đa 10 phút trước khi tải lại; thao tác làm mới yêu cầu tải nguồn mới ngay. Nếu vẫn là `cache`/`bundled`, chưa thể kết luận TV đã thấy release mới nhất.

Dịch vụ chỉ tải URL được danh sách hợp lệ cho phép, kiểm tra SHA-256 rồi ký WGT bằng certificate đã Arm trên TV trước khi cài. **Không gỡ KOSOVO PANEL để cập nhật.** Cần certificate hợp lệ cho DUID TV đích và Developer Mode Host PC IP là chính địa chỉ TV khi Store tự cài ứng dụng.

## Các bản dự phòng trong Store

Bảng sau mô tả dữ liệu đóng gói tại `catalog/personal-apps.json`, không phải cam kết đây là phiên bản mới nhất trực tuyến:

| Bản | Tizen | Gói cài |
|---|---|---|
| 0.8.2 | 5.0 trở lên | [Kosovo-SamsungTV-Tizen5plus-v0.8.2.wgt](https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.2/Kosovo-SamsungTV-Tizen5plus-v0.8.2.wgt) |
| Lịch sử 0.8.0 | 5.0 trở lên | [Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt](https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.0/Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt) |
| Lịch sử 0.7.6 | 5.0 trở lên | [Kosovo-SamsungTV-v0.7.6.wgt](https://github.com/tqh180581/qhsamsung/releases/download/movies-v0.7.6/Kosovo-SamsungTV-v0.7.6.wgt) |

Asset 0.8.2 có 12.330.119 byte, SHA-256 `45d521d7181f09d81cd23d1eed01f8db12f0edc76092c6b3bb3825f683922d88`. Các release 0.8.0 và 0.7.6 cùng URL/mã băm cũ được giữ làm lịch sử, không tạo nút hạ phiên bản tự động. Đổi dữ liệu dự phòng trong WGT vẫn cần build Store; cập nhật thông thường dùng nguồn trực tuyến.

## Giữ dữ liệu khi nâng Store

Cập nhật QHSamsung một lần lên 0.5.0-qh10 bằng đúng chứng chỉ tác giả đang dùng, giữ `A2STVStore.Store`, package `A2STVStore` và service `A2STVStore.sdbservice`. Cài đè bản cập nhật; **không gỡ Store** để tránh mất certificate Arm và cache trong dữ liệu riêng của package. Kiểm tra Store vẫn báo sẵn sàng sau khi cập nhật rồi mới chọn Update ứng dụng.

Các kiểm thử offline xác minh chữ ký/trạng thái nguồn, metadata, giới hạn cài đặt và nội dung WGT. Chúng không chứng minh gói Store hay KOSOVO đã được ký, cài và nghiệm thu trên TV thật. Thiết lập publisher và secret xem [GITHUB-SETUP.md](../GITHUB-SETUP.md).
