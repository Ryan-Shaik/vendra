import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface CustomerWelcomeEmailProps {
  customerName: string
}

export function CustomerWelcomeEmail({
  customerName,
}: CustomerWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Customer Onboarding spec */}
          <Text>Customer welcome stub — {customerName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function customerWelcomeSubject(): string {
  return `Welcome to Vendra — start shopping`
}
