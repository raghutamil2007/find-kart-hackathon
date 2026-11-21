import { useEffect, useState } from 'react';
import type { DeliveryLocation, Product } from '../types/findkart.ts';
import { getProductStock } from '../utils/stock.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductModalProps {
  product: Product | null;
  isWishlisted: boolean;
  location: DeliveryLocation;
  stockOverrides?: Record<string, number>;
  userEmail?: string;
  isNotified?: boolean;
  onNotifyRestock?: (product: Product, email: string) => Promise<void> | void;
  onClose: () => void;
  onAddToCart: (product: Product, size?: string, color?: string) => void;
  onToggleWishlist: (productId: string) => void;
}

export function ProductModal({
  product,
  isWishlisted,
  location,
  stockOverrides,
  userEmail = '',
  isNotified = false,
  onNotifyRestock,
  onClose,
  onAddToCart,
  onToggleWishlist,
}: ProductModalProps) {
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [added, setAdded] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(userEmail);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes?.[0]);
      setSelectedColor(product.colors?.[0]);
      setAdded(false);
      setShowEmailPrompt(false);
      setNotifyEmail(userEmail);
    }
  }, [product, userEmail]);

  if (!product) return null;

  const liveStock = getProductStock(product, stockOverrides);
  const isOutOfStock = liveStock === 0;

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, selectedSize, selectedColor);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  const handleNotifySubmit = async () => {
    if (!onNotifyRestock) return;
    const targetEmail = (notifyEmail || userEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setShowEmailPrompt(true);
      return;
    }
    setNotifying(true);
    try {
      await onNotifyRestock(product, targetEmail);
      setShowEmailPrompt(false);
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter-md"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto overscroll-contain bg-light-surface-container-lowest rounded-md border border-light-outline-variant shadow-xl grid grid-cols-1 md:grid-cols-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-light-surface-container-low text-light-on-surface hover:bg-light-surface-container flex items-center justify-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            close
          </span>
        </button>

        {/* Product Image Column */}
        <div className="md:col-span-5 bg-light-surface-container-low p-gutter-md sm:p-gutter-lg flex items-center justify-center">
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt}
            className="w-full h-52 sm:h-64 md:h-80 object-contain"
          />
        </div>

        {/* Purchase Module Column */}
        <div className="md:col-span-7 p-gutter-md sm:p-gutter-lg flex flex-col justify-between gap-gutter-md min-w-0">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-label-sm font-label text-light-on-surface-variant uppercase">
              <span>{product.brand}</span>
              <span aria-hidden="true">·</span>
              <span>{product.category}</span>
            </div>

            <h2 className="font-headline text-headline-sm md:text-headline-md text-light-on-surface pr-8">
              {product.name}
            </h2>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-success text-on-success font-label text-label-sm tabular-nums">
                {product.rating.toFixed(1)}{' '}
                <span
                  className="material-symbols-outlined text-[12px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  star
                </span>
              </span>
              <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
                {product.reviewCount.toLocaleString('en-IN')} verified ratings
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-gutter-sm pt-1">
              <span className="font-headline text-headline-md text-light-on-surface tabular-nums">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="font-body text-body-md text-light-on-surface-variant line-through tabular-nums">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
              <span className="font-label text-label-md text-success tabular-nums">
                {product.discountPercent}% off
              </span>
            </div>

            <div>
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-light-error-container text-light-error font-label text-label-md">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    cancel
                  </span>
                  Product Unavailable · 0 in stock
                </span>
              ) : liveStock <= 5 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-accent-yellow/25 text-light-on-surface font-label text-label-md tabular-nums">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    inventory_2
                  </span>
                  Low Stock · Only {liveStock} units left
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-success/15 text-success font-label text-label-md tabular-nums">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    check_circle
                  </span>
                  In Stock · {liveStock} units available
                </span>
              )}
            </div>

            <p className="font-body text-body-md text-light-on-surface-variant">{product.description}</p>

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="font-label text-label-md text-light-on-surface">Select Size</span>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`px-3 py-1.5 rounded-sm border font-label text-label-md cursor-pointer transition-colors ${
                        selectedSize === sz
                          ? 'bg-light-primary text-light-on-primary border-light-primary'
                          : 'border-light-outline-variant text-light-on-surface hover:border-light-primary'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color / Shade Selector */}
            {product.colors && product.colors.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="font-label text-label-md text-light-on-surface">
                  Select Colour / Shade
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setSelectedColor(clr)}
                      className={`px-3 py-1.5 rounded-sm border font-body text-body-sm cursor-pointer transition-colors ${
                        selectedColor === clr
                          ? 'bg-light-primary text-light-on-primary border-light-primary'
                          : 'border-light-outline-variant text-light-on-surface hover:border-light-primary'
                      }`}
                    >
                      {clr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Highlights */}
            <ul className="pt-2 border-t border-light-outline-variant/60 flex flex-col gap-1">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2 font-body text-body-sm text-light-on-surface">
                  <span className="material-symbols-outlined text-[16px] text-success" aria-hidden="true">
                    check_circle
                  </span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            {/* Delivery Check */}
            <div className="p-3 rounded bg-light-surface-container-low border border-light-outline-variant/60 flex items-center gap-2 text-body-sm text-light-on-surface">
              <span className="material-symbols-outlined text-[18px] text-light-primary" aria-hidden="true">
                local_shipping
              </span>
              <span>
                Cash on Delivery available to {location.city} ({location.pincode}) · 7-Day Easy Returns
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {isOutOfStock && showEmailPrompt && !isNotified && (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="Enter your email for restock notification"
                  aria-label="Restock notification email"
                  className="flex-1 min-w-0 h-10 px-3 rounded border border-light-outline-variant bg-light-surface-container-low font-body text-base sm:text-body-md text-light-on-surface focus:outline-none focus:ring-2 focus:ring-light-primary"
                />
                <button
                  type="button"
                  disabled={notifying}
                  onClick={() => void handleNotifySubmit()}
                  className="h-10 px-4 rounded bg-light-primary text-light-on-primary font-label text-label-md cursor-pointer shrink-0"
                >
                  {notifying ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-gutter-sm">
              {isOutOfStock ? (
                <button
                  type="button"
                  disabled={isNotified || notifying}
                  onClick={() => {
                    if (userEmail) {
                      void handleNotifySubmit();
                    } else {
                      setShowEmailPrompt(true);
                    }
                  }}
                  className={`flex-1 py-3 px-gutter-lg rounded font-label text-label-lg inline-flex items-center justify-center gap-2 transition-colors ${
                    isNotified
                      ? 'bg-success/15 text-success cursor-default'
                      : 'bg-accent-yellow text-on-accent-yellow hover:bg-light-secondary-container cursor-pointer'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {isNotified ? 'notifications_active' : 'notifications'}
                  </span>
                  <span>
                    {isNotified
                      ? 'Restock Alert Active'
                      : notifying
                        ? 'Subscribing...'
                        : 'Notify Me When Available'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAdd}
                  className={`flex-1 py-3 px-gutter-lg rounded font-label text-label-lg transition-colors cursor-pointer ${
                    added
                      ? 'bg-success text-on-success'
                      : 'bg-accent-yellow text-on-accent-yellow hover:bg-light-secondary-container'
                  }`}
                >
                  {added ? 'Added to Cart' : 'Add to Cart'}
                </button>
              )}

            <button
              type="button"
              onClick={() => onToggleWishlist(product.id)}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
              className={`px-4 py-3 rounded border font-label text-label-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                isWishlisted
                  ? 'border-light-error text-light-error bg-light-error-container/30'
                  : 'border-light-outline-variant text-light-on-surface hover:border-light-primary'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isWishlisted ? { fontVariationSettings: "'FILL' 1" } : undefined}
                aria-hidden="true"
              >
                favorite
              </span>
              <span className="hidden sm:inline">{isWishlisted ? 'Saved' : 'Wishlist'}</span>
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
