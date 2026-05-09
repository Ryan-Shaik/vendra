import { prisma } from '../index';
async function main() {
    console.log('🌱 Seeding database...');
    // 1. Default global commission config
    const existingConfig = await prisma.commissionConfig.findFirst({
        where: { scope: 'global', scopeId: null },
    });
    if (!existingConfig) {
        await prisma.commissionConfig.create({
            data: {
                scope: 'global',
                scopeId: null,
                rate: 0.08, // 8% — Default commission rate
                createdBy: 'seed',
                note: 'Default global commission rate set at platform launch',
            },
        });
        console.log('✅ Default CommissionConfig created (8%)');
    }
    else {
        console.log('⏭️  CommissionConfig already exists — skipping');
    }
    // 2. Root categories
    const rootCategories = [
        { name: 'Fashion', slug: 'fashion' },
        { name: 'Electronics', slug: 'electronics' },
        { name: 'Home & Living', slug: 'home-living' },
        { name: 'Health & Beauty', slug: 'health-beauty' },
        { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
        { name: 'Handmade & Crafts', slug: 'handmade-crafts' },
        { name: 'Books & Stationery', slug: 'books-stationery' },
        { name: 'Food & Grocery', slug: 'food-grocery' },
    ];
    for (const cat of rootCategories) {
        await prisma.category.upsert({
            where: { slug: cat.slug },
            update: {},
            create: cat,
        });
    }
    console.log(`✅ ${rootCategories.length} root categories seeded`);
    console.log('🏁 Seeding complete.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
