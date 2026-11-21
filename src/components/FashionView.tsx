import { useMemo, useState } from 'react';
import { CATALOG_PRODUCTS, STITCH_IMAGES } from '../data/catalog.ts';
import type { Product } from '../types/findkart.ts';
import { ProductCard } from './ProductCard.tsx';
import { ProductImage } from './ProductImage.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';

interface FashionViewProps {
  activeSubNav: string;
  onChangeSubNav: (nav: string) => void;
  searchQuery: string;
  wishlistIds: string[];
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
}

type SortMode = 'popularity' | 'price-asc' | 'price-desc' | 'newest';

export function FashionView({
  activeSubNav,
  onChangeSubNav,
  searchQuery,
  wishlistIds,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
}: FashionViewProps) {
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<'all' | 'under1000' | '1000to2500' | 'above2500'>('all');
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [sortMode, setSortMode] = useState<SortMode>('popularity');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const fashionProducts = useMemo(
    () => CATALOG_PRODUCTS.filter((p) => p.storeSection === 'fashion'),
    []
  );

  const activeFilterCount =
    selectedGenders.length +
    selectedCategories.length +
    selectedBrands.length +
    (priceRange !== 'all' ? 1 : 0) +
    (selectedSize ? 1 : 0) +
    (selectedColor ? 1 : 0) +
    (minDiscount > 0 ? 1 : 0);

  const toggleItem = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const clearAllFilters = () => {
    setSelectedGenders([]);
    setSelectedCategories([]);
    setSelectedBrands([]);
    setPriceRange('all');
    setSelectedSize(null);
    setSelectedColor(null);
    setMinDiscount(0);
    onChangeSubNav('All');
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fashionProducts
      .filter((p) => {
        if (q) {
          const hay = `${p.name} ${p.brand} ${p.category} ${p.subCategory || ''} ${p.gender || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (activeSubNav !== 'All') {
          const navLower = activeSubNav.toLowerCase();
          const matchesSub =
            p.gender?.toLowerCase() === navLower ||
            p.category.toLowerCase() === navLower ||
            p.subCategory?.toLowerCase() === navLower ||
            p.name.toLowerCase().includes(navLower);
          if (!matchesSub) return false;
        }
        if (selectedGenders.length > 0 && (!p.gender || !selectedGenders.includes(p.gender))) {
          return false;
        }
        if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) {
          return false;
        }
        if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) {
          return false;
        }
        if (priceRange === 'under1000' && p.price >= 1000) return false;
        if (priceRange === '1000to2500' && (p.price < 1000 || p.price > 2500)) return false;
        if (priceRange === 'above2500' && p.price <= 2500) return false;
        if (selectedSize && (!p.sizes || !p.sizes.includes(selectedSize))) return false;
        if (selectedColor && (!p.colors || !p.colors.includes(selectedColor))) return false;
        if (p.discountPercent < minDiscount) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'price-asc') return a.price - b.price;
        if (sortMode === 'price-desc') return b.price - a.price;
        if (sortMode === 'newest') return b.newest - a.newest;
        return b.popularity - a.popularity;
      });
  }, [
    fashionProducts,
    searchQuery,
    activeSubNav,
    selectedGenders,
    selectedCategories,
    selectedBrands,
    priceRange,
    selectedSize,
    selectedColor,
    minDiscount,
    sortMode,
  ]);

  const filterPanelContent = (
    <>
      <div className="flex items-center justify-between pb-gutter-sm border-b border-light-outline-variant/60">
        <h2 className="font-headline text-title-md text-light-on-surface">Filters</h2>
        <button
          type="button"
          onClick={clearAllFilters}
          className="font-label text-label-sm text-light-primary hover:underline cursor-pointer"
        >
          Clear all
        </button>
      </div>

      {/* Gender */}
      <div className="flex flex-col gap-2">
        <span className="font-label text-label-md text-light-on-surface">Gender</span>
        <div className="flex flex-col gap-1.5">
          {['Men', 'Women', 'Kids'].map((g) => (
            <label key={g} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedGenders.includes(g)}
                onChange={() => toggleItem(selectedGenders, g, setSelectedGenders)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{g}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Category</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'T-shirts', label: 'Tops, T-shirts & Outerwear' },
            { value: 'Jeans', label: 'Jeans, Chinos & Joggers' },
            { value: 'Ethnic', label: 'Dresses, Sarees & Kurtas' },
            { value: 'Footwear', label: 'Sneakers, Loafers & Heels' },
            { value: 'Accessories', label: 'Bags, Watches & Eyewear' },
          ].map((c) => (
            <label key={c.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.value)}
                onChange={() => toggleItem(selectedCategories, c.value, setSelectedCategories)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Brand */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Brand</span>
        <div className="flex flex-col gap-1.5">
          {['Roadster', 'Allen Solly', 'Fabindia', 'Lavie', 'Fossil'].map((b) => (
            <label key={b} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBrands.includes(b)}
                onChange={() => toggleItem(selectedBrands, b, setSelectedBrands)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{b}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Price Range</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'all', label: 'All Prices' },
            { value: 'under1000', label: 'Under ₹1,000' },
            { value: '1000to2500', label: '₹1,000 – ₹2,500' },
            { value: 'above2500', label: 'Above ₹2,500' },
          ].map((pr) => (
            <label key={pr.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fashion-price"
                checked={priceRange === pr.value}
                onChange={() => setPriceRange(pr.value as typeof priceRange)}
                className="w-4 h-4 border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{pr.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Size</span>
        <div className="flex flex-wrap gap-1.5">
          {['S', 'M', 'L', 'XL', 'Free'].map((sz) => {
            const active = selectedSize === sz;
            return (
              <button
                key={sz}
                type="button"
                onClick={() => setSelectedSize(active ? null : sz)}
                className={`px-2.5 py-1 rounded-sm border font-label text-label-sm cursor-pointer transition-colors ${
                  active
                    ? 'bg-light-primary text-light-on-primary border-light-primary'
                    : 'border-light-outline-variant text-light-on-surface hover:border-light-primary'
                }`}
              >
                {sz}
              </button>
            );
          })}
        </div>
      </div>

      {/* Colour */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Colour</span>
        <div className="flex flex-wrap gap-2">
          {['Blue', 'Yellow', 'Tan', 'Navy', 'Olive', 'Crimson', 'Black', 'Blush'].map((clr) => {
            const active = selectedColor === clr;
            return (
              <button
                key={clr}
                type="button"
                onClick={() => setSelectedColor(active ? null : clr)}
                className={`px-2.5 py-1 rounded-sm border font-body text-body-sm cursor-pointer transition-colors ${
                  active
                    ? 'bg-light-primary text-light-on-primary border-light-primary'
                    : 'border-light-outline-variant text-light-on-surface hover:border-light-primary'
                }`}
              >
                {clr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Discount */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Discount</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 0, label: 'All Discounts' },
            { value: 30, label: '30% or more' },
            { value: 40, label: '40% or more' },
            { value: 50, label: '50% or more' },
          ].map((d) => (
            <label key={d.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fashion-discount"
                checked={minDiscount === d.value}
                onChange={() => setMinDiscount(d.value)}
                className="w-4 h-4 border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{d.label}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="bg-light-surface-container-low">
      <div className="max-w-7xl mx-auto px-3 sm:px-gutter-md lg:px-gutter-lg py-gutter-md md:py-gutter-lg flex flex-col gap-gutter-md md:gap-gutter-lg">
        {/* Compact Fashion Promotional Banner */}
        <ScrollReveal yOffset={14}>
          <section
            aria-label="Fashion promotion"
            className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 items-center"
          >
            <div className="order-2 lg:order-1 lg:col-span-7 p-gutter-md md:p-gutter-xl flex flex-col gap-1.5 md:gap-gutter-sm min-w-0">
              <span className="inline-flex w-fit px-2 py-0.5 md:px-2.5 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm">
                NEW SEASON COLLECTION
              </span>
              <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-light-on-surface text-balance">
                Effortless everyday fashion, curated for India
              </h1>
              <p className="font-body text-body-sm md:text-body-md text-light-on-surface-variant max-w-xl">
                Discover breathable cottons, ethnic kurtas, denim, footwear, and everyday accessories starting at ₹449.
              </p>
              <div className="hidden md:block pt-gutter-xs">
                <a
                  href="#fashion-catalog"
                  className="inline-flex items-center gap-gutter-sm px-gutter-lg py-2.5 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-label-md transition-colors shadow-sm"
                >
                  <span>Shop Now</span>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    arrow_forward
                  </span>
                </a>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-5 h-full">
              <ProductImage
                src={STITCH_IMAGES.bannerFashionMinimal}
                alt="Minimalist FindKart fashion collection featuring denim, cotton shirt, and sneakers"
                className="w-full h-40 sm:h-56 lg:h-60 object-cover"
                fallbackIcon="checkroom"
              />
            </div>
          </section>
        </ScrollReveal>

        {/* Mobile & Tablet Active Title + Sort & Filter Bar */}
        <div className="flex flex-col gap-2 lg:hidden">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="font-title text-title-md text-light-on-surface truncate">
              {activeSubNav === 'All' ? 'Fashion' : `Fashion — ${activeSubNav}`}
            </span>
            <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums shrink-0">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-gutter-sm">
            <select
              aria-label="Sort fashion products"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="w-full min-h-[40px] rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface font-label text-label-sm py-2 px-3"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="newest">Newest First</option>
            </select>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="w-full min-h-[40px] rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface font-label text-label-sm py-2 px-3 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                tune
              </span>
              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>
          </div>
        </div>

        {/* Catalog Layout: Filter Sidebar + Product Grid */}
        <section id="fashion-catalog" className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          {/* Desktop Left Filters Panel */}
          <aside
            aria-label="Fashion filters"
            className="hidden lg:flex lg:col-span-3 bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-gutter-md flex-col gap-gutter-md shadow-sm"
          >
            {filterPanelContent}
          </aside>

          {/* Right Product Listing Column */}
          <div className="lg:col-span-9 flex flex-col gap-gutter-md min-w-0">
            {/* Desktop Sorting & Result Count Bar */}
            <div className="hidden lg:flex bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 px-gutter-md py-3 items-center justify-between gap-gutter-sm shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-title text-title-md text-light-on-surface">
                  {activeSubNav === 'All' ? 'Fashion' : `Fashion — ${activeSubNav}`}
                </span>
                <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'})
                </span>
              </div>

              <div className="flex items-center gap-gutter-sm">
                <label htmlFor="fashion-sort-select" className="font-label text-label-md text-light-on-surface-variant">
                  Sort by:
                </label>
                <select
                  id="fashion-sort-select"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface font-body text-body-sm py-1.5 pl-3 pr-8 focus:border-light-primary focus:ring-light-primary"
                >
                  <option value="popularity">Popularity</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-gutter-xl text-center flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-[36px] text-light-outline" aria-hidden="true">
                  checkroom
                </span>
                <h3 className="font-headline text-title-lg text-light-on-surface">
                  No fashion items match your filters
                </h3>
                <p className="font-body text-body-md text-light-on-surface-variant max-w-md">
                  Try clearing one or more filter selections to browse all FindKart fashion styles.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-gutter-lg py-2.5 rounded bg-light-primary text-light-on-primary font-label text-label-md cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-gutter-sm md:gap-gutter-md items-stretch">
                {filteredProducts.map((product, index) => (
                  <ScrollReveal key={product.id} delay={(index % 3) * 0.04} className="h-full min-w-0">
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
            )}
          </div>
        </section>
      </div>

      {/* Mobile & Tablet Filters Drawer */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Fashion filters"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="relative ml-auto w-[min(85vw,20rem)] bg-light-surface-container-lowest h-full overflow-y-auto overscroll-contain p-gutter-md flex flex-col gap-gutter-md shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-sm text-light-on-surface-variant uppercase">
                Refine Results
              </span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="w-8 h-8 rounded hover:bg-light-surface-container flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            {filterPanelContent}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-2 w-full py-3 rounded bg-light-primary text-light-on-primary font-label text-label-md cursor-pointer"
            >
              Show {filteredProducts.length} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
