# Complete Database SQL

This folder contains the full Supabase/Postgres schema for **Easy Kisti Shop**, so you can spin up the exact same backend on a new Supabase project (for example, after remixing this Lovable project).

## Files

- **`complete_schema.sql`** — All migrations concatenated in chronological order. Contains:
  - All ENUM types (`app_role`, `sale_status`, `installment_status`, `attendance_status`, `payment_type`, `adjustment_type`)
  - All tables (`shops`, `products`, `customers`, `sales`, `sale_items`, `installments`, `installment_payments`, `purchases`, `purchase_items`, `purchase_payments`, `suppliers`, `expenses`, `cash_book`, `staff`, `staff_access`, `shop_users`, `attendance`, `stock_adjustments`, `sales_returns`, `sales_return_items`, `guarantors`, `categories`, `expense_categories`, `profiles`, `user_roles`, `telegram_subscribers`, `telegram_link_codes`, `staff_activity_logs`)
  - All GRANTs, RLS policies, and security-definer functions (`has_role`, `is_super_admin`, `user_in_shop`, `user_can_access_shop`, etc.)
  - All triggers (stock updates, installment/purchase payment recompute, `handle_new_user`, timestamp triggers, etc.)
  - The `handle_new_user` trigger on `auth.users` that auto-creates profile + role

## How to use on a brand new Supabase project

1. Create a new project at https://supabase.com/dashboard
2. Open **SQL Editor → New query**
3. Copy the entire contents of `complete_schema.sql` and paste
4. Click **Run**
5. In **Storage**, create three public buckets:
   - `product-images` (public)
   - `avatars` (public)
   - `kyc-docs` (public)
6. In **Authentication → Providers**, enable **Email** (and disable "Confirm email" for faster testing, if desired)
7. In your `.env` (or Lovable Cloud settings) set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
8. Deploy the edge functions from `supabase/functions/` and set their secrets (`TELEGRAM_API_KEY`, etc.)
9. Sign up your first user — they will automatically become **admin** (via `handle_new_user`)

## Notes

- The file is a full concatenation of every migration in `supabase/migrations/`. Later migrations may `ALTER` or `DROP` things from earlier ones — this is intentional and safe when run top-to-bottom.
- Re-generate this file after new migrations by running:
  ```bash
  {
    echo "-- COMPLETE DATABASE SCHEMA"
    for f in $(ls supabase/migrations/*.sql | sort); do
      echo ""; echo "-- === $(basename $f) ==="; cat "$f"; echo ""
    done
  } > database/complete_schema.sql
  ```
