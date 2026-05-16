import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface VendorPayoutHeldEmailProps {
  storeName:  string
  vendorName: string
  amount:     string
  reason:     string
  contactUrl: string
}

export function VendorPayoutHeldEmail({
  storeName,
  vendorName,
  amount,
  reason,
  contactUrl,
}: VendorPayoutHeldEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Payout Reconciliation spec */}
          <Text>Payout held stub — {storeName}, {vendorName}, {amount}, {reason}, {contactUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorPayoutHeldSubject(): string {
  return `Your Vendra payout is on hold`
}
