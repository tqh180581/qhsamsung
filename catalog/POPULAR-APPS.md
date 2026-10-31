# Ứng dụng thông dụng cho QHSamsung

Đợt bổ sung ngày 31/10/2026 ưu tiên TV Samsung từ **Tizen 4.0**, gồm giải trí, thư viện phim cá nhân và truyền game từ máy tính. QHSamsung vẫn là **0.5.0-qh10**; thay đổi nằm trong danh mục ứng dụng trực tuyến, không tạo gói Store mới.

Nếu TV đã có QHSamsung 0.5.0-qh10, mở **Settings → Refresh app catalog**. Kiểm tra **Personal apps → Online catalog**, rồi chọn **Install** hoặc **Update** cho từng ứng dụng. Bản Store cũ hơn chưa có cơ chế danh mục cá nhân trực tuyến cần cập nhật Store một lần theo [hướng dẫn thiết lập](../GITHUB-SETUP.md).

## Ba gói bổ sung cho TV đời cũ

Các WGT được giữ nguyên byte từ bản phát hành của tác giả, đối chiếu mã SHA-256 và đọc manifest trước khi đưa vào kho. Bản sao WGT, nguồn và giấy phép được tập hợp tại [release apps-tizen4plus-2026-10-31](https://github.com/tqh180581/qhsamsung/releases/tag/apps-tizen4plus-2026-10-31).

| Ứng dụng trong Store | Phiên bản trong WGT | Phạm vi của gói được chọn | Dùng để làm gì / điều kiện |
|---|---|---|---|
| TizenTube Old | 2.1.1 | Tizen 4.0–5.5 trong phạm vi đợt bổ sung này | Xem YouTube qua TizenTube với chặn quảng cáo và SponsorBlock. Đây là gói cho TV cũ; gói Cobalt yêu cầu Tizen 6.0 trở lên. |
| Litefin Tizen Legacy | 2.0.20 | Tizen 4.0 trở lên | Trình khách Jellyfin cho thư viện phim/nhạc cá nhân. Cần máy chủ Jellyfin của người dùng; khả năng phát trực tiếp phụ thuộc codec và TV. |
| Moonlight NaCl | 0.9.2 | Tizen 4.0–6.0 trong phạm vi đợt bổ sung này | Truyền game/màn hình từ PC chạy Sunshine. Tác giả thử trên TV Samsung đời 2019/Tizen 5.0; nên bắt đầu ở 1080p. Không thay bằng các bản Moonlight WASM yêu cầu Tizen 5.5+. |

Nguồn chính: [TizenTube và cách chọn bản Old](https://github.com/reisxd/TizenTube/blob/v2.1.1/docs/README.md), [Litefin v2.0.20](https://github.com/MoazSalem/litefin/releases/tag/v2.0.20), [Moonlight NaCl v1.0.0](https://github.com/brornski/moonlight-samsung-tv/releases/tag/v1.0.0).

**Phiên bản Moonlight:** upstream đặt tên release `v1.0.0`, nhưng tệp `MoonlightNaCl.wgt` phát hành có `widget/@version="0.9.2"`. Store dùng **0.9.2 từ WGT thật** để so sánh cập nhật; không suy ra phiên bản cài đặt từ tên tag hoặc từ `config.xml` trong mã nguồn. Tệp WGT chưa bị sửa để đổi số phiên bản.

Ba mục mới được đăng ký với mức tối thiểu **4.0** để phù hợp phạm vi của kho này, dù manifest gốc có thể cho phép Tizen cũ hơn. Nhãn hỗ trợ là phạm vi lựa chọn theo tài liệu upstream và manifest, chưa phải xác nhận đã cài/chạy trên mọi mẫu TV. Đặc biệt, không suy rộng Moonlight NaCl sang Tizen 6.5+ hoặc TizenTube Old sang các nền tảng mới dùng Cobalt.

## Các ứng dụng thông dụng đã có trong nguồn cộng đồng

Bản nhập metadata cộng đồng đã được cập nhật lên **community-755**, gồm **123 nhóm ứng dụng và 154 gói/biến thể**. Tệp cài cộng đồng tiếp tục tải từ nguồn gốc; danh sách này không có nghĩa mọi gói đều chạy trên Tizen 4.0. Xem [toàn bộ danh sách](APPS.md).

| Nhóm | Một số mục hiện có | Lưu ý lựa chọn |
|---|---|---|
| Video và tiện ích ứng dụng | TizenBrew, Twitch, Twitch Old Tizen | Chọn đúng biến thể theo phiên bản Tizen. TizenBrew là công cụ chạy/cài ứng dụng, không phải bộ chuyển đổi APK Android. |
| Quản lý và thông tin TV | App Manager, TizenUtility | Dùng mô tả từng app để phân biệt trình mở ứng dụng, thông tin thiết bị và các chức năng có thể thay đổi cấu hình. |
| Game | Snake, Doom, RetroTV và các biến thể Moonlight | Mỗi gói có yêu cầu riêng; RetroTV yêu cầu Tizen 5.0+, các bản Moonlight WASM phổ biến yêu cầu 5.5+. |

Các ứng dụng **Steam Link và Chiaki-Tizen yêu cầu Tizen 5.5+**, còn **RetroArch yêu cầu 6.5+**, nên không được giới thiệu như lựa chọn cho toàn bộ nhóm Tizen 4.0/5.0. Chúng có thể vẫn xuất hiện trong nguồn cộng đồng dành cho TV mới hơn. [Steam Link](https://github.com/pebeto/tizen-steam-link), [manifest Chiaki](https://github.com/Trent407/chiaki-tizen/blob/v0.2.0/app/config.xml), [RetroArch](https://github.com/Sype0/retroarch-tizen)

## Cập nhật các lần sau

Mỗi WGT cá nhân phải giữ đúng app/package ID đã đăng ký và có phiên bản manifest tăng lên. Sau khi WGT mới được phát hành trong repo `tqh180581/qhsamsung`, workflow quét release, kiểm tra manifest và mã băm, rồi ký danh mục. TV làm mới danh mục và hiển thị bản app mới mà không build lại Store. Việc có bản mới ở repo upstream của tác giả chưa tự tạo bản sao mới trong repo cá nhân; cần nhập đúng WGT và nguồn/giấy phép tương ứng trước khi publisher nhận được nó.

Không gỡ Store hoặc thay chứng chỉ đang dùng chỉ để làm mới danh mục. Xem [nguồn và giấy phép của ba gói](THIRD-PARTY-APPS.md).
