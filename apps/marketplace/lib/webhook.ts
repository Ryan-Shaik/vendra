/**
 * Standard webhook handler wrapper.
 * Enforces: signature verification runs first, returns 400 on failure.
 * Handler runs only after verification succeeds.
 * Returns 500 on internal errors so the sender retries.
 */
export async function handleWebhook<TEvent>(
  req:    Request,
  verify: (req: Request) => Promise<TEvent>,
  handle: (event: TEvent) => Promise<Response>,
): Promise<Response> {
  let event: TEvent

  try {
    event = await verify(req)
  } catch (error) {
    console.error('[webhook] Signature verification failed:', error)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    return await handle(event)
  } catch (error) {
    console.error('[webhook] Handler error:', error)
    // Return 500 so the sender (Stripe, Svix) retries delivery
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
