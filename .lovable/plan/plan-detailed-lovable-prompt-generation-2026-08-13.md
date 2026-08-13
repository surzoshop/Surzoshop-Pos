# Plan - Detailed Lovable Prompt Generation

The user wants a comprehensive and detailed Lovable prompt that captures all the recent implementations, specifically the "Daily Close" feature and the "Ledger Running Balance" fix, so they can replicate these in another project.

## Technical Details

### 1. Daily Close Feature
- **Route:** `/ledger/daily-close`.
- **Logic:** 
    - Income: Sum of `sales.paid` (excluding installments already paid at time of sale) + `installment_payments`.
    - Expense: Only entries from the `expenses` table.
    - Closing: `Income - Expense`.
    - Timeline: Chronological list of all entries (Sales, Installments, Cashbook, Expenses). Entries that don't affect the net closing (like generic cashbook deposits/withdrawals) are labeled accordingly.
- **UI:** 
    - Header with date picker and quick navigation chips (Today, Yesterday, etc.).
    - Stat cards (Total Income, Total Expense, Net Closing).
    - Mobile-optimized card list for the timeline.

### 2. Ledger Running Balance Fix
- **Logic:** 
    - Calculate a `cashBalanceById` map by sorting all cash-affecting transactions (from all sources) chronologically across all time.
    - Each row in the ledger table displays the balance from this map for that specific transaction ID.
    - This ensures that filtering or searching in the UI does not change the calculated balance for a specific row.
- **UI:** 
    - Integrated "Cash Balance Breakdown" section.
    - Integrated `DailyCloseStats` component for the current day's summary.

### 3. Prompt Construction
- I will create a highly descriptive, multi-paragraph prompt that explains the business logic, the technical requirements for data fetching, and the UI specifications.

## Implementation Steps

1.  **Draft the Prompt:** I will create the detailed prompt as a single block of text for the user to copy.
2.  **Display for Review:** Use the Plan tool to show the plan to the user.
