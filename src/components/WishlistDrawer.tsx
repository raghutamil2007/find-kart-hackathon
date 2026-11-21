import { CATALOG_PRODUCTS } from '../data/catalog.ts';
import type { Product } from '../types/findkart.ts';
import { ProductImage } from './ProductImage.tsx';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistIds: string[];
  onToggleWishlist: (productId: string) => void;
  onMoveToCart: (product: Product) => void;
}

export function WishlistDrawer({
  isOpen,
  onClose,
  wishlistIds,
  onToggleWishlist,
  onMoveToCart,
}: WishlistDrawerProps) {
  if (!isOpen) return null;

  const savedProducts = CATALOG_PRODUCTS.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Wishlist">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <aside className="relative w-full max-w-[100vw] sm:max-w-md bg-light-surface-container-lowest h-full flex flex-col shadow-xl">
        <div className="px-gutter-md py-gutter-md bg-light-primary text-light-on-primary flex items-center justify-between gap-2">
          <h2 className="font-headline text-title-lg truncate">Saved Wishlist ({savedProducts.length})</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wishlist"
            className="w-9 h-9 rounded hover:bg-light-primary-container flex items-center justify-center shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {savedProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-gutter-xl text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-light-surface-container flex items-center justify-center text-light-primary">
              <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
                favorite
              </span>
            </div>
            <h3 className="font-headline text-title-lg text-light-on-surface">No saved items yet</h3>
            <p className="font-body text-body-md text-light-on-surface-variant max-w-xs">
              Tap the heart icon on any FindKart product to bookmark it here for quick checkout later.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-gutter-lg py-2.5 rounded bg-light-primary text-light-on-primary font-label text-label-md cursor-pointer"
            >
              Explore Store
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain p-gutter-md flex flex-col gap-3">
            {savedProducts.map((product) => (
              <div
                key={product.id}
                className="p-3 rounded-md border border-light-outline-variant/60 bg-light-surface-container-lowest flex gap-3"
              >
                <ProductImage
                  src={product.imageUrl}
                  alt={product.imageAlt}
                  className="w-20 h-20 object-contain shrink-0 rounded bg-light-surface-container-low p-1"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                  <div>
                    <p className="font-label text-label-sm text-light-on-surface-variant uppercase">
                      {product.brand}
                    </p>
                    <h3 className="font-title text-body-md text-light-on-surface truncate">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-title text-title-md text-light-on-surface tabular-nums">
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                      <span className="font-label text-label-sm text-success tabular-nums">
                        {product.discountPercent}% off
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveToCart(product)}
                      className="flex-1 min-h-[36px] py-1.5 px-3 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-label-sm cursor-pointer"
                    >
                      Move to Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(product.id)}
                      aria-label={`Remove ${product.name} from wishlist`}
                      className="min-h-[36px] py-1.5 px-2.5 rounded border border-light-outline-variant text-light-on-surface-variant hover:text-light-error font-label text-label-sm cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
