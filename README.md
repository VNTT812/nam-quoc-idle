# Nam Quốc Idle

Idle giang hồ Đại Việt, bản đồ và kiến trúc mang hơi thời nhà Trần (đình, cổng tam quan, bia đá, tre trúc, sông nước). Repo: [nam-quoc-idle](https://github.com/VNTT812/nam-quoc-idle).

Nền bản đồ giữ bố cục + vật cản gốc Võ Lâm; đổi bối cảnh đất/cây/nhà-cửa sang tông Trần bằng remap pixel (không stamp chồng ảnh). Tái tạo: `python3 tools/reskin_tran_layout.py all`.

Map chọn thêm: **Phổ Minh Tự** (cùng bậc Yên Tử), **Hồ Tây** (cùng bậc Bạch Đằng) — chọn chip bản đồ trong UI.

## Chạy local

Cần một máy chủ tĩnh (game dùng đường dẫn tương đối và service worker):

```bash
python3 -m http.server 47291
```

Mở [http://127.0.0.1:47291/](http://127.0.0.1:47291/).

Đăng nhập bằng tài khoản cũ nếu Supabase vẫn còn. Client vẫn trỏ đúng project đã cấu hình trong `js/chatcfg.js`, nên nhân vật lưu đám mây vẫn vào được khi máy chủ đó còn sống.

### Đồng đội bản đồ (beta)

Sau khi đăng nhập, vào **bãi luyện công** (cùng map): tối đa ~6 người / phòng `map:{zoneId}` qua Supabase Realtime (presence vị trí + broadcast hit/spawn).

- **HP quái chung** — mọi người đánh cùng một máu
- **Drop / EXP** — chỉ người **last-hit** nhận
- Host (cid nhỏ nhất) làm trọng tài spawn; chưa có game server riêng

Phó bản / tháp / trong thành vẫn solo. Badge **Đồng đội** góc phải sân đấu hiện số người trên map.

Muốn chơi thử trên máy, không cần đăng nhập:

[http://127.0.0.1:47291/?offline_test=1](http://127.0.0.1:47291/?offline_test=1)

## Những gì không nằm trên host tĩnh

Các file build và schema không được deploy lên Pages, nên không kéo về được:

- `NET_SETUP.sql`, `CHAT_SETUP.sql`, `CHAT_ITEM.sql`
- `HUONG_DAN_WEB.txt`, `docs/`, `tools/`, `jxmap/`, `jxres/`
- bảng dữ liệu gốc (`Goods.txt`, `Skills.txt`, …)

Nếu project Supabase còn, không cần các file SQL đó. Nếu database cũng mất, schema phải dựng lại từ lời gọi trong `js/net.js` và `js/chat.js` — file SQL gốc không còn trên site.

Font `IBM Plex Mono` được CSS tham chiếu nhưng file `.woff2` trên Pages trả về trang HTML. Bản này đã tải lại đúng 5 subset từ Google Fonts (SIL OFL) vào `fonts/`.

Một số sheet ngựa (`img/jx/m/ma_hh_*`, `ma_ht_*`) và vài file mp3 võ công đặt tên tiếng Trung cũng không có trên server gốc. Game bỏ qua và dùng hình / tiếng dự phòng.

Icon `img/p/shaolin.png` không có trên host. File hiện tại là bản sao của chân dung môn phái `img/pl/shaolin.png` để manifest không bị gãy.

## Credit sprite

Quái map Yên Tử (id 2) dùng sprite **Spell of Mastery** (NancyGold), giấy phép [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
