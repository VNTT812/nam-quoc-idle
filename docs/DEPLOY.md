# Deploy lên Cloudflare Pages (bản cố định)

Game là static site — deploy giống bản cũ `*.pages.dev`.

## Vì sao link agent hay “hết vô được”

Link `*.trycloudflare.com` là **quick tunnel tạm**: Cloudflare có thể thu hồi bất kỳ lúc nào, và khi máy agent tắt thì tunnel cũng tắt. Muốn chơi lâu dài cần host tĩnh (Pages) hoặc named tunnel gắn domain.

| Cách | URL cố định? | Sống khi tắt agent? |
|------|--------------|---------------------|
| Quick tunnel (`trycloudflare.com`) | Không (đổi mỗi lần) | Không |
| **Cloudflare Pages** | Có (`*.pages.dev`) | Có |
| Named Cloudflare Tunnel + domain | Có | Có (cần máy chạy cloudflared) |

## Cách nhanh (Dashboard) — khuyến nghị

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages**
2. Connect git repo của project này (hoặc **Upload assets** cả thư mục)
3. Build settings:
   - Build command: *(để trống)*
   - Output directory: `/` hoặc `.`
4. Deploy → nhận link `https://<tên>.pages.dev` — dùng link này thay tunnel

## Tunnel tạm khi đang dev với agent

Trong phiên agent có script `/tmp/keep-tunnel.sh`: tự bật lại cloudflared nếu chết. URL hiện tại ghi ở `/tmp/cf-tunnel.url`. Vẫn **không** thay được Pages — chỉ giảm lúc “đứt giữa chừng” trong lúc VM còn chạy.

## Lưu ý

- Đăng nhập online cần đã chạy `sql/NET_SETUP.sql` + tắt Confirm email trên Supabase.
