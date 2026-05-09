import { prisma } from '../index'

async function test() {
  console.log('Testing Cart owner check constraint...')
  
  // Test 1: Both NULL (Should fail)
  try {
    await prisma.cart.create({
      data: {
        customerId: null,
        guestSessionId: null,
      },
    })
    console.log('❌ Error: Created cart with both NULL (should have failed)')
  } catch (e) {
    console.log('✅ Success: Correctly failed to create cart with both NULL')
  }

  // Test 2: Both set (Should fail)
  try {
    // We need a customer to reference
    const customer = await prisma.customer.findFirst()
    if (customer) {
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          guestSessionId: 'guest-123',
        },
      })
      console.log('❌ Error: Created cart with both set (should have failed)')
    } else {
      console.log('⚠️ Skipping Test 2: No customer found in DB')
    }
  } catch (e) {
    console.log('✅ Success: Correctly failed to create cart with both set')
  }

  // Test 3: Guest without expiresAt (Should fail)
  try {
    await prisma.cart.create({
      data: {
        guestSessionId: 'guest-456',
        expiresAt: null,
      },
    })
    console.log('❌ Error: Created guest cart without expiresAt (should have failed)')
  } catch (e) {
    console.log('✅ Success: Correctly failed to create guest cart without expiresAt')
  }

  // Test 4: Customer with expiresAt (Should fail)
  try {
    const customer = await prisma.customer.findFirst()
    if (customer) {
      await prisma.cart.create({
        data: {
          customerId: customer.id,
          expiresAt: new Date(),
        },
      })
      console.log('❌ Error: Created customer cart with expiresAt (should have failed)')
    }
  } catch (e) {
    console.log('✅ Success: Correctly failed to create customer cart with expiresAt')
  }
}

test()
