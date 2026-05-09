# Multi-Vendor E-Commerce Marketplace

## Overview

This project is a modern multi-vendor e-commerce marketplace that enables multiple independent sellers to list, manage, and sell their products through a single, unified storefront. It is designed for entrepreneurs, retail aggregators, and platform operators who want to launch a scalable online marketplace — similar to Amazon or Etsy — without building everything from scratch. The platform solves the core challenge of coordinating vendors, payments, orders, and customers in one cohesive system, while giving each seller their own branded space to operate.

## Goals

1. Launch a fully functional multi-vendor marketplace where vendors can independently register, manage their catalog, and fulfill orders
2. Provide a seamless, trust-building shopping experience for customers — from discovery to checkout to delivery tracking
3. Establish a sustainable revenue model through automated commission calculation, explicit Super Admin-gated payout reconciliation, and scalable infrastructure
4. Give platform operators full control through a governed admin system — with clear separation between Super Admin financial authority and Moderator operational duties

## Core User Flow

> **Single entry point:** Every user starts at `vendra.com`. Customers browse immediately. Vendors register or log in from the homepage and are redirected to their portal automatically. Admins access a completely separate application at `admin.vendra.com` — this subdomain is unreachable from the main marketplace.

### Customer Flow
1. Customer lands on `vendra.com` and browses the marketplace without signing in — no account required to discover or search products
2. Customer filters and searches products by category, price, rating, vendor, or stock status
3. Customer adds items to cart; cart persists via session for guest users
4. At checkout, customer chooses to continue as guest, sign in, or create a free account; a guest cart is merged into the authenticated cart if they sign in
5. Customer completes checkout: enters shipping address (saved to address book if authenticated), selects shipping method, and pays via Stripe
6. The order is automatically routed to the relevant vendor(s)
7. Customer receives an order confirmation email; authenticated customers can also track the order in their account
8. Customer receives the order and — if authenticated and verified as a buyer — is prompted to leave a rating and review

### Vendor Flow
1. Vendor lands on `vendra.com` and clicks "Start Selling" in the homepage navigation
2. Vendor completes the dedicated vendor registration form (business name, contact details) and creates a Clerk account — role is set to `vendor`, status set to `pending`
3. A Moderator or Super Admin reviews the application via `admin.vendra.com` and approves or rejects it
4. Approved vendor receives a confirmation email and returns to `vendra.com` to log in — they are automatically redirected to `vendra.com/vendor/dashboard` based on their role
5. Vendor completes all required onboarding steps: store profile (name, logo, description), at least one shipping zone configured, and Stripe Connect Express onboarding (KYC + bank details) — products cannot be published until all steps are complete
6. Vendor adds products to their catalog with variants (size, color, SKU), pricing, images, and stock quantities
7. Vendor fulfills incoming orders: marks items as shipped, adds tracking numbers, and monitors shipment status in real time
8. Platform calculates commission at order time (snapshotted rate), generates a reconciliation report at the end of each settlement period, and disburses payouts after explicit Super Admin release

### Admin Flow

> Admins never interact with `vendra.com`. All admin activity happens exclusively at `admin.vendra.com` — a separate Next.js application with its own Clerk instance, middleware, and Vercel deployment.

#### Super Admin
1. Super Admin navigates to `admin.vendra.com` and signs in with their `super_admin` Clerk account — unauthenticated visitors are redirected to the login page
2. Lands on the Super Admin dashboard: platform-wide revenue, vendor count, active orders, and pending payout batches
3. Configures commission rates: global default, category-level overrides, and per-vendor overrides
4. At the end of each settlement period, reviews the reconciliation report and releases or holds each payout batch — no Stripe Transfer executes without this explicit action
5. Manages the admin team: creates moderator accounts, promotes existing users to moderator or super_admin, demotes or deactivates accounts (cannot act on their own account)
6. Configures platform-wide settings: return window, shipping rules, featured vendor slots

#### Moderator
1. Moderator navigates to `admin.vendra.com` and signs in with their `moderator` Clerk account — automatically redirected away from Super Admin-only sections
2. Reviews the vendor application queue — approves or rejects pending applications with a reason note
3. Reviews flagged product listings — delists or reinstates products that violate platform policy
4. Reviews escalated disputes from customers or vendors — issues platform-level refunds, partial refunds, or dismisses with a resolution note
5. All actions are written to the activity log with timestamp and actor ID

## Features

### I. Auth & Accounts

- Split entry points — "Shop Now" (customer) vs "Start Selling" (vendor) registration flows
- Customer account creation: email + password or Google OAuth; role assigned automatically
- Email verification enforced on all new accounts (Clerk-native)
- Password reset / forgot password flow (Clerk-native)
- Guest checkout — no account required to browse or purchase
- Guest-to-authenticated cart merge on sign-in
- Customer saved address book — multiple addresses, default address selection
- Customer-to-vendor upgrade path via "Become a Seller" in account settings

### II. Platform Administration

- **Super Admin** — full platform access:
  - Commission rate configuration (global, per-category, per-vendor override)
  - Payout reconciliation review with manual hold/release per batch — no automatic transfers
  - Platform-wide settings: return window, shipping rules, featured vendor slots
  - Admin role management: create moderators, promote any user to moderator or super_admin, demote, deactivate (cannot act on own account)
  - Full visibility into all moderation actions
- **Moderator** — scoped operational access:
  - Vendor application queue: approve, reject, suspend
  - Product moderation: review flagged listings, delist or reinstate
  - Dispute resolution: issue platform refunds, partial refunds, or dismiss
  - No access to financial configuration, commission rates, or payout controls
- Admin activity log — every admin action recorded with timestamp, actor ID, and affected entity

### III. Vendor Management

- Vendor registration and multi-step onboarding flow
- Onboarding completeness gate — vendor cannot publish products until store profile, shipping zone, and Stripe Connect are all complete
- Stripe Connect Express onboarding — KYC and bank account setup for payouts
- Vendor dashboard: sales overview, order volume, earnings summary, inventory alerts
- Vendor catalog management: add, edit, publish, unpublish products
- Product variants: size, color, material, or any custom attribute with individual SKU and pricing
- Per-variant inventory tracking with automatic out-of-stock status when stock reaches zero
- In-app real-time notifications for new orders, order status changes, payout events, and dispute updates
- Mobile-responsive vendor interface

### IV. Storefront & Discovery

- Marketplace-friendly homepage: hero, featured vendors, category navigation
- Product listing page (PLP) with Algolia-powered search and filters: price range, category, rating, vendor, in-stock only
- Product detail page (PDP): image gallery, variant selector, stock indicator, vendor badge, ratings summary
- Vendor store page: hero banner, vendor info, full product grid, average rating
- SEO optimisation: `generateMetadata` for all PDP, PLP, and vendor store pages
- Ratings and reviews: post-delivery prompt, star rating, written review; purchase-verified eligibility gate (only customers with a delivered order may review)
- Seller profile pages

### V. Cart & Checkout

- Persistent cart: session-based for guests, database-backed for authenticated customers
- Multi-vendor cart: single checkout across products from multiple vendors
- Checkout flow: address entry (auto-populated from address book if authenticated), shipping method selection, order summary
- Stripe-powered payment with automatic commission split via Stripe Connect
- Order confirmation: email for all users (guest and authenticated); order tracking page for authenticated customers
- Invoicing: PDF invoice generated and emailed on order confirmation

### VI. Order Management

- Automated order routing to the correct vendor(s) on payment confirmation
- Vendor fulfillment: mark as shipped, add carrier and tracking number
- Real-time shipment tracking visible to both vendor and customer
- Customer order history in account dashboard
- Returns flow: customer initiates return, vendor reviews and accepts/rejects, platform refund issued
- Dispute escalation to platform: enters moderator queue for resolution
- Custom transactional email notifications for all order lifecycle events

### VII. Payments, Commissions & Reconciliation

- Commission engine: three-tier rate resolution — global default → category override → per-vendor override; most specific rate wins
- Commission snapshotted at order creation — rate changes never affect existing orders
- Vendor earnings dashboard: per-order breakdown, commission deducted, net earnings, payout history
- Reconciliation report generated by Inngest job at end of each settlement period
- Super Admin payout review: hold or release each vendor payout batch
- Stripe Transfer executed only after explicit Super Admin release
- Vendor payout confirmation email on release; hold notification email when flagged

### VIII. Security & Compliance

- Role-based access control: `customer`, `vendor`, `moderator`, `super_admin` — enforced at middleware and route handler level
- All vendor data strictly scoped by `vendorId` — no cross-vendor data access
- Atomic stock decrements inside Prisma transactions at order placement
- Stripe webhook signature verification before any handler executes
- Idempotent webhook processing — duplicate events never processed twice
- Data encryption at rest (Supabase) and in transit (TLS)
- Full admin activity audit log
- Scalable infrastructure via Vercel edge + Supabase horizontal scaling

### IX. Support & Extensibility

- Comprehensive documentation: README, API reference, vendor onboarding guide
- Open APIs for third-party integrations

## Scope

### In Scope

- End-to-end vendor onboarding with a completeness gate before publishing
- Vendor Stripe Connect Express onboarding (KYC + bank details)
- Customer-facing marketplace storefront with cart, checkout, and order tracking
- Guest checkout with optional post-purchase account creation and cart merge
- Product variants (size, color, SKU) with per-variant inventory tracking
- Commission engine with global, category, and per-vendor override tiers
- Explicit Super Admin payout release gate — no automatic transfers
- Admin panel with separate Super Admin and Moderator access zones
- Super Admin role management — promote, demote, deactivate any user account
- In-app real-time notifications for vendors and admins (Supabase Realtime)
- Order routing, shipping integrations, returns, and dispute escalation
- Review system with purchase-verified eligibility gate
- Core security: data encryption, role-based access control, audit logs
- SEO, mobile-responsive design, and Core Web Vitals optimisation

### Out of Scope

- Native mobile apps (iOS/Android) — mobile support is web-responsive only at launch
- Custom AI/ML-powered recommendation engine
- Warehousing or fulfillment center management
- Social commerce features (live shopping, shoppable posts)
- Multi-currency or multi-language support (Phase 1)

## Success Criteria

1. A vendor can register via the "Start Selling" flow, complete onboarding, and publish a product listing within 15 minutes
2. A vendor cannot publish products until all required onboarding steps — store profile, shipping zone, and Stripe Connect — are completed
3. A customer can browse, add to cart, and complete checkout as a guest — with no account required
4. A customer can optionally create an account and see full order history, tracking, and review history in their profile
5. A guest customer's cart is preserved and merged correctly when they sign in or create an account during checkout
6. Products with variants correctly track and decrement stock per variant at order placement, and go out-of-stock automatically when exhausted
7. Vendor and customer roles are correctly assigned by Clerk at the point of registration — a vendor sign-up never creates a customer account and vice versa
8. A Super Admin can promote any user to moderator, demote a moderator, and deactivate admin accounts — but cannot demote or deactivate their own account
9. A Super Admin dashboard gives access to financial config, commission rates, payout controls, and admin management — none of which are accessible to a Moderator
10. A Moderator dashboard gives access to vendor approvals, product moderation, and dispute resolution only
11. Only customers with a verified, delivered order for a product can submit a review for that product
12. Orders are automatically routed to the correct vendor upon payment confirmation
13. Commission is automatically calculated, snapshotted at order creation, and reflected in the vendor dashboard
14. Shipment tracking status is updated in real time and visible to both vendor and customer
15. The platform sustains performance under a load of 10,000 concurrent users without degradation

---

## Feature Prioritization

### ✅ MVP Features
*Core features required for a functional, launchable marketplace.*

| # | Feature | Category |
|---|---------|----------|
| 0a | Guest checkout (no account required) | Customer Auth |
| 0b | Customer account creation (email / Google OAuth) | Customer Auth |
| 0c | Split entry points — "Shop Now" vs "Start Selling" | Auth & Onboarding |
| 0d | Role assignment at registration (customer vs vendor) | Auth & Onboarding |
| 0e | Super Admin + Moderator sub-roles with separate dashboard access | Auth & Onboarding |
| 0f | Guest-to-authenticated cart merge at sign-in | Customer Auth |
| 0g | Admin role management — promote, demote, deactivate any user | Platform Admin |
| 0h | Email verification on all new accounts (Clerk-native) | Auth & Onboarding |
| 0i | Password reset / forgot password flow (Clerk-native) | Auth & Onboarding |
| 1 | Cart (persists for guests and signed-in customers) | Website Design |
| 2 | Marketplace-friendly theme | Website Design |
| 4 | Checkout | Website Design |
| 6 | Ratings and reviews | Website Design |
| 9 | Seller profile | Website Design |
| 10 | SEO for multi-vendor marketplace | Website Design |
| 11 | Vendor registration & onboarding | Vendor Management |
| 12 | Vendor dashboards | Vendor Management |
| 14 | Vendor permissions | Vendor Management |
| 16 | Vendor catalog | Vendor Management |
| 18 | Mobile support | Vendor Management |
| 19 | Commission calculation | Payments |
| 20 | Payment integrations | Payments |
| 21 | Reconciliation and accounts | Payments |
| 22 | Order automation / routing | Order Management |
| 23 | Shipping integrations | Order Management |
| 24 | Shipment tracking | Order Management |
| 25 | Invoicing | Order Management |
| 27 | Returns | Order Management |
| 28 | Custom email notifications | Order Management |
| 30 | Scalability | Security |
| 31 | Data security | Security |
| 37 | Documentation | Support |
| 40 | Open APIs | Support |
| A1 | Vendor application review & approval/rejection | Platform Admin |
| A2 | Vendor suspension / ban | Platform Admin |
| A3 | Global commission rate configuration | Platform Admin |
| A4 | Payout reconciliation review + hold/release | Platform Admin |
| A5 | Dispute resolution centre | Platform Admin |
| A6 | Product flagging and delisting | Platform Admin |
| A7 | Admin activity log | Platform Admin |
| B1 | Product variants (size, color, SKU) | Catalog |
| B2 | Inventory tracking per variant + out-of-stock automation | Catalog |
| B3 | Vendor onboarding completeness gate (must complete all steps before publishing) | Vendor Onboarding |
| B4 | Stripe Connect Express onboarding for vendors (KYC + bank details) | Payments |
| B5 | In-app notifications for vendors and admins (Supabase Realtime) | Notifications |
| B6 | Customer saved address book | Customer Account |
| B7 | Search filters on PLP (price range, category, rating, vendor, in-stock) | Storefront |
| B8 | Review eligibility gate (purchased + delivered orders only) | Reviews |

---

### 🔜 Post-MVP Features
*Enhancements that add value after the core platform is stable.*

| # | Feature | Category | Rationale |
|---|---------|----------|-----------|
| 3 | Custom fields and pages | Website Design | Nice-to-have flexibility, not blocking launch |
| 5 | Pincode restriction | Website Design | Useful for hyperlocal marketplaces; add once core checkout is stable |
| 7 | Whitelabel | Website Design | Relevant for B2B/SaaS licensing model, not Day 1 |
| 8 | Type of marketplace configuration | Website Design | Expand beyond B2C after validating core model |
| 13 | Vendor website sync | Vendor Management | Reduces friction for established vendors; complex to build reliably |
| 15 | Vendor-customer chat | Vendor Management | Valuable for trust, but adds moderation complexity |
| 17 | Analytics (advanced) | Vendor Management | Basic metrics in MVP; deeper analytics in Phase 2 |
| 26 | NDR handling | Order Management | Needed at scale; low priority for early order volumes |
| 29 | Digital products | Order Management | Separate fulfillment path; address after physical goods are stable |
| 32 | Traceability and change logs | Security | Important for compliance at scale, not blocking MVP |
| 33 | Tax compliance | Compatible Apps | Integrate after core payments are verified |
| 34 | Subscriptions | Compatible Apps | Requires separate billing infrastructure |
| 35 | Upsell and cross-sell | Compatible Apps | Revenue optimization; add once catalog is mature |
| 36 | CRM | Compatible Apps | Useful for retention; third-party integration in Phase 2 |
| 38 | Customization support | Support | Offer as a paid service post-launch |
| 39 | Live chat support | Support | Staff and tooling needed; prioritize async support first |
