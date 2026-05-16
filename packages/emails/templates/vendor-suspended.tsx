import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface VendorSuspendedEmailProps {
  storeName:  string
  vendorName: string
  reason:     string
}

export function VendorSuspendedEmail({
  storeName,
  vendorName,
  reason,
}: VendorSuspendedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Vendor Suspension spec */}
          <Text>Vendor suspended stub — {storeName}, {vendorName}, {reason}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorSuspendedSubject(storeName: string): string {
  return `Important update about your Vendra store "${storeName}"`
}
