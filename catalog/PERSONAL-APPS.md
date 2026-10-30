# Ứng dụng cá nhân QHSamsung

| Ứng dụng | Phiên bản | Tizen | Gói cài |
|---|---|---|---|
| Kosovo SamsungTV / KOSOVO PANEL | 0.8.2 | 5.0 trở lên | [Kosovo-SamsungTV-Tizen5plus-v0.8.2.wgt](https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.2/Kosovo-SamsungTV-Tizen5plus-v0.8.2.wgt) |
| Bản cũ giữ để khôi phục có chủ đích | 0.8.0 | 5.0 trở lên | [Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt](https://github.com/tqh180581/qhsamsung/releases/download/kosovo-tizen5plus-v0.8.0/Kosovo-SamsungTV-Tizen5plus-v0.8.0.wgt) |
| Bản cũ giữ để khôi phục có chủ đích | 0.7.6 | 5.0 trở lên | [Kosovo-SamsungTV-v0.7.6.wgt](https://github.com/tqh180581/qhsamsung/releases/download/movies-v0.7.6/Kosovo-SamsungTV-v0.7.6.wgt) |

QHSamsung `0.4.3-qh9` ghim bản KOSOVO PANEL 0.8.2. Store giữ giao diện, trình cài và guard của nền 0.4.1-qh7. KOSOVO giữ định danh `KsvTv2019A.KosovoTV` / `KsvTv2019A`, tự nhận model/phiên bản và tối ưu kết xuất thẻ Trang chủ bằng số lớp hiển thị có giới hạn. Tizen 5.0 là phiên bản tối thiểu; khả năng phát còn phụ thuộc codec, DRM, nguồn và thiết bị thực tế.

Sau khi cập nhật QHSamsung bằng đúng chứng chỉ tác giả của Store, mở **IPTV & Live TV** → **Kosovo SamsungTV** → **Update** hoặc **Install**. Dịch vụ tải gói unsigned, kiểm tra SHA-256 rồi ký bằng certificate đã Arm trên TV trước khi cài. Không gỡ KOSOVO PANEL để cập nhật. Cần certificate hợp lệ trên TV và Developer Mode Host PC IP là chính địa chỉ TV; bản ký sideload vẫn phụ thuộc DUID của TV đích.

Asset 0.8.2 có 12.330.119 byte, SHA-256 `45d521d7181f09d81cd23d1eed01f8db12f0edc76092c6b3bb3825f683922d88`. Release 0.8.0 và 0.7.6 cùng metadata/mã băm cũ giữ nguyên. UI chỉ hiển thị release đầu tiên (0.8.2); các bản cũ không tạo nút hạ phiên bản trong Store. Việc khôi phục bản cũ cần lựa chọn rõ ràng và chữ ký phù hợp.

URL và SHA-256 của ứng dụng cá nhân được ghim trong gói QHSamsung đã ký. Dịch vụ chỉ mở rộng danh sách cài với đúng URL và mã băm đó; yêu cầu từ giao diện không thể thêm URL tùy ý. Nguồn Apps2Samsung vẫn phải qua kiểm tra chữ ký như trước. Nếu nguồn Apps2Samsung không truy cập được, chỉ các app cá nhân đã ghim còn khả dụng; chữ ký danh sách sai vẫn bị từ chối. Đổi bản phát hành hoặc mã băm app cá nhân cần đóng gói và cập nhật QHSamsung.

Kiểm thử offline xác nhận metadata UI/service/bundle thống nhất, gói 0.8.2 có đúng hash/kích thước, runtime Store 0.4.1 được giữ nguyên và các guard từ chối URL ngoài danh sách hoặc hash sai. Gói Store mới ở worktree này chưa ký/cài; kiểm thử không thay thế nghiệm thu TV.
