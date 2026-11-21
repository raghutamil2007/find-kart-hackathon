import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { CATALOG_PRODUCTS } from './src/data/catalog.ts';
import {
  publishOrderPlaced,
  publishStockUpdate,
  publishStockNotification,
  publishChatEvent,
} from './src/kafka/publishers.ts';
import { getProducer, disconnectProducer } from './src/kafka/kafka.ts';
import type {
  CartItem,
  DeliveryLocation,
  Order,
  OrderItem,
  OrderShipping,
  StockNotification,
  SupportTicket,
  SupportTicketCategory,
} from './src/types/findkart.ts';
import {
  buildDeterministicStockReply,
  getProductStock,
  searchProductsWithStock,
} from './src/utils/stock.ts';
import {
  isPostgresConfigured,
  testConnection,
  initPostgresDatabase,
  userRepo,
  orderRepo,
  supportRepo,
  stockRepo,
  aivenService,
} from './backend/index.ts';

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
  stockOverrides?: Record<string, number>;
  stockNotifications?: StockNotification[];
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

let isPgActive = false;

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
      stockOverrides: parsed.stockOverrides || {},
      stockNotifications: Array.isArray(parsed.stockNotifications) ? parsed.stockNotifications : [],
    };
  } catch {
    return { users: [], supportTickets: [...INITIAL_SUPPORT_TICKETS], stockOverrides: {}, stockNotifications: [] };
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

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  const claims = token ? verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ message: 'Please sign in to continue.' });
    return;
  }

  let user: StoredUser | null | undefined = null;
  if (isPgActive) {
    try {
      user = await userRepo.findUserById(claims.uid);
    } catch (err) {
      console.error('[PostgreSQL] Error in requireAuth user lookup:', err);
    }
  }

  if (!user) {
    const db = readDb();
    user = db.users.find((u) => u.id === claims.uid);
  }

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

  // Check and initialize PostgreSQL backend
  if (isPostgresConfigured()) {
    try {
      const conn = await testConnection();
      if (conn.connected) {
        const initRes = await initPostgresDatabase();
        if (initRes.success) {
          isPgActive = true;
          console.log(`[Database] PostgreSQL active and connected (${conn.latencyMs}ms).`);
        } else {
          console.warn(`[Database] PostgreSQL init warning: ${initRes.message}. Running in local JSON fallback mode.`);
        }
      } else {
        console.warn(`[Database] PostgreSQL connection failed: ${conn.error}. Running in local JSON fallback mode.`);
      }
    } catch (err: unknown) {
      console.warn('[Database] PostgreSQL startup error:', err);
    }
  } else {
    console.log('[Database] PostgreSQL not configured (DATABASE_URL unset). Running in local JSON fallback mode.');
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      database: isPgActive ? 'postgresql' : 'file-fallback',
    });
  });

  // DB Status Endpoint
  app.get('/api/db/status', async (_req: Request, res: Response) => {
    const configured = isPostgresConfigured();
    const conn = configured ? await testConnection() : { connected: false };
    res.json({
      configured,
      active: isPgActive,
      mode: isPgActive ? 'postgresql' : 'file-fallback',
      connection: conn,
    });
  });

  // Aiven Open Source Service Diagnostics & Metrics Endpoint
  app.get('/api/aiven/status', async (_req: Request, res: Response) => {
    try {
      const status = await aivenService.getAivenServiceStatus();
      res.json(status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // Auth: Register
  app.post('/api/auth/register', async (req: Request, res: Response) => {
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

    if (isPgActive) {
      const existing = await userRepo.findUserByEmail(email);
      if (existing) {
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

      await userRepo.createUser(newUser);
      const token = signToken(newUser.id, newUser.email);
      setSessionCookie(res, token);
      res.status(201).json({
        token,
        user: sanitizeUser(newUser),
      });
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
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const guestCart = validateCartItems(body.guestCart);
    const guestWishlist = validateWishlistIds(body.guestWishlist);

    if (!isValidEmail(email) || password.length < 6) {
      res.status(400).json({ message: 'Enter a valid email address and password.' });
      return;
    }

    if (isPgActive) {
      const user = await userRepo.findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
        res.status(401).json({ message: 'Invalid email or password. Please check and try again.' });
        return;
      }
      if (guestCart.length > 0 || guestWishlist.length > 0) {
        await userRepo.mergeGuestData(user, guestCart, guestWishlist);
      }
      const token = signToken(user.id, user.email);
      setSessionCookie(res, token);
      res.json({
        token,
        user: sanitizeUser(user),
      });
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
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;
    if (!claims) {
      res.status(200).json({ user: null });
      return;
    }

    if (isPgActive) {
      const user = await userRepo.findUserById(claims.uid);
      if (!user) {
        res.status(200).json({ user: null });
        return;
      }
      res.json({ user: sanitizeUser(user), token });
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
  app.put('/api/user/cart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const items = validateCartItems(body.cart);

    if (isPgActive && req.authUser) {
      const cart = await userRepo.updateUserCart(req.authUser.id, items);
      res.json({ cart });
      return;
    }

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
  app.put('/api/user/wishlist', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const wishlist = validateWishlistIds(body.wishlist);

    if (isPgActive && req.authUser) {
      const updatedWishlist = await userRepo.updateUserWishlist(req.authUser.id, wishlist);
      res.json({ wishlist: updatedWishlist });
      return;
    }

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
  app.put('/api/user/location', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : '';
    const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
    if (!city || !/^\d{6}$/.test(pincode)) {
      res.status(400).json({ message: 'Enter a valid city and 6-digit Indian pin code.' });
      return;
    }

    if (isPgActive && req.authUser) {
      const location = await userRepo.updateUserLocation(req.authUser.id, { city, pincode });
      res.json({ location });
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
  app.post('/api/orders', async (req: Request, res: Response) => {
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

    if (isPgActive) {
      const overrides = await stockRepo.getStockOverrides();
      const updates: Record<string, number> = {};
      for (const item of orderItems) {
        const prod = productMap.get(item.productId);
        if (prod) {
          const currentStock = getProductStock(prod, overrides);
          const newStock = Math.max(0, currentStock - item.quantity);
          overrides[prod.id] = newStock;
          updates[prod.id] = newStock;
        }
      }
      await stockRepo.batchUpdateStockOverrides(updates);
      await orderRepo.createOrder(order, claims?.uid);

      // ── Kafka: publish ORDER_PLACED + per-item STOCK_UPDATED events ──
      const kafkaUserId = claims?.uid ?? 'guest';
      publishOrderPlaced(order, kafkaUserId).catch((e) =>
        console.warn('[Kafka] ORDER_PLACED publish failed:', e),
      );
      for (const item of orderItems) {
        const prod = productMap.get(item.productId);
        if (prod) {
          const newStock = updates[prod.id] ?? 0;
          const prevStock = newStock + item.quantity;
          publishStockUpdate(prod.id, prod.name, prevStock, newStock, `order:${order.orderId}`).catch(
            (e) => console.warn('[Kafka] STOCK_UPDATED publish failed:', e),
          );
        }
      }

      res.status(201).json({ order, stockOverrides: overrides });
      return;
    }

    const db = readDb();
    const overrides = { ...(db.stockOverrides || {}) };
    for (const item of orderItems) {
      const prod = productMap.get(item.productId);
      if (prod) {
        const currentStock = getProductStock(prod, overrides);
        overrides[prod.id] = Math.max(0, currentStock - item.quantity);
      }
    }
    db.stockOverrides = overrides;

    if (claims) {
      const user = db.users.find((u) => u.id === claims.uid);
      if (user) {
        user.orders.unshift(order);
        user.cart = [];
        user.location = { city, pincode };
      }
    }
    writeDb(db);

    // ── Kafka: publish ORDER_PLACED + per-item STOCK_UPDATED events ──
    const kafkaUserId = claims?.uid ?? 'guest';
    publishOrderPlaced(order, kafkaUserId).catch((e) =>
      console.warn('[Kafka] ORDER_PLACED publish failed:', e),
    );
    for (const item of orderItems) {
      const prod = productMap.get(item.productId);
      if (prod) {
        const prevStock = getProductStock(prod, db.stockOverrides || {}) + item.quantity;
        const newStock = Math.max(0, prevStock - item.quantity);
        publishStockUpdate(prod.id, prod.name, prevStock, newStock, `order:${order.orderId}`).catch(
          (e) => console.warn('[Kafka] STOCK_UPDATED publish failed:', e),
        );
      }
    }

    res.status(201).json({ order, stockOverrides: overrides });
  });

  // Get Orders for authenticated user
  app.get('/api/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (isPgActive && req.authUser) {
      const orders = await orderRepo.getOrdersByUserId(req.authUser.id);
      res.json({ orders });
      return;
    }
    res.json({ orders: req.authUser?.orders || [] });
  });

  // Customer Care: List visible support tickets (user's own tickets + sample reference tickets)
  app.get('/api/support/tickets', async (req: Request, res: Response) => {
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

    const starterIds = new Set(INITIAL_SUPPORT_TICKETS.map((t) => t.ticketId));

    if (isPgActive) {
      const visibleTickets = await supportRepo.listVisibleTickets({
        claimsUserId: claims?.uid,
        guestTicketIds,
        starterIds,
      });
      res.json({ tickets: visibleTickets });
      return;
    }

    const db = readDb();
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
  app.post('/api/support/tickets', async (req: Request, res: Response) => {
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

    const ticketNumber = 4900 + Math.floor(Math.random() * 5000);
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

    if (isPgActive) {
      await supportRepo.createTicket(newTicket);
      res.status(201).json({ ticket: newTicket });
      return;
    }

    const db = readDb();
    const allTickets = db.supportTickets || [...INITIAL_SUPPORT_TICKETS];
    db.supportTickets = [newTicket, ...allTickets].slice(0, 200);
    writeDb(db);

    res.status(201).json({ ticket: newTicket });
  });

  // Customer Care: Add follow-up message or mark ticket resolved
  app.post('/api/support/tickets/:ticketId/reply', async (req: Request, res: Response) => {
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

    if (isPgActive) {
      const ticket = await supportRepo.findTicketById(ticketId);
      if (!ticket) {
        res.status(404).json({ message: 'Support ticket not found.' });
        return;
      }
      if (ticket.userId && ticket.userId !== claims?.uid) {
        res.status(403).json({ message: 'You do not have permission to update this ticket.' });
        return;
      }
      const updated = await supportRepo.addReply(ticketId, {
        id: `rep_${crypto.randomUUID().slice(0, 8)}`,
        senderRole: 'customer',
        senderName: senderName || ticket.customerName,
        message,
        createdAt: new Date().toISOString(),
      });
      res.json({ ticket: updated });
      return;
    }

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

  app.patch('/api/support/tickets/:ticketId', async (req: Request, res: Response) => {
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

    if (isPgActive) {
      const ticket = await supportRepo.findTicketById(ticketId);
      if (!ticket) {
        res.status(404).json({ message: 'Support ticket not found.' });
        return;
      }
      if (ticket.userId && ticket.userId !== claims?.uid) {
        res.status(403).json({ message: 'You do not have permission to update this ticket.' });
        return;
      }
      const updated = await supportRepo.updateTicketStatus(ticketId, 'Resolved');
      res.json({ ticket: updated });
      return;
    }

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

  // Live Stock Inventory Overrides
  app.get('/api/stock', async (_req: Request, res: Response) => {
    if (isPgActive) {
      const stockOverrides = await stockRepo.getStockOverrides();
      res.json({ stockOverrides });
      return;
    }
    const db = readDb();
    res.json({ stockOverrides: db.stockOverrides || {} });
  });

  // Product Restock Notification Subscriptions
  app.get('/api/stock-notifications', async (req: Request, res: Response) => {
    const emailQuery = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;

    if (isPgActive) {
      let targetEmail = emailQuery;
      if (claims?.uid) {
        const user = await userRepo.findUserById(claims.uid);
        if (user) targetEmail = user.email;
      }
      if (!targetEmail) {
        res.json({ notifications: [] });
        return;
      }
      const notifications = await stockRepo.getNotificationsByEmail(targetEmail);
      res.json({ notifications });
      return;
    }

    const db = readDb();
    const all = db.stockNotifications || [];
    const authUser = claims ? db.users.find((u) => u.id === claims.uid) : undefined;
    const targetEmail = authUser?.email || emailQuery;

    if (!targetEmail) {
      res.json({ notifications: [] });
      return;
    }

    const filtered = all.filter((n) => n.email.toLowerCase() === targetEmail.toLowerCase());
    res.json({ notifications: filtered });
  });

  app.post('/api/stock-notifications', async (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    const product = CATALOG_PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found in catalog.' });
      return;
    }

    const token = extractToken(req);
    const claims = token ? verifyToken(token) : null;

    if (isPgActive) {
      let email = rawEmail;
      if (!email && claims?.uid) {
        const authUser = await userRepo.findUserById(claims.uid);
        if (authUser) email = authUser.email;
      }

      if (!isValidEmail(email)) {
        res.status(400).json({ message: 'Please enter a valid email address for restock notifications.' });
        return;
      }

      const existing = await stockRepo.findNotification(product.id, email);
      if (existing) {
        res.json({
          notification: existing,
          message: `You are already subscribed for restock alerts on ${product.name} at ${email}.`,
        });
        return;
      }

      const entry: StockNotification = {
        id: `notif_${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        productName: product.name,
        email,
        createdAt: new Date().toISOString(),
        status: 'Subscribed',
      };

      await stockRepo.createNotification(entry);

      // ── Kafka: publish STOCK_NOTIFICATION_SUBSCRIBED ──
      publishStockNotification(entry).catch((e) =>
        console.warn('[Kafka] STOCK_NOTIFICATION publish failed:', e),
      );

      res.status(201).json({
        notification: entry,
        message: `Notification registered! We will email ${email} as soon as ${product.name} is back in stock.`,
      });
      return;
    }

    const db = readDb();
    const authUser = claims ? db.users.find((u) => u.id === claims.uid) : undefined;
    const email = rawEmail || authUser?.email || '';

    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Please enter a valid email address for restock notifications.' });
      return;
    }

    const notifications = db.stockNotifications || [];
    const existing = notifications.find(
      (n) => n.productId === product.id && n.email.toLowerCase() === email
    );
    if (existing) {
      res.json({
        notification: existing,
        message: `You are already subscribed for restock alerts on ${product.name} at ${email}.`,
      });
      return;
    }

    const entry: StockNotification = {
      id: `notif_${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      productName: product.name,
      email,
      createdAt: new Date().toISOString(),
      status: 'Subscribed',
    };

    db.stockNotifications = [entry, ...notifications].slice(0, 500);
    writeDb(db);

    // ── Kafka: publish STOCK_NOTIFICATION_SUBSCRIBED ──
    publishStockNotification(entry).catch((e) =>
      console.warn('[Kafka] STOCK_NOTIFICATION publish failed:', e),
    );

    res.status(201).json({
      notification: entry,
      message: `Notification registered! We will email ${email} as soon as ${product.name} is back in stock.`,
    });
  });

  // Responsive Stock Assistant Chatbot
  app.post('/api/chat', async (req: Request, res: Response) => {
    if (!verifyMutationHeader(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message || message.length > 600) {
      res.status(400).json({ message: 'Please enter a message between 1 and 600 characters.' });
      return;
    }

    const chatStart = Date.now();
    const chatToken = extractToken(req);
    const chatClaims = chatToken ? verifyToken(chatToken) : null;

    const stockOverrides = isPgActive
      ? await stockRepo.getStockOverrides()
      : (readDb().stockOverrides || {});
    const deterministic = buildDeterministicStockReply(message, stockOverrides);
    const matches =
      deterministic.matches.length > 0
        ? deterministic.matches
        : searchProductsWithStock(message, stockOverrides, 4);

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.json({
        reply: deterministic.reply,
        matches,
        askNotificationFor: deterministic.askNotificationFor,
        source: 'catalog',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const inventoryContext =
        matches.length > 0
          ? matches
              .map(
                (m) =>
                  `- ${m.name} (${m.brand}, ${m.category}) | Price: ₹${m.price} | Stock: ${m.stock} units${m.stock === 0 ? ' [PRODUCT UNAVAILABLE]' : ''}`
              )
              .join('\n')
          : 'No exact catalog product matched this query. Suggest sample categories like Electronics, Fashion, Beauty, Kitchen Appliances, or typing "out of stock items".';

      const historyRaw = Array.isArray(body.history) ? body.history.slice(-6) : [];
      const historySummary = historyRaw
        .map((h) => {
          if (h && typeof h === 'object') {
            const role = (h as { role?: unknown }).role === 'user' ? 'Customer' : 'Assistant';
            const text = typeof (h as { text?: unknown }).text === 'string' ? (h as { text: string }).text : '';
            return text ? `${role}: ${text}` : '';
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${historySummary ? `Recent conversation:\n${historySummary}\n\n` : ''}Customer message: "${message}"\n\nLive FindKart inventory lookup:\n${inventoryContext}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are the concise, helpful FindKart Shopping & Stock Assistant. Keep answers to 2-4 clear sentences. Always state exact stock quantities from the provided Live FindKart inventory lookup (never invent numbers). Whenever a product has Stock: 0 units, explicitly state "Product Unavailable" and ask the customer if they would like a restock notification when it is back in stock.',
        },
      });

      const replyText = aiResponse.text?.trim() || deterministic.reply;
      const chatDuration = Date.now() - chatStart;

      // ── Kafka: publish CHAT_QUERY event ──
      publishChatEvent({
        sessionId: crypto.randomUUID().slice(0, 12),
        userId: chatClaims?.uid,
        query: message,
        reply: replyText,
        matchCount: matches.length,
        durationMs: chatDuration,
      }).catch((e) => console.warn('[Kafka] CHAT_QUERY publish failed:', e));

      res.json({
        reply: replyText,
        matches,
        askNotificationFor: matches.filter((m) => m.stock === 0),
        source: 'gemini',
      });
    } catch (err: unknown) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 502;
      let errMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to reach AI assistant right now.';
      if (errMsg.trim().startsWith('{')) {
        try {
          const parsedErr = JSON.parse(errMsg) as { error?: { message?: string }; message?: string };
          errMsg = parsedErr.error?.message || parsedErr.message || errMsg;
        } catch {
          // Keep original string if not JSON
        }
      }
      res.status(status).json({
        message: errMsg,
        matches,
        askNotificationFor: deterministic.askNotificationFor,
      });
    }
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

  // ── Kafka: warm up producer (non-blocking — fails gracefully if broker is down) ──
  getProducer()
    .then(() => console.log('[Kafka] Producer ready'))
    .catch((e) => console.warn('[Kafka] Broker unreachable at startup (events will be skipped):', e?.message));

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[FindKart] Shutting down…');
    await disconnectProducer().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start FindKart server:', err);
  process.exit(1);
});
