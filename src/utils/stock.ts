import { CATALOG_PRODUCTS } from '../data/catalog.ts';
import type { ChatProductMatch, Product } from '../types/findkart.ts';

export const OUT_OF_STOCK_PRODUCT_IDS = new Set<string>([
  'home-classic-jacket',
  'home-bassline-headset',
  'home-brewmate-kettle',
  'home-urbanpack-bag',
  'fashion-watch-fossil',
  'fashion-saree-fabindia',
  'fashion-men-sport-smartwatch',
  'beauty-perfume-plum',
  'beauty-lipstick-lakme',
  'beauty-sunstick-minimalist',
]);

function hashProductId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getProductStock(
  product: Pick<Product, 'id' | 'stock'>,
  stockOverrides?: Record<string, number>
): number {
  if (stockOverrides && typeof stockOverrides[product.id] === 'number') {
    return Math.max(0, Math.floor(stockOverrides[product.id]));
  }
  if (typeof product.stock === 'number') {
    return Math.max(0, Math.floor(product.stock));
  }
  if (OUT_OF_STOCK_PRODUCT_IDS.has(product.id)) {
    return 0;
  }
  const h = hashProductId(product.id);
  if (h % 7 === 0) {
    return 2 + (h % 4); // Low stock: 2..5
  }
  return 8 + (h % 37); // Healthy stock: 8..44
}

export function toChatProductMatch(
  product: Product,
  stockOverrides?: Record<string, number>
): ChatProductMatch {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    originalPrice: product.originalPrice,
    discountPercent: product.discountPercent,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    stock: getProductStock(product, stockOverrides),
  };
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'any',
  'are',
  'available',
  'availability',
  'can',
  'check',
  'count',
  'currently',
  'do',
  'does',
  'find',
  'for',
  'get',
  'got',
  'have',
  'hello',
  'hey',
  'hi',
  'how',
  'i',
  'in',
  'inventory',
  'is',
  'it',
  'item',
  'items',
  'left',
  'many',
  'me',
  'much',
  'notify',
  'notification',
  'of',
  'on',
  'or',
  'out',
  'please',
  'present',
  'price',
  'product',
  'products',
  'qty',
  'quantity',
  'remaining',
  'search',
  'show',
  'status',
  'stock',
  'stocks',
  'tell',
  'the',
  'there',
  'this',
  'to',
  'unavailable',
  'units',
  'want',
  'what',
  'which',
  'with',
  'you',
  'zero',
]);

function normalizeToken(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 4 && token.endsWith('es') && !token.endsWith('shoes')) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

export function searchProductsWithStock(
  rawQuery: string,
  stockOverrides?: Record<string, number>,
  limit = 4
): ChatProductMatch[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  if (/\b(out of stock|unavailable|zero stock|0 stock|sold out)\b/.test(q)) {
    return CATALOG_PRODUCTS.map((p) => toChatProductMatch(p, stockOverrides))
      .filter((p) => p.stock === 0)
      .slice(0, limit);
  }

  if (/\b(low stock|running low|few left)\b/.test(q)) {
    return CATALOG_PRODUCTS.map((p) => toChatProductMatch(p, stockOverrides))
      .filter((p) => p.stock > 0 && p.stock <= 5)
      .slice(0, limit);
  }

  if (/\b(in stock|available products|trending|popular|all products)\b/.test(q)) {
    return CATALOG_PRODUCTS.slice(0, limit).map((p) => toChatProductMatch(p, stockOverrides));
  }

  const rawTokens = q
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  if (rawTokens.length === 0) {
    return [];
  }

  const scored: { product: Product; score: number }[] = [];

  for (const product of CATALOG_PRODUCTS) {
    const nameLower = product.name.toLowerCase();
    const brandLower = product.brand.toLowerCase();
    const catLower = `${product.category} ${product.subCategory || ''} ${product.storeSection}`.toLowerCase();
    const genderLower = (product.gender || '').toLowerCase();
    const descLower = product.description.toLowerCase();

    let score = 0;
    const matchedTokens = new Set<string>();

    for (const token of rawTokens) {
      const norm = normalizeToken(token);
      if (nameLower.includes(token) || nameLower.includes(norm)) {
        score += 12;
        matchedTokens.add(token);
      } else if (brandLower.includes(token) || brandLower.includes(norm)) {
        score += 9;
        matchedTokens.add(token);
      } else if (catLower.includes(token) || catLower.includes(norm)) {
        score += 7;
        matchedTokens.add(token);
      } else if (genderLower && (genderLower === token || genderLower === norm)) {
        score += 5;
        matchedTokens.add(token);
      } else if (descLower.includes(token) || descLower.includes(norm)) {
        score += 3;
        matchedTokens.add(token);
      }
    }

    if (matchedTokens.size > 0) {
      // Bonus when multiple user tokens match the same product
      score += matchedTokens.size * 6;
      // Bonus for exact substring of clean phrase
      const cleanPhrase = rawTokens.join(' ');
      if (cleanPhrase.length >= 3 && nameLower.includes(cleanPhrase)) {
        score += 20;
      }
      scored.push({ product, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.product.popularity - a.product.popularity;
  });

  return scored.slice(0, limit).map((item) => toChatProductMatch(item.product, stockOverrides));
}

export function buildDeterministicStockReply(
  query: string,
  stockOverrides?: Record<string, number>
): {
  reply: string;
  matches: ChatProductMatch[];
  askNotificationFor: ChatProductMatch[];
} {
  const q = query.trim().toLowerCase();

  if (/^(hi|hello|hey|hii|namaste|good morning|good evening|help)\b/.test(q) && q.split(/\s+/).length <= 4) {
    return {
      reply:
        'Hi! I am your FindKart Stock Assistant. Ask me about any product to check how many units are currently in stock. If a product has 0 stock, I will show "Product Unavailable" and set up a restock notification for you.',
      matches: [],
      askNotificationFor: [],
    };
  }

  const matches = searchProductsWithStock(query, stockOverrides, 4);
  if (matches.length === 0) {
    return {
      reply:
        'I could not find a matching product in our catalog for that query. Try asking about items like "SoundCore Headphones", "Classic Navy Jacket", "PulseFit Watch", "Sunscreen", "Saree", or ask for "out of stock items".',
      matches: [],
      askNotificationFor: [],
    };
  }

  const unavailable = matches.filter((m) => m.stock === 0);
  const available = matches.filter((m) => m.stock > 0);

  const parts: string[] = [];
  if (available.length > 0) {
    const summary = available
      .map((m) => `${m.name} (${m.stock} ${m.stock === 1 ? 'unit' : 'units'} in stock)`)
      .join(', ');
    parts.push(`Available stock found: ${summary}.`);
  }

  if (unavailable.length > 0) {
    const names = unavailable.map((m) => m.name).join(', ');
    parts.push(
      `${names} ${unavailable.length === 1 ? 'has' : 'have'} 0 units left — Product Unavailable. Would you like to receive a restock notification as soon as ${unavailable.length === 1 ? 'it is' : 'they are'} available again?`
    );
  }

  return {
    reply: parts.join(' '),
    matches,
    askNotificationFor: unavailable,
  };
}
