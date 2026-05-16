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
