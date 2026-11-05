# Learning Tracker

@AGENTS.md

## What this is

Web app cho người tự học: gom nguồn học, ghi chú và thẻ ôn vào một luồng, rồi ôn bằng spaced repetition. Người dùng chính là lập trình viên học song song với công việc; mỗi người chỉ thấy dữ liệu của mình.

## Sources of truth

- Spec: `SPEC.md`. Khi có quyết định mới về flow, dữ liệu hay phạm vi, cập nhật cả `SPEC.md` và PRD.
- PRD: https://claude.ai/artifact/Su4HPs68ZmL3RkB8cMyctc
- Design system và prototype: https://claude.ai/artifact/NYLS4XYntxLFmtp5snMb2o
- Ticket: Trello https://trello.com/b/builyI19/learning-tracker (Backlog, Đang làm, Review, Xong)

Prototype là bản giả lập để tham khảo UI và flow, không chép code của nó.

## Commands

Chạy `nvm use` trước; repo ghim Node 24 và pnpm qua corepack.

- Install: `pnpm install`
- Run: `pnpm dev` (cổng 3000)
- Test: `pnpm test` · E2E: `pnpm test:e2e`
- Lint: `pnpm lint` · Types: `pnpm typecheck` · Format: `pnpm format`
- Build: `pnpm build`

## Conventions

- Folder layout: `src/app` route, `src/components` UI, `src/components/ui` shadcn, `src/domain` logic nghiệp vụ thuần TypeScript, `src/lib` tiện ích
- Logic nghiệp vụ nằm trong `src/domain`, dùng chung cho UI, Server Actions và MCP
- Chỉ dùng token ngữ nghĩa trong `src/app/globals.css`, không viết mã màu trong component
- Khoảng cách là bội số của 4; UI có đủ tiếng Việt và tiếng Anh
- Test nằm cạnh code, tên theo mẫu "should … when …"; E2E nằm trong `e2e/`
- Commits: một dòng, `feat(): …` / `bugfix(): …` / `refactor(): …` / `test(): …`
- Branches: `feat/<short>` hoặc `fix/<short>`, merge qua pull request

## Workflow

- BA: no · QA: no. Ticket cùng `SPEC.md` là spec; test nằm trong plan được duyệt.
- Mỗi ticket bắt đầu ở plan mode: goal, branch, files, steps, tests. Chỉ code sau khi plan được duyệt.
- Trello không tự đóng card theo PR: dán link PR vào card và chuyển cột khi xong.

## Never

- Never edit code or cut a branch before the plan is approved
- Never push to main or force-push
- Never edit generated components in `src/components/ui`; wrap them instead
- Never reset or rewrite shared seed data; test on a throwaway copy
- Never skip or delete a failing test
- Never change CI configuration unless asked
- Never commit secrets or real `.env` files
