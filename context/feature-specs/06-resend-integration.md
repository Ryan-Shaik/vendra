# Spec: Resend + React Email Integration

> Read `AGENTS.md` before starting.
> The service layer spec must be complete before starting this spec.
> This spec covers the `packages/emails` shared package used by both apps.

---

## Objective

Set up Resend and React Email as the transactional email system for the platform.
All 14 email templates are created here as stubs — full content is filled in
as each feature spec is implemented.

The output of this spec is:
- A `packages/emails` shared package with a `sendEmail()` wrapper
- A Resend client singleton
- 14 typed React Email template stubs
- A barrel export so both apps import cleanly from `@vendra/emails`
- A live preview server for developing templates

---

## Step 1 — Dashboard setup

1. Go to [resend.com](https://resend.com) and create an account
2. Go to **API Keys** → **Create API Key**
   - Name: `vendra-marketplace`
   - Permission: **Sending access** only — not full access
3. Copy the API key (`re_...`)
4. **Domain setup (optional but recommended for production):**
   - Go to **Domains** → **Add Domain**
   - Add your domain and follow the DNS verification steps
   - Once verified, use `noreply@yourdomain.com` as the sender
   - Without a verified domain: use `onboarding@resend.dev` — this works in
     development but Resend will only deliver to your own verified email address

---

## Step 2 — Package setup

Create `packages/emails/` as a standalone package in the monorepo.

### `packages/emails/package.json`

```json
{
  "name": "@vendra/emails",
  "version": "0.0.1",
  "main": "./index.ts",
  "scripts": {
    "email:preview": "email dev --dir ./templates --port 3002"
  },
  "dependencies": {
    "resend": "^4.0.0",
    "@react-email/components": "^0.0.27",
    "react-email": "^3.0.0",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.0.0"
  }
}
```

Install from `packages/emails`:

```bash
npm install
```

> Install in `packages/emails` only — not in `apps/marketplace` or `apps/admin`.
> Both apps import from `@vendra/emails` via the workspace reference.

---

## Step 3 — Environment variables

Add to monorepo root `.env` and `.env.example`:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Vendra <noreply@yourdomain.com>"
# During development without a verified domain:
# RESEND_FROM_EMAIL="Vendra <onboarding@resend.dev>"
```

Add to `apps/marketplace/lib/env.ts` and `apps/admin/lib/env.ts`:

```ts
RESEND_API_KEY:    z.string().min(1),
RESEND_FROM_EMAIL: z.string().min(1),
```

Add to both apps' `package.json` dependencies:

```json
{
  "dependencies": {
    "@vendra/emails": "workspace:*"
  }
}
```

---

## Step 4 — Resend client singleton

Create `packages/emails/client.ts`:

```ts
import { Resend } from 'resend'

const globalForResend = globalThis as unknown as {
  resend: Resend | undefined
}

export const resend =
  globalForResend.resend ??
  new Resend(process.env.RESEND_API_KEY)

if (process.env.NODE_ENV !== 'production') {
  globalForResend.resend = resend
}
```

> The singleton pattern prevents multiple Resend client instances during
> Next.js hot reloads in development — same pattern as the Prisma client.

---

## Step 5 — `sendEmail()` wrapper

Create `packages/emails/send.ts`.

All email sending across the entire platform goes through this single function.
Never call `resend.emails.send()` directly in feature code.

```ts
import { jsx } from 'react/jsx-runtime'
import { resend } from './client'
import { type ServiceResult, ok, err } from '@vendra/types'

interface SendEmailOptions {
  to:       string | string[]
  subject:  string
  template: React.ComponentType<any>
  props:    Record<string, unknown>
  replyTo?: string
  tags?:    Array<{ name: string; value: string }>
}

/**
 * Sends a transactional email using a React Email template.
 * Returns ServiceResult — never throws.
 *
 * @example
 * const { data, error } = await sendEmail({
 *   to:       'vendor@example.com',
 *   subject:  'Your store has been approved',
 *   template: VendorApprovedEmail,
 *   props:    { storeName: 'Artisan Co.', vendorName: 'Jane', dashboardUrl: '...' },
 * })
 * if (error) console.error('Email failed:', error.message)
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { data, error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to:      options.to,
      subject: options.subject,
      react:   jsx(options.template, options.props),
      replyTo: options.replyTo,
      tags:    options.tags,
    })

    if (error) {
      console.error('[sendEmail] Resend API error:', error)
      return err('EXTERNAL_SERVICE_ERROR', 'Failed to send email', 502)
    }

    return ok({ id: data!.id })
  } catch (e) {
    console.error('[sendEmail] Unexpected error:', e)
    return err('INTERNAL_ERROR', 'Email service unavailable', 500)
  }
}
```

> **Why `jsx` from `react/jsx-runtime`?**
> `send.ts` is a `.ts` file — JSX syntax requires a `.tsx` extension.
> `jsx(Component, props)` renders a React element without JSX syntax,
> allowing email components to be rendered in a plain TypeScript file.
> Template files are `.tsx` and use normal JSX — only `send.ts` needs this.

---

## Step 6 — Email templates

Create the following files in `packages/emails/templates/`.
Each template exports a React component and a subject line helper function.
At this stage, write complete markup only for `vendor-approved.tsx` —
the rest are stubs with minimal placeholder content.
Full content for each template is completed in the relevant feature spec.

```
packages/emails/templates/
  vendor-approved.tsx         ← Complete — used immediately in Vendor Onboarding spec
  vendor-rejected.tsx         ← Stub
  vendor-suspended.tsx        ← Stub
  vendor-new-order.tsx        ← Stub
  vendor-payout-released.tsx  ← Stub
  vendor-payout-held.tsx      ← Stub
  order-confirmation.tsx      ← Stub
  order-shipped.tsx           ← Stub
  order-delivered.tsx         ← Stub
  dispute-opened.tsx          ← Stub
  dispute-resolved.tsx        ← Stub
  customer-welcome.tsx        ← Stub
  admin-role-changed.tsx      ← Stub
```

### Complete template — `packages/emails/templates/vendor-approved.tsx`

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface VendorApprovedEmailProps {
  storeName:    string
  vendorName:   string
  dashboardUrl: string
}

export function VendorApprovedEmail({
  storeName,
  vendorName,
  dashboardUrl,
}: VendorApprovedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your store {storeName} has been approved on Vendra</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Welcome to Vendra, {vendorName}
          </Heading>
          <Text style={styles.text}>
            Your store <strong>{storeName}</strong> has been approved.
            Complete your onboarding to start listing products and receiving orders.
          </Text>
          <Section style={{ marginTop: '24px' }}>
            <Button href={dashboardUrl} style={styles.button}>
              Complete onboarding
            </Button>
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Vendra Marketplace &middot; Questions? Reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorApprovedSubject(storeName: string): string {
  return `Your store "${storeName}" is approved — welcome to Vendra`
}

const styles = {
  body: {
    backgroundColor: '#F9F8F6',
    fontFamily:      'sans-serif',
  },
  container: {
    maxWidth:  '600px',
    margin:    '0 auto',
    padding:   '40px 20px',
  },
  heading: {
    color:      '#1C1C1A',
    fontSize:   '24px',
    fontWeight: '700',
    margin:     '0 0 16px',
  },
  text: {
    color:      '#6B6B67',
    fontSize:   '16px',
    lineHeight: '1.6',
  },
  button: {
    backgroundColor: '#1A6B4A',
    color:           '#FFFFFF',
    padding:         '12px 24px',
    borderRadius:    '10px',
    textDecoration:  'none',
    display:         'inline-block',
  },
  hr: {
    borderColor: 'rgba(28,28,26,0.12)',
    margin:      '32px 0',
  },
  footer: {
    color:    '#6B6B67',
    fontSize: '12px',
  },
} as const
```

### Stub template pattern

Write all remaining 12 templates as stubs following this exact pattern:

```tsx
// packages/emails/templates/vendor-rejected.tsx
import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface VendorRejectedEmailProps {
  storeName:  string
  vendorName: string
  reason:     string
}

export function VendorRejectedEmail({
  storeName,
  vendorName,
  reason,
}: VendorRejectedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Vendor Onboarding spec */}
          <Text>Vendor rejected stub — {storeName}, {vendorName}, {reason}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorRejectedSubject(storeName: string): string {
  return `Update on your Vendra application for "${storeName}"`
}
```

**Props for each stub template:**

| Template | Props |
|----------|-------|
| `vendor-rejected` | `storeName`, `vendorName`, `reason` |
| `vendor-suspended` | `storeName`, `vendorName`, `reason` |
| `vendor-new-order` | `storeName`, `orderId`, `orderTotal`, `itemCount`, `dashboardUrl` |
| `vendor-payout-released` | `storeName`, `vendorName`, `amount`, `period`, `dashboardUrl` |
| `vendor-payout-held` | `storeName`, `vendorName`, `amount`, `reason`, `contactUrl` |
| `order-confirmation` | `orderId`, `customerName`, `items`, `total`, `trackingUrl` |
| `order-shipped` | `orderId`, `customerName`, `carrier`, `trackingNumber`, `trackingUrl` |
| `order-delivered` | `orderId`, `customerName`, `reviewUrl` |
| `dispute-opened` | `orderId`, `disputeId`, `raisedBy`, `reason` |
| `dispute-resolved` | `orderId`, `disputeId`, `resolutionType`, `resolutionNote` |
| `customer-welcome` | `customerName` |
| `admin-role-changed` | `recipientName`, `oldRole`, `newRole` |

---

## Step 7 — Barrel export

Create `packages/emails/index.ts`:

```ts
// Core
export { resend }    from './client'
export { sendEmail } from './send'

// Templates
export {
  VendorApprovedEmail,
  vendorApprovedSubject,
} from './templates/vendor-approved'
export {
  VendorRejectedEmail,
  vendorRejectedSubject,
} from './templates/vendor-rejected'
export {
  VendorSuspendedEmail,
  vendorSuspendedSubject,
} from './templates/vendor-suspended'
export {
  VendorNewOrderEmail,
  vendorNewOrderSubject,
} from './templates/vendor-new-order'
export {
  VendorPayoutReleasedEmail,
  vendorPayoutReleasedSubject,
} from './templates/vendor-payout-released'
export {
  VendorPayoutHeldEmail,
  vendorPayoutHeldSubject,
} from './templates/vendor-payout-held'
export {
  OrderConfirmationEmail,
  orderConfirmationSubject,
} from './templates/order-confirmation'
export {
  OrderShippedEmail,
  orderShippedSubject,
} from './templates/order-shipped'
export {
  OrderDeliveredEmail,
  orderDeliveredSubject,
} from './templates/order-delivered'
export {
  DisputeOpenedEmail,
  disputeOpenedSubject,
} from './templates/dispute-opened'
export {
  DisputeResolvedEmail,
  disputeResolvedSubject,
} from './templates/dispute-resolved'
export {
  CustomerWelcomeEmail,
  customerWelcomeSubject,
} from './templates/customer-welcome'
export {
  AdminRoleChangedEmail,
  adminRoleChangedSubject,
} from './templates/admin-role-changed'
```

---

## Step 8 — Preview server

The React Email preview server lets you develop and review templates with live reload.
Run it separately from the Next.js dev server:

```bash
cd packages/emails
npm run email:preview
# Opens http://localhost:3002
```

> Use port `3002` to avoid conflicts with `apps/marketplace` on `3000`
> and the Inngest dev server on `3001`.

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

- [ ] `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set
- [ ] `packages/emails` installs and compiles without TypeScript errors
- [ ] `import { sendEmail, VendorApprovedEmail } from '@vendra/emails'` resolves
      in both `apps/marketplace` and `apps/admin`
- [ ] `sendEmail()` delivers a real email in development:
  ```ts
  const { data, error } = await sendEmail({
    to:       'your@email.com',
    subject:  'Test email',
    template: VendorApprovedEmail,
    props: {
      storeName:    'Test Store',
      vendorName:   'Test User',
      dashboardUrl: 'http://localhost:3000/vendor/dashboard',
    },
  })
  // data.id should be a Resend email ID string
  ```
- [ ] The email arrives in the inbox with the correct subject and content
- [ ] `sendEmail()` returns `err('EXTERNAL_SERVICE_ERROR', ...)` when called
      with an invalid API key — not a thrown exception
- [ ] `npm run email:preview` opens at `http://localhost:3002` and renders
      the `VendorApprovedEmail` template correctly
- [ ] All 13 template files exist — stubs are acceptable for all except `vendor-approved`
- [ ] All template files export both a component and a subject helper function
- [ ] `npm run build` passes in `apps/marketplace` and `apps/admin`
- [ ] `progress-tracker.md` Resend sub-task checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `resend.emails.send()` called in feature code | Always call `sendEmail()` from `@vendra/emails` |
| JSX syntax in `send.ts` | Use `jsx()` from `react/jsx-runtime` — `send.ts` is `.ts` not `.tsx` |
| Inline styles as separate objects per element | Extract to a `styles` const at the bottom of each template |
| One template file for all emails | One file per email — named after the event that triggers it |
| Skip the subject helper function | Every template exports both component and `[name]Subject()` helper |
| `RESEND_FROM_EMAIL` without a display name | Use `"Vendra <noreply@domain.com>"` format |
| Call `sendEmail()` inside a Server Component directly | Call via a Server Action or Inngest job — keep email sending out of render |