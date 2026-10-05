# Deploy lên Cloudflare Pages (bản cố định)

Game là static site — deploy giống bản cũ `*.pages.dev`.

## Cách nhanh (Dashboard)

1. Vào https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages**
2. Connect git repo `t-ng-v-dev/volam-revive` (hoặc upload thư mục)
3. Build settings:
   - Build command: *(để trống)*
   - Output directory: `/` hoặc `.`
4. Deploy → nhận link `https://<tên>.pages.dev`

## Lưu ý

- Tunnel `trycloudflare.com` chỉ tạm khi agent đang chạy.
- Pages mới = link cố định, chơi mọi lúc.
- Đăng nhập online cần đã chạy `sql/NET_SETUP.sql` + tắt Confirm email trên Supabase.
