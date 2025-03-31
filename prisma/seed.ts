// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Define the default tags you want to create
const defaultTags = [
  { name: 'Personal', slug: 'personal' },
  { name: 'Work', slug: 'work' },
  { name: 'Health', slug: 'health' },
  { name: 'Technology', slug: 'technology' },
  { name: 'Finance', slug: 'finance' },
  { name: 'Entertainment', slug: 'entertainment' },
  { name: 'Travel', slug: 'travel' }, // Added based on earlier UI screenshots
  { name: 'Education', slug: 'education' }, // Added based on earlier UI screenshots
  { name: 'Other', slug: 'other' },
  // Add any more default tags here
];

async function main() {
  console.log(`Seeding database with default tags...`);

  for (const tagData of defaultTags) {
    // Use prisma.tag.upsert:
    // - If a tag with the specified 'slug' exists, it does nothing (update: {}).
    // - If it doesn't exist, it creates the new tag using the 'create' data.
    // This makes the seed script safe to run multiple times without errors.
    const tag = await prisma.tag.upsert({
      where: { slug: tagData.slug }, // Unique identifier to check for existence
      update: {}, // What to do if found (nothing in this case)
      create: {
        // Data to use if not found
        name: tagData.name,
        slug: tagData.slug,
      },
    });
    console.log(`Upserted tag: ${tag.name} (ID: ${tag.id})`);
  }

  console.log(`Seeding finished.`);
}

// Execute the main function and handle errors/cleanup
main()
  .then(async () => {
    // Disconnect Prisma Client on success
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // Log errors and disconnect Prisma Client on failure
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1); // Exit with error code
  });
