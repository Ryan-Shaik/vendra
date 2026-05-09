import { prisma } from '../index'

async function test() {
  console.log('Testing CommissionConfig check constraint...')
  try {
    await prisma.commissionConfig.create({
      data: {
        scope: 'vendor',
        vendorId: null, // Should fail
        rate: 0.05,
        createdBy: 'test',
      },
    })
    console.log('❌ Error: Created vendor commission with null vendorId (should have failed)')
  } catch (e) {
    console.log('✅ Success: Correctly failed to create vendor commission with null vendorId')
  }

  try {
    await prisma.commissionConfig.create({
      data: {
        scope: 'global',
        vendorId: 'some-id', // Should fail
        rate: 0.05,
        createdBy: 'test',
      },
    })
    console.log('❌ Error: Created global commission with non-null vendorId (should have failed)')
  } catch (e) {
    console.log('✅ Success: Correctly failed to create global commission with non-null vendorId')
  }
}

test()
