import { CATALOG_PRODUCTS } from '../data/catalog.ts';
import type {
  CartItem,
  DeliveryLocation,
  Order,
  OrderItem,
  OrderShipping,
  SupportTicket,
  SupportTicketCategory,
  UserProfile,
} from '../types/findkart.ts';

export interface ParsedApiResult<T> {
  ok: boolean;
  status: number;
  isHtmlFallback: boolean;
  data: T | null;
  errorMessage?: string;
}

export async function safeParseApiResponse<T>(res: Response): Promise<ParsedApiResult<T>> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  const trimmed = text.trim();

  if (
    trimmed.startsWith('<!') ||
    trimmed.startsWith('<html') ||
    contentType.includes('text/html')
  ) {
    return {
      ok: false,
      status: res.status,
      isHtmlFallback: true,
      data: null,
      errorMessage: 'API endpoint returned HTML instead of JSON.',
    };
  }

  try {
    const parsed = trimmed ? (JSON.parse(trimmed) as T & { message?: string }) : null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        isHtmlFallback: false,
        data: parsed,
        errorMessage:
          (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string'
            ? parsed.message
            : undefined) || `Request failed (${res.status})`,
      };
    }
    return {
      ok: true,
      status: res.status,
      isHtmlFallback: false,
      data: parsed,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      isHtmlFallback: false,
      data: null,
      errorMessage: 'Received an unexpected response from the server. Please try again.',
    };
  }
}

// Local fallback store used ONLY when the app is served as a static SPA without Express API routes
const LOCAL_ACCOUNTS_KEY = 'findkart_static_accounts';
const LOCAL_TICKETS_KEY = 'findkart_static_support_tickets';

interface LocalAccountRecord {
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordDigest: string;
  location: DeliveryLocation;
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
}

export interface AuthResponsePayload {
  token: string;
  user: UserProfile & {
    cart: CartItem[];
    wishlist: string[];
    orders: Order[];
    location: DeliveryLocation;
  };
}

async function hashLocalPassword(password: string, salt: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${salt}:${password.length}`;
}

function readLocalAccounts(): LocalAccountRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAccountRecord[]): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage limits
  }
}

export async function fallbackRegister(params: {
  name: string;
  email: string;
  password: string;
  guestCart: CartItem[];
  guestWishlist: string[];
}): Promise<AuthResponsePayload> {
  const accounts = readLocalAccounts();
  const normalizedEmail = params.email.trim().toLowerCase();
  if (accounts.some((a) => a.email === normalizedEmail)) {
    throw new Error('An account with this email already exists. Try signing in.');
  }
  const salt = Math.random().toString(36).slice(2, 12);
  const passwordDigest = await hashLocalPassword(params.password, salt);
  const created: LocalAccountRecord = {
    id: `usr_${Date.now().toString(36)}`,
    name: params.name.trim(),
    email: normalizedEmail,
    passwordSalt: salt,
    passwordDigest,
    location: { city: 'Bengaluru', pincode: '560001' },
    cart: params.guestCart,
    wishlist: params.guestWishlist,
    orders: [],
  };
  writeLocalAccounts([...accounts, created]);
  return {
    token: `local_${created.id}`,
    user: {
      id: created.id,
      name: created.name,
      email: created.email,
      location: created.location,
      cart: created.cart,
      wishlist: created.wishlist,
      orders: created.orders,
    },
  };
}

export async function fallbackLogin(params: {
  email: string;
  password: string;
  guestCart: CartItem[];
  guestWishlist: string[];
}): Promise<AuthResponsePayload> {
  const accounts = readLocalAccounts();
  const normalizedEmail = params.email.trim().toLowerCase();
  const existing = accounts.find((a) => a.email === normalizedEmail);
  if (!existing) {
    throw new Error('No account found with this email. Switch to "Create account" to register.');
  }
  const digest = await hashLocalPassword(params.password, existing.passwordSalt);
  if (digest !== existing.passwordDigest) {
    throw new Error('Invalid email or password. Please check and try again.');
  }

  if (params.guestCart.length > 0) {
    for (const gItem of params.guestCart) {
      const match = existing.cart.find(
        (c) =>
          c.productId === gItem.productId &&
          c.selectedSize === gItem.selectedSize &&
          c.selectedColor === gItem.selectedColor
      );
      if (match) {
        match.quantity = Math.min(20, match.quantity + gItem.quantity);
      } else {
        existing.cart.push(gItem);
      }
    }
  }
  if (params.guestWishlist.length > 0) {
    existing.wishlist = Array.from(new Set([...existing.wishlist, ...params.guestWishlist]));
  }
  writeLocalAccounts(accounts);

  return {
    token: `local_${existing.id}`,
    user: {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      location: existing.location,
      cart: existing.cart,
      wishlist: existing.wishlist,
      orders: existing.orders,
    },
  };
}

export function fallbackPlaceOrder(items: CartItem[], shipping: OrderShipping): Order {
  const productMap = new Map(CATALOG_PRODUCTS.map((p) => [p.id, p]));
  const orderItems: OrderItem[] = [];
  let subtotal = 0;
  let totalMrp = 0;

  for (const item of items) {
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
  const orderNum = 1000 + Math.floor(Math.random() * 9000);
  return {
    orderId: `FK-${orderNum}`,
    createdAt: new Date().toISOString(),
    status: 'Confirmed — Preparing Shipment',
    items: orderItems,
    subtotal,
    deliveryFee,
    totalSavings: Math.max(0, totalMrp - subtotal),
    total: subtotal + deliveryFee,
    shipping,
  };
}

const STARTER_LOCAL_TICKETS: SupportTicket[] = [
  {
    ticketId: 'FK-SUP-4892',
    customerName: 'FindKart Member',
    email: 'care@findkart.in',
    orderId: 'FK-2026-88412',
    category: 'Delivery & Shipping',
    subject: 'Package delayed at Bengaluru hub',
    message:
      'My SoundCore ANC Headphones shipment has been showing at Bengaluru Peenya hub since yesterday evening.',
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
          'Hi! Your parcel cleared Peenya sortation this morning and is scheduled for delivery tomorrow between 10:00 AM and 2:00 PM.',
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
    message: 'I ordered size L in the UrbanWeave Linen Shirt and would like to exchange for size M.',
    status: 'Under Review',
    createdAt: '2026-11-18T14:20:00.000Z',
    slaDueAt: '2026-11-18T20:20:00.000Z',
    assignedSpecialist: 'Rohan Deshmukh · Apparel Care Desk',
    replies: [
      {
        id: 'rep_4886_1',
        senderRole: 'specialist',
        senderName: 'Rohan Deshmukh',
        senderTitle: 'Apparel Care Specialist',
        message: 'Your exchange request is under review to reserve size M at our nearest center.',
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
    message: 'Please share the itemized GST tax invoice PDF for my order.',
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
        message: 'We have dispatched your signed GST tax invoice (#INV-FK-86219) to your email.',
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
    message: 'Please confirm when the refund for my returned kettle will be credited.',
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
        message: 'Your refund has been processed back to your original payment method (Ref #RFND-992041).',
        createdAt: '2026-11-12T13:12:00.000Z',
      },
    ],
  },
];

export function readFallbackTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY);
    if (!raw) return [...STARTER_LOCAL_TICKETS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...STARTER_LOCAL_TICKETS];
  } catch {
    return [...STARTER_LOCAL_TICKETS];
  }
}

export function writeFallbackTickets(tickets: SupportTicket[]): void {
  try {
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(tickets));
  } catch {
    // Ignore storage limits
  }
}

export function fallbackCreateTicket(payload: {
  customerName: string;
  email: string;
  orderId: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  attachmentName?: string;
  attachmentType?: string;
}): SupportTicket {
  const existing = readFallbackTickets();
  const ticketNum = 4900 + Math.floor(Math.random() * 5000);
  const now = new Date();
  const ticket: SupportTicket = {
    ticketId: `FK-SUP-${ticketNum}`,
    customerName: payload.customerName,
    email: payload.email,
    orderId: payload.orderId || 'General Inquiry',
    category: payload.category,
    subject: payload.subject,
    message: payload.message,
    attachmentName: payload.attachmentName,
    attachmentType: payload.attachmentType,
    status: 'Under Review',
    createdAt: now.toISOString(),
    slaDueAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    assignedSpecialist: 'Priya Nair · Senior Customer Care Specialist',
    replies: [
      {
        id: `rep_${Date.now().toString(36)}`,
        senderRole: 'specialist',
        senderName: 'Priya Nair',
        senderTitle: 'Senior Customer Care Specialist · 6-Hour SLA Queue',
        message: `Ticket logged for ${payload.customerName}. Assigned directly to Priya Nair for human review. No automated AI replies — you will receive a personal response within 6 hours at ${payload.email}.`,
        createdAt: now.toISOString(),
      },
    ],
  };
  writeFallbackTickets([ticket, ...existing]);
  return ticket;
}
