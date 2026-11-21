import { CATALOG_PRODUCTS, STITCH_IMAGES } from '../data/catalog.ts';
import type { Product, StoreView } from '../types/findkart.ts';
import { ProductCard } from './ProductCard.tsx';
import { ProductImage } from './ProductImage.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';

interface HomeViewProps {
  wishlistIds: string[];
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onNavigate: (view: StoreView) => void;
}

export function HomeView({
  wishlistIds,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
  onNavigate,
}: HomeViewProps) {
  const trending = CATALOG_PRODUCTS.filter((p) => p.homeSections?.includes('trending'));
  const deals = CATALOG_PRODUCTS.filter((p) => p.homeSections?.includes('deals'));
  const recommended = CATALOG_PRODUCTS.filter((p) => p.homeSections?.includes('recommended'));
  const newArrivals = CATALOG_PRODUCTS.filter((p) => p.homeSections?.includes('new'));

  const fashionSpotlightIds = [
    'fashion-hoodie-roadster',
    'fashion-saree-fabindia',
    'fashion-loafers-roadster',
    'fashion-sling-lavie',
  ];
  const fashionSpotlight = fashionSpotlightIds
    .map((id) => CATALOG_PRODUCTS.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  const fashionCount = CATALOG_PRODUCTS.filter((p) => p.storeSection === 'fashion').length;

  const categoryHighlights: {
    view: StoreView;
    title: string;
    subtitle: string;
    img: string;
    alt: string;
  }[] = [
    {
      view: 'fashion',
      title: 'Fashion',
      subtitle: `${fashionCount} styles · Min. 40% off`,
      img: STITCH_IMAGES.fashionSareeSilk,
      alt: 'Fashion category',
    },
    {
      view: 'electronics',
      title: 'Electronics',
      subtitle: 'From ₹849',
      img: STITCH_IMAGES.prodHeadphones,
      alt: 'Electronics category',
    },
    {
      view: 'home-kitchen',
      title: 'Home & Kitchen',
      subtitle: 'Starting ₹799',
      img: STITCH_IMAGES.prodKettle,
      alt: 'Home and Kitchen category',
    },
    {
      view: 'beauty',
      title: 'Beauty & Care',
      subtitle: 'Top rated',
      img: STITCH_IMAGES.prodSkincare,
      alt: 'Beauty category',
    },
  ];

  return (
    <div className="bg-light-surface-container-low">
      <div className="max-w-7xl mx-auto px-3 sm:px-gutter-md lg:px-gutter-lg py-gutter-md md:py-gutter-lg flex flex-col gap-gutter-lg md:gap-section">
        {/* Hero Promotional Banner */}
        <section
          aria-label="Featured promotion"
          className="bg-light-primary text-light-on-primary rounded-md overflow-hidden border border-light-primary-container shadow-sm grid grid-cols-1 lg:grid-cols-12 items-center"
        >
          <div className="order-2 lg:order-1 lg:col-span-6 p-gutter-md sm:p-gutter-lg lg:p-gutter-xl flex flex-col gap-2.5 md:gap-gutter-md min-w-0">
            <span className="inline-flex items-center w-fit px-2.5 py-0.5 md:px-3 md:py-1 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm md:text-label-md">
              WEEKEND RETAIL OFFER
            </span>
            <h1 className="font-display text-headline-lg-mobile md:text-display-lg text-light-on-primary text-balance">
              Upgrade your everyday tech &amp; essentials
            </h1>
            <p className="font-body text-body-sm md:text-body-lg text-light-inverse-primary text-pretty max-w-lg">
              Up to 40% off on audio, smartwatches, and home appliances with Cash on Delivery across India.
            </p>
            <div className="pt-1 md:pt-gutter-sm">
              <a
                href="#trending-products"
                className="inline-flex items-center justify-center gap-gutter-sm w-full sm:w-auto px-gutter-lg py-2.5 md:py-3 rounded bg-accent-yellow text-on-accent-yellow hover:bg-light-secondary-container font-label text-label-md md:text-label-lg transition-colors duration-150 shadow-sm"
              >
                <span>Shop Now</span>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-6 h-full">
            <ProductImage
              src={STITCH_IMAGES.heroElectronicsSale}
              alt="FindKart weekend electronics promotion featuring headphones, smartwatch, and smartphone"
              className="w-full h-48 sm:h-64 md:h-72 lg:h-80 object-cover"
              fallbackIcon="devices"
            />
          </div>
        </section>

        {/* Section 0: Fashion Spotlight (First) */}
        <section id="fashion-spotlight" className="flex flex-col gap-gutter-sm md:gap-gutter-md scroll-mt-24">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="font-headline text-title-lg md:text-headline-md text-light-on-surface">
                Top Fashion Styles
              </h2>
              <p className="hidden md:block font-body text-body-sm text-light-on-surface-variant">
                {fashionCount} distinct ethnic, western, footwear, watches, bags &amp; kids styles
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fashion')}
              className="font-label text-label-md md:text-label-lg text-light-primary hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>View all {fashionCount}</span>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md items-stretch">
            {fashionSpotlight.map((product, index) => (
              <ScrollReveal key={product.id} delay={(index % 4) * 0.04} className="h-full min-w-0">
                <ProductCard
                  product={product}
                  isWishlisted={wishlistIds.includes(product.id)}
                  showBrand
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={onSelectProduct}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Section 1: Trending Products */}
        <section id="trending-products" className="flex flex-col gap-gutter-sm md:gap-gutter-md scroll-mt-24">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="font-headline text-title-lg md:text-headline-md text-light-on-surface">
                Trending Products
              </h2>
              <p className="hidden md:block font-body text-body-sm text-light-on-surface-variant">
                Most shopped items across India this week
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('electronics')}
              className="font-label text-label-md md:text-label-lg text-light-primary hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>View all</span>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md items-stretch">
            {trending.map((product, index) => (
              <ScrollReveal key={product.id} delay={(index % 4) * 0.04} className="h-full min-w-0">
                <ProductCard
                  product={product}
                  isWishlisted={wishlistIds.includes(product.id)}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={onSelectProduct}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Section 2: Best Deals */}
        <section id="best-deals" className="flex flex-col gap-gutter-sm md:gap-gutter-md scroll-mt-24">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="font-headline text-title-lg md:text-headline-md text-light-on-surface">
                Best Deals
              </h2>
              <p className="hidden md:block font-body text-body-sm text-light-on-surface-variant">
                Limited-time price drops on top-rated products
              </p>
            </div>
            <span className="px-2.5 py-0.5 md:px-3 md:py-1 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm md:text-label-md shrink-0">
              Up to 55% Off
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md items-stretch">
            {deals.map((product, index) => (
              <ScrollReveal key={product.id} delay={(index % 4) * 0.04} className="h-full min-w-0">
                <ProductCard
                  product={product}
                  isWishlisted={wishlistIds.includes(product.id)}
                  showWishlistButton={false}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={onSelectProduct}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Category Highlights */}
        <ScrollReveal>
          <section aria-label="Shop by category" className="flex flex-col gap-gutter-sm md:gap-gutter-md">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-headline text-title-lg md:text-headline-md text-light-on-surface">
                Shop by Category
              </h2>
              <p className="hidden md:block font-body text-body-sm text-light-on-surface-variant">
                Explore curated collections across FindKart
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md">
              {categoryHighlights.map((cat, index) => (
                <ScrollReveal key={cat.view} delay={(index % 4) * 0.04} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigate(cat.view)}
                    className="w-full bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-2.5 sm:p-3 md:p-gutter-md flex items-center gap-2.5 sm:gap-3 md:gap-gutter-md hover:border-light-primary hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 shadow-sm text-left cursor-pointer h-full"
                  >
                    <ProductImage
                      src={cat.img}
                      alt={cat.alt}
                      className="w-11 h-11 sm:w-12 sm:h-12 md:w-16 md:h-16 object-contain shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-title text-label-md md:text-title-md text-light-on-surface truncate">
                        {cat.title}
                      </span>
                      <span className="font-body text-body-sm text-light-primary truncate">{cat.subtitle}</span>
                    </div>
                  </button>
                </ScrollReveal>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Section 3: Recommended for You */}
        <section id="recommended-products" className="flex flex-col gap-gutter-sm md:gap-gutter-md">
          <ScrollReveal>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-headline text-title-lg md:text-headline-md text-light-on-surface">
                Recommended for You
              </h2>
              <span className="font-body text-body-sm text-light-on-surface-variant shrink-0">
                Based on popular picks
              </span>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md items-stretch">
            {recommended.map((product, index) => (
              <ScrollReveal key={product.id} delay={(index % 4) * 0.04} className="h-full min-w-0">
                <ProductCard
                  product={product}
                  isWishlisted={wishlistIds.includes(product.id)}
                  showWishlistButton={false}
                  showRating={false}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={onSelectProduct}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Section 4: New Arrivals */}
        <section id="new-arrivals" className="flex flex-col gap-gutter-sm md:gap-gutter-md">
          <ScrollReveal>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-headline text-title-lg md:text-headline-md text-light-on-surface">
                New Arrivals
              </h2>
              <span className="font-label text-label-md text-light-primary shrink-0">Fresh in store</span>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md items-stretch">
            {newArrivals.map((product, index) => (
              <ScrollReveal key={product.id} delay={(index % 4) * 0.04} className="h-full min-w-0">
                <ProductCard
                  product={product}
                  isWishlisted={wishlistIds.includes(product.id)}
                  showWishlistButton={false}
                  showRating={false}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onSelectProduct={onSelectProduct}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
