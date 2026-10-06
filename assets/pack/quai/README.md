# Thư viện sheet quái

Sinh lúc: `2026-10-06T18:10:29Z` · `python3 tools/quai_pack.py`

- **113 stem** (ani 47 · enemy 55 · boss 11)
- **119 quái** · **20 map**
- Sheet thiếu act: 0 · Stem không gắn quái: 11

## Cấu trúc

```
assets/pack/quai/
  catalog.json / index.json / monsters.csv / README.md
  portraits/<stem>.png
  by_type/{ani,boss,enemy}/<stem>  →  stems/<stem>
  stems/<stem>/
    meta.json
    st.webp  run.webp  at.webp  hurt.webp  die.webp
    portrait.png
```

Runtime game vẫn đọc `img/a/` + `img/m/`. Pack này hardlink để **tra cứu / dựng lại**.

## Danh sách theo loại

### ani (47)

| Stem | Quái | Map | Đủ 5 act |
|------|------|-----|----------|
| `ani001` | Đông Bắc hổ(0), Đông Bắc hổ(590) | Tam Đảo | ✓ |
| `ani002` | Hoa Nam hổ(1) | — | ✓ |
| `ani003` | Bạch Hổ(2) | Bạch Đằng Giang | ✓ |
| `ani005` | Kim Tiền báo(3) | — | ✓ |
| `ani006` | Báo trắng(4) | Bạch Đằng Giang | ✓ |
| `ani009` | Sói xám(5) | Thiên Trường | ✓ |
| `ani010` | Sói đỏ(6) | Thiên Trường | ✓ |
| `ani011` | Sói xanh(7) | Thiên Trường, Chí Linh, Phả Lại | ✓ |
| `ani012` | Sói tuyết(8) | Chí Linh, Phả Lại | ✓ |
| `ani013` | Hồ ly(9) | — | ✓ |
| `ani015` | Hỏa Hồ(10) | Chí Linh, Phả Lại, Đông Triều | ✓ |
| `ani018` | Heo rừng(11) | Yên Tử Sơn, Long Hưng, Tức Mặc | ✓ |
| `ani019` | Nhím(12) | Yên Tử Sơn, Long Hưng, Tức Mặc | ✓ |
| `ani021` | Đại Tượng(13) | — | ✓ |
| `ani024` | Voi Hoàng hà(14) | — | ✓ |
| `ani025` | Gấu nâu(15) | — | ✓ |
| `ani026` | Gấu đen(16) | — | ✓ |
| `ani029` | Trâu rừng(17) | An Bang | ✓ |
| `ani033` | Cá sấu(18) | — | ✓ |
| `ani036` | Thằn lằn đỏ(19) | — | ✓ |
| `ani037` | Nhãn Kính Mãng xà(20) | — | ✓ |
| `ani038` | Rắn xanh(21) | — | ✓ |
| `ani039` | Kim Hoàn Mãng Xà(22), Xích Luyện Xà(556) | Trường Yên | ✓ |
| `ani040` | Xích Luyện Xà(23) | — | ✓ |
| `ani041` | Kim Điêu(24), Kên đất(557) | Côn Sơn, Vân Đồn, Trường Yên | ✓ |
| `ani042` | Thương ưng(25) | Côn Sơn, Đông Triều | ✓ |
| `ani043` | Kền Kền(26) | Côn Sơn, Đông Triều, Vân Đồn +1 | ✓ |
| `ani045` | Dơi chúa(27) | — | ✓ |
| `ani046` | Dơi chúa đỏ(28) | — | ✓ |
| `ani047` | Dơi Dong(29) | — | ✓ |
| `ani048` | Dơi hút máu(30) | — | ✓ |
| `ani049` | Kim Miêu(31) | — | ✓ |
| `ani050` | Xá Lị(32) | — | ✓ |
| `ani051` | Hoán hùng(33) | Yên Tử Sơn, Long Hưng | ✓ |
| `ani052` | Linh Miêu(34) | Yên Tử Sơn, Đạm Thủy Cốc | ✓ |
| `ani053` | Tàng Vực hầu(35) | — | ✓ |
| `ani054` | Khỉ xám(36) | An Bang | ✓ |
| `ani055` | Hắc Diệp Hầu(37) | An Bang, Vân Đồn | ✓ |
| `ani056` | Kim Tơ Hầu(38) | Đạm Thủy Cốc | ✓ |
| `ani058` | Sài(39) | — | ✓ |
| `ani059` | Tuyết Quái(40) | — | ✓ |
| `ani060` | Cóc(41) | — | ✓ |
| `ani061` | Hươu đốm(42) | Đạm Thủy Cốc | ✓ |
| `ani063` | Heo trắng(43) | — | ✓ |
| `ani065` | Bọ cạp(558) | Trường Yên | ✓ |
| `ani066` | Nhện(45) | — | ✓ |
| `ani067` | Rết(46) | — | ✓ |

### boss (11)

| Stem | Quái | Map | Đủ 5 act |
|------|------|-----|----------|
| `boss002` | — | — | ✓ |
| `boss003` | — | — | ✓ |
| `boss005` | — | — | ✓ |
| `boss006` | Phiến Khách(602) | Bến Phong Lăng | ✓ |
| `boss008` | — | — | ✓ |
| `boss013` | — | — | ✓ |
| `boss015` | — | — | ✓ |
| `boss017` | — | — | ✓ |
| `boss019` | — | — | ✓ |
| `boss022` | — | — | ✓ |
| `boss024` | — | — | ✓ |

### enemy (55)

| Stem | Quái | Map | Đủ 5 act |
|------|------|-----|----------|
| `enemy003` | Thi Nghi Sinh(699) | Động Dương Trung | ✓ |
| `enemy021` | Lạc Quang(595) | Ba Vì Sơn | ✓ |
| `enemy023` | Ngân Nha(589) | Ải Chi Lăng | ✓ |
| `enemy024` | Sương Đao(598), Kinh Phong Mạc Bắc Thảo Nguyên(710) | — | ✓ |
| `enemy028` | Lãnh Cung(599), Thần Tý(707) | Bến Phong Lăng, Mạc Cao Quật | ✓ |
| `enemy029` | Đoạt Phách(597) | Ba Vì Sơn | ✓ |
| `enemy036` | Hàn Thương(596), Lãnh Thương(708) | Ba Vì Sơn, Bến Phong Lăng | ✓ |
| `enemy040` | Sãn Vũ(601) | — | ✓ |
| `enemy048` | Phá Lang Kim sơn đảo(712), Tiểu Boss cấp 80(857) | Bạch Đằng Giang | ✓ |
| `enemy050` | Hạ Hầu Phục(716) | Tam Đảo | ✓ |
| `enemy051` | Tiếu Vô Thường(717) | Ba Vì Sơn | ✓ |
| `enemy059` | Hà Hoa Đạo(675) | Bến Phong Lăng | ✓ |
| `enemy067` | Bôn Lôi(588) | Ải Chi Lăng | ✓ |
| `enemy069` | Thừa Phong Kim sơn đảo(713) | — | ✓ |
| `enemy070` | Tiểu Boss cấp 70(856) | Vân Đồn | ✓ |
| `enemy076` | Chính Võ Sĩ(700) | Động Băng Hà | ✓ |
| `enemy078` | Tẩu Thạch(704) | Bến Phong Lăng, Mạc Cao Quật | ✓ |
| `enemy079` | — | — | ✓ |
| `enemy081` | Tiểu Boss cấp 30(852) | Long Hưng | ✓ |
| `enemy082` | Độc Bộ(591), Tiểu Boss cấp 90(858) | Đạm Thủy Cốc, Tam Đảo | ✓ |
| `enemy083` | Phi Sa(703) | — | ✓ |
| `enemy086` | Giáng Chùy(600) | — | ✓ |
| `enemy089` | Lục Phi(720), Tiểu Boss cấp 60(855) | Đông Triều, Ải Chi Lăng | ✓ |
| `enemy107` | Xích Chưởng(592), Tiểu Boss cấp 20(851) | Thiên Trường, Tam Đảo | ✓ |
| `enemy109` | Tiểu Boss cấp 40(853) | Côn Sơn | ✓ |
| `enemy121` | Khoái Thối(140) | — | ✓ |
| `enemy122` | Tây Nam sơn tặc đầu lĩnh(141) | Yên Tử Sơn | ✓ |
| `enemy123` | Giang Nam sơn tặc đầu lĩnh(142) | Tức Mặc | ✓ |
| `enemy124` | Đông Bắc sơn tặc đầu lĩnh(143) | Phả Lại | ✓ |
| `enemy125` | Hoa Bắc sơn tặc đầu lĩnh(144) | An Bang | ✓ |
| `enemy126` | Nam bộ sơn tặc đầu lĩnh(145), Tiểu Boss cấp 50(854) | Chí Linh, Trường Yên | ✓ |
| `enemy127` | Đoạt Mệnh Liêm(146) | — | ✓ |
| `enemy128` | Đao khách(147), Đao Trảm(594) | Ba Vì Sơn | ✓ |
| `enemy129` | Báo đốm(148), Mạc Tặc(706) | Bến Phong Lăng, Mạc Cao Quật | ✓ |
| `enemy130` | Trường Thương(149) | Động Băng Hà, Động Dương Trung | ✓ |
| `enemy131` | Thanh Mi(150) | — | ✓ |
| `enemy132` | Mãng Hán(151) | — | ✓ |
| `enemy133` | Tây Nam sơn tặc 2(152) | — | ✓ |
| `enemy134` | Giang Nam sơn tặc 1(153), Sa Đạo(705) | Mạc Cao Quật | ✓ |
| `enemy135` | Lưu Lương(154) | — | ✓ |
| `enemy136` | Hắc Cân(155) | — | ✓ |
| `enemy137` | Ảnh Côn(156) | — | ✓ |
| `enemy138` | Đông Bắc sơn tặc 1(157) | — | ✓ |
| `enemy139` | Đông Bắc sơn tặc 2(158) | — | ✓ |
| `enemy140` | Hoa Bắc sơn tặc 1(159) | Động Băng Hà, Động Dương Trung | ✓ |
| `enemy141` | Hoa Bắc sơn tặc 2(160), Tuyết ảnh(593) | Tam Đảo | ✓ |
| `enemy142` | Thiết Trảo(161) | — | ✓ |
| `enemy143` | Đoản Kích(162) | — | ✓ |
| `enemy144` | sơn tặc 01(163) | — | ✓ |
| `enemy146` | sơn tặc 03(165) | — | ✓ |
| `enemy147` | Nguyễn Minh Viễn(701), Liệt Không Mạc Bắc Thảo Nguyên(709) | Bến Phong Lăng, Mạc Cao Quật | ✓ |
| `enemy148` | sơn tặc 05(167) | — | ✓ |
| `enemy149` | sơn tặc 06(168) | — | ✓ |
| `enemy150` | sơn tặc 07(169) | Động Băng Hà, Động Dương Trung | ✓ |
| `enemy205` | Thủy Tặc(674), Phục Ba Kim sơn đảo(711) | — | ✓ |

## Stem chưa gắn quái

`boss002`, `boss003`, `boss005`, `boss008`, `boss013`, `boss015`, `boss017`, `boss019`, `boss022`, `boss024`, `enemy079`

