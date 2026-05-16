import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface DisputeOpenedEmailProps {
  orderId:   string
  disputeId: string
  raisedBy:  string
  reason:    string
}

export function DisputeOpenedEmail({
  orderId,
  disputeId,
  raisedBy,
  reason,
}: DisputeOpenedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Dispute Resolution spec */}
          <Text>Dispute opened stub — {orderId}, {disputeId}, {raisedBy}, {reason}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function disputeOpenedSubject(orderId: string): string {
  return `Dispute opened for order #${orderId}`
}
