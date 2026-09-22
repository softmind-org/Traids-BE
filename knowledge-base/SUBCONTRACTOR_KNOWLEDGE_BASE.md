# Traids — Subcontractor Knowledge Base

**Audience:** subcontractors (tradespeople and freelancers who find work and get paid through Traids).
**Covers:** the Traids web app, as seen by a subcontractor. Screen names, button labels and messages
are quoted exactly as they appear in the app.
**Last updated:** 22 September 2026

---

## 1. Quick facts

| Topic | Rule |
|---|---|
| Currency | British pounds (£) |
| Traids' fee | Paid by the **company**. Nothing is taken from your pay for it |
| What you receive | Your **gross pay minus CIS** (gross = hours × your hourly rate) |
| CIS rate | **30%** of your gross pay (section 8.6) |
| Your hourly rate on a job | The rate you **proposed** when applying, or the job's rate for an offer you accepted |
| Timesheet weeks | **Monday to Sunday**. Week 1 is the week the job starts |
| Which week you can log | **Only the current week**, today or earlier days |
| Automatic submission | At the end of each week, a week you've logged hours for but not submitted is submitted for you |
| Automatic approval | If the company doesn't approve your timesheet, it's **approved automatically 18 hours after you submit** |
| Invoice created | When **every** worker's timesheet on that job for that week is approved |
| Company pays | Each invoice is due **30 days** after it's created |
| Withdrawals | To the bank account you connected through Stripe. **No fee.** Usually **1–3 business days**. Your Stripe verification must be complete |
| Apply for a job | **Once** per job. A rejection is final for that job |
| Staying logged in | Up to **30 days**, or until you click **Logout** |

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Job Board** | Where companies' open jobs are listed for you to apply to |
| **Application** | Your request to work on a job, with your proposed rate and message |
| **Offer** | A job a company sends **directly to you**. You accept or reject it |
| **Booking** | A job you're working on or have been accepted for (in **My Bookings**) |
| **Timesheet** | Your hours for one week on one job |
| **Invoice** | The bill to the company for one job for one week, created from approved hours |
| **Wallet** | Your balance of money received, which you withdraw to your bank |
| **CIS** | The UK Construction Industry Scheme — tax deducted from your pay |
| **Stripe** | Traids' payments partner, which holds your bank details and sends your money |
| **Compliance documents** | Your insurance, tickets/CSCS card and certifications |
| **Portfolio** | Past projects you show on your profile |

**"Pending" means different things on different screens:**

| Where | "Pending" means |
|---|---|
| **My Bookings → Pending** tab | You've been accepted, but the job hasn't started yet |
| An **application** (Requested tab) | The company hasn't decided yet |
| **Dashboard → Pending Offers** | Offers waiting for your answer |
| An **invoice** (Payments) | The company hasn't paid it yet |
| **Wallet → Pending** balance | Money received but not yet cleared by Stripe, so it can't be withdrawn yet |

---

## 3. What Traids is

Traids is a construction platform run by **Traids Software Ltd (company number 17253498)**. It
connects **companies**, who post construction jobs and hire workers, with **subcontractors** —
skilled tradespeople and freelancers who find work, log their hours and get paid.

As a subcontractor you can:

- Browse the **Job Board** and apply for jobs
- Receive **direct job offers** from companies and accept or reject them
- Track all your work in **My Bookings**
- Log your daily hours in **Timesheets** and submit them to the company for approval
- See your invoices in **Payments**
- Withdraw money to your bank from your **Wallet**
- **Chat** with companies
- Keep your **compliance documents** (insurance, tickets/CSCS, certifications) up to date
- Build a **portfolio** of past work to attract companies

Using Traids is free for subcontractors — the platform fee is paid by the company.

---

## 4. Getting started

### 4.1 How do I create a subcontractor account?

1. Go to the Traids home page and click **"Join as Subcontractor"** or **"Signup"**.
2. On the "Choose Your Account Type" screen, pick **"Register as Subcontractor"**.
3. Complete the registration form. It has three steps, then a payments step.

A progress bar shows "Step X of 3" and how much is complete.

> **Important:** registration is not saved as a draft. If you press the browser's Back button after
> step 1, you'll see **"Leave Registration?"** — choosing **"Leave"** loses everything you entered.
> Choose **"Stay"** to keep going.

#### Step 1 — Personal Details

Every field is required.

| Field | Example | Notes |
|---|---|---|
| Full Name | Your Name | |
| Email | your.email@example.com | Must not already be registered |
| Password | | Use the Show/Hide toggle to check it |
| Primary Trade | Electrician, Plumber, Carpenter, Masonry | Choose from the list |
| Years of Experience | 5 | Number |
| Postcode | SW1A 1AA | |
| City Location | London | |
| Hourly Rate (£) | 45 | Number |

Click **"Save & Continue"**. The app checks your email with the server first (the button shows
"Checking..."). If the email is already used you'll see **"Email already in use."**

#### Step 2 — Qualifications & Documents

You must upload three documents, and give each one an expiry date:

| Document | Expiry date field |
|---|---|
| Insurance Documents | Insurance Expiry Date |
| Tickets/CSCS Card | Tickets Expiry Date |
| Certifications | Certification Expiry Date |

- Accepted files: **PDF, JPG or PNG**, up to **10MB** each.
- Tip from the app: *"Use your phone to snap a photo of your CSCS card or certificates."*
- When you add a file, the app **scans it automatically** ("Uploading & scanning document...") and
  tries to read the expiry date for you. If it finds one, the date fills in by itself — you can still
  change it.
- Expiry dates must be **today or in the future**.

Common messages:

| Message | What to do |
|---|---|
| `"<file>" exceeds the maximum allowed size of 10MB.` | Use a smaller file or a lower-resolution photo |
| `"<file>" is not a supported file type…` | Only PDF, JPG or PNG are accepted — not videos or other formats |
| "Invalid document. Please upload the correct file." | The scan didn't recognise it as the right kind of document. Upload the correct one |
| "Document scanning is temporarily unavailable. Your file has been accepted — please enter the expiry date manually." | Your file is fine — just type the expiry date yourself |
| "Failed to upload … document. Please remove the file and try again." | Remove the file with the X and add it again |

A failed upload is not retried automatically — remove it and add it again.

#### Step 3 — Profile Setup (optional)

- **Profile Image**
- **Professional Bio** — tell companies about your experience and specialties
- **Work Examples**

Click **"Submit Registration"**. If something is wrong, a red box lists the problems ("There are N
validation errors" — click **"Show details"** to see them).

When registration succeeds, **your account is created and you are signed in automatically** — you
don't need to log in again.

#### Step 4 — Set Up Payments (bank account)

You'll see **"Account Created!"** and a checklist. The last item, **Bank Verification**, is required
so you can be paid.

- Click **"Continue to Bank Setup"**. You'll be taken to **Stripe**, our secure payments partner, to
  connect your bank and verify your identity. It takes about 3 minutes.
- *Why is this needed?* UK law requires identity verification for payments. This is handled by
  Stripe — **Traids never sees your bank details.**

When Stripe sends you back, you'll see **"You're all set!"**. Click **"Go to Dashboard"**.

> Finish every step Stripe asks for before you leave. If verification isn't complete, you **can't
> withdraw money** from your Wallet, and it **can't be resumed from the app** later — you'd need to
> contact Traids support (section 8.4).

### 4.2 How do I log in?

1. Click **"Login"** on the home page.
2. On **"Choose Your Account Type"**, pick **"Login as Subcontractor"**.
3. Enter your **Email** and **Password** and click **"Login"**.

> **"I can't log in with the right password."** Make sure you chose **Login as Subcontractor**, not
> Login as Company. The account type is chosen on that first screen — the login form has no switch.
> Go back and choose the other card.

There is no "Remember me" option and no Google sign-in.

### 4.3 How long do I stay logged in?

You stay logged in — even after closing the browser — for up to **30 days**, or until you click
**Logout**. When your session ends you'll be sent back to the account type screen and will need to log
in again.

Logging out in one browser tab logs you out of your other open tabs within a few seconds.

> On a shared or public computer, always click **Logout** when you're finished.

### 4.4 How do I log out?

Click your **name/profile picture** in the top-right corner and choose **"Logout"**.

### 4.5 I forgot my password

1. On the login screen click **"Forgot Password?"**.
2. Enter your email and click **"Reset Password"**. (If asked, choose your account type:
   subcontractor.)
3. We email you a **6-digit code**. Enter it on the "Two-Step Verification" screen. The code expires
   after **10 minutes**.
   - Didn't get it? Check spam, then click **"Resend it"**.
4. Choose a new password — **at least 8 characters**, and both boxes must match.
5. You'll see **"Password Reset Successfully!"** Click **"Continue"** and log in.

Messages you may see: "Invalid or expired OTP. Please try again." (request a new code),
"Password must be at least 8 characters long", "Passwords do not match".

### 4.6 How do I change my password while logged in?

Go to **Settings** (profile menu → Settings) → **Account Security**. Enter a **New Password** and
**Confirm Password** (at least 8 characters, must match), then click **"Save Changes"**. Leave both
boxes blank to keep your current password.

---

## 5. Finding your way around

The top menu has:

| Menu item | What it's for |
|---|---|
| **Dashboard** | Overview: earnings, offers, timesheets, recommended jobs, active bookings |
| **Job Board** | Browse and apply for jobs |
| **Chats** | Messages with companies |
| **My Bookings** | Offers, applications and all your jobs |
| **Timesheets** | Log hours and submit them |
| **Payments** | Your invoices |
| **Wallet** | Your balance and withdrawals |
| **Earnings** | Earnings summary |

On a phone or small screen these are in the **menu (☰)** button.

Top right: the **notification bell**, and your **profile menu** with **Settings**, **Profile
Overview** and **Logout**.

If you open a page meant for companies you'll see "You don't have access to this page." and be sent
back to your dashboard.

---

## 6. Dashboard

Shows **"Welcome Back, <your name>"** and:

- **Total Earnings** — what you've been paid from invoices
- **Pending Offers** — offers waiting for your answer
- **Pending Timesheets**
- **Profile Completion** — how complete your profile is. A complete profile helps companies trust
  you.
- **Recommended for You** — up to 3 open jobs in your trade. Jobs you've already applied for aren't
  shown. Click **"View All Jobs"** to go to the Job Board.
- **Active Bookings** — up to 3 jobs currently in progress. Click **"View All"** for My Bookings.

To apply for a recommended job, open it from the **Job Board** (section 7).

---

## 7. Finding and applying for jobs

### 7.1 How do I find jobs?

Go to **Job Board** ("Browse verified jobs and apply instantly").

- **Search** — type in "Search jobs & keywords...". Results appear as you type.
- **Filters** (left side):
  - **Trade Type** — Electrician, Plumber, Carpenter, Masonry (tick one or more)
  - **Max Hourly Rate** — slider from £30 to £100 (£100 means no limit)
  - **Location** — type a place

> **Note:** when you type in the search box, the filters are ignored and only your keywords are used.
> Clear the search box to use the filters again.

Each job card shows the company, job title, hourly rate, start date, site address, trade and job
type. Jobs you've already applied for show an **"Applied"** badge. Click **"View Job"** for full
details.

If nothing shows: *"No jobs found. Try adjusting your filters."* Try fewer filters or a higher rate.

The Job Board only lists jobs that haven't started and still need workers. Once a job has all the
workers it needs, it disappears from the board.

### 7.2 What's on a job's page?

- **Job Description**
- **Site maps & Documents** — drawings or files from the company (open in a new tab)
- **Job Overview** — Rate (£/hour), Duration (weeks), Start Date, Location
- **About the Company** — name, email, phone, address

### 7.3 How do I apply for a job?

1. Open the job from the **Job Board** and click **"Apply Now"**.
2. The **"Apply for Job"** form opens. Your trade credentials, qualifications and insurance are
   **attached automatically** from your verified profile.
3. Fill in:
   - **Full Name** — filled in for you
   - **Proposed Hourly Rate** — required. Pre-filled with the job's rate; you can propose a different
     one. **If you're accepted, this is the rate you're paid.**
   - **Message** — required. Tell the company why you're a good fit
   - **Documents** — optional. PDF, JPG or PNG, up to 10MB each, up to 3 files
4. Click the **"Send Offer"** button to submit your application.

You'll see **"Application Sent Successfully — Wait for the company to review your application."**
Your application then appears in **My Bookings → Requested**, and the job shows an **"Applied"**
badge on the Job Board.

### 7.4 Can I apply more than once, or apply again after being rejected?

**No.** You can apply for each job **only once**. After you apply, the button on that job becomes
disabled and shows your application status:

| Button shows | Meaning |
|---|---|
| **Applied — Awaiting Response** | The company hasn't decided yet |
| **Application Accepted** | You got the job |
| **Application Rejected** | The company didn't choose you — this is final for that job |
| **Already Applied** | You've applied (status not shown) |

If you try to apply again you'll see: *"You have already applied for this job (application status:
…)."*

If a company has **already sent you an offer** for that job, you can't apply — go to **My Bookings →
Offers** and respond to the offer instead.

### 7.5 Why was my application rejected when the company didn't reject me?

When a job gets all the workers it needs, any other pending applications for it are automatically
marked **Rejected**. This doesn't mean the company reviewed and turned you down — the positions were
simply filled.

### 7.6 "This job has already been fully assigned" / "no longer accepting applications"

The job has all the workers it needs, or it has already started. You can't apply for it any more.

### 7.7 Can I change or withdraw my application?

No. Once sent, an application can't be edited or withdrawn. If something's wrong, message the company
— for example from the job's **About the Company** details — or wait for their decision.

### 7.8 Can I save jobs to look at later?

Not at the moment. There's no saved-jobs feature for subcontractors yet.

---

## 8. Getting paid

### 8.1 How and when do I get paid?

1. **You log hours and submit** your timesheet for the week. If you forget, a week you've logged hours
   for is **submitted automatically at the end of the week**.
2. **The company approves it.** If they don't, it's **approved automatically 18 hours after you
   submitted it**.
3. **An invoice is created** once every worker's timesheet on that job for that week is approved —
   usually early in the following week at the latest.
4. **The company pays the invoice.** Each invoice is due within **30 days**. Traids can't pay you
   before the company pays.
5. **The money is sent to your Stripe account automatically** and appears in your **Wallet**, first
   as **Pending**, then **Available** once Stripe clears it.
6. **You withdraw** it to your bank account (section 8.4). It usually arrives within **1–3 business
   days**.

If an invoice hasn't been paid, message the company in **Chats**. Traids can't make a company pay
sooner.

### 8.2 How much will I receive?

**You receive: gross pay − CIS deduction.**

- **Gross pay** = hours worked × your hourly rate on that job
- **CIS deduction** = gross pay × 30%

**Example** — 40 hours at £25/hour with CIS at 30%:

| Line | Amount |
|---|---|
| Gross pay (40 × £25) | £1,000.00 |
| CIS deduction (30%) | −£300.00 |
| **You receive** | **£700.00** |

Traids' **5% platform fee is paid by the company** on top of this — it's **not** taken from your pay.

### 8.3 Payments page

**Payments** ("Financial ledger and invoice tracking") shows:

- **Total Earned**, **Available Balance** and **Pending Balance**
- A table of your invoices: Invoice #, Company, Gross Amount, CIS (%), CIS Amount, Net Payable,
  Status
- Status is **Paid** (green) or **Pending** (orange — the company hasn't paid yet)
- Use the **Search** box to find an invoice by number, company or job

### 8.4 Wallet and withdrawals

**Wallet** shows your **Available Balance** and **Pending** amount, plus your **Transaction
History** (each payment with its invoice, job, week and company).

- **Available** — money you can withdraw now
- **Pending** — money that's been sent to you but is still being cleared by Stripe. It moves to
  Available automatically

**How do I withdraw money?**

1. Click **"Withdraw Funds"**.
2. Enter the amount. It can't be more than your available balance ("Amount exceeds available
   balance").
3. Click **"Withdraw"**, check the bank account shown, and click **"Confirm Withdrawal"**.
4. You'll see **"£X Withdrawn"** with a timeline.

Traids doesn't charge a withdrawal fee — the full amount you enter is sent to your bank.

Money is sent to the bank account you connected through Stripe. It usually arrives within **1–3
business days**.

**Can't withdraw?** Check that:

- You have an **Available** balance (Pending money can't be withdrawn yet)
- Your **Stripe verification is complete**. If it isn't, withdrawals are blocked. An unfinished
  Stripe setup can't be resumed from the app yet — contact Traids support.

### 8.5 How do I add or change my bank account?

Your bank account is connected through **Stripe** during registration (the "Set Up Payments" step).
There isn't currently a screen in the app to change your bank details afterwards — please contact
Traids support if you need to change them.

### 8.6 What is CIS, and why is 30% deducted?

The **Construction Industry Scheme (CIS)** is a UK tax scheme where tax is deducted from payments to
subcontractors. On Traids:

- CIS is deducted at **30%** of your gross pay for all subcontractors.
- The reduced **20%** rate for subcontractors registered for CIS with HMRC isn't available on Traids
  yet, and neither is **gross payment status** (0% deduction).
- Each invoice shows the CIS rate and amount.

For questions about your own tax, what you owe or how to register for CIS, speak to an accountant or
HMRC — Traids can't give tax advice.

---

## 9. My Bookings

**My Bookings** ("Manage your assigned and ongoing jobs") has five tabs. Each tab shows a count.

| Tab | What it contains |
|---|---|
| **Offers** | Jobs a company has offered you directly — waiting for your answer |
| **In Progress** | Jobs currently underway. These are the jobs you log hours for in Timesheets |
| **Pending** | Jobs you've accepted that haven't started yet |
| **Completed** | Finished jobs |
| **Requested** | Every job you've applied for, with the status of each application |

### 9.1 How do I accept or reject a job offer?

Open **My Bookings → Offers**. Each offer shows the company, job, rate ("Quote/Bid"), the job
description and any **Project Documents** (click the eye icon to view).

- **"Accept Offer"** — accepts the job. It moves to the **Pending** tab. You're paid the job's hourly
  rate.
- **"Reject"** — declines the offer.

> **Rejecting happens immediately — there's no "are you sure?" step.** Check before you click.

You'll also get a pop-up **"New Offer Received!"** when a company sends you an offer.

If the job has already been filled by the time you accept, you'll see *"Job has already reached
maximum worker capacity"* and the offer can't be accepted.

### 9.2 How do I see the jobs I've applied for?

Open **My Bookings → Requested**. It lists every application, newest first, with a status:

| Status | Meaning |
|---|---|
| **Pending** (orange) | Waiting for the company to decide |
| **Accepted** (green) | You got the job — it will also appear in Pending / In Progress |
| **Rejected** (red) | Not successful (including when the job was filled by others) |

Each card shows when you applied. Click a card to open the job.

If empty: *"You haven't applied for any jobs yet."*

### 9.3 What's the difference between Pending and In Progress?

- **Pending** — you've been accepted but the company hasn't started the job yet.
- **In Progress** — the company has started the job. You can now log hours for it in
  **Timesheets**.

The job moves to In Progress when the **company** clicks Start Job — not automatically on the start
date. If it's past the start date and still Pending, message the company.

### 9.4 How do I message the company about a booking?

Click a booking card to open its details, then click **"Message"**. Type your message (you can
**Attach** files up to 10MB each) and click **"Send Message"**. You'll see **"Message Sent!"** — the
conversation continues in **Chats**.

---

## 10. Timesheets

Timesheets are how you record the hours you work and get paid for them.

### 10.1 How do I log my hours?

1. Go to **Timesheets** ("Log your work and submit for approval").
2. Under **Select Project**, choose the job. Only **In Progress** jobs appear.
3. The **Project Progress** tracker shows the job's weeks. The **current week** is marked
   **"Current"** and opens automatically.
4. Under **"Log Daily Hours — Week N"**, find the day and click **"Log Hours"**.
5. Enter your **Check In** and **Check Out** times (they start at 09:00 and 17:00) and click
   **"Submit"** to save that day.

The hours for that day are calculated automatically and shown as a green badge (e.g. "8h"). Click
**"Edit"** to change a day you've already logged.

> There's no separate field for breaks — just enter your check-in and check-out times. A check-out
> earlier than check-in is treated as an overnight shift.

### 10.2 Which days can I log?

You can log or edit a day only when **all** of these are true:

- It's in the **current week** of the job
- It's within the job's start and end dates
- It's **today or earlier** — you can't log future days
- The week hasn't already been submitted or approved

You can log **any past day in the current week**, not just today — the hours are saved against the
day you pick.

If the button is greyed out, hover over it: *"Only the current week can be logged"* or *"This day
hasn't happened yet."*

### 10.3 How are the weeks worked out?

Weeks run **Monday to Sunday**. **Week 1** is the week the job starts in, and the weeks continue until
the job's end date. So a job starting on a Wednesday has a short first week, and the last week only
shows days up to the end date.

### 10.4 Can I log hours for a previous or future week?

No. **Only the current week can be logged and submitted.** Past and future weeks are **view only**
— you can open them to check your hours, but not change them.

> **Log your hours during the week.** Anything you've logged is submitted for you automatically at
> the end of the week, but days you didn't log can't be added once the week is over.

### 10.5 How do I submit my timesheet?

The **SUBMISSION Summary** on the right shows **Total Hours Worked**, **Hourly Rate**, **Gross
Amount** and **Total Payable**.

1. Click **"Submit Invoice"**.
2. Check the totals and click **"Yes, Sure"**.
3. You'll see **"Timesheet & Invoice Sent"**.

This sends your hours to the company for approval. Despite the message, the **invoice is created
later** — once the company has approved every worker's timesheet for that week (section 8.1).

The **"Submit Invoice"** button only works when you're on the current week, have logged at least one
day, and haven't submitted yet. If it's greyed out, the reason is shown under it:

| Message | Meaning |
|---|---|
| "Log at least one day before submitting." | Log some hours first — you can't submit an empty week |
| "Only Week N can be submitted." | You're viewing a different week — go to the current one |
| "This job ended on <date>." | The job has finished |
| "This job starts on <date>." | The job hasn't started yet |
| "This project has no active week right now." | Today is outside the job's dates |

### 10.6 What if I forget to submit?

If you've logged at least one day that week, your timesheet is **submitted automatically at the end
of the week**, and the company sees it on Monday morning. You don't need to do anything. Once
submitted, the week is locked.

### 10.7 What do the timesheet statuses mean?

| Status | Meaning |
|---|---|
| **Draft** | Hours are saved but not submitted — you can still edit |
| **Submitted — Awaiting Approval** | Sent to the company. The week is locked |
| **✓ Approved — Payment Pending** | Approved by the company, or automatically after 18 hours. Payment follows once the company pays the invoice |

### 10.8 How long does approval take?

Companies have **18 hours** to review a submitted timesheet. If they haven't approved it by then,
it's **approved automatically**.

### 10.9 I made a mistake on a submitted timesheet

A submitted week is locked and can't be edited from the app. Message the company in **Chats** straight
away — before it's approved — and contact Traids support if it can't be sorted out.

### 10.10 "Job completed" / "This job starts on…"

- **"Job completed on <date>."** — the job has finished, so no more hours can be logged or
  submitted. Your earlier weeks stay visible for your records.
- **"This job starts on <date>."** — you can start logging once the job begins.

### 10.11 I don't see any job in Timesheets

You'll see **"No Active Jobs"**. Only jobs that are **In Progress** appear. Once a company accepts
you and **starts** the job, it will show up here.

---

## 11. Chats (messaging)

Go to **Chats** to message companies.

- The list on the left shows your conversations. Use **"Search conversations..."** and the **All** /
  **Unread** tabs.
- Click a conversation to open it. Opening it marks it as read.
- Type in **"Type a message..."** and press **Enter** or click **"Reply"** to send. **Shift+Enter**
  adds a new line.
- **Attachments:** click the paperclip. You can send **images, PDF, DOC and DOCX** files up to
  **10MB** each. Larger files are skipped: *"… exceeds the 10 MB limit and was not attached."*
- New messages arrive instantly, and you'll get a "New message from…" notification.

**How do I start a chat with a company?** You can't start a brand-new chat from the Chats page.
Chats start when a company messages you, or when you click **"Message"** on one of your bookings
(section 9.4).

**Formatting:** the Bold / Italic / list buttons only change how the text looks while you type —
messages are delivered as plain text.

**Deleting a message:** hover over it, click **"…"** → **"Delete"**, then choose **"Delete for me"**
or **"Delete for Everyone"**. You have 5 seconds to **Undo**.

> Deleting currently only removes the message from **your own screen**. The other person may still
> see it, and it may reappear if you refresh the page.

---

## 12. Notifications

The **bell** in the top-right shows a red count of unread notifications ("9+" if more than 9).

- Click the bell to see them. Click **"Mark all as read"** to clear them all.
- Click a notification to go straight to the related screen:

| Notification about | Takes you to |
|---|---|
| A job | That job's page (or the Job Board) |
| An offer | That job's page (or My Bookings) |
| An application | That job's page (or My Bookings) |
| A message | Chats |
| Compliance / documents | Settings & Profile |

- **"View All Notifications"** shows older, already-read ones too.

You may also see pop-ups at the top right, which close after 10 seconds:

- **"New Offer Received!"** — a company sent you an offer. Check **My Bookings → Offers**.
- **"Application Accepted!"** — a company accepted your application.
- **"Your application was rejected for: <job>"**
- **"Job assigned: <job>"**

---

## 13. Your profile and settings

Open your **profile menu** (top right) → **"Settings"**.

> Changes on this page are saved only when you click **"Save Changes"** at the top — except removing
> your photo, which happens immediately.

### 13.1 Profile Details

- **Photo** — click **"Upload Photo"** (JPG, PNG or WEBP; square recommended, up to 5MB). Click
  **"Save Changes"** to keep it.
- **Remove photo** — click **"Remove"**. This happens **immediately**. A placeholder is shown instead.
- **Full Name**, **Trade Type**, **Hourly Rate**, **About** (your bio)

Your **Hourly Rate** here is the rate companies see on your profile. Changing it doesn't change the
rate on jobs you've applied for or been accepted for — each job uses the rate you proposed when
applying, or the job's rate for an accepted offer.

### 13.2 Availability

Turn the **"Available"** toggle on or off to show companies whether you're available for work. It
shows as **Available** / **Unavailable** on your profile. Save with **"Save Changes"**.

### 13.3 Documents (compliance)

Upload new **Insurance**, **Tickets** and **Certification** documents — PDF, JPG or PNG, up to **5MB**
each, up to 3 per type. Your existing documents are listed under each box. Click **"Save Changes"**
to upload.

### 13.4 Notifications

- **Job Alerts** — get notified when new jobs match your trade
- **Timesheet Reminders** — weekly reminders to log your hours

Both are on by default.

### 13.5 Can I change my email?

Not in the app. Contact Traids support.

### 13.6 How do I delete my account?

Account deletion isn't available in the app yet — it's coming in a future update. If you need your
account closed before then, contact Traids support.

---

## 14. Profile Overview, portfolio and compliance

Open your **profile menu** → **"Profile Overview"** to see your profile the way companies do.

### 14.1 Compliance Center

Shows your three compliance documents — **Public Liability Insurance**, **Site Tickets** and **Trade
Certifications** — with their status:

| Status | Meaning |
|---|---|
| ✓ with a date | Valid until that date |
| ✓ "Valid (No Expiry)" | Uploaded, with no expiry date |
| "Expiring soon...." (red) | Expires within **30 days** — renew it soon |
| ✗ "Expired" | Upload a new one in **Settings → Documents** |
| ✗ "Not provided" | Upload it in **Settings → Documents** |

Click **"Download Copy"** to open a document.

> Keeping your documents valid matters — companies check compliance before and during a job.

### 14.2 Portfolio — how do I add my past work?

1. On Profile Overview, click **"Upload New Work"**.
2. Fill in:
   - **Project Title** (up to 150 characters) — required to publish
   - **Specialty Category** — Electrical Installations, Plumbing & Heating, Carpentry & Joinery,
     Masonry & Bricklaying — required to publish
   - **Brief Overview** (up to 300 characters) — required to publish
   - Client / Company Name, Project Location, Duration, Cost Range (£), Completion Date — optional
   - **Project photos** — JPG, PNG or WEBP, up to **5MB** each, up to **10** photos. At least one is
     required to publish
   - **Detailed Project Description** (up to 5000 characters)
3. Click:
   - **"Submit for Review"** to publish it. It appears on your profile **straight away** — there's no
     review step.
   - **"Save as Draft"** to keep it private.

If something required is missing when you publish, the app lists the missing fields.

> Portfolio projects **can't be edited or deleted** in the app yet, and a draft **can't be reopened**
> to finish it. Fill in everything you need before you click **"Submit for Review"**.

### 14.3 Reviews and "Top Rated"

**Total Reviews** shows ratings (1–5 stars) and comments from companies you've worked with. Companies
can rate you once per job, after approving your hours.

The **"Top Rated"** badge appears when your average rating is **4.5 or higher from at least 3
ratings**.

---

## 15. Troubleshooting

| Problem | Answer |
|---|---|
| Can't log in | Make sure you picked **Login as Subcontractor**. Use **Forgot Password?** if needed |
| "You don't have access to this page." | That page is for companies. You're sent back to your dashboard |
| Logged out unexpectedly | Your session expired (after up to 30 days) or you logged out in another tab. Log in again |
| Apply button is greyed out | You've already applied for that job — check **My Bookings → Requested** |
| Can't apply: "fully assigned" | The job has all the workers it needs (section 7.6) |
| Rejected but the company didn't reject me | The job was filled (section 7.5) |
| Accepted job still in Pending | The company hasn't clicked Start Job yet — message them (section 9.3) |
| Can't log hours for a day | Only today and earlier days in the **current week** can be logged |
| "Submit Invoice" is greyed out | Read the message under the button (section 10.5) |
| Forgot to submit last week | If you logged any hours, it was submitted automatically at the end of the week (section 10.6). If you logged nothing, contact Traids support |
| Wrong hours on a submitted timesheet | Message the company straight away (section 10.9) |
| Timesheet approved but no money yet | The company has to pay the invoice first — due within 30 days (section 8.1) |
| Paid less than hours × rate | CIS is deducted at 30% (section 8.2) |
| Can't withdraw | Check you have an **Available** balance and your Stripe verification is complete — an unfinished setup needs Traids support (section 8.4) |
| Job not showing in Timesheets | Only **In Progress** jobs appear |
| Document upload failed | Check it's PDF/JPG/PNG and under the size limit; remove it and try again |
| Deleted message came back | Deletion is currently only on your screen |
| Need to change bank details | Contact Traids support |

---

## 16. Known app issues and accuracy notes

Some screens show information that's misleading or controls that don't work yet. Use the correct
information below when answering.

- **Earnings page.** The figures on the **Earnings** page are sample data, not the user's real
  earnings. Never quote them. For real figures, point users to **Payments** and **Wallet**.
- **CIS on Payments.** If the Payments table shows CIS as 0% / £0.00, that's a display issue — CIS
  **is** deducted at 30%, and the payout is gross minus CIS. Suggest contacting support for a CIS
  statement.
- **"Timesheet & Invoice Sent".** Submitting a timesheet doesn't create an invoice straight away — the
  invoice is created when the company has approved every worker's timesheet for that week.
- **Timesheet success message** may name a company called "BuildRight Construction". The invoice
  actually goes to the user's own client company.
- **Dashboard "Apply Now".** The Apply Now button on recommended job cards on the Dashboard doesn't
  work. Tell users to apply through the **Job Board**.
- **Apply button label.** The button that submits a job application says **"Send Offer"**. It sends
  an application, not an offer.
- **Requested tab rate label.** The Requested tab shows the proposed rate as "£X/day". It's an
  **hourly** rate.
- **Withdrawal timing.** The Wallet page says 2–3 business days and the withdrawal screens say 1–2
  business days. Quote "usually 1–3 business days".
- **Withdrawal fee.** If the withdrawal screen shows a £1.50 processing fee, that's outdated — Traids
  doesn't deduct a withdrawal fee, and the full amount entered is sent.
- **Withdrawal reference.** The "TRAIDS-PAY-0042" reference shown after a withdrawal is the same for
  every withdrawal. Don't tell users to use it to trace a payment.
- **Booking rating.** The "4.9 (124 reviews)" rating on a booking's company card is a placeholder.
- **Trade lists.** Registration and the Job Board offer Electrician, Plumber, Carpenter and Masonry.
  Settings also offers Painter and HVAC Technician.
- **Compliance expiry dates** are entered during registration. Settings → Documents has no expiry date
  fields and no way to delete old documents.
- **Registration step 5** ("You're all set!") appears whenever the user returns from Stripe, even if
  Stripe verification isn't actually finished. If withdrawals are blocked, verification may be
  incomplete — it can't be resumed in the app, so the user needs Traids support.
- **Portfolio "Save as Draft"** saves privately, but there's no way to reopen a draft yet.

---

## 17. Not available yet

Don't describe these as available. Where there's a workaround, it's listed.

| Feature | Workaround |
|---|---|
| Saving jobs to view later | — |
| Editing or withdrawing an application | Message the company |
| Logging or submitting a past week | Anything logged is auto-submitted at the end of the week; otherwise contact Traids support |
| Editing a submitted timesheet | Message the company before it's approved |
| A breaks field on timesheets | Enter actual check-in and check-out times |
| Editing or deleting portfolio projects, or reopening drafts | — |
| Changing bank details in the app | Contact Traids support |
| Changing email | Contact Traids support |
| The reduced 20% CIS rate | — |
| Gross payment status (0% CIS) | — |
| Resuming an unfinished Stripe setup | Contact Traids support |
| Deleting your account | Coming in a future update. Contact Traids support if it's urgent |
