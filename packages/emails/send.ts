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
