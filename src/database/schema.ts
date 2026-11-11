import { pool } from "./pool";

const schemaSql = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VENDOR', 'DELIVERY', 'CUSTOMER');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED_BY_VENDOR', 'PICKED_UP', 'DELIVERED', 'PACKED');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DOUBLE PRECISION NOT NULL,
    mrp DOUBLE PRECISION NOT NULL DEFAULT 0,
    current_selling_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    discount_value DOUBLE PRECISION NOT NULL,
    min_order_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_discount DOUBLE PRECISION,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS delivery_info (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    pincode TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    status "OrderStatus" NOT NULL DEFAULT 'PENDING',
    total_amount DOUBLE PRECISION NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_phone TEXT,
    delivery_email TEXT,
    delivery_latitude DOUBLE PRECISION,
    delivery_longitude DOUBLE PRECISION,
    coupon_id TEXT REFERENCES coupons(id),
    coupon_discount DOUBLE PRECISION NOT NULL DEFAULT 0,
    customer_id TEXT NOT NULL REFERENCES users(id),
    store_id TEXT NOT NULL REFERENCES stores(id),
    delivery_partner_id TEXT REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_stores_vendor_id ON stores(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
  CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
  CREATE INDEX IF NOT EXISTS idx_products_color ON products(color);
  CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
  CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
  CREATE INDEX IF NOT EXISTS idx_delivery_info_user_id ON delivery_info(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
  CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_id ON orders(delivery_partner_id);
  CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON orders(coupon_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

  ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE stores ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE products ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE coupons ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE delivery_info ALTER COLUMN updated_at SET DEFAULT NOW();
  ALTER TABLE orders ALTER COLUMN updated_at SET DEFAULT NOW();
`;

export async function initDb(): Promise<void> {
  await pool.query(schemaSql);
}

