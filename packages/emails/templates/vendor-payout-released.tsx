import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface VendorPayoutReleasedEmailProps {
  storeName:    string
  vendorName:   string
  amount:       string
  period:       string
  dashboardUrl: string
}

export function VendorPayoutReleasedEmail({
  storeName,
  vendorName,
  amount,
  period,
  dashboardUrl,
}: VendorPayoutReleasedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Payout Reconciliation spec */}
          <Text>Payout released stub — {storeName}, {vendorName}, {amount}, {period}, {dashboardUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorPayoutReleasedSubject(amount: string): string {
  return `Payout of ${amount} released — Vendra`
}
