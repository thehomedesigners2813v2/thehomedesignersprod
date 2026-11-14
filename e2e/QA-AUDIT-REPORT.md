# TheHomeDesigners local QA audit

Run date: 11 November 2026  
Target: http://localhost:5173 against the local Supabase stack only.  
Browser: headed Chromium, slow motion 80ms.  
Result source: `npx playwright test` (1.5 minutes).

## Score

| Result | Count |
| --- | ---: |
| Total automated cases | 24 |
| Passed | 17 |
| Failed | 1 |
| Blocked (skipped) | 6 |
| Not tested as a full workflow | listed below |

Pass rate excluding blocked cases: 17 / 18 = 94.4%.

## Passed

- Homepage, designer search, deals, and project navigation load.
- Homepage remains readable at a 390px-wide viewport.
- Homeowner signup rejects a weak password.
- Homeowner registration sends a Mailpit confirmation, and the confirmed account can sign in and sign out.
- An unconfirmed account cannot sign in.
- A signed-out visitor is redirected away from project registration, the designer dashboard, the designer subscription page, and `/admin`.
- A confirmed homeowner sees Access Denied on `/admin` and is sent home from the designer dashboard.
- A local admin account can open `/admin`.
- Designer registration validates an empty form, creates a profile, confirms the email, and then holds the dashboard for verification.
- Signed-out visitors cannot stay on the designer quotation route.

## Failed

### Homeowner login has no password reset

1. Test: `homeowner authentication › login offers a password reset`
2. Page: sign-in modal in `src/components/AuthModal.tsx`
3. Open http://localhost:5173, choose Sign In, look for a forgot-password or reset control.
4. Expected: a way to request a password reset.
5. Actual: the modal only offers email, password, Sign In, and Sign up.
6. Error: the reset button was not found within 15 seconds.
7. Likely cause: reset exists only on designer registration, and only after that email is already registered (`Reset Password` in `DesignerRegistration.tsx`).
8. Area: frontend.
9. Correction: add the existing `resetPasswordForEmail` action to the homeowner sign-in modal. Do not disable email confirmation.

Severity: major for account recovery. Not a security bypass.

## Blocked

These did not run because `supabase/.env` has no development secrets. No payment, AI, Resend, or WhatsApp call was made.

- Razorpay test checkout: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- Razorpay webhook: `RAZORPAY_WEBHOOK_SECRET`
- AI quotation generation: `OPENAI_API_KEY` (this flow uses OpenAI, not Gemini)
- Gemini chat and Vastu: `GEMINI_API_KEY`
- Bill and receipt email: `RESEND_API_KEY`, and the sender `orders@thehomedesigners.com` must be a verified Resend domain
- WhatsApp: the app uses WAHA settings in `whatsapp_settings`, not the Meta Cloud API. No test recipient is configured.

## Not tested end to end

These routes exist, but this run did not complete the business workflow. A new designer remains `pending` until an admin verifies them, so quotation, project, and subscription actions stay closed.

- Manual, template, and modular quotation editing, sending, acceptance, rejection, and parking other quotations.
- Project creation after acceptance, progress, documents, and project notifications.
- The 10% confirmation payment, success, failure, webhook status, and duplicate-payment protection.
- Floor-plan upload, credit reservation, settlement, and refund.
- Homeowner and designer profile editing after the first registration.
- Admin screens beyond the overview: designers, homeowners, subscriptions, quotations, payments, and AI usage.
- A contact or enquiry form was not found as a separate public route.

## Other observations

- Auth confirmation emails are visible at http://127.0.0.1:54324. That path passed.
- `CustomerRegistration` contains a “Please sign in” message, but a `useEffect` redirects a signed-out visitor home before that message can be used. Access is still blocked. Severity: minor.
- No production Supabase, Hostinger, or live payment system was used.
- Console errors and failed network requests are attached to each test in the HTML report. The only failing assertion was the missing reset control, not an application exception.

## Priority

1. Add password reset to the homeowner sign-in modal.
2. Supply the development secrets above and rerun the blocked cases.
3. Verify one designer from the admin account, then add tests for quotation, acceptance, project creation, and the 10% payment.
4. Remove or reach the unused “Please sign in to register your project” branch so the redirect and the message do not disagree.

## Artifacts

- HTML report: `playwright-report/index.html`
- Failure screenshot, video, and trace: `test-results/homeowner-homeowner-authen-917b9-gin-offers-a-password-reset-chromium/`
- Open the trace with `npx playwright show-trace test-results/homeowner-homeowner-authen-917b9-gin-offers-a-password-reset-chromium/trace.zip`

## Run again

```powershell
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
npx supabase start
npm run dev
npx playwright test
npx playwright show-report
```

The browser opens visibly. Tests use synthetic `@example.com` accounts and the local Mailpit inbox.
