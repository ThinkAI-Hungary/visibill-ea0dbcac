

# Add "Join Company" Tab to Onboarding Wizard

## What Changes

The first step of the onboarding wizard (in `EmptyStateDashboard.tsx`) currently only shows a company creation form. We will add a tabbed interface identical to the one in `CompanySelector.tsx`, allowing new users to either create a company or join an existing one via a 6-character code.

When a user joins via code, the wizard completes immediately -- no Steps 2-4 -- and they land on the dashboard with the joined company's data.

---

## Implementation Details

### File: `src/components/dashboard/EmptyStateDashboard.tsx`

**1. Add new state variables:**
- `joinCode` (string) for the code input
- `isJoining` (boolean) for loading state
- `step1Tab` (string, default `'create'`) to track which tab is active

**2. Add `handleJoinCompany` function:**
- Reuse the exact same logic from `CompanySelector.tsx` (lines 87-133):
  - Call `supabase.functions.invoke('join-company', { body: { share_token } })`
  - Handle `already_member` and `invalid_code` errors
  - On success: call `refreshCompanies()`, `setSelectedCompany(data.company)`, show success toast, and call `onOnboardingComplete?.()` to close the wizard

**3. Modify `renderStep1()` to include tabs:**
- Wrap the existing form content in a `Tabs` component with two tabs:
  - Tab "create" ("Uj ceg regisztracioja"): existing company name/tax/address form (unchanged)
  - Tab "join" ("Csatlakozas meglevohhoz"): join code input + button (same UI as CompanySelector)

**4. Update navigation button logic:**
- The "Next" button at the bottom should be **hidden or disabled** when the "Join" tab is active (since the join button inside the tab handles completion)
- Alternatively, the join tab's button directly completes onboarding without stepping through 2-4

**5. Add imports:**
- `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`

### No other files need changes.

---

## Technical Notes

- The `join-company` edge function is already deployed and handles authentication, token lookup, duplicate checks, and membership insertion.
- The `on_company_created` trigger is irrelevant here since joining doesn't create a company.
- The `onOnboardingComplete?.()` callback triggers the product tour -- this is appropriate after joining too.
- The "Next" button validation (`isStep1Valid`) only applies to the create tab. When on the join tab, the step navigation buttons should reflect that (disable "Next" or hide it).

