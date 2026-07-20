# VisiBill - Project Documentation

## Project Overview

**Application Name:** VisiBill  
**Purpose:** Hungarian invoice management system with NAV (National Tax and Customs Administration) integration  
**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Supabase, Resend  
**Primary Markets:** Hungary (NAV integration)

---

## Architecture Overview

### Frontend
- **Framework:** React 18 with TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS with shadcn/ui components
- **Routing:** React Router v6
- **State Management:** React Context API (Auth, Subscription, Theme)
- **UI Library:** shadcn/ui (Radix UI primitives)

### Backend
- **Database:** Supabase PostgreSQL
- **Serverless Functions:** Supabase Edge Functions (Deno)
- **Authentication:** Supabase Auth with custom email hooks
- **Storage:** Supabase Storage (for invoice files)

### External Integrations
- **NAV API:** Hungarian tax authority invoice data
- **Resend:** Email delivery service
- **Nylas:** Email synchronization and OAuth
- **Mailgun:** Incoming email processing
- **N8N:** Webhook-based invoice processing automation
- **Stripe:** Subscription payment processing

---

## Directory Structure

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui base components (buttons, cards, dialogs, etc.)
│   ├── dashboard/       # Dashboard-specific components (MetricCard, ProjectBreakdown, RecentInvoices)
│   ├── nav/             # NAV integration components (NavCredentialsForm)
│   ├── AppLayout.tsx    # Main application layout with sidebar
│   ├── AppSidebar.tsx   # Navigation sidebar component
│   ├── AuthGuard.tsx    # Authentication guard wrapper
│   ├── ProtectedRoute.tsx # Route protection component
│   ├── ChangePasswordDialog.tsx
│   ├── EmailAliasManager.tsx
│   ├── EmailPreferences.tsx
│   ├── NylasEmailConnect.tsx
│   └── SubscriptionUsage.tsx
├── pages/               # Route page components
│   ├── Index.tsx        # Dashboard (/)
│   ├── Auth.tsx         # Login/Register (/auth)
│   ├── Onboarding.tsx   # New user onboarding (/onboarding)
│   ├── InvoicesPage.tsx # Invoice management (/invoices)
│   ├── Projects.tsx     # Project management (/projects)
│   ├── SalariesPage.tsx # Salary management (/salaries)
│   ├── Integrations.tsx # Third-party integrations (/integrations)
│   ├── Settings.tsx     # User settings (/settings)
│   ├── Pricing.tsx      # Subscription pricing (/pricing)
│   ├── ExchangeRates.tsx # Currency rates (/exchange-rates)
│   ├── ManualUpload.tsx # Manual invoice upload (/manual-upload)
│   ├── NavTesting.tsx   # NAV API testing (/nav-testing)
│   └── NotFound.tsx     # 404 page
├── contexts/            # React Context providers
│   ├── AuthContext.tsx  # Authentication state management
│   ├── SubscriptionContext.tsx # Subscription & usage tracking
│   └── ThemeContext.tsx # Theme (light/dark mode)
├── hooks/               # Custom React hooks
│   ├── use-mobile.tsx   # Mobile viewport detection
│   └── use-toast.ts     # Toast notification hook
├── integrations/        # External service integrations
│   └── supabase/
│       ├── client.ts    # Supabase client initialization
│       └── types.ts     # Auto-generated DB types (read-only)
├── types/               # TypeScript type definitions
│   └── invoices.ts      # Invoice-related types
├── lib/
│   └── utils.ts         # Utility functions (cn, etc.)
├── index.css            # Global styles & design tokens
├── App.tsx              # Root application component
└── main.tsx             # Application entry point

supabase/
├── functions/           # Edge Functions (serverless)
│   ├── send-email/
│   ├── send-welcome-email/
│   ├── send-invoice-notification/
│   ├── nav-token/
│   ├── nav-sync/
│   ├── query-nav-invoices/
│   ├── nav-query-outbound-invoices/
│   ├── trigger-invoice-processing/
│   ├── trigger-bank-statement-processing/
│   ├── process-mailgun-webhook/
│   ├── nylas-auth/
│   ├── nylas-callback/
│   ├── save-credentials/
│   ├── create-checkout/
│   ├── customer-portal/
│   ├── check-subscription/
│   ├── export-user-data/
│   ├── create-email-alias/
│   └── delete-email-alias/
├── migrations/          # Database migrations (read-only, auto-managed)
└── config.toml          # Supabase configuration
```

---

## Key Edge Functions

### Email System
- **`send-email`**: Main email sending function via Resend API
  - Handles auth confirmation emails, password reset emails
  - Used as custom SMTP hook for Supabase Auth
  - Requires `SEND_EMAIL_HOOK_SECRET` for webhook authentication
  
- **`send-welcome-email`**: Sends onboarding welcome email to new users
  
- **`send-invoice-notification`**: Notifies users about invoice processing status

### NAV Integration (Hungarian Tax Authority)
- **`nav-token`**: NAV API authentication and token exchange
  - Validates user credentials
  - Generates authentication tokens for NAV API calls
  - Uses SHA-512 and SHA3-512 hashing
  
- **`nav-sync`**: Synchronizes invoice data from NAV
  - Fetches invoices for specified date range
  - Stores sync logs in `nav_sync_logs` table
  
- **`query-nav-invoices`**: Queries invoice digests from NAV API
  - Supports inbound/outbound direction filtering
  - Date range filtering (max 35 days)
  - Pagination support
  
- **`nav-query-outbound-invoices`**: Specialized function for outbound invoices
  
- **`save-credentials`**: Securely stores NAV API credentials
  - Validates and encrypts credentials
  - Stores in `user_nav_credentials` table

### Invoice Processing
- **`trigger-invoice-processing`**: Triggers N8N webhook for invoice processing
  - Called after invoice upload
  - Returns 200 even on webhook failure to avoid client errors
  - Updates `invoice_uploads` status
  
- **`trigger-bank-statement-processing`**: Triggers bank statement processing workflow
  
- **`process-mailgun-webhook`**: Processes incoming emails via Mailgun
  - Extracts attachments
  - Uploads to Supabase storage
  - Creates invoice upload records
  - Triggers processing workflow

### Email Integrations
- **`nylas-auth`**: Initiates Nylas OAuth flow for email sync
  - Generates OAuth authorization URL
  - Retrieves stored tokens
  - Handles disconnect
  
- **`nylas-callback`**: Handles Nylas OAuth callback
  - Exchanges authorization code for access token
  - Stores tokens in `nylas_tokens` table
  
- **`create-email-alias`**: Creates custom email aliases via Mailgun
  - Generates unique email addresses
  - Sets up Mailgun routing
  - Stores alias in `email_aliases` table
  
- **`delete-email-alias`**: Removes email aliases and Mailgun routes

### Payment & Subscription
- **`create-checkout`**: Creates Stripe checkout session
  - Handles subscription purchases
  - Creates or retrieves Stripe customer
  
- **`customer-portal`**: Opens Stripe customer portal
  - Allows users to manage subscriptions
  - Handle payment methods and billing
  
- **`check-subscription`**: Verifies user subscription status
  - Checks Stripe for active subscriptions
  - Updates `user_subscriptions` table
  - Returns tier and invoice limits

### Data Management
- **`export-user-data`**: GDPR-compliant user data export
  - Exports all user-related data
  - Returns JSON format

---

## Key Pages & Routes

| Route | Component | Description | Auth Required |
|-------|-----------|-------------|---------------|
| `/` | Index.tsx | Dashboard with metrics, recent invoices, project breakdown | Yes |
| `/auth` | Auth.tsx | Login and registration page | No |
| `/onboarding` | Onboarding.tsx | New user onboarding flow | Yes |
| `/invoices` | InvoicesPage.tsx | Invoice list and management | Yes |
| `/projects` | Projects.tsx | Project management and tracking | Yes |
| `/salaries` | SalariesPage.tsx | Salary records and payments | Yes |
| `/integrations` | Integrations.tsx | NAV, Nylas, and other integrations | Yes |
| `/settings` | Settings.tsx | User settings and preferences | Yes |
| `/pricing` | Pricing.tsx | Subscription plans and pricing | No |
| `/exchange-rates` | ExchangeRates.tsx | Currency exchange rate viewer | Yes |
| `/manual-upload` | ManualUpload.tsx | Manual invoice file upload | Yes |
| `/nav-testing` | NavTesting.tsx | NAV API testing interface | Yes |

---

## Authentication Flow

### User Registration & Login
1. User enters email and password on `/auth` page
2. `AuthContext.signUp()` or `AuthContext.signIn()` called
3. Supabase Auth processes request
4. Custom email hook (`send-email` function) sends confirmation email via Resend
5. User clicks confirmation link (if enabled)
6. User redirected to dashboard or onboarding

### Email Confirmation Flow
1. Supabase Auth triggers webhook to `send-email` function
2. Function validates `SEND_EMAIL_HOOK_SECRET`
3. Email sent via Resend API
4. User clicks link in email
5. `emailRedirectTo` parameter redirects to app
6. Auth state updated via `onAuthStateChange` listener

### Protected Routes
- `AuthGuard` component wraps protected pages
- Checks `user` from `AuthContext`
- Redirects to `/auth` if not authenticated
- Uses `ProtectedRoute` wrapper for route-level protection

### Session Management
- Session persisted in localStorage via Supabase client
- `onAuthStateChange` listener updates React state
- Automatic token refresh handled by Supabase client
- Session stored in both `user` and `session` state (critical for token management)

---

## NAV Integration

### Overview
NAV (Nemzeti Adó- és Vámhivatal) is the Hungarian National Tax and Customs Administration. This system integrates with NAV's API to query and sync invoice data.

### Required Credentials
- **NAV Username**: User's NAV technical user account
- **NAV Tax Number**: Hungarian tax ID (8 digits)
- **NAV Password**: Technical user password
- **Sign Key**: XML signature key
- **Exchange Key**: Data exchange encryption key
- **Environment**: Test or Production

### Authentication Process
1. User provides credentials via `NavCredentialsForm`
2. Credentials stored via `save-credentials` function (encrypted)
3. Token requested via `nav-token` function
4. Token includes SHA-512 hashed password + SHA3-512 signature
5. Token used for subsequent API calls (24h validity)

### Invoice Querying
- **Direction**: INBOUND (incoming) or OUTBOUND (outgoing)
- **Date Range**: Max 35 days per query
- **Pagination**: 100 invoices per page
- **Fields**: Invoice number, issue date, amounts (net, VAT, gross), tax numbers

### Database Storage
- **`user_nav_credentials`**: Encrypted credential storage
- **`nav_invoices`**: Synced invoice data
- **`nav_sync_logs`**: Sync operation history and errors

### Known Limitations
- Test environment may have different data than production
- Rate limiting applies (queries should be throttled)
- Date range limited to 35 days per request
- XML parsing is simplified (production may need enhancements)

---

## Email System

### Outgoing Emails (Resend)
**Primary Service**: Resend API  
**Function**: `send-email`  
**Templates**: 
- Email confirmation (`email-confirmation.tsx`)
- Password reset (`password-reset.tsx`)
- Welcome email (`welcome.tsx`)
- Invoice processed notification (`invoice-processed.tsx`)

**Configuration**:
- Set as custom SMTP hook in Supabase Dashboard
- Requires `SEND_EMAIL_HOOK_SECRET` environment variable
- Webhook URL: `https://[project-ref].supabase.co/functions/v1/send-email`

**Rate Limits**:
- Supabase Auth has strict email rate limits (dev/free tier)
- Resend used to bypass these limits in production
- Resend free tier: 100 emails/day, 3000/month

### Incoming Emails (Mailgun)
**Primary Service**: Mailgun  
**Function**: `process-mailgun-webhook`  
**Flow**:
1. Email sent to custom alias (e.g., `company123@mg.visibill.app`)
2. Mailgun receives email and triggers webhook
3. Webhook parses email, extracts attachments
4. Attachments uploaded to Supabase Storage (`invoice-uploads` bucket)
5. Record created in `invoice_uploads` table
6. N8N webhook triggered for processing

**Configuration**:
- Mailgun routes created via `create-email-alias` function
- Webhook signature verification enabled
- EU region: `api.eu.mailgun.net`

### Email Sync (Nylas)
**Primary Service**: Nylas  
**Functions**: `nylas-auth`, `nylas-callback`  
**Purpose**: Read user's email inbox for invoice detection  
**Flow**:
1. User initiates OAuth via `NylasEmailConnect` component
2. Redirected to Nylas authorization page
3. Callback handled by `nylas-callback` function
4. Access token and grant ID stored in `nylas_tokens` table
5. App can read emails via Nylas API

**Providers Supported**: Gmail, Outlook, Yahoo, IMAP

---

## Subscription System

### Stripe Integration
- **Functions**: `create-checkout`, `customer-portal`, `check-subscription`
- **Webhook**: Stripe webhook handler (to be implemented)
- **Plans**: Configurable via Stripe Dashboard

### Subscription Tiers
- **Free/Test**: Limited invoices per month
- **Paid Plans**: Higher invoice limits based on product name parsing

### Usage Tracking
- **Context**: `SubscriptionContext`
- **Table**: `user_subscriptions`
- **Fields**:
  - `tier`: Subscription tier name
  - `invoice_limit`: Max invoices per period
  - `invoices_used`: Current usage count
  - `period_start` / `period_end`: Billing period

### Usage Flow
1. `SubscriptionContext.canProcessInvoice()` checks remaining capacity
2. Invoice processing increments usage via `incrementUsage()`
3. Database function `increment_invoice_usage` updates counter
4. Monthly reset via `reset_monthly_usage` (cron job or manual)

### Customer Portal
- Managed via Stripe Billing Portal
- Users can:
  - Update payment methods
  - Change subscription plan
  - View invoices and billing history
  - Cancel subscription

---

## Database Schema (Key Tables)

### User & Authentication
- **`profiles`**: Extended user profile data (name, company, position, avatar)
- **`user_email_preferences`**: Email notification settings
- **`user_subscriptions`**: Subscription tier and usage tracking
- **`settings`**: User-specific app settings (key-value store)

### NAV Integration
- **`user_nav_credentials`**: Encrypted NAV API credentials
- **`nav_invoices`**: Synced invoice data from NAV
- **`nav_sync_logs`**: History of sync operations

### Invoice Management
- **`invoices`**: Main invoice table (all types)
- **`invoice_uploads`**: Manual and email-based uploads
- **Invoice backup tables**: `sima_szamla_backup`, `egyszerusitett_szamla_backup`, `vegszamla_backup`, `proforma_backup`

### Project & Financial
- **`projects`**: Project tracking
- **`categories`**: Invoice categorization
- **`salary`**: Salary entries
- **`salary_files`**: Salary payment files
- **`tax`**: Tax payment records

### Bank Integration
- **`bank_statements`**: Bank statement files
- **`bank_statement_uploads`**: Upload tracking
- **`bank_transactions`**: Individual transaction records (Supports XLSX, CIB, OTP, and **Binx e-pénz PDF** via native parser)

### VAT & Tax Management
- **`tax`**: Tax payment records
- **Cash Accounting VAT (Pénzforgalmi ÁFA)**: 
  - Automated calculation of payable and deductible VAT based on payment status (matched transactions).
  - **`calculate_cash_accounting_vat` RPC**: Complex database function that aggregates VAT amounts from paid invoices within a period, handling rounding and summaries for tax declaration.

### Email System
- **`email_aliases`**: Custom email aliases for invoice forwarding
- **`nylas_tokens`**: OAuth tokens for email sync

### Row-Level Security (RLS)
All tables have RLS enabled with policies:
- Users can only access their own data (`auth.uid() = user_id`)
- Separate policies for SELECT, INSERT, UPDATE, DELETE
- No cross-user data leakage

---

## Environment Variables & Secrets

### Supabase
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Anonymous/public API key
- `SUPABASE_SERVICE_ROLE_KEY`: Admin API key (server-side only)

### Email Services
- `RESEND_API_KEY`: Resend email API key
- `SEND_EMAIL_HOOK_SECRET`: Webhook authentication secret (must be base64-encoded in Supabase Dashboard)
- `MAILGUN_API_KEY`: Mailgun API key
- `MAILGUN_SIGNING_KEY`: Webhook signature verification
- `MAILGUN_DOMAIN`: Email domain (e.g., `mg.visibill.app`)

### Email Sync
- `NYLAS_CLIENT_ID`: Nylas OAuth client ID
- `NYLAS_API_KEY`: Nylas API key

### Payment
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

### Automation
- `N8N_WEBHOOK_URL`: N8N webhook endpoint for invoice processing

---

## Common Workflows

### User Onboarding
1. User registers on `/auth`
2. Email confirmation sent (if enabled)
3. User logs in
4. Redirected to `/onboarding`
5. Completes profile setup
6. Redirected to dashboard

### NAV Credentials Setup
1. User navigates to `/integrations`
2. Fills in `NavCredentialsForm`
3. Credentials validated via `nav-token` function
4. Stored securely in `user_nav_credentials`
5. User can now sync invoices

### Invoice Syncing (NAV)
1. User clicks "Sync Invoices" button
2. `query-nav-invoices` function called with date range
3. NAV API returns invoice digest
4. Invoices upserted into `nav_invoices` table
5. Sync log created in `nav_sync_logs`
6. UI updated with new invoices

### Manual Invoice Upload
1. User navigates to `/manual-upload`
2. Selects PDF/image file
3. File uploaded to Supabase Storage
4. Record created in `invoice_uploads`
5. `trigger-invoice-processing` called
6. N8N webhook processes file (OCR, data extraction)
7. Results stored in `invoices` table

### Email-Based Invoice Upload
1. Supplier sends invoice to user's custom alias
2. Mailgun receives email
3. `process-mailgun-webhook` extracts attachments
4. Attachments uploaded to Storage
5. `invoice_uploads` record created
6. Processing triggered automatically
7. User notified via email

### Subscription Purchase
1. User views plans on `/pricing`
2. Clicks "Subscribe" button
3. `create-checkout` function creates Stripe session
4. Redirected to Stripe checkout page
5. Completes payment
6. Stripe webhook updates `user_subscriptions` (when implemented)
7. User gains access to premium features

---

## Development Guidelines

### Local Development
```bash
npm run dev          # Start Vite dev server (port 8080)
npm run build        # Production build
npm run preview      # Preview production build
```

### Edge Functions
- Auto-deploy on git push (via Supabase CLI or Lovable)
- Test locally: `supabase functions serve`
- Logs: Check Supabase Dashboard > Edge Functions > Logs
- CORS: All functions include CORS headers for frontend access

### Frontend Deployment
- **Staging**: Auto-deploys to `[project].lovable.app`
- **Production**: Click "Update" in Publish dialog after changes
- **Custom Domain**: Configure in Project Settings > Domains

### Database Migrations
- Auto-generated and managed by Lovable
- Located in `supabase/migrations/` (read-only)
- Applied automatically on deployment
- Types regenerated in `src/integrations/supabase/types.ts`

### Design System
- **Colors**: Use HSL semantic tokens from `index.css`
- **Components**: Leverage shadcn/ui variants
- **Spacing**: Tailwind spacing scale
- **Typography**: Defined in `tailwind.config.ts`
- **Never use**: Direct color values (e.g., `bg-white`, `text-black`)

---

## Known Issues & Solutions

### Issue: Email Rate Limit Exceeded
**Problem**: Supabase Auth rate limits email sends during testing  
**Solution**: 
1. Use custom Resend hook (already implemented)
2. Temporarily disable email confirmation in Supabase Dashboard
3. Upgrade Supabase plan for higher limits

### Issue: NAV Token Authentication Failed
**Problem**: "Invalid signature" or "Authentication failed" from NAV API  
**Solution**:
1. Verify credentials are correct (test environment vs production)
2. Check signature generation (SHA3-512 implementation)
3. Ensure proper XML formatting
4. Validate timestamp format (ISO 8601)

### Issue: Invoice Processing Webhook Failed
**Problem**: N8N webhook returns error, invoice stuck in "processing"  
**Solution**:
1. Check N8N workflow is active
2. Verify `N8N_WEBHOOK_URL` is correct
3. Review N8N logs for processing errors
4. Function now returns 200 even on failure to avoid client errors

### Issue: Email Confirmation Hook 500 Error
**Problem**: `send-email` function returns 500, "Base64Coder is not defined"  
**Solution**:
1. Ensure `SEND_EMAIL_HOOK_SECRET` is base64-encoded in Supabase Dashboard
2. Navigate to: Authentication > Providers > Email > Custom SMTP
3. Base64-encode your secret before entering
4. Verify secret matches in edge function

### Issue: Session Not Persisting
**Problem**: User logged out on page refresh  
**Solution**:
1. Store both `user` AND `session` in AuthContext (critical)
2. Ensure `onAuthStateChange` listener is set up before `getSession()`
3. Check localStorage for Supabase session data
4. Verify Supabase client configuration includes persistence

### Issue: NAV Date Range Too Large
**Problem**: "Date range exceeds maximum" error  
**Solution**:
1. Limit queries to max 35 days
2. Implement pagination for large date ranges
3. Split queries into multiple 35-day chunks

### Issue: RLS Policy Violation
**Problem**: "new row violates row-level security policy"  
**Solution**:
1. Ensure `user_id` is set to `auth.uid()` for all inserts
2. Verify user is authenticated before DB operations
3. Check RLS policies match expected user context

---

## Testing NAV Integration

### Test Environment
- Use separate NAV test credentials
- Test environment has limited data
- API endpoints differ from production
- Set `is_test_environment: true` in credentials

### Testing Workflow
1. Navigate to `/nav-testing`
2. Enter test credentials
3. Validate credentials via "Test Connection"
4. Query test invoices
5. Verify data appears in `nav_invoices` table

### Production Checklist
- [ ] Switch to production NAV credentials
- [ ] Update `is_test_environment` to `false`
- [ ] Test with real invoice queries
- [ ] Verify sync logs for errors
- [ ] Monitor rate limits
- [ ] Set up error notifications

---

## API Rate Limits & Quotas

### Supabase (Free Tier)
- Database: 500 MB
- Storage: 1 GB
- Edge Functions: 500K requests/month
- Realtime: 200 concurrent connections
- Auth emails: Very limited (use custom hook)

### Resend (Free Tier)
- 100 emails/day
- 3,000 emails/month
- 1 domain
- No custom templates (paid feature)

### NAV API
- Rate limits not publicly documented
- Recommended: Throttle requests
- Date range: Max 35 days per query
- Token validity: 24 hours

### Stripe
- No strict rate limits
- Webhook retry logic built-in
- Test mode has same limits as live mode

---

## Security Best Practices

### Secrets Management
- Never commit secrets to git
- Use Supabase environment variables for edge functions
- Rotate API keys periodically
- Use service role key only in edge functions, never in frontend

### Authentication
- Always use RLS policies on all tables
- Validate `auth.uid()` matches `user_id`
- Use `ProtectedRoute` for authenticated pages
- Never expose service role key to frontend

### Data Access
- All database queries filtered by `user_id`
- No cross-user data access
- Validate user permissions before operations
- Use prepared statements (Supabase client handles this)

### Email Security
- Verify Mailgun webhook signatures
- Validate `SEND_EMAIL_HOOK_SECRET` on email hook
- Sanitize email content before processing
- Rate limit email sending to prevent abuse

---

## Monitoring & Logging

### Edge Function Logs
- Access via: Supabase Dashboard > Edge Functions > [Function] > Logs
- Include request/response data
- Filter by time range
- Export for analysis

### Database Logs
- Query via: Supabase Dashboard > Database > Logs
- Postgres logs available
- Slow query detection
- Connection monitoring

### Error Tracking
- Console errors logged in browser DevTools
- Edge function errors logged to Supabase
- Consider: Sentry integration for production

### Usage Monitoring
- Track in `user_subscriptions.invoices_used`
- Monitor via dashboard metrics
- Alert users near limit
- Auto-reset monthly via cron

---

## Future Enhancements

### Planned Features
- [ ] Stripe webhook handler for subscription events
- [x] Bank account reconciliation (Supported via transaction matching)
- [x] Binx e-pénz bank statement support
- [ ] Automated monthly usage reset (cron)
- [ ] Advanced invoice search and filtering
- [ ] Bulk invoice export (Excel/CSV)
- [ ] Multi-language support (EN, HU)
- [ ] Mobile app (React Native)
- [x] AI-powered invoice categorization (Implemented via `category_classifier.py`)
- [x] Tax report generation (Pénzforgalmi ÁFA & 65-M PDF/Excel generation)
- [x] Multi-tenant workspace support (Implemented via `company_members` tenant routing)

### Technical Debt
- [ ] Improve NAV XML parsing (currently simplified)
- [ ] Add comprehensive error handling in all edge functions
- [ ] Implement retry logic for failed webhooks
- [ ] Add unit tests for critical functions
- [ ] Optimize database queries (add indexes)
- [ ] Implement caching layer (Redis/Supabase cache)
- [ ] Add request rate limiting
- [ ] Improve email template designs

---

## Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [React Router Docs](https://reactrouter.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Stripe Docs](https://stripe.com/docs)
- [Resend Docs](https://resend.com/docs)
- [NAV API Docs](https://onlineszamla.nav.gov.hu/) (Hungarian)

### Developer Contacts
- Frontend: React + TypeScript developers
- Backend: Deno + Supabase experience
- NAV Integration: Hungarian tax/accounting knowledge required

---

## Changelog

### Version 1.3.0 (Current - 2026-07-20)
- **Transaction Rules & Auto-Categorization:**
  - Integrated an in-memory auto-categorization rules engine (`apply_transaction_rules`) in the Python worker.
  - Automatically matches unmatched transactions using direction, amount boundaries, and text description patterns (substring/regex).
  - Assigns target GL account IDs, logs rules application, and optionally auto-verifies transactions.
  - Fixed database query column mapping in the frontend rule testing simulation dialog (switched `date` to `transaction_date` and removed `direction` since it is computed client-side).
- **SAF-T XML (Audit File) Dry Run:**
  - Supported a `dry_run` flag during SAF-T XML import processing in the worker.
  - Parses and validates the file, increments counts, but skips inserting accounts, partners, and journal entries into the database to save writes.
- **Suggestions Dialog Layout & Spacing:**
  - Widened the "Javasolt Hozzárendelések Elfogadása" suggestions dialog in `ProfitAndLoss.tsx` to `max-w-4xl` for a cleaner UI layout.
  - Removed cell truncation (`truncate max-w-[150px]` and `truncate max-w-[180px]`) from the "Megnevezés" and "Javasolt Sor" table columns to let names wrap and fit fully.
- **Bug Fixes & Code Correctness:**
  - *suggest_gl_mappings RPC:* Fixed database type mismatches (`character varying(50)` vs expected `text`) by explicitly casting return values in the SQL function definition via a new migration.
  - *Missing Imports:* Resolved runtime reference errors by importing `FileText` in `GeneralLedgerTable.tsx` and the Radix `Dialog` components in `ProfitAndLoss.tsx`.
  - *Annual Report PDF:* Closed the unclosed braces block inside the helper function in `annualReportPdf.ts` which was causing esbuild compilation failure.
  - *Petty Cash:* Clean-deleted the redundant clipboard copy button and its assets from the denomination calculator.

### Version 1.2.0 (2026-07-16)
- **Transaction Files Upload & Deletion:**
  - Integrated a premium file uploading dialog for bank transactions.
  - Allowed deletion of transaction records directly based on the uploaded files, similar to the invoice upload flow.
- **Transaction Notes (Inline & Details):**
  - Integrated inline note-taking and note lists for both matched and unmatched transaction rows.
  - Embedded note lists and creations in `TransactionDetailsDialog.tsx` sheet.
  - Introduced premium card-based visibility selector (Private vs Common/Shared) with Emerald lock and User icons.
  - Resolved database foreign key violations (`notes_invoice_id_fkey`) when adding notes to NAV-only invoices or unmatched transactions by routing the ID through the non-constraint `invoice_ids` array column.
- **Two-Column Side-by-Side Row Layouts:**
  - Re-designed the expanded row interface (`ExpandedInvoiceRow.tsx` and unmatched `TransactionTable.tsx` rows) to place the related items list on the left and the notes section on the right, maximizing screen space efficiency.
- **Notes Page Sync & Navigation:**
  - Enabled multi-select transaction lookup and linkage inside the Note editor modal (`NoteModal.tsx`).
  - Rendered linked transaction count badge on note list cards, and detailed transaction rows under the note details on the Notes page.
  - Enabled direct transaction details lookup popups right from the Notes page.

### Version 1.1.0 (2026-07-15)
- **Database Fixes:** Resolved G/L balances double counting and balance sheet sign issues by correcting the `get_bs_report` RPC algorithm.
- **Visual Progress Checklist:** Redesigned the Annual Report progress checklist to make uncompleted/pending steps visually distinct (dashed hollow dots, italic muted text) and completed ones green-glowing.
- **Premium Financial Modules:**
  - *General Ledger:* State Keep-Alive (0ms delay tab switching) and auto-expansion on search.
  - *Profit & Loss:* Interactive "What-If" Revenue simulator slide bar (-50% to +50%).
  - *Balance Sheet:* CSS Balance Beam ⚖️ visual widget and HSL colored Current/Quick Ratio gauges.
  - *Annual Report:* SVG circular progress ring, visual pending nodes checklist, and auto-generated data grids in the notes editor.
  - *VAT Return:* statutory deadline countdown banner and Reverse Charge Auditor.
  - *Petty Cash:* RPC-driven cash totals aggregation and read-only rate limiter bypass (`check_request`).

### Version 1.0.0
- Initial release
- NAV integration
- Email processing
- Subscription system
- Manual invoice upload
- Project and category management

---

**Last Updated:** 2026-07-16  
**Maintained By:** VisiBill Development Team
