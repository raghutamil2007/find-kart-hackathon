-- FindKart PostgreSQL Schema

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  city VARCHAR(80) DEFAULT 'Bengaluru',
  pincode VARCHAR(10) DEFAULT '560001',
  cart JSONB DEFAULT '[]'::jsonb,
  wishlist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(100) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) NOT NULL,
  total_savings NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  shipping JSONB NOT NULL,
  items JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 3. Customer Care Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  ticket_id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  order_id VARCHAR(60) DEFAULT 'General Inquiry',
  category VARCHAR(60) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  attachment_name VARCHAR(160),
  attachment_type VARCHAR(60),
  status VARCHAR(40) NOT NULL DEFAULT 'Under Review',
  sla_due_at TIMESTAMPTZ NOT NULL,
  assigned_specialist VARCHAR(160) NOT NULL,
  replies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON support_tickets(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- 4. Live Stock Inventory Overrides Table
CREATE TABLE IF NOT EXISTS stock_overrides (
  product_id VARCHAR(100) PRIMARY KEY,
  stock INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Restock Notification Subscriptions Table
CREATE TABLE IF NOT EXISTS stock_notifications (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  email VARCHAR(160) NOT NULL,
  status VARCHAR(40) DEFAULT 'Subscribed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_notif_email ON stock_notifications(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_stock_notif_product ON stock_notifications(product_id);
