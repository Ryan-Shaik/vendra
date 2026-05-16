import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface DisputeResolvedEmailProps {
  orderId:        string
  disputeId:      string
  resolutionType: string
  resolutionNote: string
}

export function DisputeResolvedEmail({
  orderId,
  disputeId,
  resolutionType,
  resolutionNote,
}: DisputeResolvedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Dispute Resolution spec */}
          <Text>Dispute resolved stub — {orderId}, {disputeId}, {resolutionType}, {resolutionNote}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function disputeResolvedSubject(orderId: string): string {
  return `Dispute resolved for order #${orderId}`
}
