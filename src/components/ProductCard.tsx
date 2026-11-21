import { useState } from 'react';
import type { Product } from '../types/findkart.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  showBrand?: boolean;
  showWishlistButton?: boolean;
  showRating?: boolean;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
}

export function ProductCard({
  product,
  isWishlisted,
  showBrand = false,
  showWishlistButton = true,
  showRating = true,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
}: ProductCardProps) {
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    onAddToCart(product);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <article className="min-w-0 bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-2.5 sm:p-gutter-md flex flex-col justify-between gap-2 sm:gap-gutter-md hover:border-light-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 shadow-sm h-full">
      <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
        <div className="relative bg-light-surface-container-lowest rounded p-1 sm:p-2 flex items-center justify-center">
          <button
            type="button"
            onClick={() => onSelectProduct(product)}
            className="w-full flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-primary rounded"
            aria-label={`View details for ${product.name}`}
          >
            <ProductImage
              src={product.imageUrl}
              alt={product.imageAlt}
              className="w-full h-32 sm:h-44 object-contain transition-transform duration-150 hover:scale-[1.02]"
            />
          </button>

          {showWishlistButton && (
            <button
              type="button"
              onClick={() => onToggleWishlist(product.id)}
              aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
              className={`absolute top-1 right-1 w-9 h-9 rounded-full bg-light-surface-container-low/90 flex items-center justify-center transition-colors cursor-pointer ${
                isWishlisted ? 'text-light-error' : 'text-light-on-surface-variant hover:text-light-error'
              }`}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={isWishlisted ? { fontVariationSettings: "'FILL' 1" } : undefined}
                aria-hidden="true"
              >
                favorite
              </span>
            </button>
          )}
        </div>

        {showBrand && (
          <span className="font-label text-label-sm text-light-on-surface-variant uppercase truncate">
            {product.brand}
          </span>
        )}

        <button
          type="button"
          onClick={() => onSelectProduct(product)}
          className="text-left cursor-pointer hover:text-light-primary transition-colors min-w-0"
        >
          <h3 className="font-title text-label-md sm:text-title-md text-light-on-surface line-clamp-2 break-words">
            {product.name}
          </h3>
        </button>

        {showRating && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-success text-on-success font-label text-label-sm tabular-nums">
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
              ({product.reviewCount.toLocaleString('en-IN')})
            </span>
          </div>
        )}

        <div className="flex items-baseline gap-1 sm:gap-gutter-sm flex-wrap">
          <span className="font-title text-title-md sm:text-title-lg text-light-on-surface tabular-nums">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          <span className="font-body text-body-sm text-light-on-surface-variant line-through tabular-nums">
            ₹{product.originalPrice.toLocaleString('en-IN')}
          </span>
          <span className="font-label text-label-sm sm:text-label-md text-success tabular-nums">
            {product.discountPercent}% off
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className={`w-full min-h-[38px] py-2 sm:py-2.5 px-2 sm:px-gutter-md rounded font-label text-label-sm sm:text-label-md transition-colors duration-150 cursor-pointer ${
          justAdded
            ? 'bg-success text-on-success'
            : 'bg-light-primary text-light-on-primary hover:bg-light-primary-container'
        }`}
      >
        {justAdded ? 'Added to Cart' : 'Add to Cart'}
      </button>
    </article>
  );
}
