# Learning Tracker

Gom nguồn học, ghi chú và thẻ ôn vào một luồng, rồi ôn bằng spaced repetition. Xem `SPEC.md`.

## Chạy dự án

```bash
nvm use
corepack enable pnpm
pnpm install
pnpm dev
```

Các lệnh khác nằm trong `CLAUDE.md`. Lần đầu chạy E2E cần `pnpm exec playwright install chromium`.

## Database ở local

Cần Docker Desktop đang chạy. Lần đầu sẽ tải các image của Supabase, mất vài phút.

```bash
pnpm db:start
pnpm db:status
pnpm db:stop
```

`pnpm db:start` tạo database và chạy `supabase/seed.sql` nếu database còn trống. `pnpm db:stop` giữ nguyên dữ liệu.

Tạo `.env.local` từ `.env.sample`, rồi lấy giá trị từ `pnpm exec supabase status -o env`:

| Biến trong `.env.local`         | Giá trị trong `supabase status` |
| ------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `API_URL`                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY`                      |
| `DATABASE_URL`                  | `DB_URL`                        |

Seed có 2 user chỉ dùng ở local, để test đọc chéo: `user-a@example.test` và `user-b@example.test`. Mật khẩu nằm trong `supabase/seed.sql`.

Muốn tạo lại database từ đầu thì tự chạy `pnpm exec supabase db reset`. Lệnh này xoá dữ liệu local nên hook không cho Claude chạy. Sau khi `seed.sql` thay đổi cũng cần chạy lệnh này.

### Test với database

`pnpm test` chạy cả các file `*.db.test.ts` trên database local, nên cần `pnpm db:start` trước; database chưa bật thì test fail. Mỗi test chạy trong một transaction rồi rollback, nên không để lại dữ liệu. Test chỉ chạy trên `127.0.0.1` hoặc `localhost`.

CI chưa có database nên bỏ qua các test này (`CI=true`), vì vậy cần chạy `pnpm test` ở local trước khi mở PR.

### Đổi schema

1. Sửa `src/lib/db/schema.ts`. Bảng mới phải có `.enableRLS()`, không tạo policy.
2. `pnpm db:generate --name=<ten_thay_doi>` sinh migration vào `supabase/migrations`.
3. Đọc lại file SQL vừa sinh.
4. `pnpm db:migrate` áp dụng vào database local.

Migration đã merge thì không sửa lại; thay đổi tiếp theo là một migration mới.

Container `analytics` đang tắt trong `supabase/config.toml` vì không khởi động được ở local và app không dùng đến.
