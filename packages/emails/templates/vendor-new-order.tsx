import { Html, Head, Body, Container, Text } from '@react-email/components'
import * as React from 'react'

interface VendorNewOrderEmailProps {
  storeName:    string
  orderId:      string
  orderTotal:   string
  itemCount:    number
  dashboardUrl: string
}

export function VendorNewOrderEmail({
  storeName,
  orderId,
  orderTotal,
  itemCount,
  dashboardUrl,
}: VendorNewOrderEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          {/* TODO: Complete in Order Management spec */}
          <Text>New order stub — {storeName}, {orderId}, {orderTotal}, {itemCount}, {dashboardUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function vendorNewOrderSubject(orderId: string): string {
  return `New order received — #${orderId}`
}
