# Hệ thống quái theo map

Lấy từ data live (`world.js` + `zones2.js`, bản v195).

- `sw` = tỷ lệ quái theo hệ khi spawn: `[Kim, Mộc, Thủy, Hỏa, Thổ]`
- Map **alt** = bản đồ thay thế cùng bậc cấp
- Map **tail** = dãy cao cấp 160–200

## A. Dãy map chính (luyện công)

### 1. Yên Tử Sơn

- Cấp: **1–10** · Map id: `2` · Nền: `img/z/2.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Rừng núi / thú nhỏ
- Boss: **Tây Nam sơn tặc đầu lĩnh** (`#141`)
- Roster hiệu lực: `zones2.js` → `zm["2"]` (đè `world.js`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 12 | Nhím | `ani019` | melee | 6 |
| 11 | Heo rừng | `ani018` | melee | 6 |
| 33 | Hoán hùng | `ani051` | melee | 6 |
| 34 | Linh Miêu | `ani052` | melee | 6 |
| 141 | Tây Nam sơn tặc đầu lĩnh **boss** | `enemy122` | melee | 5 |

### 2. Kiếm Các Tây Bắc

- Cấp: **10–20** · Map id: `3` · Nền: `img/z/3.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Rừng sâu / thú săn
- Boss: **Tiểu Boss cấp 20** (`#851`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 5 | Sói xám | `ani009` | melee | 6 |
| 6 | Sói đỏ | `ani010` | melee | 6 |
| 7 | Sói xanh | `ani011` | melee | 6 |
| 851 | Tiểu Boss cấp 20 **boss** | `enemy107` | melee | 12 |

### 3. Tần Lăng

- Cấp: **20–30** · Map id: `7` · Nền: `img/z/7.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Hang động / dơi & sâu bọ
- Boss: **Tiểu Boss cấp 30** (`#852`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 12 | Nhím | `ani019` | melee | 6 |
| 33 | Hoán hùng | `ani051` | melee | 6 |
| 11 | Heo rừng | `ani018` | melee | 6 |
| 852 | Tiểu Boss cấp 30 **boss** | `enemy081` | melee | 12 |

### 4. Kiếm Các Tây Nam

- Cấp: **30–40** · Map id: `19` · Nền: `img/z/19.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Đầm lầy / bò sát
- Boss: **Giang Nam sơn tặc đầu lĩnh** (`#142`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 12 | Nhím | `ani019` | melee | 6 |
| 11 | Heo rừng | `ani018` | melee | 6 |
| 142 | Giang Nam sơn tặc đầu lĩnh **boss** | `enemy123` | melee | 6 |

### 5. Thanh Thành sơn

- Cấp: **40–50** · Map id: `21` · Nền: `img/z/21.jpg`
- Hệ spawn: Kim 20%, Thổ 80%
- Theme gợi ý: Sườn núi / chim & hầu
- Boss: **Tiểu Boss cấp 40** (`#853`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 24 | Kim Điêu | `ani041` | melee | 8 |
| 25 | Thương ưng | `ani042` | melee | 8 |
| 26 | Kền Kền | `ani043` | melee | 8 |
| 853 | Tiểu Boss cấp 40 **boss** | `enemy109` | melee | 12 |

### 6. Phục Ngưu Sơn Tây

- Cấp: **50–60** · Map id: `41` · Nền: `img/z/41.jpg`
- Hệ spawn: Mộc 80%, Hỏa 20%
- Theme gợi ý: Rừng Tây / sói gấu hồ
- Boss: **Tiểu Boss cấp 50** (`#854`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 7 | Sói xanh | `ani011` | melee | 6 |
| 8 | Sói tuyết | `ani012` | melee | 6 |
| 10 | Hỏa Hồ | `ani015` | melee | 6 |
| 854 | Tiểu Boss cấp 50 **boss** | `enemy126` | melee | 12 |

### 7. Phục Ngưu Sơn Đông

- Cấp: **60–70** · Map id: `90` · Nền: `img/z/90.jpg`
- Hệ spawn: Kim 80%, Thủy 20%
- Theme gợi ý: Đông / thú lớn
- Boss: **Đông Bắc sơn tặc đầu lĩnh** (`#143`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 7 | Sói xanh | `ani011` | melee | 6 |
| 8 | Sói tuyết | `ani012` | melee | 6 |
| 10 | Hỏa Hồ | `ani015` | melee | 6 |
| 143 | Đông Bắc sơn tặc đầu lĩnh **boss** | `enemy124` | melee | 6 |

### 8. Vũ Lăng sơn

- Cấp: **70–80** · Map id: `70` · Nền: `img/z/70.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Sơn tặc / người
- Boss: **Tiểu Boss cấp 60** (`#855`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 25 | Thương ưng | `ani042` | melee | 8 |
| 26 | Kền Kền | `ani043` | melee | 8 |
| 10 | Hỏa Hồ | `ani015` | melee | 6 |
| 855 | Tiểu Boss cấp 60 **boss** | `enemy089` | melee | 12 |

### 9. Thục Cương sơn

- Cấp: **80–90** · Map id: `92` · Nền: `img/z/92.jpg`
- Hệ spawn: Mộc 80%, Hỏa 20%
- Theme gợi ý: Kiếm khách / cao thủ
- Boss: **Hoa Bắc sơn tặc đầu lĩnh** (`#144`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 17 | Trâu rừng | `ani029` | melee | 6 |
| 36 | Khỉ xám | `ani054` | melee | 6 |
| 37 | Hắc Diệp Hầu | `ani055` | melee | 6 |
| 144 | Hoa Bắc sơn tặc đầu lĩnh **boss** | `enemy125` | melee | 8 |

### 10. Hoành Sơn Phái

- Cấp: **90–100** · Map id: `56` · Nền: `img/z/56.jpg`
- Hệ spawn: Mộc 30%, Thủy 70%
- Theme gợi ý: Bang hội / võ nhân
- Boss: **Tiểu Boss cấp 70** (`#856`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 24 | Kim Điêu | `ani041` | melee | 8 |
| 26 | Kền Kền | `ani043` | melee | 8 |
| 37 | Hắc Diệp Hầu | `ani055` | melee | 6 |
| 856 | Tiểu Boss cấp 70 **boss** | `enemy070` | melee | 12 |

### 11. Hoàng Hà Nguyên Đầu

- Cấp: **100–110** · Map id: `122` · Nền: `img/z/122.jpg`
- Hệ spawn: Mộc 20%, Thủy 80%
- Theme gợi ý: Hổ báo / đại mãng
- Boss: **Tiểu Boss cấp 80** (`#857`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 2 | Bạch Hổ | `ani003` | melee | 7 |
| 4 | Báo trắng | `ani006` | melee | 6 |
| 26 | Kền Kền | `ani043` | melee | 8 |
| 857 | Tiểu Boss cấp 80 **boss** | `enemy048` | melee | 12 |

### 12. Dược Vương Cốc

- Cấp: **110–120** · Map id: `140` · Nền: `img/z/140.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Dược cốc / dị nhân
- Boss: **Tiểu Boss cấp 90** (`#858`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 34 | Linh Miêu | `ani052` | melee | 6 |
| 42 | Hươu đốm | `ani061` | melee | 4 |
| 38 | Kim Tơ Hầu | `ani056` | melee | 6 |
| 858 | Tiểu Boss cấp 90 **boss** | `enemy082` | melee | 12 |

### 13. Sa mạc địa biểu

- Cấp: **120–130** · Map id: `224` · Nền: `img/z/224.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Sa mạc
- Boss: **Nam bộ sơn tặc đầu lĩnh** (`#145`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 558 | Bọ cạp | `ani065` | melee | 6 |
| 556 | Xích Luyện Xà | `ani039` | melee | 4 |
| 557 | Kên đất | `ani041` | melee | 8 |
| 145 | Nam bộ sơn tặc đầu lĩnh **boss** | `enemy126` | melee | 5 |

### 14. Lâm Du Quan

- Cấp: **130–140** · Map id: `319` · Nền: `img/z/319.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Quan ải / quân nhân
- Boss: **Lục Phi** (`#720`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 588 | Bôn Lôi | `enemy067` | melee | 6 |
| 589 | Ngân Nha | `enemy023` | melee | 6 |
| 720 | Lục Phi **boss** | `enemy089` | melee | 12 |

### 15. Chân núi Trường Bạch

- Cấp: **140–150** · Map id: `320` · Nền: `img/z/320.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Trường Bạch / dị thú
- Boss: **Hạ Hầu Phục** (`#716`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 591 | Độc Bộ | `enemy082` | melee | 6 |
| 590 | Đông Bắc hổ | `ani001` | melee | 6 |
| 592 | Xích Chưởng | `enemy107` | melee | 6 |
| 593 | Tuyết ảnh | `enemy141` | melee | 6 |
| 716 | Hạ Hầu Phục **boss** | `enemy050` | melee | 12 |

### 16. Trường Bạch sơn Bắc

- Cấp: **150–160** · Map id: `322` · Nền: `img/z/322.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Bắc cảnh / cao thủ
- Boss: **Tiếu Vô Thường** (`#717`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 596 | Hàn Thương | `enemy036` | melee | 6 |
| 595 | Lạc Quang | `enemy021` | melee | 6 |
| 594 | Đao Trảm | `enemy128` | melee | 6 |
| 597 | Đoạt Phách | `enemy029` | melee | 6 |
| 717 | Tiếu Vô Thường **boss** | `enemy051` | melee | 12 |

### 17. Phong Lăng độ

- Cấp: **160–170** · Map id: `336` · Nền: `img/z/336.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Cao cấp / đảo–thảo nguyên
- Boss: **Phiến Khách** (`#602`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 675 | Hà Hoa Đạo | `enemy059` | melee | 12 |
| 709 | Liệt Không Mạc Bắc Thảo Nguyên | `enemy147` | melee | 6 |
| 708 | Lãnh Thương | `enemy036` | melee | 6 |
| 707 | Thần Tý | `enemy028` | melee | 6 |
| 704 | Tẩu Thạch | `enemy078` | melee | 6 |
| 706 | Mạc Tặc | `enemy129` | melee | 6 |
| 602 | Phiến Khách **boss** | `boss006` | melee | 6 |

### 18. Mạc Cao Quật

- Cấp: **170–180** · Map id: `340` · Nền: `img/z/340.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Cao cấp / động phủ
- Boss: **Nguyễn Minh Viễn** (`#701`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 705 | Sa Đạo | `enemy134` | melee | 6 |
| 704 | Tẩu Thạch | `enemy078` | melee | 6 |
| 706 | Mạc Tặc | `enemy129` | melee | 6 |
| 707 | Thần Tý | `enemy028` | melee | 6 |
| 701 | Nguyễn Minh Viễn **boss** | `enemy147` | melee | 12 |

### 19. Băng Hà động

- Cấp: **180–190** · Map id: `201` · Nền: `img/z/201.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Cao cấp / hà động
- Boss: **Chính Võ Sĩ** (`#700`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 169 | sơn tặc 07 | `enemy150` | melee | 6 |
| 159 | Hoa Bắc sơn tặc 1 | `enemy140` | melee | 6 |
| 149 | Trường Thương | `enemy130` | melee | 6 |
| 700 | Chính Võ Sĩ **boss** | `enemy076` | melee | 12 |

### 20. Dương Trung động

- Cấp: **190–200** · Map id: `205` · Nền: `img/z/205.jpg`
- Hệ spawn: cân bằng (20%)
- Theme gợi ý: Cao cấp / cung động
- Boss: **Thi Nghi Sinh** (`#699`)

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 159 | Hoa Bắc sơn tặc 1 | `enemy140` | melee | 6 |
| 169 | sơn tặc 07 | `enemy150` | melee | 6 |
| 149 | Trường Thương | `enemy130` | melee | 6 |
| 699 | Thi Nghi Sinh **boss** | `enemy003` | melee | 12 |

## B. Map thay thế (cùng bậc cấp)

### Thay cho bậc *Kiếm Các Tây Bắc* (cấp 10–20)

#### Nhạn Đãng sơn · id `195`

- Nền: `img/z/195.jpg` · Boss chung bậc: **Tiểu Boss cấp 20**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 9 | Hồ ly | `ani013` | melee | 5 |
| 7 | Sói xanh | `ani011` | melee | 6 |
| 37 | Hắc Diệp Hầu | `ani055` | melee | 6 |
| 45 | Nhện | `ani066` | melee | 6 |

### Thay cho bậc *Tần Lăng* (cấp 20–30)

#### Kiếm Các Trung Nguyên · id `43`

- Nền: `img/z/43.jpg` · Boss chung bậc: **Tiểu Boss cấp 30**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 6 | Sói đỏ | `ani010` | melee | 6 |
| 5 | Sói xám | `ani009` | melee | 6 |
| 7 | Sói xanh | `ani011` | melee | 6 |

#### La Tiêu sơn · id `179`

- Nền: `img/z/179.jpg` · Boss chung bậc: **Tiểu Boss cấp 30**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 5 | Sói xám | `ani009` | melee | 6 |
| 4 | Báo trắng | `ani006` | melee | 6 |
| 6 | Sói đỏ | `ani010` | melee | 6 |
| 167 | sơn tặc 05 | `enemy148` | melee | 6 |

### Thay cho bậc *Kiếm Các Tây Nam* (cấp 30–40)

#### Vũ Di sơn · id `193`

- Nền: `img/z/193.jpg` · Boss chung bậc: **Giang Nam sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 4 | Báo trắng | `ani006` | melee | 6 |
| 6 | Sói đỏ | `ani010` | melee | 6 |
| 5 | Sói xám | `ani009` | melee | 6 |
| 158 | Đông Bắc sơn tặc 2 | `enemy139` | melee | 6 |

#### Miêu Lĩnh · id `74`

- Nền: `img/z/74.jpg` · Boss chung bậc: **Giang Nam sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 17 | Trâu rừng | `ani029` | melee | 6 |
| 35 | Tàng Vực hầu | `ani053` | melee | 6 |
| 37 | Hắc Diệp Hầu | `ani055` | melee | 6 |

#### Tuyết Báo động tầng 1 · id `145`

- Nền: `img/z/145.jpg` · Boss chung bậc: **Giang Nam sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 3 | Kim Tiền báo | `ani005` | melee | 6 |
| 4 | Báo trắng | `ani006` | melee | 6 |
| 9 | Hồ ly | `ani013` | melee | 5 |

### Thay cho bậc *Thanh Thành sơn* (cấp 40–50)

#### Điểm Thương sơn · id `167`

- Nền: `img/z/167.jpg` · Boss chung bậc: **Tiểu Boss cấp 40**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 32 | Xá Lị | `ani050` | melee | 6 |
| 37 | Hắc Diệp Hầu | `ani055` | melee | 6 |
| 20 | Nhãn Kính Mãng xà | `ani037` | melee | 4 |
| 24 | Kim Điêu | `ani041` | melee | 8 |
| 25 | Thương ưng | `ani042` | melee | 8 |

### Thay cho bậc *Phục Ngưu Sơn Đông* (cấp 60–70)

#### Thanh Loa đảo · id `68`

- Nền: `img/z/68.jpg` · Boss chung bậc: **Đông Bắc sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 161 | Thiết Trảo | `enemy142` | melee | 6 |
| 168 | sơn tặc 06 | `enemy149` | melee | 6 |
| 141 | Tây Nam sơn tặc đầu lĩnh | `enemy122` | melee | 5 |

#### Vi sơn đảo · id `342`

- Nền: `img/z/342.jpg` · Boss chung bậc: **Đông Bắc sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 712 | Phá Lang Kim sơn đảo | `enemy048` | melee | 6 |
| 713 | Thừa Phong Kim sơn đảo | `enemy069` | melee | 6 |

#### Mạc Bắc Thảo Nguyên · id `341`

- Nền: `img/z/341.jpg` · Boss chung bậc: **Đông Bắc sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 710 | Kinh Phong Mạc Bắc Thảo Nguyên | `enemy024` | melee | 6 |
| 674 | Thủy Tặc | `enemy205` | melee | 6 |
| 711 | Phục Ba Kim sơn đảo | `enemy205` | melee | 6 |

### Thay cho bậc *Thục Cương sơn* (cấp 80–90)

#### Lão Hổ động · id `123`

- Nền: `img/z/123.jpg` · Boss chung bậc: **Hoa Bắc sơn tặc đầu lĩnh**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 140 | Khoái Thối | `enemy121` | melee | 6 |
| 149 | Trường Thương | `enemy130` | melee | 6 |
| 150 | Thanh Mi | `enemy131` | melee | 6 |

### Thay cho bậc *Hoành Sơn Phái* (cấp 90–100)

#### Tiến Cúc động · id `93`

- Nền: `img/z/93.jpg` · Boss chung bậc: **Tiểu Boss cấp 70**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 146 | Đoạt Mệnh Liêm | `enemy127` | melee | 6 |
| 147 | Đao khách | `enemy128` | melee | 6 |
| 148 | Báo đốm | `enemy129` | melee | 6 |

#### Khoả Lang động · id `75`

- Nền: `img/z/75.jpg` · Boss chung bậc: **Tiểu Boss cấp 70**

| ID | Tên | Anim sheet | Kiểu | Run |
|---:|---|---|---|---:|
| 155 | Hắc Cân | `enemy136` | melee | 5 |
| 156 | Ảnh Côn | `enemy137` | melee | 6 |
| 157 | Đông Bắc sơn tặc 1 | `enemy138` | melee | 6 |

## C. Thống kê

- Map chính + cao cấp: **20**
- Map alt: **13**
- Loại quái trong data: **119**
- Anim sheet đang dùng trên map: **74**

Khi làm art mới: ưu tiên làm lại theo **anim sheet** (nhiều id quái có thể dùng chung 1 sheet), không nhân bản theo từng id.