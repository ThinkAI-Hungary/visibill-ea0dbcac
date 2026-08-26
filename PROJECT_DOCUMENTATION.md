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
│   ├── ManualUpload.tsx # Manual invoice file upload
│   ├── NavTesting.tsx   # NAV API testing interface
│   ├── Accounty/        # Eaisybooks (Accounty) module pages (/accounty)
│   │   ├── AccountyApp.tsx  # Unified portfolio dashboard page
│   │   ├── AccountyScopedLayout.tsx # Scoped client layout wrapper
│   │   ├── ClientDetailsPage.tsx  # Scoped client overview dashboard
│   │   ├── ClientInvoicesPage.tsx # Scoped client invoices dashboard
│   │   ├── FilingsPage.tsx        # NAV Filings subpage
│   │   ├── EmployeesPage.tsx      # Payroll employees dashboard
│   │   ├── Ev/          # Egyéni Vállalkozás (EV) specific pages
│   │   │   ├── ClientEvMainPage.tsx      # EV Main page
│   │   │   └── EvDepreciationPage.tsx    # Fixed Assets Depreciation
│   │   └── Tao/         # Társasági adó (TAO) specific pages
│   │       └── ClientTaoMainPage.tsx     # TAO Main page
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

### Eaisybooks (Accounty) & Payroll
- **`accounty_assignments`**: Accountant-to-company assignments and status tracking
- **`accounty_employees`**: Employee data for payroll calculation
- **`accounty_employments`**: Employment contracts and status tracking
- **`accounty_payroll_calculations`**: Periodical payroll details and tax computations
- **`accounty_ev_records_fixed_assets`**: EV fixed asset records and ÉCS settings
- **`accounty_ev_performance_logs`**: Mileage and performance logs for EV assets

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

### Version 1.9.5 (2026-08-26)
- **Timezone-Safe Date Calculations & Formatting:**
  - Implemented the `parseLocalDate` utility across the **eaisybooks (Accounty)** DateRangeContext, EV depreciation extraction, and **Corporate Tax (TAO)** fixed assets views (`DepreciationCards.tsx`, `AssetDetailPanel.tsx`).
  - Resolves timezone shifts where YYYY-MM-DD dates parsed using `new Date()` shifted backward by one day for users in timezones behind UTC (such as US EST).
  - Fixed Net Book Value columns in EV Depreciation list to dynamically deduct current year depreciation.
- **Multi-Currency Analytics and VAT Return Integration:**
  - Integrated `useExchangeRates` in the **Analytics** page (`Analytics.tsx`) to dynamically fetch MNB exchange rates. Correctly converts EUR, USD, and other foreign currency amounts to HUF before aggregating monthly revenue/expenses charts and VAT analytical breakdowns.
  - Implemented exchange rate conversion for items and totals inside the VAT row drill-down component (`VatRowDrillDown.tsx`) and for A60 EU community totals in the main VAT Return page (`VatReturnPage.tsx`).
- **Year Selector Reactivity:**
  - Removed redundant `taxYear` states from EV Flat Rate, KATA, HIPA, VSZJA Osztalékalap, VSZJA Adóalap, and Compare pages. The pages now dynamically recalculate and respond to changes in the global DateRangeContext.
- **Worker db.py Cleanup:**
  - Removed an invalid, empty database RPC call `client.rpc("", {})` in `get_gl_context` inside the python worker (`db.py`), eliminating redundant database exceptions.

### Version 1.9.3 (2026-08-26)
- **Skeleton Loader Migration:**
  - Systematically replaced legacy spinner loading overlays (`<Loader2 />`) and text loading messages (`Betöltés...`) with modern, animated Skeleton loaders inside the **eaisybooks (Accounty)** module.
  - Replaced spinners on `Filing2608Page`, `Filing08EPage`, and `EPayslipPortalPage` with the `FinancialPageSkeleton` component.
  - Replaced spinners on `DocumentCenterPage` with a custom grid-card layout skeleton.
  - Replaced spinners on `YearEndDashboardPage`, `MultiJobPage`, `JobModificationPage`, `ExitDocumentsPage`, `EmployeeExitWizardPage`, `OfficeSettingsPage`, and `FilingWorkflowPage` with styled page layouts utilizing `<Skeleton />` and `<ContentSkeleton />`.
  - Replaced inline text placeholders in `RepresentationPage` and `CegkapuSettingsPage` with animated skeletons.

### Version 1.9.2 (2026-08-26)
- **Database & Query Performance Optimizations:**
  - Created and executed a new PostgreSQL migration ([20260826_optimize_ev_record_counts.sql](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/supabase/migrations/20260826_optimize_ev_record_counts.sql)) implementing the `get_ev_record_counts(p_company_id uuid, p_tax_year int)` server-side RPC function. It incorporates strict security checks (member/accountant access check) and runs all 9 counts in a single database transaction using fast index-scans.
  - Refactored `useEvRecordCounts` in [useEvData.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/hooks/useEvData.ts) to utilize the new RPC, reducing parallel client-side HTTP network connection overhead from 9 queries down to 1.
  - Optimized `useEvRealTotals` in [useEvData.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/hooks/useEvData.ts) to call the high-performance `get_ev_ytd_totals` RPC alongside a fast `head` count check instead of fetching and mapping thousands of full invoice rows into client memory.
  - Fixed an N+1 query storm on the Dashboard KPI page by lazy-loading the `MissingItemsTooltip` component in [DashboardKpiView.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/dashboard/DashboardKpiView.tsx) only when the user hovers over a client row, eliminating 5 redundant queries on initial page load.
  - Optimized the **eaisybill** client dashboard query in [useDashboardData.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/hooks/useDashboardData.ts) to call the pre-existing database RPC `get_petty_cash_summary` instead of pulling registers, opening balances (unfiltered), and entries, and doing JS summation in client memory, reducing 3 raw client-side queries into 1 lightweight RPC.
  - **Dashboard Tooltip & Layout Fixes:** Refactored `MissingItemsTooltip` in [DashboardShared.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/dashboard/DashboardShared.tsx) to use Radix UI `HoverCard` rendering inside a Portal at the root body level. This prevents tooltips from altering the container's DOM dimensions (causing unwanted scrollbars) and eliminates absolute element clipping. Wrapped the table rows in [DashboardKpiView.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/dashboard/DashboardKpiView.tsx) as HoverCard triggers, added `pr-6` padding to the rightmost column header and cells to resolve column cutoff issues, and added `pt-3 pb-1` padding to the `overflow-x-auto` wrapper combined with `leading-relaxed` line-height on `thead` to prevent Hungarian accent characters (like Ü, á, ó) from being clipped at the top boundary of the container. Increased the top margin of the `LineChart` component from 10 to 24 in [DashboardKpiView.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/dashboard/DashboardKpiView.tsx) to prevent clipping of the highest Y-axis label (e.g. "6000 db").

### Version 1.9.1 (2026-08-26)
- **Database Security & RLS Permission Fix:**
  - Created and executed a new PostgreSQL migration ([20260826_fix_user_is_company_member_permission.sql](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/supabase/migrations/20260826_fix_user_is_company_member_permission.sql)) to grant `EXECUTE` privileges on the `user_is_company_member(uuid)` helper function to `anon` and `authenticated` roles.
  - Resolves a recurring RLS policy evaluation blocker (`42501 permission denied`) that caused database lookup errors on company membership tables when accessed by unauthenticated sessions (e.g. during initialization or login flow).

### Version 1.9.0 (2026-08-25)
- **eaisybooks & eaisybill UI/UX Unification:**
  - **Centralized Theme Shadow Configuration:** Redefined the `'soft'` shadow mapping in [tailwind.config.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/tailwind.config.ts) to point to the theme CSS variable `var(--shadow-soft)`. Defined `--shadow-soft` in [index.css](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/index.css) (with soft double-cast for light mode and 1px inset boundary for dark mode), dynamically updating over 50 card layouts across the platform.
  - **Glassmorphic Card Visuals:** Updated `ClientCard` and `KpiCard` components in [DashboardShared.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/dashboard/DashboardShared.tsx) and charts/metric grids in [DashboardKpiView.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/dashboard/DashboardKpiView.tsx) to utilize glassmorphic styles (`bg-card/50 border border-border/80 shadow-soft`) matching the premium eaisybill layout.
  - **Theme-Aware Tooltips & Popovers:** Replaced hardcoded hex values in chart tooltips ([MissingInvoicesReportPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/MissingInvoicesReportPage.tsx)) with CSS-theme variables (`var(--tooltip-bg)`, `var(--tooltip-text)`). Replaced hardcoded slate hover blocks with theme-aware `bg-popover border border-border text-popover-foreground` popover styles in [CashbookLedgerView.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/Ev/CashbookLedgerView.tsx).
  - **Sticky Invoice Action Menu:** Added row selection states and integrated a premium floating bulk action menu via React portal in [ClientInvoicesPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/ClientInvoicesPage.tsx). Includes dynamic sum totals grouped by currency, bulk status mutation, delete confirmation overlays, and resolved z-index overlapping by raising dropdown z-index layers.
  - **Form Stepper Fix:** Added `pt-2` padding to the wizard stepper wrapper in [TaoWizardShell.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/Tao/TaoWizardShell.tsx) to prevent clipping of the active step's outline rings.
  - **Global Color Alignment:** Replaced hardcoded slate-900 borders and slate grey backgrounds with dynamic theme tokens (`border-primary`, `bg-accent/40`, `bg-muted/80`) in step forms ([ClientDetailsStep.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/new-client/ClientDetailsStep.tsx)), integrations ([IntegrationStep.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/new-client/IntegrationStep.tsx)), download formats ([ClientReportsPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/ClientReportsPage.tsx)), and payroll tab lists ([EmployeeDetailsPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/EmployeeDetailsPage.tsx)).

### Version 1.8.0 (2026-08-18)
- **Customs Decisions Processing (Vámhatározatok):**
  - Extended the check constraint `invoices_type_check` in Supabase with the new `'vamhatarozat'` type.
  - Implemented AI classification and extraction pipeline logic in Python worker with `VamhatarozatOutput` Pydantic models.
  - Integrated robust fallback model handler (`gpt-4o-mini`) when DeepSeek API calls fail.
  - Configured custom badge styles (orange color scheme) and labels (`vamhatarozat: 'Vámhatározat'`) in frontend.
- **Categories Page Enhancements:**
  - Extended client categories page lists to allow viewing document/invoice image previews (or structured e-Receipt details if no file is uploaded).
  - Integrated support for showing detailed item-level breakdowns for category invoices directly.
- **Ticketing System Refactoring:**
  - Implemented sequence-based (`feedback_ticket_number_seq`) ticket ID auto-incrementing to resolve duplicate ticket ID issues (e.g. multiple `EB-0001` occurrences).
  - Blocked commenting, file uploads, and internal note options on unassigned tickets (`!assigned_to`), displaying clear warnings for both admin and client roles.
  - Added a new "Összes ticket" filter checkbox in the admin dashboard to display all tickets, showing only the admin's own and unassigned tickets by default.

### Version 1.7.5 (2026-08-18)
- **Chart of Accounts PDF Parser Precision:**
  - **Standalone Keyword Matching:** Implemented a standalone word boundary validation (using Hungarian Unicode character aware regex checks) for address keyword filters (`tér`, `út`, `utca`, `tere`) in `UploadChartOfAccountsModal.tsx` and its corresponding test suite. This prevents valid general ledger accounts containing these letter combinations (e.g. `92 EXPORTÉRTÉKESÍTÉS ÁRBEVÉTELE`, which contains `t-é-r` as a substring) from being erroneously skipped.

### Version 1.7.4 (2026-08-17)
- **AI Invoice Processor Resilience & Pydantic Fallbacks:**
  - **Pydantic Validation Safeguard:** Added custom pre-validators to `models.py` (specifically for `SimaSzamlaOutput`, `VegszamlaOutput`, `DijbekeroProformaOutput`, and `EgyszerusitettSzlaOutput`) to fallback to `"Ismeretlen vevő"` / `"Ismeretlen eladó"` if the LLM returns `null`/`None` for buyer or seller name fields. This prevents hard Pydantic schema validation failures from halting the entire processing pipeline.
  - **Rebranding Fix:** Cleaned up temporal dead zone ReferenceErrors in `ManagementDashboard.tsx` that caused page crashes.

### Version 1.7.3 (2026-08-15)
- **Annual Report & Editor Optimization:**
  - **Editor Focus Stability:** Replaced dynamic text-length-dependent editor key with a state-controlled reset counter. Debounced auto-saving no longer recreates the editor DOM, resolving cursor jump, focus loss, and document scroll resetting.
  - **Live Preview Scroll Preservation:** Added a scroll position capture and restoration system on the sticky live preview iframe. The scroll coordinates are preserved during updates and reapplied on load, allowing seamless side-by-side editing.
  - **eaisyBill Rebranding:** Rebranded the report cover page logo from `eaisyBooks` to `eaisyBill`.
  - **Cover Badge Cleanups:** Removed the hardcoded `Generálta: eaisybooks.hu` footer badge.
- **VAT Return (M-Lap) Partner Validation:**
  - **8-digit Törzsszám Support:** Extended `validateHungarianTaxNumber` to support Hungarian 8-digit partner tax numbers (törzsszám) alongside standard 11-digit hyphenated tax numbers, calculating CDV checksums correctly and resolving incorrect "invalid format" flags on M-lap pages.

### Version 1.7.2 (2026-08-13)
- **Eaisybooks UI/UX Improvements:**
  - **Smooth Mode Switcher:** Implemented a smooth fade-in loading state transition for switching between eaisyBill and eaisyBooks modes.
  - **Pulsing Sidebar Notification:** Added a glowing, pulsing notifications badge for unread tickets in the sidebar.
  - **Side-by-Side Report Preview:** Redesigned the report generation modal to present a responsive split screen with real-time PDF/preview rendering.
  - **History Search & Filters:** Added instant text search and format type tab filters (All, PDF, Excel, Sent) to recent report history list.
  - **Resolved Deficiencies Filtering:** Fixed a duplicate list view issue in `ClientDetailsPage.tsx` by filtering out past resolved items from closing blocking deficiencies and KPI counts.
- **AI Assistant Enhancements:**
  - **Local Session Persistence:** Saved active AI chat session ID in `localStorage` to keep conversation thread active during routing.
  - **Floating Copy Button:** Positioned a hover copy button on assistant message cards for easy clipboard copy.
  - **Hungarian Quick Actions:** Standardized initial chat prompts to target specific Hungarian tax advice questions.
- **Fixed Asset & Tax Customization:**
  - **Compliance Warning:** Added an inline tax compliance warning flag (yellow triangle) on immediate write-offs of assets valued over 200,000 HUF.
  - **Override Indicators:** Implemented manual change indicator dots (blue) when user edits recommended method or ÉCS rates.
  - **Interactive Tax Form Sliders:** Added range sliders for costs and entrepreneurial drawings (kivét) to make the tax form planner fully interactive.

### Version 1.7.1 (2026-08-10)
- **Tax Document Extraction Blacklist:**
  - Implemented a content-based blacklist in the transaction extractor to reject municipal/state tax documents (such as municipal tax account statements (`adószámla kivonat`), tax directorate letters (`adóügyi igazgatóság`), or dunning letters (`fizetési felszólítás`)) from being processed as bank statements.
  - Returns a clear rejection reason `Is this really a transaction?` which forces the job into the error/ignored state on the correct pipeline instead of generating false bank transactions.
- **Customer/Client Number Exclusion in Invoice Extraction:**
  - Added strict warnings to all invoice extraction system prompts (`sima_szamla.md`, `vegszamla.md`, `egyszerusitett_szamla.md`, `dijbekero_proforma.md`) to explicitly forbid extracting customer/client numbers (e.g. `customer no.`, `Kunde Nr.`, `customer ID`, `partner no.`) as the invoice number (`szamlaszam`).
- **Min OCR Quality Fallback in MarkItDown:**
  - Fixed a critical fallback bug in `ocr_markitdown.py` where plain text extraction returning less than 30 characters (such as basic page headers on scanned PDFs, e.g. "## Page 1") was accepted as valid and returned immediately, triggering the worker's quality gate and failing the job.
  - Added a strict length check (`len(text.strip()) >= 30`) to force fallback to LLM Vision OCR or Direct Vision OCR when plain text extraction yields insufficient text.

### Version 1.7.0 (2026-08-10)
- **Portfolio Page Slate & Blue Colors Realignment:**
  - Fully eliminated remaining hardcoded `slate`, `blue`, and `sky` background, border, and text classes across the main Portfolio dashboard, sub-pages, and tab modules, replacing them with dynamic design system theme variables to create a premium onyx look.
  - Standardized color badges, background borders, and loading skeleton colors in `AccountyApp.tsx` (the main Portfolio container).
  - Swapped hardcoded border lines (`slate-100`, `slate-200`, `slate-300`) with dynamic border tokens (`border-border`) and updated chart grid stroke properties (`#f1f5f9` and slate) in `DashboardKpiView.tsx`.
  - Standardized `KpiCard` titles, icons, and values, and updated `OwnerDropdown` select popups, hover states, and text in `DashboardShared.tsx`.
  - Cleaned up table head rows (`thead`), checkboxes, row dividing lines, and row hover highlights in `ClientListView.tsx`.
  - Refactored state labels, taxpayer tables, and search controls in `TaoPortfolioPage.tsx` to eliminate hardcoded slate/blue colors.
  - Refactored task cards, badge labels, and checklist buttons in `YearEndDashboardPage.tsx` to use design system theme variables.
- **Permission Matrix Page Restructuring:**
  - Fixed the Roles matrix table breakdown on `PermissionMatrixPage.tsx` by wrapping it in an `overflow-x-auto` horizontal scroll container and pinning the first column containing accountant names (`sticky left-0`).
  - Added a solid `absolute inset-0 bg-card -z-10` layer inside the headers and row cells of the sticky column to prevent scrolled company cell badges and drop-down buttons from displaying through or on top of the sticky column when scrolling.
- **Unified Table Header Theme:**
  - Enforced a premium steel-blue / slate-blue color scheme on all table headers globally in `index.css` (using `#121315` as row background and `#94a3b8` as label text in dark mode).
  - Updated the `TableHead` component in `table.tsx` from `font-medium` to `font-semibold` to achieve a bold, modern look.
- **Client Profile & Invoices Table Row Color Alignment:**
  - Replaced hardcoded blue backgrounds and label colors in `ClientProfileTab.tsx` with dynamic theme design system tokens.
  - Removed `dark:bg-slate-900/50` from table rows and standardized row styling in `ClientInvoicesPage.tsx` to use neutral onyx cards and row hover highlights.

### Version 1.6.0 (2026-08-08)
- **BinX CSV Bank Statement Processing:**
  - Fixed CSV converter column truncation bug by dynamically computing `max_cols` across all CSV rows instead of defaulting to the first row (which was often metadata / 2 columns), preserving all columns in the converted Markdown table.
  - Implemented automatic double-UTF-8 decoding recovery in the CSV parser to resolve corrupted Hungarian accent characters (e.g., recovering `ó` from `Ã³`) common in email forwarding.
  - This resolved the issue where BinX CSV bank statements were incorrectly routed to the GLS report pipeline by Mailgun/Eaisybooks due to extraction failing on missing column data.
- **Eaisybooks (Accounty) UI Improvements:**
  - **Removed Mock Timeline:** Cleaned up the mock `<MissingInvoicesTimeline />` section showing hardcoded notifications timeline (e.g., "Felszólítás küldve") from the client missing invoices page ([ClientMissingInvoicesPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/ClientMissingInvoicesPage.tsx)).
  - **Repositioned Invoice Summaries:** Moved the invoice totals summary bar from the bottom of the table card to the top (directly below the toolbar, above the table) in the scoped company invoices page ([ClientInvoicesPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/ClientInvoicesPage.tsx)) for better scannability.

### Version 1.5.0 (2026-08-07)
- **Advanced Depreciation (ÉCS) Module:**
  - Integrated 8 advanced depreciation methods (Linear, Declining Balance, Sum of Years' Digits, Progressive, Performance-based, Multiplier-based, Absolute amount, Immediate write-off) into fixed assets calculations.
  - Stored ÉCS settings as serialized JSON metadata within the notes column of the fixed assets table for backward compatibility.
  - Developed `accounty-ai-depreciation` Edge Function to suggest optimal depreciation methods and rates based on asset description/cost, integrating it into import dialogs and manual forms.
- **Unified Navigation & Layouts:**
  - Consolidated portfolio dashboards at `/accounty` (Clients list, Payroll portfolio, TAO/KIVA overview, EV portfolio).
  - Scoped client-centric routes under `/accounty/:companyId/:dateRange/` using `AccountyScopedLayout` to handle client/date context.
  - Standardized visual layout headers, square back buttons, and gray pulse skeleton loading indicators across all client dashboards.
- **A60 Community VAT Cross-Check Validation:**
  - Automated cross-check validation in `VatReturnPage.tsx` comparing outbound/inbound EU invoices against lines 91-92 and 93-94 of the VAT Return.
  - Added interactive client-side overrides to toggle invoice type (Product vs Service) in real-time.
  - Highlighted VIES tax number format errors and missing partner tax numbers on the A60 summary list.

### Version 1.4.1 (2026-07-28)
- **OTP Bank Statement Extractor Fixes:**
  - *Deviza (EUR) Parsing:* Fixed extraction of OTP Bank statements in foreign currencies (e.g. EUR) by updating the column limits (shifted `X_ERTEKNAP` from `140` to `110` to handle layout changes) and updating amount parsing to support commas for decimal points.
  - *Dynamic Currency Detection:* Enabled automatic detection of statement currency (e.g., `EUR`, `HUF`) from the statement header instead of assuming HUF.
  - *Testing Utilities:* Fixed the `_extract_from_pdf` return type unpacking inside `test_transaction.py`.

### Version 1.4.0 (2026-07-28)
- **Database Query Optimizations:**
  - *NAV Invoice Lookup:* Added strict date window filtering (`dateFromFormatted` and `dateToFormatted`) and updated the React Query `queryKey` in `useInvoiceData.ts` to prevent duplicate or endless refetches of massive historical company datasets.
  - *Tickets Unread Count:* Replaced expensive client-side filtering (which downloaded all comments for all tickets) with a secure, permission-respecting server-side RPC `get_unread_ticket_count` in `useTickets.ts`.
  - *Dashboard VAT Breakdown:* Replaced full download of `nav_invoice_items` with a performant server-side RPC `get_vat_breakdown` in `useDashboardData.ts` grouping by VAT rate, invoice direction, and currency, reducing data load from 50,000+ items to 50-100 aggregated rows.
- **Payroll (Accounty) Module Bugfixes:**
  - *Deductions Column:* Resolved `column accounty_payroll_calculations.total_deductions does not exist` database errors by adding `total_deductions numeric` to `accounty_payroll_calculations`, backfilling the data from `deductions->>'total'`, and updating `usePayrollData.ts` to store calculations correctly.
- **General Ledger Template Enhancements:**
  - *Plain Text Upload:* Extended the `UploadChartOfAccountsModal.tsx` file dialog to accept and parse `.txt` files as delimiter-detected CSV files.

### Version 1.3.0 (2026-07-20)
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

**Last Updated:** 2026-08-25  
**Maintained By:** VisiBill Development Team
