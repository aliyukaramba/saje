// Seeds roles, permissions, restaurant settings, a super admin, and DEMO menu data.
// Demo menu items are placeholders, prefixed "Demo", and can be deleted in the admin area.
// Run with: npm run seed -w @restaurant/database
// Required env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (min 10 chars). Never commit these values.
import path from "node:path";
import { config } from "dotenv";
// Load packages/database/.env so the seed works in any terminal, not only ones where DATABASE_URL is set.
config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { PERMISSIONS, ROLE_KEYS, ROLE_PERMISSIONS, argon2Hasher } from "@restaurant/shared";

const db = new PrismaClient();

const ROLE_NAMES: Record<(typeof ROLE_KEYS)[number], string> = {
  super_admin: "Super Administrator",
  restaurant_manager: "Restaurant Manager",
  cashier: "Cashier",
  kitchen_staff: "Kitchen Staff",
  waiter: "Waiter",
  delivery_staff: "Delivery Staff",
  inventory_manager: "Inventory Manager",
};

async function seedPermissionsAndRoles() {
  for (const key of PERMISSIONS) {
    await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const key of ROLE_KEYS) {
    const role = await db.role.upsert({
      where: { key },
      update: { name: ROLE_NAMES[key] },
      create: { key, name: ROLE_NAMES[key] },
    });
    const perms = await db.permission.findMany({ where: { key: { in: [...ROLE_PERMISSIONS[key]] } } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
}

async function seedSettings() {
  await db.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: process.env.RESTAURANT_NAME ?? "Restaurant",
      currency: "NGN",
      pickupEnabled: true,
      deliveryEnabled: false,
    },
  });
}

async function seedSuperAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("Skipping super admin: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.");
    return;
  }
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");
  const existing = await db.user.findFirst({ where: { email } });
  const user = existing ?? await db.user.create({
    data: { email, fullName: "Super Administrator", kind: "STAFF", passwordHash: await argon2Hasher.hash(password) },
  });
  const role = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  console.log(`Super admin ready: ${email}`);
}

async function seedDemoMenu() {
  const categories = [
    { slug: "demo-starters", name: "Demo Starters", sortOrder: 1 },
    { slug: "demo-mains", name: "Demo Mains", sortOrder: 2 },
    { slug: "demo-drinks", name: "Demo Drinks", sortOrder: 3 },
  ];
  const cat: Record<string, string> = {};
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug }, update: {}, create: c,
    });
    cat[c.slug] = row.id;
  }
  const products = [
    { slug: "demo-spring-rolls", categoryId: cat["demo-starters"], name: "Demo Spring Rolls", description: "Placeholder item. Replace in the admin area.", basePrice: "2500.00", isFeatured: true, sortOrder: 1 },
    { slug: "demo-jollof-rice", categoryId: cat["demo-mains"], name: "Demo Jollof Rice", description: "Placeholder item. Replace in the admin area.", basePrice: "4500.00", isFeatured: true, sortOrder: 1 },
    { slug: "demo-grilled-chicken", categoryId: cat["demo-mains"], name: "Demo Grilled Chicken", description: "Placeholder item. Replace in the admin area.", basePrice: "6000.00", discountPrice: "5500.00", sortOrder: 2 },
    { slug: "demo-chilled-juice", categoryId: cat["demo-drinks"], name: "Demo Chilled Juice", description: "Placeholder item. Replace in the admin area.", basePrice: "1200.00", sortOrder: 1 },
  ];
  for (const p of products) {
    await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug, categoryId: p.categoryId, name: p.name, description: p.description,
        basePrice: p.basePrice, discountPrice: p.discountPrice ?? null,
        isFeatured: p.isFeatured ?? false, sortOrder: p.sortOrder,
      },
    });
  }
}

async function main() {
  await seedPermissionsAndRoles();
  await seedSettings();
  await seedSuperAdmin();
  await seedDemoMenu();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
