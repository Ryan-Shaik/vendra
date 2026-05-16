import { serve }  from 'inngest/next'
import { inngest } from '@vendra/jobs/client'
import { createStripeConnectAccountJob } from '@vendra/jobs/stripe-connect.job'

// Register all Inngest functions here as they are created in future specs
export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    createStripeConnectAccountJob,
    // Add more jobs here in subsequent specs
  ],
})
