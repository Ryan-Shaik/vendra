import Stripe from 'stripe'
import * as dotenv from 'dotenv'

dotenv.config({ path: 'apps/marketplace/.env.local' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

async function run() {
  try {
    const res = await stripe.accounts.list({ limit: 1 })
    console.log('Stripe SDK connection successful. Total accounts returned:', res.data.length)
  } catch(e) {
    console.error('Error connecting to Stripe:', e)
  }
}
run()
