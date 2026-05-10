## লক্ষ্য

আপনার staff system-কে production-grade করা — mobile+password login, multi-shop selection, staff-specific dashboard (ক্রয়মূল্য সম্পূর্ণ লুকানো), এবং প্রতিটি staff-এর activity history tracking।

## ১. Staff form — mobile + password login + shop selection

`src/pages/Staff.tsx`-এ side-sheet update:
- Email field সরিয়ে **Mobile Number** field। Phone-ই login identifier।
- Password field থাকবে।
- নতুন **Shop নির্বাচন** dropdown — super admin / multi-shop owner-এর জন্য সব shop list থেকে choose করা যাবে। Single shop হলে auto-select।
- "Login তৈরি করুন" toggle মানে এই phone+password দিয়ে staff app-এ ঢুকতে পারবে।

## ২. Edge function — phone-based auth

`supabase/functions/create-shop-user/index.ts` update:
- Body: `{ phone, password, full_name, shop_id, staff_id, permissions }`।
- Internally synthetic email তৈরি: `<digits>@staff.local` (Supabase Auth-এর জন্য email লাগে, কিন্তু user phone দিয়েই login করবে)।
- `phone` field auth user-এ সংরক্ষণ + `shop_users.email` জায়গায় phone store।
- Login screen-এ user phone টাইপ করলে আমরা সেটাকে `<digits>@staff.local`-এ map করে `signInWithPassword` করব।

## ৩. Login flow update

`src/pages/Auth.tsx`-এ একটি tab/toggle: **"Email দিয়ে"** / **"Mobile দিয়ে"**।  
Mobile mode: phone + password → internally email = `<digits>@staff.local` বানিয়ে `signInWithPassword`।

## ৪. Staff Dashboard (আলাদা view, ক্রয়মূল্য সম্পূর্ণ গোপন)

নতুন `src/pages/StaffDashboard.tsx`:
- শুধু দেখাবে: আজকের বিক্রয়, মোট বিক্রয় (এই মাস), মাসিক order সংখ্যা, আজকের order, top selling products (qty only), নিজের attendance/সালামি info।
- **কখনোই দেখাবে না**: cost, purchase price, profit, supplier dues, expenses, cash book balance, stock valuation।
- Routing: `useShop`-এর `permissions`-এ `dashboard` থাকলে role=`staff` user `/`-এ গেলে `StaffDashboard` render হবে; admin হলে existing `Dashboard`।

## ৫. ক্রয়মূল্য hide — global guard

Staff role-এর জন্য সব page-এ cost/purchase fields লুকাতে একটি hook: `useCanSeeCost()` → admin/super_admin হলে `true`, staff হলে `false`।  
Update করতে হবে: `Products.tsx`, `StockLedger.tsx`, `Reports.tsx`, `Purchases.tsx`, `Dashboard.tsx`-এ যে যে cost/profit column আছে। Staff-এর menu থেকে Purchases/Stock-Ledger/Reports/Suppliers default-এ off থাকবে presets-এ; কেউ accidental ON করলেও cost column দেখা যাবে না।

## ৬. Staff activity history

নতুন table `staff_activity_logs`:
- fields: `staff_id`, `user_id`, `shop_id`, `action` (e.g. `sale.create`, `expense.create`, `login`), `entity_type`, `entity_id`, `meta jsonb`, `created_at`।
- RLS: admin সব দেখতে পারবে; staff শুধু নিজের।
- App-এর key mutation point-এ helper `logActivity(action, entity, meta)` call করব (POS sale create, expense create, customer create, login)।

নতুন page `src/pages/StaffHistory.tsx` (route `/staff/:id/history`):
- উপরে staff profile card (নাম, পদ, phone, joined date, total actions)।
- Tabs: **সব Activity**, **বিক্রয়**, **খরচ**, **হাজিরা**, **Login**।
- Date range filter, search, pagination।
- Timeline-style list with icon per action type।

## ৭. Staff page UI overhaul (professional)

`src/pages/Staff.tsx` redesign:
- Header summary: Total staff, Active, Total monthly salary।
- Search + filter by position।
- Card grid → richer card: avatar initial, name, position chip, phone, salary, "শেষ activity" timestamp, এবং card-এ click করলে `/staff/:id/history`-এ যাবে।
- Card-এ ছোট action buttons: History, Edit, Delete (admin only)।

## Technical notes (developer-only)

- Phone→email mapping: stripped digits + `@staff.local`। Auth user-এ `phone` metadata-ও store করে রাখব future-proofing-এর জন্য।
- `useAuth` hook থেকে `role` পাওয়া যায় — staff dashboard switching ও cost-hiding সেখান থেকেই driven।
- Activity logging fire-and-forget (`.then()` ছাড়া await), fail হলে main flow break করবে না।
- Migration একটাই: `staff_activity_logs` table + RLS + index on `(staff_id, created_at desc)`।

## ক্রম

1. Migration: `staff_activity_logs` (approval নেব)।
2. Edge function update (phone-based)।
3. `Auth.tsx` mobile login tab।
4. `Staff.tsx` form (mobile + shop select) + UI overhaul।
5. `StaffDashboard.tsx` + routing switch।
6. `useCanSeeCost` hook + cost-column guard সব relevant page-এ।
7. `StaffHistory.tsx` + activity log helper + key mutation points-এ hook করা।