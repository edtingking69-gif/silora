# AI Rules & Architecture Guidelines

## Tech Stack Overview
- **Core Framework**: React 18 (TypeScript) with Vite build tool.
- **Styling**: Tailwind CSS configured with a custom color palette (`ink`, `primary`, `accent`, `success`, `warning`, `error`), custom animations, and Plus Jakarta Sans typography.
- **Routing**: Custom lightweight hash-based router (`src/components/router/Router.tsx`) supporting URL synchronization, parameters (`matchRoute`), programmatic navigation (`navigate`), and `<Link>` components.
- **Backend & Database**: Supabase (`@supabase/supabase-js`) providing PostgreSQL database, user authentication, row-level security (RLS), and custom RPC functions (`create_order`, `submit_payment`, `admin_revenue_*`, etc.).
- **Storage**: Supabase Storage bucket (`silora`) for uploading product images, category banners, and payment QR codes.
- **Icons**: `lucide-react` for consistent, accessible UI iconography.
- **Global State Management**: React Context providers (`AuthContext`, `CartContext`, `ToastContext`) for global authentication, cart persistence, and toast notifications.
- **PWA**: Service Worker (`public/sw.js`) and Web App Manifest (`public/manifest.json`) for installability and caching.

---

## Library & Tooling Rules: What to Use for What

### 1. Routing & Navigation
- **Rule**: Use the built-in hash router from `@/components/router/Router`.
- **Navigation**: Use `navigate('/path')` for programmatic page transitions.
- **Links**: Use `<Link to="/path">` rather than standard `<a>` tags for internal navigation.
- **Route Matching**: Use `useRoute()` to read the active path, and `matchRoute(pattern, path)` for route parameters (e.g., `/product/:id`, `/account/orders/:id`).

### 2. UI Components & Design System
- **Rule**: Use the custom components in `src/components/ui/` or build on Tailwind utility classes.
- **Primitives**:
  - `Button` for all CTA and secondary button elements.
  - `Input`, `Textarea`, `Select` for form fields.
  - `Modal` and `ConfirmDialog` for popups and destructive actions.
  - `Badge` for order statuses, payment badges, product tags.
  - `Stars` for star rating displays.
  - `EmptyState` for empty lists/data placeholders.
  - `Skeleton`, `GridSkeleton` for loading placeholders.
- **Icons**: Always import icons exclusively from `lucide-react`.

### 3. Styling & Theming
- **Rule**: Use Tailwind utility classes following the design tokens defined in `tailwind.config.js`.
- **Colors**:
  - `primary-*` for brand accents, primary buttons, and CTA highlights (Orange/Amber).
  - `ink-*` for backgrounds, surfaces, text, and borders (Neutral slate/charcoal tones).
  - `accent-*` for secondary highlights and category accents (Cyan/Teal).
  - `success-*`, `warning-*`, `error-*` for status-specific indicators and badges.
- **Containers**: Use `.container-silora` for consistent responsive max-width layout padding.
- **Formatting helpers**: Use `formatINR`, `formatDate`, `formatDateTime`, `discountPercent`, `classNames`, and `slugify` from `@/utils/format`.

### 4. Backend, Database & RPC Operations
- **Rule**: Always interface with Supabase through `@/lib/supabase` or helper methods in `@/services/api`.
- **Authentication**: Use `useAuth()` hook (`signIn`, `signUp`, `signOut`, `user`, `profile`, `isAdmin`).
- **Cart**: Use `useCart()` hook (`items`, `addToCart`, `updateQuantity`, `removeItem`, `clearCart`).
- **Sensitive / Complex Operations**: Use Supabase RPCs for transaction-critical tasks:
  - `create_order` for checkout calculation and order creation.
  - `submit_payment` for submitting transaction reference / UTR.
  - `update_payment_status` & `update_order_delivery_status` for order management.
  - `admin_revenue_*` for dashboard revenue aggregation.

### 5. Notifications & Feedback
- **Rule**: Use the `useToast()` hook (`toast(message, type)`) to notify users on successful actions or error feedback.
- Do not use browser `alert()` or `confirm()`; use `toast()` and `<ConfirmDialog />`.

---

## Code Structure & Conventions
- `src/components/ui/`: Generic reusable UI primitives.
- `src/components/router/`: Custom hash router implementation.
- `src/contexts/`: React context providers (`AuthContext`, `CartContext`, `ToastContext`).
- `src/layouts/`: Shell layouts (`StoreLayout` for customer-facing store, `AdminLayout` for admin portal).
- `src/pages/`: Customer-facing pages (`HomePage`, `ProductsPage`, `ProductDetailPage`, `CartPage`, `CheckoutPage`, `AccountPage`, `OrderDetailPage`, `LoginPage`, `SignupPage`).
- `src/pages/admin/`: Admin management pages (`AdminDashboard`, `AdminProducts`, `AdminOrders`, `AdminPayments`, `AdminCategories`, `AdminCustomers`, `AdminPaymentMethods`, `AdminQrCodes`, `AdminShipping`, `AdminCoupons`, `AdminAdmins`, `AdminSettings`).
- `src/services/api.ts`: Centralized async API query wrappers.
- `src/types/`: TypeScript interface and type declarations.
- `src/utils/`: Formatting and utility helper functions.