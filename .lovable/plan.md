
# Add "Tranzakciók" Tab to Document Upload Page

## Summary
Add a new "Tranzakciók" tab to the existing document upload page (`ManualUpload.tsx`) that allows users to upload transaction-related files separately from bank statements.

## Changes Required

### 1. Update TabsList Layout
**File:** `src/pages/ManualUpload.tsx`

Change the grid layout from 3 columns to 4 columns to accommodate the new tab:
- Current: `grid-cols-3`
- New: `grid-cols-4`

Add a new TabsTrigger for "Tranzakciók" with the Landmark icon (consistent with the sidebar navigation).

### 2. Add State for Transaction Files
Add new state variable for handling transaction file selection:
- `selectedTransactionFiles` - array of selected transaction files

### 3. Add File Handling Functions
Create new functions mirroring the existing patterns:
- `handleTransactionFileSelect` - validates and adds files (PDF, CSV, XLS/XLSX)
- `removeTransactionFile` - removes a file from selection
- `handleTransactionUpload` - uploads files to storage and creates database records

### 4. Add New TabsContent for Transactions
Create the "transactions" TabsContent section with:
- Card header with Landmark icon and description
- Drag-and-drop upload area
- File list display with badges showing file type and size
- Upload button with loading state

### 5. Storage Configuration
Store transaction files in the `transactions` bucket (as discussed previously for bank statement changes, but now specifically for this new tab).

---

## Technical Details

### Import Updates
Add `Landmark` icon import from lucide-react.

### State Additions
```typescript
const [selectedTransactionFiles, setSelectedTransactionFiles] = useState<File[]>([]);
```

### New Functions Pattern
The transaction file handling will follow the same pattern as bank statements:
- Allowed file types: PDF, CSV, XLS, XLSX
- Storage bucket: `transactions`
- Database table: Can use `bank_statement_uploads` with a different type indicator, or you can specify if a new table is preferred

### TabsList Change
```tsx
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="invoices">Számlák</TabsTrigger>
  <TabsTrigger value="bank-statements">Bankkivonatok</TabsTrigger>
  <TabsTrigger value="transactions">Tranzakciók</TabsTrigger>
  <TabsTrigger value="salaries">Bérek/Járulékok</TabsTrigger>
</TabsList>
```

---

## UI Consistency
The new tab will maintain visual consistency with existing tabs:
- Same card structure with header, description, and content
- Same drag-and-drop styling with dashed border
- Same file list format with badges and remove buttons
- Same upload button with loading spinner
