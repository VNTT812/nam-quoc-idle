# Zone 56 · Hoành Sơn Phái — style review (Trần)

Layout và `jmo.js` zone `56` **không đổi** cho tới khi bạn chọn variant.

| Slug | Mô tả |
|------|--------|
| `00-original-vltk.jpg` | Bản gốc từ git (VLTK) |
| `01-reskin-van-don.jpg` | Reskin Trần · tông Vân Đồn (nước/xanh) |
| `02-reskin-warm.jpg` | Reskin Trần · gạch/ mái ấm |
| `03-reskin-lush.jpg` | Reskin Trần · rừng xanh Côn Sơn |
| `04-reskin-mist.jpg` | Reskin Trần · sương mù nhẹ |
| `05-compose-van-don.jpg` | Ghép texture · tran-van-don-map |
| `06-compose-con-son.jpg` | Ghép texture · tran-con-son-map |
| `07-compose-thang-long.jpg` | Ghép texture · tran-thang-long-map |
| `08-hybrid-water-van-don.jpg` | Pha reskin + AI Vân Đồn (layout ưu tiên) |
| `09-hybrid-warm-thang-long.jpg` | Pha reskin ấm + AI Thăng Long |

Mở `index.html` để xem lưới thumb.

Deploy (sau khi duyệt): copy variant → `img/z/56.jpg`, bump cache trong `index.html` / `sw.js` / `world.js`.

## Architecture Trần (v2)
| Slug | Mô tả |
|------|--------|
| `10-arch-recolor.jpg` | Đổi màu mái/tường/cờ → ngói đất nung (không stamp) |
| `11-arch-accent.jpg` | Recolor + vẽ mái/đầu đao nhẹ |
| `12-arch-stamp-soft.jpg` | Recolor + stamp nhà Trần (mềm) |
| `13-arch-stamp-strong.jpg` | Recolor + stamp mạnh + đầu đao |
| `14-arch-stamp-warm.jpg` | Recolor + stamp + grade ấm hơn |

## Architecture Trần v3 (AI compound)
| Slug | Mô tả |
|------|--------|
| `15-tran-arch-A.jpg` | AI Trần compound A · ngói đất nung |
| `16-tran-arch-B.jpg` | AI Trần compound B · tông ấm |
| `17-tran-arch-C.jpg` | AI Trần compound C · giữ sân xám |
| `18-tran-arch-AB.jpg` | Pha A+B · mái đất nung + bố cục |
