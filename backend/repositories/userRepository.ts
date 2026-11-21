import { query } from '../db.ts';
import type { CartItem, DeliveryLocation, Order } from '../../src/types/findkart.ts';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  location: DeliveryLocation;
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  city: string;
  pincode: string;
  cart: CartItem[];
  wishlist: string[];
  created_at: Date | string;
}

function mapRowToUser(row: UserRow, orders: Order[] = []): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    location: {
      city: row.city || 'Bengaluru',
      pincode: row.pincode || '560001',
    },
    cart: Array.isArray(row.cart) ? row.cart : [],
    wishlist: Array.isArray(row.wishlist) ? row.wishlist : [],
    orders,
  };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const userRes = await query<UserRow>(
    `SELECT id, name, email, password_hash, password_salt, city, pincode, cart, wishlist, created_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email.trim()]
  );

  if (userRes.rows.length === 0) return null;
  const row = userRes.rows[0];

  const ordersRes = await query(
    `SELECT order_id as "orderId", created_at as "createdAt", status,
            subtotal::float, delivery_fee::float as "deliveryFee",
            total_savings::float as "totalSavings", total::float,
            shipping, items
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [row.id]
  );

  const orders = ordersRes.rows.map((o) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
  })) as Order[];

  return mapRowToUser(row, orders);
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const userRes = await query<UserRow>(
    `SELECT id, name, email, password_hash, password_salt, city, pincode, cart, wishlist, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (userRes.rows.length === 0) return null;
  const row = userRes.rows[0];

  const ordersRes = await query(
    `SELECT order_id as "orderId", created_at as "createdAt", status,
            subtotal::float, delivery_fee::float as "deliveryFee",
            total_savings::float as "totalSavings", total::float,
            shipping, items
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [row.id]
  );

  const orders = ordersRes.rows.map((o) => ({
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
  })) as Order[];

  return mapRowToUser(row, orders);
}

export async function createUser(user: StoredUser): Promise<StoredUser> {
  await query(
    `INSERT INTO users (id, name, email, password_hash, password_salt, city, pincode, cart, wishlist, created_at)
     VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       cart = EXCLUDED.cart,
       wishlist = EXCLUDED.wishlist`,
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.passwordSalt,
      user.location.city,
      user.location.pincode,
      JSON.stringify(user.cart),
      JSON.stringify(user.wishlist),
      user.createdAt,
    ]
  );

  return user;
}

export async function updateUserCart(userId: string, cart: CartItem[]): Promise<CartItem[]> {
  await query(
    `UPDATE users SET cart = $1::jsonb WHERE id = $2`,
    [JSON.stringify(cart), userId]
  );
  return cart;
}

export async function updateUserWishlist(userId: string, wishlist: string[]): Promise<string[]> {
  await query(
    `UPDATE users SET wishlist = $1::jsonb WHERE id = $2`,
    [JSON.stringify(wishlist), userId]
  );
  return wishlist;
}

export async function updateUserLocation(
  userId: string,
  location: DeliveryLocation
): Promise<DeliveryLocation> {
  await query(
    `UPDATE users SET city = $1, pincode = $2 WHERE id = $3`,
    [location.city, location.pincode, userId]
  );
  return location;
}

export async function mergeGuestData(
  user: StoredUser,
  guestCart: CartItem[],
  guestWishlist: string[]
): Promise<StoredUser> {
  let modified = false;

  if (guestCart.length > 0) {
    for (const gItem of guestCart) {
      const existing = user.cart.find(
        (c) =>
          c.productId === gItem.productId &&
          c.selectedSize === gItem.selectedSize &&
          c.selectedColor === gItem.selectedColor
      );
      if (existing) {
        existing.quantity = Math.min(20, existing.quantity + gItem.quantity);
      } else {
        user.cart.push(gItem);
      }
    }
    modified = true;
  }

  if (guestWishlist.length > 0) {
    const merged = new Set([...user.wishlist, ...guestWishlist]);
    user.wishlist = Array.from(merged);
    modified = true;
  }

  if (modified) {
    await query(
      `UPDATE users SET cart = $1::jsonb, wishlist = $2::jsonb WHERE id = $3`,
      [JSON.stringify(user.cart), JSON.stringify(user.wishlist), user.id]
    );
  }

  return user;
}
