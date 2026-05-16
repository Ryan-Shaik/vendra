import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe =
  globalForStripe.stripe ??
  new Stripe(stripeSecretKey, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe
}
