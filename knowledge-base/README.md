# Traids Assistant — Knowledge Base

Source content for the in-app help chatbot. This README is for the team and is **not** sent to the
bot.

## Files

| File | Sent to the bot for | Contains |
|---|---|---|
| `ASSISTANT_INSTRUCTIONS.md` | Every user | How the bot behaves: tone, scope, accuracy, safety, support contact |
| `COMPANY_KNOWLEDGE_BASE.md` | Company users | How the app works for companies |
| `SUBCONTRACTOR_KNOWLEDGE_BASE.md` | Subcontractors | How the app works for subcontractors |

Each request sends `ASSISTANT_INSTRUCTIONS.md` followed by **one** knowledge base, chosen from the
signed-in user's type. The whole file is sent every time (no search/RAG), and the API caches it so
repeat questions are cheap.

## Before go-live

Resolve every **`[CONFIRM: …]`** marker — replace it with the real answer, or delete the sentence.
The bot is told not to state `[CONFIRM]` facts, but they shouldn't ship. Find them with:

```bash
grep -rn "CONFIRM" knowledge-base/
```

## Editing rules

1. **Update the knowledge base in the same pull request as the feature change.** A stale entry
   makes the bot give wrong answers confidently.
2. **Quote the app exactly.** Screen names, tabs, buttons and messages in **bold** or "quotes",
   spelled exactly as users see them.
3. **Write for the user, not the code.** Describe what users see and do, not endpoints or fields.
4. **Keep the structure.** Each file has, in order: Quick facts → Glossary → topic sections (with
   question headings) → Troubleshooting → Known app issues → Not available yet. Add new questions to
   the matching topic section, and update Quick facts if a number or rule changes.
5. **Record UI bugs under "Known app issues"** with the correct answer, so the bot doesn't repeat
   what the screen wrongly says. Remove the note when the bug is fixed.
6. **List missing features under "Not available yet"** so the bot doesn't invent them.
7. **No dates, names or other values that change per request.** The files must be identical on
   every request or caching stops working. ("Last updated" is fine — it only changes when you edit
   the file.)

## Facts checked against the backend

These come from the backend code, not the screens. If the code changes, update them here and in
both knowledge bases:

| Fact | Where in the code |
|---|---|
| Timesheets auto-approve 18 hours after submission | `REVIEW_WINDOW_HOURS` in `timesheet.service.ts`; hourly job in `timesheet-scheduler.service.ts` |
| Unsubmitted weeks auto-submit Sunday 23:00 | `@Cron('0 0 23 * * 0')` in `timesheet-scheduler.service.ts` |
| Invoice created when all timesheets for a job+week are approved | `maybeGenerateInvoice` in `invoice.service.ts` |
| Company pays gross − CIS + 5% fee + card fee (UK 1.5%, EEA 2.5%, other 3.25%, + 20p) | `invoice.service.ts` |
| Invoice due in 30 days | `invoice.service.ts` |
| Subcontractor receives gross − CIS | `stripe-scheduler.service.ts` |
| CIS deducted at 30% for everyone (set at signup; no process changes it) | `signUp` in `subcontractor.service.ts` |
| Accepted applicant paid their proposed rate | `resolveHourlyRate` in `timesheet.service.ts` |
| Full jobs block applications/offers and auto-reject pending applications | `job-application.service.ts`, `offer.service.ts` |
| Withdrawals need completed Stripe verification; no fee — the full amount is paid out | `withdraw` in `subcontractor.service.ts` |
| Subcontractor Total Earnings and Wallet amounts = gross − CIS | `getDashboardStats`, `getWallet` in `subcontractor.service.ts` |
| Deleting a Pending job also deletes its offers, applications and compliance folder | `deleteJob` in `job.service.ts` |
| Password reset code expires in 10 minutes | `forgotPassword` in `auth.service.ts` |
| Sessions last up to 30 days | `JWT_EXPIRES_IN` |
| Top Rated = average ≥ 4.5 from ≥ 3 ratings; "Expiring soon" = within 30 days | `portfolio.service.ts` |
