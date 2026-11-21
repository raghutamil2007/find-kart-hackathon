import React from 'react';
import type { DeliveryLocation, StoreView, UserProfile } from '../types/findkart.ts';
import { ScrollProgressBar } from './ScrollReveal.tsx';

interface HeaderProps {
  currentView: StoreView;
  onNavigate: (view: StoreView) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (q: string) => void;
  location: DeliveryLocation;
  onOpenLocation: () => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onOpenOrders: () => void;
  wishlistCount: number;
  onOpenWishlist: () => void;
  cartCount: number;
  onOpenCart: () => void;
  fashionSubNav: string;
  onSelectFashionSubNav: (filter: string) => void;
  beautySubNav: string;
  onSelectBeautySubNav: (filter: string) => void;
}

const HOME_CATEGORIES: { view: StoreView; label: string; mobileLabel: string; icon: string }[] = [
  { view: 'fashion', label: 'Fashion', mobileLabel: 'Fashion', icon: 'checkroom' },
  { view: 'electronics', label: 'Electronics', mobileLabel: 'Electronics', icon: 'devices' },
  { view: 'beauty', label: 'Beauty', mobileLabel: 'Beauty', icon: 'spa' },
  { view: 'sports', label: 'Sports', mobileLabel: 'Sports', icon: 'fitness_center' },
  { view: 'home-kitchen', label: 'Home & Kitchen', mobileLabel: 'Home', icon: 'kitchen' },
  { view: 'books', label: 'Books', mobileLabel: 'Books', icon: 'menu_book' },
  { view: 'toys', label: 'Toys', mobileLabel: 'Toys', icon: 'toys' },
  { view: 'accessories', label: 'Accessories', mobileLabel: 'Accessories', icon: 'watch' },
];

const FASHION_SUBNAV = [
  'All',
  'Men',
  'Women',
  'Kids',
  'Footwear',
  'Watches',
  'Bags',
  'Accessories',
  'Ethnic Wear',
  'Western Wear',
  'Sportswear',
];

const BEAUTY_SUBNAV: { key: string; label: string; icon?: string }[] = [
  { key: 'All', label: 'All Beauty' },
  { key: 'Skincare', label: 'Skincare', icon: 'spa' },
  { key: 'Makeup', label: 'Makeup', icon: 'brush' },
  { key: 'Haircare', label: 'Haircare', icon: 'water_drop' },
  { key: 'Fragrances', label: 'Fragrances', icon: 'liquor' },
  { key: 'Bath & Body', label: 'Bath & Body' },
  { key: "Men's Grooming", label: "Men's Grooming" },
  { key: 'Beauty Tools', label: 'Beauty Tools' },
  { key: 'Personal Care', label: 'Personal Care' },
  { key: 'Lip Care', label: 'Lip Care' },
  { key: 'Sun Protection', label: 'Sun Protection' },
];

export function Header({
  currentView,
  onNavigate,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  location,
  onOpenLocation,
  user,
  onOpenAuth,
  onOpenOrders,
  wishlistCount,
  onOpenWishlist,
  cartCount,
  onOpenCart,
  fashionSubNav,
  onSelectFashionSubNav,
  beautySubNav,
  onSelectBeautySubNav,
}: HeaderProps) {
  const storeSubtitle =
    currentView === 'fashion'
      ? 'FASHION STORE'
      : currentView === 'beauty'
        ? 'BEAUTY STORE'
        : currentView === 'customer-care'
          ? 'CUSTOMER CARE'
          : 'INDIA STORE';

  const searchPlaceholder =
    currentView === 'fashion'
      ? 'Search fashion products...'
      : currentView === 'beauty'
        ? 'Search beauty products...'
        : currentView === 'customer-care'
          ? 'Search help topics, orders, or products...'
          : 'Search for electronics, fashion, home essentials...';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(searchQuery);
  };

  const firstName = user ? user.name.split(' ')[0] : 'Login';

  return (
    <header className="sticky top-0 z-30 bg-light-primary text-light-on-primary border-b border-light-primary-container shadow-sm">
      {/* Desktop & Tablet Header Bar (md+) */}
      <div className="hidden md:flex max-w-7xl mx-auto px-gutter-md lg:px-gutter-lg h-16 items-center justify-between gap-3 lg:gap-gutter-lg">
        {/* Brand Logo + Location */}
        <div className="flex items-center gap-2 lg:gap-gutter-lg shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-gutter-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow rounded text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded bg-accent-yellow text-on-accent-yellow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                shopping_bag
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-title-lg text-light-on-primary leading-none whitespace-nowrap">
                FindKart
              </span>
              <span className="font-label text-label-sm text-accent-yellow whitespace-nowrap">
                {storeSubtitle}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenLocation}
            aria-label={`Change delivery location from ${location.city} ${location.pincode}`}
            className="flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded hover:bg-light-primary-container transition-colors duration-150 text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-accent-yellow shrink-0" aria-hidden="true">
              location_on
            </span>
            <div className="flex flex-col">
              <span className="hidden xl:inline font-label text-label-sm text-light-inverse-primary leading-none">
                Deliver to
              </span>
              <span className="font-label text-label-sm lg:text-label-md text-light-on-primary leading-tight whitespace-nowrap">
                <span className="hidden lg:inline">{location.city} </span>
                <span className="lg:hidden">{location.city.slice(0, 3)} </span>
                {location.pincode}
              </span>
            </div>
          </button>
        </div>

        {/* Prominent Search Bar */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 max-w-2xl" role="search">
          <div className="relative flex items-center">
            <span
              className="material-symbols-outlined text-[20px] text-light-outline absolute left-3 pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full h-10 pl-10 pr-20 lg:pr-24 rounded bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-body-md border-0 focus:ring-2 focus:ring-accent-yellow focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1 h-8 px-2.5 lg:px-gutter-md rounded-sm bg-accent-yellow text-on-accent-yellow hover:bg-light-secondary-container font-label text-label-sm lg:text-label-md transition-colors duration-150 cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>

        {/* Account, Wishlist, Cart Actions */}
        <nav aria-label="Customer actions" className="flex items-center gap-1 lg:gap-gutter-sm shrink-0">
          <button
            type="button"
            onClick={user ? onOpenOrders : onOpenAuth}
            className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded bg-light-surface-container-lowest text-light-primary hover:bg-light-surface-container transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              person
            </span>
            <span className="font-label text-label-md max-w-20 truncate">{firstName}</span>
          </button>

          <button
            type="button"
            onClick={onOpenWishlist}
            aria-label={`Wishlist (${wishlistCount})`}
            className="relative inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded hover:bg-light-primary-container text-light-on-primary transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              favorite
            </span>
            <span className="hidden lg:inline font-label text-label-md">Wishlist</span>
            {wishlistCount > 0 && (
              <span className="inline-flex min-w-5 h-5 px-1 rounded-full bg-accent-yellow text-on-accent-yellow font-label text-label-sm items-center justify-center tabular-nums">
                {wishlistCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Shopping cart (${cartCount})`}
            className="relative inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded hover:bg-light-primary-container text-light-on-primary transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              shopping_cart
            </span>
            <span className="hidden lg:inline font-label text-label-md">Cart</span>
            <span className="inline-flex min-w-5 h-5 px-1 rounded-full bg-accent-yellow text-on-accent-yellow font-label text-label-sm items-center justify-center tabular-nums">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('customer-care')}
            aria-label="Customer Care"
            title="Customer Care"
            aria-current={currentView === 'customer-care' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              currentView === 'customer-care'
                ? 'bg-light-primary-container text-accent-yellow ring-1 ring-accent-yellow/60'
                : 'hover:bg-light-primary-container text-light-on-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              support_agent
            </span>
            <span className="hidden lg:inline font-label text-label-md">Customer Care</span>
          </button>
        </nav>
      </div>

      {/* Mobile Header Bar */}
      <div className="md:hidden px-3 sm:px-gutter-md py-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-left min-w-0"
          >
            <div className="w-8 h-8 rounded bg-accent-yellow text-on-accent-yellow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                shopping_bag
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline text-title-lg text-light-on-primary leading-none truncate">
                FindKart
              </span>
              <span className="font-label text-[10px] leading-tight text-accent-yellow truncate">
                {storeSubtitle}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={user ? onOpenOrders : onOpenAuth}
              aria-label={user ? 'Profile' : 'Login'}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 min-h-[38px] rounded bg-light-primary-container text-light-on-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                person
              </span>
              <span className="font-label text-label-sm max-w-14 sm:max-w-16 truncate">{firstName}</span>
            </button>
            <button
              type="button"
              onClick={onOpenWishlist}
              aria-label="Wishlist"
              className="relative inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded text-light-on-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                favorite
              </span>
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent-yellow text-on-accent-yellow font-label text-label-sm flex items-center justify-center tabular-nums">
                  {wishlistCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Cart"
              className="relative inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded text-light-on-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                shopping_cart
              </span>
              <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent-yellow text-on-accent-yellow font-label text-label-sm flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('customer-care')}
              aria-label="Customer Care"
              title="Customer Care"
              aria-current={currentView === 'customer-care' ? 'page' : undefined}
              className={`relative inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded cursor-pointer ${
                currentView === 'customer-care'
                  ? 'bg-light-primary-container text-accent-yellow'
                  : 'text-light-on-primary hover:bg-light-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                support_agent
              </span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} role="search" className="relative flex items-center">
          <span
            className="material-symbols-outlined text-[18px] text-light-outline absolute left-3 pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full h-10 pl-10 pr-16 rounded bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base border-0 focus:ring-2 focus:ring-accent-yellow focus:outline-none"
          />
          <button
            type="submit"
            className="absolute right-1 h-8 px-2.5 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm cursor-pointer"
          >
            Go
          </button>
        </form>

        <button
          type="button"
          onClick={onOpenLocation}
          className="flex items-center gap-1.5 text-light-inverse-primary text-left w-fit py-0.5"
        >
          <span className="material-symbols-outlined text-[15px] text-accent-yellow shrink-0" aria-hidden="true">
            location_on
          </span>
          <span className="font-body text-body-sm truncate">
            Deliver to {location.city} {location.pincode}
          </span>
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            expand_more
          </span>
        </button>
      </div>

      {/* Category / Sub-Navigation Bar */}
      {currentView === 'fashion' ? (
        <div className="bg-light-surface-container-lowest text-light-on-surface border-b border-light-outline-variant/60">
          <nav
            aria-label="Fashion categories"
            className="max-w-7xl mx-auto px-3 sm:px-gutter-md lg:px-gutter-lg py-2 flex items-center justify-start lg:justify-between gap-1.5 sm:gap-gutter-sm overflow-x-auto no-scrollbar snap-x"
          >
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-light-on-surface-variant hover:text-light-primary font-label text-label-md shrink-0 cursor-pointer snap-start"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                arrow_back
              </span>
              <span>Store</span>
            </button>
            {FASHION_SUBNAV.map((item) => {
              const isActive = fashionSubNav === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSelectFashionSubNav(item)}
                  className={`px-3 py-1.5 rounded-sm font-label text-label-md shrink-0 transition-colors cursor-pointer whitespace-nowrap snap-start ${
                    isActive
                      ? 'bg-light-primary text-light-on-primary'
                      : 'text-light-on-surface hover:bg-light-surface-container-low hover:text-light-primary'
                  }`}
                >
                  {item === 'All' ? 'All Fashion' : item}
                </button>
              );
            })}
          </nav>
        </div>
      ) : currentView === 'beauty' ? (
        <div className="bg-light-surface-container-lowest text-light-on-surface border-b border-light-outline-variant/60">
          <nav
            aria-label="Beauty categories"
            className="max-w-7xl mx-auto px-3 sm:px-gutter-md lg:px-gutter-lg py-2 flex items-center justify-start lg:justify-between gap-1.5 sm:gap-gutter-sm overflow-x-auto no-scrollbar snap-x"
          >
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-light-on-surface-variant hover:text-light-primary font-label text-label-md shrink-0 cursor-pointer snap-start"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                arrow_back
              </span>
              <span>Store</span>
            </button>
            {BEAUTY_SUBNAV.map((item) => {
              const isActive = beautySubNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectBeautySubNav(item.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm font-label text-label-md shrink-0 transition-colors cursor-pointer whitespace-nowrap snap-start ${
                    isActive
                      ? 'bg-light-primary text-light-on-primary'
                      : 'text-light-on-surface hover:bg-light-surface-container-low hover:text-light-primary'
                  }`}
                >
                  {item.icon && (
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        isActive ? 'text-light-on-primary' : 'text-light-primary'
                      }`}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      ) : (
        <div className="bg-light-surface-container-lowest text-light-on-surface border-b border-light-outline-variant/60">
          <nav
            aria-label="Product categories"
            className="max-w-7xl mx-auto px-3 sm:px-gutter-md lg:px-gutter-lg py-2 md:py-2.5 flex items-center justify-start md:justify-between gap-2 sm:gap-gutter-md overflow-x-auto no-scrollbar snap-x"
          >
            {HOME_CATEGORIES.map((cat) => {
              const isActive = currentView === cat.view;
              return (
                <button
                  key={cat.view}
                  type="button"
                  onClick={() => onNavigate(cat.view)}
                  className={`flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-2.5 py-1.5 rounded transition-colors shrink-0 cursor-pointer whitespace-nowrap snap-start ${
                    isActive
                      ? 'bg-light-surface-container text-light-primary'
                      : 'hover:bg-light-surface-container-low hover:text-light-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] md:text-[18px] text-light-primary" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span className="font-label text-label-sm md:text-label-md">
                    <span className="md:hidden">{cat.mobileLabel}</span>
                    <span className="hidden md:inline">{cat.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
      <ScrollProgressBar />
    </header>
  );
}
