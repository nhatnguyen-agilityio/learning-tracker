# Learning Tracker — SPEC

Nguồn gốc: [Learning Tracker — PRD](https://claude.ai/artifact/Su4HPs68ZmL3RkB8cMyctc), cập nhật 2026-11-05. Khi có quyết định mới về flow, dữ liệu hay phạm vi, cập nhật cả hai nơi.

**Vấn đề:** người tự học lấy kiến thức từ nhiều nguồn. Link rải rác, tiến độ không rõ, học xong vài hôm là quên.

**Giải pháp:** một web app gom nguồn học, ghi chú và thẻ ôn tập vào một luồng. Lịch spaced repetition nhắc đúng lúc sắp quên. Claude tạo thẻ từ ghi chú qua MCP server của app.

## Persona

- **Người dùng chính:** lập trình viên tự học nhiều chủ đề song song với công việc. Học trên máy tính, ôn thẻ trên máy tính và điện thoại.
- **Người dùng mở rộng:** bất kỳ ai đăng ký tài khoản bằng Google. Mỗi người chỉ thấy dữ liệu của mình.

### Chỉ số thành công (sau 1 tháng dùng)

- Ôn thẻ ít nhất 5 ngày/tuần
- Tỷ lệ nhớ (chấm "Nhớ rõ" hoặc "Mang máng") từ 80% trở lên, tính trên lượt chấm đầu tiên của mỗi thẻ trong phiên
- Theo dõi tỷ lệ người dùng còn ôn sau 7 ngày

Các chỉ số tính bằng SQL từ bảng `reviews`.

## User flow

### F1 — Đăng ký / đăng nhập

1. Bấm "Đăng nhập bằng Google" → vào màn Today. Màn Đăng nhập có câu giới thiệu ngắn, nút chuyển ngôn ngữ và link Điều khoản, Quyền riêng tư
2. Lần đầu: app lấy múi giờ và ngôn ngữ từ trình duyệt (không phải tiếng Việt thì dùng tiếng Anh); sửa được trong Settings
3. Lần đầu: màn Today trống, gợi ý "Thêm nguồn học đầu tiên"

### F2 — Thêm nguồn học

1. Bấm "Thêm nguồn" → dán link
2. Link đã có trong thư viện → cảnh báo và mở nguồn đã có, không tạo bản mới
3. App lấy tiêu đề, ảnh, loại (bài viết / video / khoá học / docs) qua oEmbed cho YouTube và Open Graph cho site khác; người dùng sửa được
4. Chọn chủ đề (chọn có sẵn hoặc tạo mới tại chỗ), trạng thái mặc định "Muốn học" → Lưu. Thêm nguồn mới ở trạng thái "Xong" thì tiến độ là 100%
5. Chuỗi không đúng định dạng link (phải bắt đầu bằng http hoặc https) → báo lỗi, không lưu được
6. Link đúng định dạng nhưng lỗi, site chặn bot hoặc không lấy được metadata → vẫn lưu được, tự nhập tiêu đề. Ảnh lỗi thì hiện ảnh thay thế

### F3 — Học và ghi chú

1. Mở nguồn → bấm mở link gốc (tab mới)
2. Thêm hoặc sửa ghi chú markdown trong danh sách ghi chú của nguồn; mỗi ghi chú tự lưu riêng
3. Kéo thanh tiến độ %; lớn hơn 0 thì "Muốn học" tự chuyển sang "Đang học"; đạt 100% thì gợi ý chuyển sang "Xong". Với nguồn đã có, chuyển sang "Xong" không tự đổi %

### F4 — Tạo thẻ thủ công

1. Trong trang nguồn, bấm "Thêm thẻ" → nhập mặt trước, mặt sau (markdown)
2. Thẻ mới vào hàng chờ "thẻ mới" của lịch ôn

### F5 — Tạo thẻ qua Claude (MCP, slice S6)

1. Trong Settings, tạo API token và làm theo hướng dẫn kết nối MCP
2. Trong Claude: "Tạo thẻ ôn tập từ ghi chú bài X"
3. Claude tìm nguồn, đọc ghi chú qua MCP, đề xuất thẻ, rồi tạo thẻ ở trạng thái **chờ duyệt**
4. Trong app, mục "Chờ duyệt" cho phép sửa, duyệt hoặc xoá từng thẻ, hoặc "Duyệt tất cả" theo từng nguồn. Chỉ thẻ đã duyệt mới vào lịch ôn, ở hàng thẻ mới và tính vào hạn mức thẻ mới/ngày

### F6 — Ôn tập hằng ngày

1. Màn Today hiển thị số thẻ đến hạn → bấm "Bắt đầu ôn"
2. Xem mặt trước → lật (Space hoặc chạm) → tự chấm: Quên / Mang máng / Nhớ rõ (phím 1/2/3). Dòng giải thích dưới nút: không nhớ ra đáp án thì chấm Quên; đúng nhưng phải nghĩ lâu thì chấm Mang máng
3. App chuyển ngay sang thẻ kế và lưu lượt chấm ở nền; lỗi mạng thì tự gửi lại
4. Thẻ chấm Quên quay lại cuối phiên
5. Chấm nhầm → hoàn tác lượt gần nhất (phím Z hoặc nút trên mobile)
6. Phiên chia thành lô 50 thẻ, ưu tiên thẻ quá hạn lâu nhất. Hết lô → tổng kết kèm nút "Ôn tiếp"
7. Hết thẻ → màn tổng kết: số thẻ đã ôn, tỷ lệ nhớ, streak

### F7 — Xem tiến độ

1. Today: streak, thẻ đến hạn, nguồn đang học dở
2. Library: tìm theo tiêu đề, URL và ghi chú; lọc theo chủ đề và trạng thái; xem tiến độ từng nguồn

### F8 — Xoá nguồn và thẻ

1. Trong trang nguồn, bấm "Xoá nguồn" → xác nhận
2. Ghi chú của nguồn bị xoá; thẻ được giữ lại và tách khỏi nguồn (`resource_id = null`)
3. Xoá thẻ đã từng ôn là xoá mềm (`deleted_at`) để giữ `reviews`; xoá thẻ chờ duyệt là xoá hẳn

### F9 — Cài đặt và tài khoản

1. Trong Settings, đổi thẻ mới/ngày, múi giờ, ngôn ngữ, quản lý chủ đề
2. Xuất dữ liệu: tải file JSON chứa toàn bộ dữ liệu của mình
3. Xoá tài khoản: xác nhận → xoá toàn bộ dữ liệu của tài khoản
4. Đăng xuất: về màn Đăng nhập, dữ liệu vẫn giữ nguyên

## Danh sách màn hình

| Màn hình | Mục đích | Dữ liệu chính | Hành động | Flow |
| --- | --- | --- | --- | --- |
| Đăng nhập | Vào app | Câu giới thiệu ngắn | Đăng nhập Google, chuyển ngôn ngữ | F1 |
| Today | Điểm bắt đầu mỗi ngày | Thẻ đến hạn, streak, nguồn đang học dở, số thẻ chờ duyệt | Bắt đầu ôn, mở nguồn, thêm nguồn | F1, F6, F7 |
| Library | Quản lý nguồn học | Danh sách nguồn, chủ đề, trạng thái, % | Tìm kiếm, lọc, thêm nguồn | F2, F7 |
| Thêm / sửa nguồn (modal) | Tạo nguồn từ link | Metadata từ link | Sửa tiêu đề, chọn chủ đề, lưu | F2 |
| Chi tiết nguồn | Học và ghi chú | Thông tin, tiến độ, ghi chú, thẻ của nguồn | Mở link, ghi chú, chỉnh %, thêm thẻ, xoá nguồn | F3, F4, F8 |
| Ôn tập | Ôn thẻ đến hạn | Thẻ hiện tại, số thẻ còn lại | Lật, chấm 3 mức, hoàn tác, thoát | F6 |
| Tổng kết phiên ôn | Phản hồi sau khi ôn | Số thẻ, tỷ lệ nhớ, streak | Ôn tiếp, về Today | F6 |
| Thẻ | Quản lý thẻ | Danh sách thẻ, tab "Chờ duyệt" | Sửa, duyệt, duyệt tất cả theo nguồn, xoá, tạm ngưng thẻ | F4, F5, F8 |
| Settings | Cấu hình | Thẻ mới/ngày, múi giờ, ngôn ngữ, chủ đề, API token | Đổi cài đặt, quản lý chủ đề, tạo/thu hồi token, xem hướng dẫn MCP, xuất dữ liệu, đăng xuất, xoá tài khoản | F5, F9 |
| Điều khoản và Quyền riêng tư | Công bố cách dùng dữ liệu | Nội dung tĩnh, 2 ngôn ngữ | Đọc, về màn trước | F1 |

**Trạng thái cần thiết kế cho mỗi màn:** trống (lần đầu), đang tải, lỗi, dữ liệu dài. Mọi màn có light/dark và đủ 2 ngôn ngữ. Màn Ôn tập và Today ưu tiên mobile.

## Quy tắc nghiệp vụ

### Loại thẻ

MVP chỉ làm thẻ hỏi–đáp (markdown, code block). Data model có `type` và `extra` để phase 2 thêm: hai chiều, cloze, gõ đáp án, trắc nghiệm, code.

### Lịch ôn

- **Thuật toán:** FSRS qua `ts-fsrs`, bật learning steps để thẻ Quên quay lại trong phiên
- **3 mức chấm:** Quên → Again, Mang máng → Hard, Nhớ rõ → Good (ẩn Easy)
- **Thẻ mới:** tối đa 20 thẻ/ngày, chỉnh trong Settings; thẻ đến hạn không giới hạn. Khi còn backlog thẻ đến hạn, tạm dừng thẻ mới
- **Ngày:** theo múi giờ người dùng, ngày mới bắt đầu lúc 04:00
- **Streak:** số ngày liên tiếp có ít nhất 1 lượt ôn. Ngày không có thẻ đến hạn không làm đứt streak, cũng không cộng thêm
- **Tạm ngưng thẻ:** thẻ bị tạm ngưng không xuất hiện trong lịch ôn cho tới khi bật lại
- **Phiên ôn:** lô 50 thẻ, ưu tiên thẻ quá hạn lâu nhất; phiên kết thúc khi hết thẻ
- **Tỷ lệ nhớ:** chỉ tính lượt chấm đầu tiên của mỗi thẻ trong phiên
- **Hoàn tác:** khôi phục lượt chấm gần nhất
- **Lịch sử:** mọi lượt chấm lưu vào `reviews`, kèm trạng thái FSRS trước khi chấm

### MCP server (slice S6)

App cung cấp MCP server để Claude đọc dữ liệu và tạo thẻ. Việc sinh thẻ do Claude của người dùng đảm nhận, nên app không gọi Claude API.

- **Endpoint:** `/api/mcp`, Streamable HTTP, chạy cùng codebase web
- **Xác thực:** personal API token tạo trong Settings, gửi qua `Authorization: Bearer <token>`; lưu dạng hash, thu hồi được
- **Client:** Claude Code và các client cấu hình được header. Connector trên claude.ai cần OAuth, để phase 2; người dùng không có client phù hợp thì tạo thẻ thủ công
- **Phạm vi:** mỗi token chỉ truy cập dữ liệu của chủ token

| Tool | Input | Kết quả |
| --- | --- | --- |
| `search_resources` | `query`, `topic?`, `status?` | Nguồn khớp theo tiêu đề, URL, ghi chú (id, tiêu đề, chủ đề, %) |
| `get_resource` | `resource_id` | Thông tin nguồn, ghi chú, thẻ đã có |
| `add_resource` | `url`, `topics?`, `status?` | Nguồn mới tạo |
| `add_note` | `resource_id`, `content` | Ghi chú mới trong nguồn, không đụng ghi chú đang sửa |
| `create_cards` | `resource_id?`, `cards[{type, front, back}]` | Thẻ ở trạng thái **chờ duyệt** |
| `get_study_stats` | `range?` | Streak, số thẻ đến hạn, tỷ lệ nhớ |

**Quy tắc an toàn:** MCP không có tool xoá. Thẻ do MCP tạo luôn phải được duyệt trong app. Mọi tool dùng chung tầng `domain` nên áp dụng cùng phân quyền, rate limit và hạn mức. Phản hồi của tool không dịch theo ngôn ngữ giao diện.

## Data model sơ bộ

Mọi bảng có `user_id`. Tầng `domain` là lớp phân quyền chính: mọi hàm truy vấn bắt buộc nhận `userId`, và có test chặn đọc chéo giữa hai user. RLS bật trên mọi bảng nhưng không có policy, để khoá đường truy cập qua API công khai của Supabase. Liên kết giữa các bảng dùng khoá ngoại ghép `(id, user_id)`, nên database từ chối dòng trỏ sang dữ liệu của user khác.

| Bảng | Field chính | Ghi chú |
| --- | --- | --- |
| `topics` | id, user_id, name, color | Chủ đề người dùng tự tạo |
| `resources` | id, user_id, url, normalized_url, title, type, thumbnail_url, status, progress (0–100), created_at, updated_at | type: article / video / course / doc / other; status: want / learning / done; `url` giữ link gốc; cảnh báo trùng theo user_id + normalized_url |
| `resource_topics` | user_id, resource_id, topic_id | Nhiều–nhiều |
| `notes` | id, user_id, resource_id, content_md, created_at, updated_at | Một nguồn có nhiều ghi chú |
| `cards` | id, user_id, resource_id?, type, front, back, extra (jsonb), status, source, created_at, deleted_at | status: pending / active / suspended; source: manual / mcp; deleted_at: xoá mềm thẻ đã ôn |
| `card_schedules` | card_id, user_id, due, stability, difficulty, learning_steps, reps, lapses, state, last_review | Trạng thái FSRS, tách khỏi nội dung thẻ |
| `reviews` | id, card_id, user_id, rating, reviewed_at, elapsed_days, scheduled_days, idempotency_key, prev_schedule (jsonb) | Lịch sử chấm; idempotency_key chống trùng, prev_schedule để hoàn tác |
| `user_settings` | user_id, new_cards_per_day (20), timezone, locale | |
| `api_tokens` | id, user_id, name, token_hash, last_used_at, revoked_at | Cho MCP |

**Quan hệ:** topic ⟷ resource (nhiều–nhiều) · resource → notes, cards (một–nhiều) · card → card_schedule (một–một), reviews (một–nhiều).

## Non-functional

- **Auth:** Supabase Auth, chỉ đăng nhập Google ở MVP
- **Phân quyền:** ở tầng `domain`; bật RLS không policy trên mọi bảng; API token lưu hash; không lưu nội dung trang của link, chỉ metadata
- **Nền tảng:** web responsive; màn Ôn tập và Today thiết kế mobile-first
- **Hiệu năng:** chuyển thẻ dưới 200 ms: đặt server ở Singapore, tải trước lô thẻ, gửi lượt chấm nền qua Route Handler với hàng đợi trong `localStorage` và khoá chống trùng
- **Trải nghiệm:** phím tắt khi ôn (Space lật, 1/2/3 chấm, Z hoàn tác); dark mode; ghi chú tự lưu
- **Ngôn ngữ:** tiếng Việt và tiếng Anh qua `next-intl`, không đưa ngôn ngữ vào URL; lưu ở `user_settings.locale` và cookie. Dịch giao diện, thông báo lỗi, trang Điều khoản và hướng dẫn MCP; không dịch nội dung người dùng. Có test báo lỗi khi hai file ngôn ngữ lệch key
- **Chống lạm dụng:** khi tải link chỉ nhận http và https, chặn IP nội bộ, kiểm tra lại sau mỗi lần redirect, timeout 5 giây, đọc tối đa 1 MB. Rate limit theo user, lưu bằng Postgres. Hạn mức mỗi tài khoản: 2.000 nguồn, 10.000 thẻ, 100 KB mỗi ghi chú
- **Tìm kiếm:** trong tiêu đề, URL và ghi chú, không phân biệt dấu tiếng Việt (`unaccent` và `pg_trgm`); Library và MCP dùng chung một hàm
- **Dữ liệu người dùng:** có trang Điều khoản và Quyền riêng tư, xoá tài khoản và xuất JSON
- **Không yêu cầu:** offline

### Tech stack

| Phần | Lựa chọn |
| --- | --- |
| Web + API | Next.js (App Router, TypeScript), Server Actions và Route Handlers |
| UI | Tailwind CSS + shadcn/ui |
| Database, Auth | Supabase (Postgres, Auth) |
| ORM | Drizzle |
| Lịch ôn | `ts-fsrs` |
| MCP | Route `/api/mcp` dùng MCP TypeScript SDK |
| Đa ngôn ngữ | `next-intl` |
| Theo dõi lỗi | Sentry (gói miễn phí) |
| Test | Vitest (logic), Playwright (luồng chính) |

**Kiến trúc code:** logic nghiệp vụ (lịch ôn, streak, quyền) đặt trong tầng `domain` thuần TypeScript, dùng chung cho UI, Server Actions và MCP.

### Deploy

- **Vercel:** Next.js (gồm API và MCP endpoint), region Singapore, chạy trên `*.vercel.app`. Merge vào `main` thì deploy production; tắt preview deploy
- **Supabase Cloud:** một project cho production, region Singapore
- **Local:** Supabase CLI và Docker, `seed.sql` có sẵn 2 user để test đọc chéo. Đăng nhập test chỉ bật ở local; build production fail nếu cờ này đang bật
- **Migration:** lệnh `db:migrate:prod` chạy tay trước khi merge code: tự `pg_dump`, rồi migrate. Mỗi migration phải tương thích với code đang chạy; xoá cột thì tách thành 2 lần release
- **Sao lưu:** `pg_dump` hằng đêm, mã hoá, lưu 14 ngày trong GitHub Actions của repo private
- **Chi phí:** dùng gói miễn phí trước; MVP không thu tiền và không chạy quảng cáo. Chỉ nâng gói khi thực sự cần

## MVP

**MVP xong khi** thiết kế, S0–S5 và Settings tối thiểu chạy trên production. S6 (MCP) làm ngay sau đó.

| Trong phạm vi | Ngoài phạm vi (để sau) |
| --- | --- |
| Đăng ký, đăng nhập bằng Google | Đăng nhập magic link (khi có tên miền và SMTP riêng) |
| Thêm nguồn bằng link, tự lấy tiêu đề và ảnh | Tải lên PDF |
| Chủ đề tự tạo, gắn nhiều chủ đề cho một nguồn | Lộ trình học theo thứ tự |
| Trạng thái nguồn và tiến độ % | Ghi chú theo mốc thời gian video |
| Ghi chú markdown theo nguồn | Dùng offline |
| Thẻ hỏi–đáp, tạo thủ công | Các loại thẻ khác |
| Ôn tập theo lịch spaced repetition, hoàn tác lượt gần nhất | Import từ bookmark, Anki, Notion |
| Dashboard Today, tiến độ, streak | Chia sẻ thư viện, extension trình duyệt |
| Giao diện tiếng Việt và tiếng Anh | Nhắc ôn qua email hoặc push |
| Điều khoản, Quyền riêng tư, xoá tài khoản, xuất JSON | Landing page riêng |
| Chống SSRF, rate limit, hạn mức theo tài khoản | Thu phí, quảng cáo |
| MCP server (slice S6, ngay sau MVP) | Kết nối MCP qua OAuth; preview deploy, staging |

### Milestones

Thứ tự theo kit: thiết kế đủ 10 màn, rồi `/plan-arch`, rồi `/slice` từng phần. S0 làm song song với thiết kế. Ước tính với 1–2 giờ mỗi tối.

| Slice | Nội dung | Ước tính |
| --- | --- | --- |
| D — Thiết kế | Design system và prototype đủ 10 màn: trạng thái, light/dark, mobile | 5–6 tối |
| S0 — Nền tảng | Repo và bộ file kit, ghim Node và pnpm, Supabase local và seed, Google auth, schema, khung ngôn ngữ, Sentry, sao lưu, `db:migrate:prod`, deploy khung lên Vercel | 4 tối |
| S1 — Library | Thêm nguồn từ link an toàn, chống trùng, chủ đề, danh sách, bộ lọc, tìm kiếm, rate limit và hạn mức | 3–4 tối |
| S2 — Chi tiết nguồn | Nhiều ghi chú markdown tự lưu, tiến độ %, trạng thái, xoá nguồn | 2 tối |
| S3 — Thẻ | Tạo, sửa, tạm ngưng, xoá thẻ hỏi–đáp | 1–2 tối |
| S4 — Ôn tập | Phiên ôn với FSRS, learning steps, lô 50 thẻ, hàng đợi lưu nền, hoàn tác, phím tắt, tổng kết | 4 tối |
| S5 — Today và Settings | Dashboard, streak, Settings, chuyển ngôn ngữ, Điều khoản, xuất dữ liệu, xoá tài khoản | 3–4 tối |
| S6 — MCP (sau MVP) | API token, endpoint `/api/mcp`, 6 tool, tab "Chờ duyệt", "Duyệt tất cả" | 3 tối |

Tổng khoảng 25–30 tối, gồm 22–26 tối cho MVP và 3 tối cho S6. 2 tuần là mục tiêu mềm, không phải cam kết.
