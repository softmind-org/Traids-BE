# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev          # watch-mode dev server (default port 3000)
npm run build              # nest build -> dist/
npm run start:prod         # node dist/main
npm run format             # prettier over src/ and test/
npm test                   # jest (rootDir: src, testRegex .*\.spec\.ts$)
npm test -- job.service    # single test file / pattern
npm run seed:admin         # create the first SUPER_ADMIN (see scripts/seed-admin.ts)
```

Caveats in the current repo state:
- `npm run lint` fails — there is no `eslint.config.mjs`/`.eslintrc` even though eslint is a devDependency.
- `npm run test:e2e` fails — `test/jest-e2e.json` does not exist. `test/` only holds a manual socket.io test page (`socket-test.html`, `socket-test.js`).
- Only `src/app.controller.spec.ts` exists; the codebase is effectively untested.

Deployment: pushes to `main` trigger `.github/workflows/main.yml`, which runs on a self-hosted runner, copies `.env` from `/var/www/traids-envs/traids-env-be`, and restarts the app under PM2 (`traids-backend`). Work happens on `stage`.

## What this is

NestJS + MongoDB (Mongoose) REST + WebSocket API for a UK construction-trades marketplace: companies post jobs, subcontractors apply or receive offers, hours are logged on weekly timesheets, timesheets roll up into invoices, the company pays via Stripe, subcontractors are paid out minus CIS deductions, and CIS returns are filed with HMRC.

`src/main.ts` enables a global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` + `transform` — **every request body must have a DTO with `class-validator` decorators**, or extra properties will 400. CORS is `origin: '*'`. `@nestjs/swagger` is a dependency but `SwaggerModule` is never wired up in `main.ts`; the `@Api*` decorators on controllers are currently documentation-only.

## Authentication model

Three distinct user types share one JWT (`JwtModule` secret = `JWT_SECRET`, 24h expiry). The payload carries `sub` (the Mongo `_id`) and `userType`, which is `'company' | 'subcontractor' | 'admin'`. There is **no shared User collection** — `Company`, `Subcontractor`, and `Admin` are separate schemas with their own login paths (`POST /auth/login` with `userType` in the body for the first two; `POST /admin/auth/login` for platform admins).

Guards in `src/auth/guards/` compose on top of `JwtAuthGuard` (which verifies the token manually and sets `request.user`, despite extending `AuthGuard('jwt')`):
- `AdminGuard` — `userType === 'company'` (named "admin" for historical reasons; it means *company*, not platform admin).
- `SubcontractorGuard` — `userType === 'subcontractor'`.
- `PlatformAdminGuard` — `userType === 'admin'` and not deactivated.
- `HmrcCompanyGuard` / `HmrcSubcontractorGuard` — hit the DB and block the request unless `hmrcConnected` is true. These gate job posting and payout-related actions.

## Domain flow (the part that spans many files)

1. **Job** (`src/job`) — created by a company; `Status` PENDING → …; carries `trade`, `typeOfJob`, rate, and `noOfSubcontractors`.
2. **Two ways to fill it**: a subcontractor applies (`src/job-application`) and the company accepts, or the company sends a direct **Offer** (`src/offer`) which the subcontractor accepts/rejects. Both paths converge on assigning the subcontractor to `job.subcontractors`.
3. **Timesheet** (`src/timesheet`) — one per subcontractor per job per `weekNumber`. Subcontractor logs `DailyLog` entries → `submitTimesheet` → company approves. Statuses: DRAFT → SUBMITTED → APPROVED. `platformFeePercent` defaults to `0.05`.
4. **Invoice** (`src/invoice`) — generated per job+week once *all* timesheets for that week are approved (`maybeGenerateInvoice` guards on `areAllTimesheetsApprovedForWeek`; `invoiceNumber` is unique). Line items compute, per subcontractor: `cisDeduction = grossAmount * cisDeductionRate/100` (rate is 20 or 30, from the subcontractor doc) and `netPayable = gross - cisDeduction + platformFee` — the total the company pays.
5. **Payment** (`src/stripe`) — company pays the invoice via a PaymentIntent; subcontractors are paid out via Stripe Express connected accounts and `createTransfer`.
6. **CIS return** (`src/cis`) — monthly return per company aggregating deductions, submitted to HMRC. Note: `cis-return.service.ts` currently only exposes read + `markAsPaid`; the generation/submission methods are commented out, and the `@Cron`s in `cis-scheduler.service.ts` are commented out too.

### Schedulers (`src/scheduler`) drive most state transitions

State does **not** only move via HTTP — several transitions are cron-driven, so changes to timesheet/invoice status must account for these:
- `timesheet-scheduler` — hourly: auto-approves timesheets past their 18-hour company review window, then tries invoice generation for each affected job+week. Sundays 23:00: auto-submits DRAFT timesheets so a forgetful subcontractor can't block the week.
- `stripe-scheduler` — every 5 min: polls `PENDING_PAYMENT` invoices' PaymentIntents and, on success, runs subcontractor transfers (`payoutsProcessed` is the idempotency flag). Every 10 min: a second payout-related sweep.
- `job-scheduler` is an empty stub.

## Real-time layer

`SocketModule` is `@Global()`, so `SocketService`, `SocketGateway`, `CompanySocketService`, and `SubcontractorSocketService` can be injected anywhere without importing the module. The gateway authenticates via `handshake.auth.token`, keeps a `userId -> socketId[]` map (multiple connections per user), and auto-joins `user:${userId}` and `type:${userType}` rooms; chat additionally uses `conversation:${conversationId}` rooms with participant validation. Emit to users through the socket services rather than touching `server.emit` directly — `SocketService.*` also persists a `Notification` document alongside the emit. `REAL_TIME_CHAT_GUIDE.md` documents the client-side contract and event names.

## Shared services (`src/common`, `CommonModule`)

- `openai.service.ts` — **misleading name: it uses the Anthropic SDK** (`@anthropic-ai/sdk`, model `claude-sonnet-4-6`, `ANTHROPIC_API_KEY`). `validateDocumentType` and `extractExpiryDate` run vision checks on subcontractor compliance uploads (CSCS card, insurance, etc.) from `subcontractor.service.ts`. The `openai` npm package is installed but unused.
- `s3-upload.service.ts` — uploads to S3 (`AWS_REGION`, default `eu-west-2`) and returns public URLs.
- `email.service.ts` — SendGrid (`@sendgrid/mail`) for password resets and compliance sharing.

## HMRC integration (`src/hmrc`)

OAuth2 against `HMRC_BASE_URL`, with **separate token sets for companies and subcontractors** stored on their respective documents. Always fetch tokens through `getValidCompanyToken` / `getValidSubcontractorToken`, which refresh on expiry — don't read the stored access token directly.

## Conventions

- Module layout is consistent: `<feature>/<feature>.{module,controller,service}.ts`, `dto/`, `schema/`. Schemas use `@Schema({ timestamps: true })` classes with `Types.ObjectId` refs; each exports a `XDocument` type and `XSchema`.
- Enums live next to the schema they belong to (`Status`, `Trade`, `TimesheetStatus`, `InvoiceStatus`, …) — import from there rather than re-declaring string literals.
- Errors are thrown as `HttpException`/`ForbiddenException` etc. from services, not returned as error objects.
- Money is rounded with `parseFloat(x.toFixed(2))` at every step; keep that pattern so invoice line items and totals reconcile.
