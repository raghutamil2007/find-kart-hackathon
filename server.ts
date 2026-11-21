import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { CATALOG_PRODUCTS } from './src/data/catalog.ts';
import type {
  CartItem,
  DeliveryLocation,
  Order,
  OrderItem,
  OrderShipping,
  SupportTicket,
  SupportTicketCategory,
} from './src/types/findkart.ts';

dotenv.config();

interface StoredUser {
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

interface DatabaseSchema {
  users: StoredUser[];
  supportTickets?: SupportTicket[];
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
}

const PORT = 3000;
const SESSION_COOKIE_NAME = 'findkart_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'findkart-db.json');

if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid database path configuration');
}

const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    ticketId: 'FK-SUP-4892',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-88412',
    category: 'Delivery & Shipping',
    subject: 'Package delayed at Bengaluru hub',
    message:
      'My SoundCore ANC Headphones shipment has been showing at Bengaluru Peenya hub since yesterday evening. Could you check the dispatch status?',
    status: 'Responded',
    createdAt: '2026-11-19T09:15:00.000Z',
    slaDueAt: '2026-11-19T15:15:00.000Z',
    assignedSpecialist: 'Priya Nair · Senior Delivery Specialist',
    replies: [
      {
        id: 'rep_4892_1',
        senderRole: 'specialist',
        senderName: 'Priya Nair',
        senderTitle: 'Senior Delivery Specialist · Bengaluru Support Desk',
        message:
          'Hi! I personally checked with our BlueDart Express hub coordinator in Peenya. Your parcel cleared line-haul sorting this morning and is scheduled for doorstep delivery tomorrow between 10:00 AM and 2:00 PM. We have flagged your pin code for priority dispatch.',
        createdAt: '2026-11-19T11:42:00.000Z',
      },
    ],
  },
  {
    ticketId: 'FK-SUP-4886',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-87904',
    category: 'Returns & Refunds',
    subject: 'Size exchange request for Linen Shirt',
    message:
      'I ordered size L in the UrbanWeave Linen Shirt, and would like to exchange it for size M. Tags and original pouch are intact.',
    status: 'Under Review',
    createdAt: '2026-11-18T14:20:00.000Z',
    slaDueAt: '2026-11-18T20:20:00.000Z',
    assignedSpecialist: 'Rohan Deshmukh · Apparel Care Desk',
    replies: [
      {
        id: 'rep_4886_1',
        senderRole: 'specialist',
        senderName: 'Rohan Deshmukh',
        senderTitle: 'Apparel Care Specialist · Human Review Desk',
        message:
          'Your exchange request is currently under review by our inventory team to reserve size M at our nearest fulfillment center. You will receive your pickup slot confirmation shortly.',
        createdAt: '2026-11-18T16:05:00.000Z',
      },
    ],
  },
  {
    ticketId: 'FK-SUP-4879',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-86219',
    category: 'Payment & Billing',
    subject: 'GST invoice copy needed for order',
    message:
      'Could you please share the itemized GST tax invoice PDF for my recent electronics accessories order?',
    status: 'Resolved',
    createdAt: '2026-11-17T08:10:00.000Z',
    slaDueAt: '2026-11-17T14:10:00.000Z',
    assignedSpecialist: 'Ananya Verma · Billing & GST Desk',
    replies: [
      {
        id: 'rep_4879_1',
        senderRole: 'specialist',
        senderName: 'Ananya Verma',
        senderTitle: 'Billing & GST Specialist',
        message:
          'We have generated and dispatched your signed GST tax invoice (#INV-FK-86219) to your registered email address with HSN codes and CGST/SGST split included.',
        createdAt: '2026-11-17T10:25:00.000Z',
      },
    ],
  },
  {
    ticketId: 'FK-SUP-3994',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-81105',
    category: 'Returns & Refunds',
    subject: 'Refund confirmation for returned kettle',
    message:
      'The delivery partner picked up my returned electric kettle on Monday. Please confirm when the refund will be credited.',
    status: 'Resolved',
    createdAt: '2026-11-12T10:30:00.000Z',
    slaDueAt: '2026-11-12T16:30:00.000Z',
    assignedSpecialist: 'Karthik Rao · Refunds Resolution Team',
    replies: [
      {
        id: 'rep_3994_1',
        senderRole: 'specialist',
        senderName: 'Karthik Rao',
        senderTitle: 'Refunds Resolution Specialist',
        message:
          'Good news — your returned BrewMaster Electric Kettle passed quality inspection at our warehouse, and your full refund has been processed back to your original payment method (Ref #RFND-992041).',
        createdAt: '2026-11-12T13:12:00.000Z',
      },
    ],
  },
];

const SUPPORT_CATEGORIES: SupportTicketCategory[] = [
  'Product',
  'Delivery & Shipping',
  'Returns & Refunds',
  'Payment & Billing',
  'Warranty & Damage',
  'Account & Order',
];

const HUMAN_SPECIALISTS = [
  'Priya Nair · Senior Customer Care Specialist',
  'Rohan Deshmukh · Order Resolution Specialist',
  'Ananya Verma · Delivery & Claims Specialist',
  'Karthik Rao · Customer Experience Desk',
];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDb(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const empty: DatabaseSchema = { users: [], supportTickets: [...INITIAL_SUPPORT_TICKETS] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      supportTickets:
        Array.isArray(parsed.supportTickets) && parsed.supportTickets.length > 0
          ? parsed.supportTickets
          : [...INITIAL_SUPPORT_TICKETS],
    };
  } catch {
    return { users: [], supportTickets: [...INITIAL_SUPPORT_TICKETS] };
  }
}

function writeDb(data: DatabaseSchema): void {
  ensureDataDir();
  const tempPath = path.resolve(DATA_DIR, `findkart-db.${process.pid}.tmp`);
  if (!tempPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp database path');
  }
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_PATH);
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const derived = crypto.scryptSync(password, storedSalt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, storedBuf);
}

function signToken(userId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      email,
      exp: Date.now() + SESSION_TTL_MS,
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token: string): { uid: string; email: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      email: string;
      exp: number;
    };
    if (!decoded.uid || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

function setSessionCookie(res: Response, token: string): void {
  const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    location: user.location,
    cart: user.cart,
    wishlist: user.wishlist,
    orders: user.orders,
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function verifyMutationHeader(req: Request, res: Response): boolean {
  const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
  const hasCustomHeader = req.headers['x-requested-with'] === 'FindKart';
  if (!hasBearer && !hasCustomHeader) {
    res.status(403).json({ message: 'Missing required request verification header.' });
    return false;
  }
  return true;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const claims = token ? verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ message: 'Please sign in to continue.' });
    return;
  }
  const db = readDb();
  const user = db.users.find((u) => u.id === claims.uid);
  if (!user) {
    res.status(401).json({ message: 'Session expired. Please sign in again.' });
    return;
  }
  req.authUser = user;
  next();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

function validateCartItems(rawItems: unknown): CartItem[] {
  if (!Array.isArray(rawItems)) return [];
  const productMap = new Map(CATALOG_PRODUCTS.map((p) => [p.id, p]));
  const sanitized: CartItem[] = [];
  for (const raw of rawItems.slice(0, 50)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.productId !== 'string' || !productMap.has(item.productId)) continue;
    const qty = typeof item.quantity === 'number' && Number.isInteger(item.quantity) ? item.quantity : 1;
    const clampedQty = Math.max(1, Math.min(20, qty));
    const selectedSize = typeof item.selectedSize === 'string' ? item.selectedSize.slice(0, 20) : undefined;
    const selectedColor = typeof item.selectedColor === 'string' ? item.selectedColor.slice(0, 30) : undefined;
    sanitized.push({
      productId: item.productId,
      quantity: clampedQty,
      selectedSize,
      selectedColor,
    });
  }
  return sanitized;
}

function validateWishlistIds(rawIds: unknown): string[] {
  if (!Array.isArray(rawIds)) return [];
  const productSet = new Set(CATALOG_PRODUCTS.map((p) => p.id));
  const unique = new Set<string>();
  for (const id of rawIds.slice(0, 100)) {
    if (typeof id === 'string' && productSet.has(id)) {
      unique.add(id);
    }
  }
  return Array.from(unique);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Auth: Register
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const guestCart = validateCartItems(body.guestCart);
    const guestWishlist = validateWishlistIds(body.guestWishlist);

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ message: 'Please enter your full name (2–80 characters).' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
      return;
    }

    const db = readDb();
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ message: 'An account with this email already exists. Try signing in.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      location: { city: 'Bengaluru', pincode: '560001' },
      cart: guestCart,
      wishlist: guestWishlist,
      orders: [],
    };

    db.users.push(newUser);
    writeDb(db);

    const token = signToken(newUser.id, newUser.email);
    setSessionCookie(res, token);
    res.status(201).json({
      token,
      user: sanitizeUser(newUser),
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const guestCart = validateCartItems(body.guestCart);
    const guestWishlist = validateWishlistIds(body.guestWishlist);

    if (!isValidEmail(email) || password.length < 6) {
      res.status(400).json({ message: 'Enter a valid email address and password.' });
      return;
    }

    const db = readDb();
    const user = db.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      res.status(401).json({ message: 'Invalid email or password. Please check and try again.' });
      return;
    }

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
      writeDb(db);
    }

    const token = signToken(user.id, user.email);
    setSessionCookie(res, token);
    res.json({
      token,
      user: sanitizeUser(user),
    });
  });

  // Auth: Me (Hydrate session)
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;
    if (!claims) {
      res.status(200).json({ user: null });
      return;
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === claims.uid);
    if (!user) {
      res.status(200).json({ user: null });
      return;
    }
    res.json({ user: sanitizeUser(user), token });
  });

  // Auth: Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // User Cart Sync
  app.put('/api/user/cart', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const items = validateCartItems(body.cart);
    const db = readDb();
    const user = db.users.find((u) => u.id === req.authUser?.id);
    if (!user) {
      res.status(401).json({ message: 'Account not found.' });
      return;
    }
    user.cart = items;
    writeDb(db);
    res.json({ cart: user.cart });
  });

  // User Wishlist Sync
  app.put('/api/user/wishlist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const wishlist = validateWishlistIds(body.wishlist);
    const db = readDb();
    const user = db.users.find((u) => u.id === req.authUser?.id);
    if (!user) {
      res.status(401).json({ message: 'Account not found.' });
      return;
    }
    user.wishlist = wishlist;
    writeDb(db);
    res.json({ wishlist: user.wishlist });
  });

  // User Location Sync
  app.put('/api/user/location', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : '';
    const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
    if (!city || !/^\d{6}$/.test(pincode)) {
      res.status(400).json({ message: 'Enter a valid city and 6-digit Indian pin code.' });
      return;
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === req.authUser?.id);
    if (!user) {
      res.status(401).json({ message: 'Account not found.' });
      return;
    }
    user.location = { city, pincode };
    writeDb(db);
    res.json({ location: user.location });
  });

  // Place Order (Works for both authenticated users and guest checkout, calculating totals server-side)
  app.post('/api/orders', (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const validatedItems = validateCartItems(body.items);
    if (validatedItems.length === 0) {
      res.status(400).json({ message: 'Your cart is empty.' });
      return;
    }

    const rawShipping = (body.shipping || {}) as Record<string, unknown>;
    const fullName = typeof rawShipping.fullName === 'string' ? rawShipping.fullName.trim() : '';
    const phone = typeof rawShipping.phone === 'string' ? rawShipping.phone.trim() : '';
    const address = typeof rawShipping.address === 'string' ? rawShipping.address.trim() : '';
    const city = typeof rawShipping.city === 'string' ? rawShipping.city.trim() : '';
    const pincode = typeof rawShipping.pincode === 'string' ? rawShipping.pincode.trim() : '';
    const paymentMethod = rawShipping.paymentMethod === 'upi_on_delivery' ? 'upi_on_delivery' : 'cod';

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ message: 'Enter recipient full name.' });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''))) {
      res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
      return;
    }
    if (address.length < 6 || address.length > 240) {
      res.status(400).json({ message: 'Enter a complete delivery street address.' });
      return;
    }
    if (city.length < 2 || city.length > 60) {
      res.status(400).json({ message: 'Enter a valid city name.' });
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      res.status(400).json({ message: 'Enter a valid 6-digit Indian pin code.' });
      return;
    }

    const productMap = new Map(CATALOG_PRODUCTS.map((p) => [p.id, p]));
    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    let totalMrp = 0;

    for (const item of validatedItems) {
      const prod = productMap.get(item.productId);
      if (!prod) continue;
      subtotal += prod.price * item.quantity;
      totalMrp += prod.originalPrice * item.quantity;
      orderItems.push({
        productId: prod.id,
        name: prod.name,
        brand: prod.brand,
        imageUrl: prod.imageUrl,
        price: prod.price,
        originalPrice: prod.originalPrice,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
      });
    }

    const deliveryFee = subtotal >= 499 ? 0 : 40;
    const total = subtotal + deliveryFee;
    const totalSavings = Math.max(0, totalMrp - subtotal);
    const shipping: OrderShipping = {
      fullName,
      phone: phone.replace(/\s+/g, ''),
      address,
      city,
      pincode,
      paymentMethod,
    };

    const orderNum = 1000 + Math.floor(Math.random() * 9000);
    const order: Order = {
      orderId: `FK-${orderNum}`,
      createdAt: new Date().toISOString(),
      status: 'Confirmed — Preparing Shipment',
      items: orderItems,
      subtotal,
      deliveryFee,
      totalSavings,
      total,
      shipping,
    };

    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;
    if (claims) {
      const db = readDb();
      const user = db.users.find((u) => u.id === claims.uid);
      if (user) {
        user.orders.unshift(order);
        user.cart = [];
        user.location = { city, pincode };
        writeDb(db);
      }
    }

    res.status(201).json({ order });
  });

  // Get Orders for authenticated user
  app.get('/api/orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ orders: req.authUser?.orders || [] });
  });

  // Customer Care: List visible support tickets (user's own tickets + sample reference tickets)
  app.get('/api/support/tickets', (req: Request, res: Response) => {
    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;
    const guestIdsParam = typeof req.query.ticketIds === 'string' ? req.query.ticketIds : '';
    const guestTicketIds = new Set(
      guestIdsParam
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^FK-SUP-\d{4,6}$/.test(id))
        .slice(0, 30)
    );

    const db = readDb();
    const starterIds = new Set(INITIAL_SUPPORT_TICKETS.map((t) => t.ticketId));
    const allTickets = db.supportTickets || [...INITIAL_SUPPORT_TICKETS];

    const visibleTickets = allTickets.filter((ticket) => {
      if (starterIds.has(ticket.ticketId)) return true;
      if (claims && ticket.userId === claims.uid) return true;
      if (!ticket.userId && guestTicketIds.has(ticket.ticketId)) return true;
      return false;
    });

    res.json({ tickets: visibleTickets });
  });

  // Customer Care: Submit new support complaint/ticket
  app.post('/api/support/tickets', (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;

    const body = (req.body || {}) as Record<string, unknown>;
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim().slice(0, 40) : '';
    const rawCategory = typeof body.category === 'string' ? body.category.trim() : 'Product';
    const category: SupportTicketCategory = SUPPORT_CATEGORIES.includes(
      rawCategory as SupportTicketCategory
    )
      ? (rawCategory as SupportTicketCategory)
      : 'Product';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const attachmentName =
      typeof body.attachmentName === 'string' ? body.attachmentName.trim().slice(0, 120) : undefined;
    const attachmentType =
      typeof body.attachmentType === 'string' &&
      ['image/jpeg', 'image/png', 'application/pdf'].includes(body.attachmentType)
        ? body.attachmentType
        : undefined;

    if (customerName.length < 2 || customerName.length > 80) {
      res.status(400).json({ message: 'Please enter your full name (2–80 characters).' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Please enter a valid registered email address.' });
      return;
    }
    if (subject.length < 4 || subject.length > 140) {
      res.status(400).json({ message: 'Please enter a brief subject (4–140 characters).' });
      return;
    }
    if (message.length < 10 || message.length > 2000) {
      res.status(400).json({ message: 'Please describe your issue in at least 10 characters.' });
      return;
    }

    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;

    const db = readDb();
    const allTickets = db.supportTickets || [...INITIAL_SUPPORT_TICKETS];

    let ticketNumber = 4900 + Math.floor(Math.random() * 5000);
    while (allTickets.some((t) => t.ticketId === `FK-SUP-${ticketNumber}`)) {
      ticketNumber = 4900 + Math.floor(Math.random() * 5000);
    }

    const now = new Date();
    const slaDue = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const specialist =
      HUMAN_SPECIALISTS[Math.floor(Math.random() * HUMAN_SPECIALISTS.length)] ||
      HUMAN_SPECIALISTS[0];

    const newTicket: SupportTicket = {
      ticketId: `FK-SUP-${ticketNumber}`,
      userId: claims?.uid,
      customerName,
      email,
      orderId: orderId || 'General Inquiry',
      category,
      subject,
      message,
      attachmentName: attachmentName || undefined,
      attachmentType,
      status: 'Under Review',
      createdAt: now.toISOString(),
      slaDueAt: slaDue.toISOString(),
      assignedSpecialist: specialist,
      replies: [
        {
          id: `rep_${crypto.randomUUID().slice(0, 8)}`,
          senderRole: 'specialist',
          senderName: specialist.split(' · ')[0],
          senderTitle: `${specialist.split(' · ')[1] || 'Human Support Desk'} · 6-Hour SLA Queue`,
          message: `Ticket logged for ${customerName}. Assigned directly to ${specialist.split(' · ')[0]} for human review. No automated AI replies — you will receive a personal response within 6 hours at ${email}.`,
          createdAt: now.toISOString(),
        },
      ],
    };

    db.supportTickets = [newTicket, ...allTickets].slice(0, 200);
    writeDb(db);

    res.status(201).json({ ticket: newTicket });
  });

  // Customer Care: Add follow-up message or mark ticket resolved
  app.post('/api/support/tickets/:ticketId/reply', (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const ticketId = typeof req.params.ticketId === 'string' ? req.params.ticketId.trim() : '';
    if (!/^FK-SUP-\d{4,6}$/.test(ticketId)) {
      res.status(400).json({ message: 'Invalid support ticket ID.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const senderName = typeof body.senderName === 'string' ? body.senderName.trim().slice(0, 80) : 'Customer';
    if (message.length < 2 || message.length > 1500) {
      res.status(400).json({ message: 'Please enter a follow-up message (2–1500 characters).' });
      return;
    }

    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;

    const db = readDb();
    const tickets = db.supportTickets || [...INITIAL_SUPPORT_TICKETS];
    const ticket = tickets.find((t) => t.ticketId === ticketId);
    if (!ticket) {
      res.status(404).json({ message: 'Support ticket not found.' });
      return;
    }
    if (ticket.userId && ticket.userId !== claims?.uid) {
      res.status(403).json({ message: 'You do not have permission to update this ticket.' });
      return;
    }

    ticket.replies.push({
      id: `rep_${crypto.randomUUID().slice(0, 8)}`,
      senderRole: 'customer',
      senderName: senderName || ticket.customerName,
      message,
      createdAt: new Date().toISOString(),
    });
    if (ticket.status === 'Resolved') {
      ticket.status = 'Under Review';
    }

    db.supportTickets = tickets;
    writeDb(db);
    res.json({ ticket });
  });

  app.patch('/api/support/tickets/:ticketId', (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const ticketId = typeof req.params.ticketId === 'string' ? req.params.ticketId.trim() : '';
    if (!/^FK-SUP-\d{4,6}$/.test(ticketId)) {
      res.status(400).json({ message: 'Invalid support ticket ID.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    if (body.status !== 'Resolved') {
      res.status(400).json({ message: 'Unsupported status update.' });
      return;
    }

    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;

    const db = readDb();
    const tickets = db.supportTickets || [...INITIAL_SUPPORT_TICKETS];
    const ticket = tickets.find((t) => t.ticketId === ticketId);
    if (!ticket) {
      res.status(404).json({ message: 'Support ticket not found.' });
      return;
    }
    if (ticket.userId && ticket.userId !== claims?.uid) {
      res.status(403).json({ message: 'You do not have permission to update this ticket.' });
      return;
    }

    ticket.status = 'Resolved';
    db.supportTickets = tickets;
    writeDb(db);
    res.json({ ticket });
  });

  // Ensure unknown /api/* paths always return JSON instead of falling through to index.html
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  // Ensure JSON middleware/parse errors always return JSON instead of Express HTML error pages
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.path.startsWith('/api')) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 400;
      const message =
        status === 413
          ? 'Request payload is too large.'
          : err instanceof SyntaxError
            ? 'Invalid JSON request payload.'
            : 'Unable to process request.';
      res.status(status).json({ message });
      return;
    }
    next(err);
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FindKart server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FindKart server:', err);
  process.exit(1);
});
