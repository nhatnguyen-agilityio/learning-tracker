# Learning Tracker

@AGENTS.md

## What this is

Web app cho người tự học: gom nguồn học, ghi chú và thẻ ôn vào một luồng, rồi ôn bằng spaced repetition. Người dùng chính là lập trình viên học song song với công việc; mỗi người chỉ thấy dữ liệu của mình.

## Sources of truth

- Spec: `SPEC.md`. Khi có quyết định mới về flow, dữ liệu hay phạm vi, cập nhật cả `SPEC.md` và PRD.
- PRD: https://claude.ai/artifact/Su4HPs68ZmL3RkB8cMyctc
- Design system và prototype: https://claude.ai/artifact/NYLS4XYntxLFmtp5snMb2o
- Ticket: Trello https://trello.com/b/builyI19/learning-tracker (Backlog, In Progress, Review, Done)

Prototype là bản giả lập để tham khảo UI và flow, không chép code của nó.

## Commands

Chạy `nvm use` trước; repo ghim Node 24 và pnpm qua corepack.

- Install: `pnpm install`
- Run: `pnpm dev` (cổng 3000)
- Test: `pnpm test` (cần `pnpm db:start`) · E2E: `pnpm test:e2e`
- Lint: `pnpm lint` · Types: `pnpm typecheck` · Format: `pnpm format`
- Build: `pnpm build`
- Database local: `pnpm db:start` · `pnpm db:status` · `pnpm db:stop` (cần Docker, xem README)
- Migration: `pnpm db:generate --name=<ten>` · `pnpm db:migrate`; schema nằm ở `src/lib/db/schema.ts`

## Conventions

- Folder layout: `src/app` route, `src/components` UI, `src/components/ui` shadcn, `src/domain` logic nghiệp vụ thuần TypeScript, `src/lib` tiện ích
- Logic nghiệp vụ nằm trong `src/domain`, dùng chung cho UI, Server Actions và MCP
- Chỉ dùng token ngữ nghĩa trong `src/app/globals.css`, không viết mã màu trong component
- Khoảng cách là bội số của 4; UI có đủ tiếng Việt và tiếng Anh
- Test nằm cạnh code, tên theo mẫu "should … when …"; E2E nằm trong `e2e/`
- Commits: một dòng, `feat(): …` / `bugfix(): …` / `refactor(): …` / `test(): …`
- Branches: `feat/<short>` hoặc `fix/<short>` tạo từ `dev`, merge vào `dev` qua pull request (`--base dev`)
- Deploy: chỉ PR `dev` → `main` khi đưa lên production; merge vào `main` là deploy

## Viết hàm domain mới

Tầng `domain` là lớp phân quyền duy nhất: app kết nối bằng role bỏ qua RLS, nên thiếu filter `userId` là lộ dữ liệu. Mẫu: `src/domain/resources.ts`.

- Hàm đụng bảng của user có chữ ký `(db: Db, userId: string, ...)`; `userId` lấy từ session ở tầng gọi, không lấy từ input của client
- Mọi câu truy vấn có `eq(table.userId, userId)` viết thẳng; `and(undefined)` của Drizzle là không có filter
- Dòng của user khác trả về như dòng không tồn tại (`null`), không báo lỗi riêng
- Chọn cột cần trả, không `select *`
- Không đọc `process.env`, cookie hay `next/*` trong `src/domain`; nếu tầng gọi dùng `"use cache"`, truyền `userId` qua tham số
- Mỗi hàm có test đọc chéo trong `*.db.test.ts`, dùng `describeWithDb` và `withTestDb` từ `src/lib/db/test-db.ts`. `withTestDb` luôn rollback, nên không đổi seed. CI không có database nên bỏ qua các test này: phải chạy `pnpm test` ở local trước khi mở PR

## Workflow

- BA: no · QA: no. Ticket cùng `SPEC.md` là spec; test nằm trong plan được duyệt.
- Mỗi ticket bắt đầu ở plan mode: goal, branch, files, steps, tests. Chỉ code sau khi plan được duyệt.
- Trello không tự đóng card theo PR: dán link PR vào card và chuyển cột khi xong.

## Never

- Never edit code or cut a branch before the plan is approved
- Never push to main or dev, and never force-push
- Never open a feature or fix PR straight into main
- Never edit generated components in `src/components/ui`; wrap them instead
- Never reset or rewrite shared seed data; test on a throwaway copy
- Never skip or delete a failing test
- Never change CI configuration unless asked
- Never commit secrets or real `.env` files
