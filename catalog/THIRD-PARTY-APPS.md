# Nguồn và giấy phép ứng dụng bên thứ ba

Đợt ứng dụng thông dụng `apps-tizen4plus-2026-10-31` giữ nguyên WGT do các tác giả bên dưới phát hành. QHSamsung cung cấp danh mục, tải xuống và quy trình ký/cài phù hợp với TV; việc đưa gói vào kho không làm thay đổi tác giả hoặc giấy phép của ứng dụng.

[Release tập hợp WGT, nguồn và giấy phép](https://github.com/tqh180581/qhsamsung/releases/tag/apps-tizen4plus-2026-10-31) có ba WGT gốc, ba archive nguồn theo commit, ba tệp giấy phép và `SOURCE-NOTICES.txt`. Không đưa chứng chỉ tác giả/distributor của TV vào các tệp phát hành này.

## TizenTube Old

- Tác giả/nguồn: [reisxd/TizenTube](https://github.com/reisxd/TizenTube).
- Bản upstream: [`v2.1.1`](https://github.com/reisxd/TizenTube/releases/tag/v2.1.1).
- WGT gốc: [`TizenTubeOld.wgt`](https://github.com/reisxd/TizenTube/releases/download/v2.1.1/TizenTubeOld.wgt).
- Commit nguồn: [`893b663d35efa558d8bdf9f54f0c4f9a31ab6a07`](https://github.com/reisxd/TizenTube/tree/893b663d35efa558d8bdf9f54f0c4f9a31ab6a07).
- Nguồn phát hành kèm: `TizenTube-v2.1.1-source.zip`, lấy từ [archive đúng commit](https://github.com/reisxd/TizenTube/archive/893b663d35efa558d8bdf9f54f0c4f9a31ab6a07.zip).
- Giấy phép: **GNU GPL phiên bản 3**; bản sao `TizenTube-LICENSE.txt` giữ nguyên [LICENSE upstream](https://github.com/reisxd/TizenTube/blob/893b663d35efa558d8bdf9f54f0c4f9a31ab6a07/LICENSE).
- Định danh trong WGT: app `xvvl3S1TT1.TizenTubeStandalone`, package `xvvl3S1TT1`, phiên bản `2.1.1`.
- Kích thước WGT: `1,482,127` byte.
- SHA-256 WGT: `97dd00e3229b47f9892586fcd35ae7f7c8812b18f4be749b19c57a75b9ed6344`.

## Litefin Tizen Legacy

- Tác giả/nguồn: [MoazSalem/litefin](https://github.com/MoazSalem/litefin).
- Bản upstream: [`v2.0.20`](https://github.com/MoazSalem/litefin/releases/tag/v2.0.20).
- WGT gốc: [`Litefin-2.0.20-Tizen-Legacy.wgt`](https://github.com/MoazSalem/litefin/releases/download/v2.0.20/Litefin-2.0.20-Tizen-Legacy.wgt).
- Commit nguồn: [`299e87e4e83cff92e95d7b94dfa471bfac59efca`](https://github.com/MoazSalem/litefin/tree/299e87e4e83cff92e95d7b94dfa471bfac59efca).
- Nguồn phát hành kèm: `Litefin-v2.0.20-source.zip`, lấy từ [archive đúng commit](https://github.com/MoazSalem/litefin/archive/299e87e4e83cff92e95d7b94dfa471bfac59efca.zip).
- Giấy phép: **Mozilla Public License 2.0**; bản sao `litefin-LICENSE.txt` giữ nguyên [LICENSE upstream](https://github.com/MoazSalem/litefin/blob/299e87e4e83cff92e95d7b94dfa471bfac59efca/LICENSE).
- Định danh trong WGT: app `LitefinApp.Litefin`, package `LitefinApp`, phiên bản `2.0.20`.
- Kích thước WGT: `6,505,067` byte.
- SHA-256 WGT: `144100cbf459dbe6dcde5d6a540d8923e5149d43ba70383f5f3ab0018da9f894`.

## Moonlight NaCl

- Tác giả/nguồn: [brornski/moonlight-samsung-tv](https://github.com/brornski/moonlight-samsung-tv), dựa trên [OneLiberty/moonlight-tizen-nacl](https://github.com/OneLiberty/moonlight-tizen-nacl) và [Moonlight](https://github.com/moonlight-stream).
- Bản upstream: [`v1.0.0`](https://github.com/brornski/moonlight-samsung-tv/releases/tag/v1.0.0).
- WGT gốc: [`MoonlightNaCl.wgt`](https://github.com/brornski/moonlight-samsung-tv/releases/download/v1.0.0/MoonlightNaCl.wgt).
- Commit nguồn: [`eccc9956bf3d04cd7f1282fb6bd68b4a010b74f0`](https://github.com/brornski/moonlight-samsung-tv/tree/eccc9956bf3d04cd7f1282fb6bd68b4a010b74f0).
- Nguồn phát hành kèm: `MoonlightNaCl-v1.0.0-source.zip`, lấy từ [archive đúng commit](https://github.com/brornski/moonlight-samsung-tv/archive/eccc9956bf3d04cd7f1282fb6bd68b4a010b74f0.zip).
- Giấy phép: **GNU GPL phiên bản 3**; bản sao `moonlight-samsung-tv-LICENSE.txt` giữ nguyên [LICENSE upstream](https://github.com/brornski/moonlight-samsung-tv/blob/eccc9956bf3d04cd7f1282fb6bd68b4a010b74f0/LICENSE). Archive giữ các nguồn, build scripts và notices riêng của các thành phần vendored như moonlight-common-c, enet, Opus và h264bitstream.
- Định danh trong WGT: app `ChqHQExU28.MoonlightNaCl`, package `ChqHQExU28`, **phiên bản thực `0.9.2`**. Tên release `v1.0.0` và manifest trong source archive không được dùng thay cho manifest của binary đã phát hành.
- Kích thước WGT: `1,846,069` byte.
- SHA-256 WGT: `d864be1ae4b56d380ab60b38ab56d76abc1c83b3442104ac70788852c5b8d43d`.

## Phạm vi xác minh

Danh mục chỉ dùng các WGT khớp kích thước/mã SHA-256 đã đối chiếu với release upstream và định danh đọc từ chính WGT. Các archive nguồn được giữ theo commit upstream để người nhận có thể tiếp cận mã nguồn và giấy phép cùng nơi tải binary; đây không phải tuyên bố đã tái tạo từng byte của binary từ nguồn. Không sửa WGT, không đổi phiên bản hoặc nâng tuyên bố tương thích bằng cách chỉnh manifest.

Khi cập nhật hoặc phân phối lại về sau, giữ thông báo tác giả và giấy phép, cung cấp nguồn tương ứng với đúng bản binary và cập nhật bản sao nguồn/giấy phép đi kèm. Những gói chỉ được tham chiếu từ nguồn cộng đồng Apps2Samsung tiếp tục tải ở upstream và không được coi là WGT được mirror trong đợt này. Xem [danh sách ứng dụng thông dụng và giới hạn Tizen](POPULAR-APPS.md).
