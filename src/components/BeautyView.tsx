import { useMemo, useState } from 'react';
import { CATALOG_PRODUCTS, STITCH_IMAGES } from '../data/catalog.ts';
import type { Product } from '../types/findkart.ts';
import { ProductCard } from './ProductCard.tsx';
import { ProductImage } from './ProductImage.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';

interface BeautyViewProps {
  activeSubNav: string;
  onChangeSubNav: (nav: string) => void;
  searchQuery: string;
  wishlistIds: string[];
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
}

type SortMode = 'popularity' | 'price-asc' | 'price-desc' | 'newest';

export function BeautyView({
  activeSubNav,
  onChangeSubNav,
  searchQuery,
  wishlistIds,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
}: BeautyViewProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<'all' | 'under500' | '500to1000' | 'above1000'>('all');
  const [selectedSkin, setSelectedSkin] = useState<string[]>([]);
  const [selectedHair, setSelectedHair] = useState<string[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [sortMode, setSortMode] = useState<SortMode>('popularity');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const beautyProducts = useMemo(
    () => CATALOG_PRODUCTS.filter((p) => p.storeSection === 'beauty'),
    []
  );

  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    (priceRange !== 'all' ? 1 : 0) +
    selectedSkin.length +
    selectedHair.length +
    selectedConcerns.length +
    (minDiscount > 0 ? 1 : 0);

  const toggleItem = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setPriceRange('all');
    setSelectedSkin([]);
    setSelectedHair([]);
    setSelectedConcerns([]);
    setMinDiscount(0);
    onChangeSubNav('All');
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return beautyProducts
      .filter((p) => {
        if (q) {
          const hay = `${p.name} ${p.brand} ${p.category} ${p.subCategory || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (activeSubNav !== 'All') {
          const navLower = activeSubNav.toLowerCase();
          const matchesSub =
            p.category.toLowerCase() === navLower ||
            p.subCategory?.toLowerCase() === navLower ||
            p.name.toLowerCase().includes(navLower);
          if (!matchesSub) return false;
        }
        if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) {
          return false;
        }
        if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) {
          return false;
        }
        if (priceRange === 'under500' && p.price >= 500) return false;
        if (priceRange === '500to1000' && (p.price < 500 || p.price > 1000)) return false;
        if (priceRange === 'above1000' && p.price <= 1000) return false;
        if (
          selectedSkin.length > 0 &&
          (!p.skinType || !selectedSkin.some((s) => p.skinType?.includes(s as 'All' | 'Oily' | 'Dry')))
        ) {
          return false;
        }
        if (
          selectedHair.length > 0 &&
          (!p.hairType || !selectedHair.some((h) => p.hairType?.includes(h as 'Dry' | 'All')))
        ) {
          return false;
        }
        if (
          selectedConcerns.length > 0 &&
          (!p.concern || !selectedConcerns.some((c) => p.concern?.includes(c as 'Hydration' | 'Sun' | 'Hairfall')))
        ) {
          return false;
        }
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
    beautyProducts,
    searchQuery,
    activeSubNav,
    selectedCategories,
    selectedBrands,
    priceRange,
    selectedSkin,
    selectedHair,
    selectedConcerns,
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

      {/* Category */}
      <div className="flex flex-col gap-2">
        <span className="font-label text-label-md text-light-on-surface">Category</span>
        <div className="flex flex-col gap-1.5">
          {['Skincare', 'Makeup', 'Haircare', 'Fragrances', 'Sun Protection'].map((cat) => (
            <label key={cat} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat)}
                onChange={() => toggleItem(selectedCategories, cat, setSelectedCategories)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Brand */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Brand</span>
        <div className="flex flex-col gap-1.5">
          {['Minimalist', 'Plum', 'Lakme', "L'Oreal Paris", 'Mamaearth'].map((b) => (
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

      {/* Price */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Price</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'all', label: 'All Prices' },
            { value: 'under500', label: 'Under ₹500' },
            { value: '500to1000', label: '₹500 – ₹1,000' },
            { value: 'above1000', label: 'Above ₹1,000' },
          ].map((pr) => (
            <label key={pr.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="beauty-price"
                checked={priceRange === pr.value}
                onChange={() => setPriceRange(pr.value as typeof priceRange)}
                className="w-4 h-4 border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{pr.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Skin Type */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Skin Type</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'All', label: 'All Skin Types' },
            { value: 'Oily', label: 'Oily & Combination' },
            { value: 'Dry', label: 'Dry & Sensitive' },
          ].map((sk) => (
            <label key={sk.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSkin.includes(sk.value)}
                onChange={() => toggleItem(selectedSkin, sk.value, setSelectedSkin)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{sk.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Hair Type */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Hair Type</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'Dry', label: 'Dry & Frizzy' },
            { value: 'All', label: 'Normal & Thinning' },
          ].map((hr) => (
            <label key={hr.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedHair.includes(hr.value)}
                onChange={() => toggleItem(selectedHair, hr.value, setSelectedHair)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{hr.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Product Concern */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Product Concern</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'Hydration', label: 'Hydration & Glow' },
            { value: 'Sun', label: 'UV & Tan Protection' },
            { value: 'Hairfall', label: 'Hairfall Control' },
          ].map((cn) => (
            <label key={cn.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedConcerns.includes(cn.value)}
                onChange={() => toggleItem(selectedConcerns, cn.value, setSelectedConcerns)}
                className="w-4 h-4 rounded-sm border-light-outline-variant text-light-primary focus:ring-light-primary"
              />
              <span className="font-body text-body-sm text-light-on-surface">{cn.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Discount */}
      <div className="flex flex-col gap-2 pt-gutter-sm border-t border-light-outline-variant/40">
        <span className="font-label text-label-md text-light-on-surface">Discount</span>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 0, label: 'All Discounts' },
            { value: 20, label: '20% or more' },
            { value: 30, label: '30% or more' },
            { value: 40, label: '40% or more' },
          ].map((d) => (
            <label key={d.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="beauty-discount"
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
        {/* Minimal Beauty Promotional Banner */}
        <ScrollReveal yOffset={14}>
          <section
            aria-label="Beauty promotion"
            className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 items-center"
          >
            <div className="order-2 lg:order-1 lg:col-span-7 p-gutter-md md:p-gutter-xl flex flex-col gap-1.5 md:gap-gutter-sm min-w-0">
              <span className="inline-flex w-fit px-2 py-0.5 md:px-2.5 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm">
                DERMATOLOGIST-TESTED ESSENTIALS
              </span>
              <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-light-on-surface text-balance">
                Clean daily skincare &amp; beauty rituals
              </h1>
              <p className="font-body text-body-sm md:text-body-md text-light-on-surface-variant max-w-xl">
                Authentic serums, SPF sunscreens, makeup, and haircare from trusted Indian and global brands — delivered with Cash on Delivery.
              </p>
              <div className="hidden md:block pt-gutter-xs">
                <a
                  href="#beauty-catalog"
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
                src={STITCH_IMAGES.bannerBeautyMinimal}
                alt="Minimalist FindKart beauty studio display with serum, moisturizer, and lipstick"
                className="w-full h-40 sm:h-56 lg:h-60 object-cover"
                fallbackIcon="spa"
              />
            </div>
          </section>
        </ScrollReveal>

        {/* Mobile & Tablet Active Title + Sort & Filter Bar */}
        <div className="flex flex-col gap-2 lg:hidden">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="font-title text-title-md text-light-on-surface truncate">
              {activeSubNav === 'All' ? 'Beauty & Personal Care' : `Beauty — ${activeSubNav}`}
            </span>
            <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums shrink-0">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-gutter-sm">
            <select
              aria-label="Sort beauty products"
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

        {/* Catalog Layout */}
        <section id="beauty-catalog" className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          {/* Desktop Left Filters Panel */}
          <aside
            aria-label="Beauty filters"
            className="hidden lg:flex lg:col-span-3 bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-gutter-md flex-col gap-gutter-md shadow-sm"
          >
            {filterPanelContent}
          </aside>

          {/* Right Product Listing Column */}
          <div className="lg:col-span-9 flex flex-col gap-gutter-md min-w-0">
            <div className="hidden lg:flex bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 px-gutter-md py-3 items-center justify-between gap-gutter-sm shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-title text-title-md text-light-on-surface">
                  {activeSubNav === 'All' ? 'Beauty & Personal Care' : `Beauty — ${activeSubNav}`}
                </span>
                <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'})
                </span>
              </div>

              <div className="flex items-center gap-gutter-sm">
                <label htmlFor="beauty-sort-select" className="font-label text-label-md text-light-on-surface-variant">
                  Sort by:
                </label>
                <select
                  id="beauty-sort-select"
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
                  spa
                </span>
                <h3 className="font-headline text-title-lg text-light-on-surface">
                  No beauty products match your filters
                </h3>
                <p className="font-body text-body-md text-light-on-surface-variant max-w-md">
                  Try clearing one or more filter selections to view all skincare, makeup, and haircare picks.
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
          aria-label="Beauty filters"
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
