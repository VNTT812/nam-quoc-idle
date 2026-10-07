# Setup Supabase cho Võ Lâm Idle

Project: https://supabase.com/dashboard/project/khwkokiflhzwxuzoilux

## Việc cần làm (theo thứ tự)

1. **Lấy API key**  
   Dashboard → **Project Settings** → **API**  
   - Project URL: `https://khwkokiflhzwxuzoilux.supabase.co` (đã điền sẵn trong `js/chatcfg.js`)  
   - Copy **anon public** (JWT `eyJ...`) hoặc **Publishable** (`sb_publishable_...`)  
   - Dán vào `js/chatcfg.js` → trường `key`

2. **Chạy SQL**  
   Dashboard → **SQL Editor** → New query  
   Dán toàn bộ nội dung `sql/NET_SETUP.sql` → **Run**  
   Rồi chạy thêm `sql/MAIL_FIX.sql` (vá hộp thư / Admin cấp đồ — bắt buộc nếu Thư luôn trống)  
   Project đã có sẵn schema: chạy thêm `sql/CHAT_TTL.sql` để bật xóa chat log sau 24 giờ (RPC `chat_purge_old`)  
   Chat bạn bè: chạy `sql/FRIEND_CHAT.sql` rồi bật **Realtime** cho bảng `public.fchat` (Database → Replication)  
   Hộp thư 24h: chạy `sql/MAIL_TTL.sql` (RPC `mail_purge_old` + `list_mail` chỉ trả thư còn hạn)

3. **Tắt Confirm email**  
   Dashboard → **Authentication** → **Providers** → **Email**  
   Tắt **Confirm email** (nếu không tắt, đăng ký sẽ không có session)

4. **Reload game**  
   Mở lại trang game (không dùng `?offline_test=1`) → Đăng ký tài khoản mới → tạo nhân vật

## Lưu ý

- Project cũ chết → **tài khoản / nhân vật cloud cũ không mang sang được**. Phải đăng ký lại.
- Offline (`?offline_test=1`) vẫn chơi được, lưu trên máy.
- Chat / chợ / thư / xếp hạng chỉ hoạt động sau khi xong 3 bước trên.
