import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface OrderShippedEmailProps {
  orderId:        string
  customerName:   string
  carrier:        string
  trackingNumber: string
  trackingUrl:    string
}

export function OrderShippedEmail({
  orderId,
  customerName,
  carrier,
  trackingNumber,
  trackingUrl,
}: OrderShippedEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Order Management spec */}
          <Text>Order shipped stub — {orderId}, {customerName}, {carrier}, {trackingNumber}, {trackingUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function orderShippedSubject(orderId: string): string {
  return `Your order #${orderId} has shipped`
}
