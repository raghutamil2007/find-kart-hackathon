import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthView } from './components/AuthView.tsx';
import { BeautyView } from './components/BeautyView.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { CategoryView } from './components/CategoryView.tsx';
import { CustomerCareView } from './components/CustomerCareView.tsx';
import { FashionView } from './components/FashionView.tsx';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { HomeView } from './components/HomeView.tsx';
import { LocationModal } from './components/LocationModal.tsx';
import { OrdersModal } from './components/OrdersModal.tsx';
import { ProductModal } from './components/ProductModal.tsx';
import { WishlistDrawer } from './components/WishlistDrawer.tsx';
import type { CartItem, DeliveryLocation, Order, Product, StoreView, UserProfile } from './types/findkart.ts';

const GUEST_CART_KEY = 'findkart_guest_cart';
const GUEST_WISHLIST_KEY = 'findkart_guest_wishlist';
const GUEST_LOCATION_KEY = 'findkart_guest_location';
const GUEST_ORDERS_KEY = 'findkart_guest_orders';

function readStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<StoreView>('auth');
  const [searchQuery, setSearchQuery] = useState('');
  const [fashionSubNav, setFashionSubNav] = useState('All');
  const [beautySubNav, setBeautySubNav] = useState('All');

  // Auth session state (token held strictly in React memory, cookie backed by HttpOnly)
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Shopping state
  const [cart, setCart] = useState<CartItem[]>(() => readStorageJson<CartItem[]>(GUEST_CART_KEY, []));
  const [wishlistIds, setWishlistIds] = useState<string[]>(() =>
    readStorageJson<string[]>(GUEST_WISHLIST_KEY, [])
  );
  const [location, setLocation] = useState<DeliveryLocation>(() =>
    readStorageJson<DeliveryLocation>(GUEST_LOCATION_KEY, { city: 'Bengaluru', pincode: '560001' })
  );
  const [orders, setOrders] = useState<Order[]>(() => readStorageJson<Order[]>(GUEST_ORDERS_KEY, []));

  // Overlays & Modals
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
  const [preselectedSupportOrderId, setPreselectedSupportOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const hasActiveOverlay =
    cartOpen || wishlistOpen || locationOpen || ordersOpen || Boolean(selectedProduct) || Boolean(infoModal);

  useEffect(() => {
    if (!hasActiveOverlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (infoModal) setInfoModal(null);
        else if (selectedProduct) setSelectedProduct(null);
        else if (cartOpen) setCartOpen(false);
        else if (wishlistOpen) setWishlistOpen(false);
        else if (locationOpen) setLocationOpen(false);
        else if (ordersOpen) setOrdersOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasActiveOverlay, infoModal, selectedProduct, cartOpen, wishlistOpen, locationOpen, ordersOpen]);

  // Hydrate authenticated session on initial mount via HttpOnly cookie
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.user) return;
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          location: data.user.location,
        });
        if (data.token) setAuthToken(data.token);
        if (Array.isArray(data.user.cart)) setCart(data.user.cart);
        if (Array.isArray(data.user.wishlist)) setWishlistIds(data.user.wishlist);
        if (data.user.location) setLocation(data.user.location);
        if (Array.isArray(data.user.orders)) setOrders(data.user.orders);
      })
      .catch(() => {
        // Stay in guest mode cleanly
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync guest preferences locally when signed out
  useEffect(() => {
    if (!user) {
      writeStorageJson(GUEST_CART_KEY, cart);
      writeStorageJson(GUEST_WISHLIST_KEY, wishlistIds);
      writeStorageJson(GUEST_LOCATION_KEY, location);
      writeStorageJson(GUEST_ORDERS_KEY, orders);
    }
  }, [user, cart, wishlistIds, location, orders]);

  const syncCartToServer = async (nextCart: CartItem[]) => {
    if (!user) return;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      await fetch('/api/user/cart', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ cart: nextCart }),
      });
    } catch {
      // Ignore transient network errors
    }
  };

  const syncWishlistToServer = async (nextWishlist: string[]) => {
    if (!user) return;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      await fetch('/api/user/wishlist', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ wishlist: nextWishlist }),
      });
    } catch {
      // Ignore transient network errors
    }
  };

  const syncLocationToServer = async (nextLoc: DeliveryLocation) => {
    if (!user) return;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      await fetch('/api/user/location', {
        method: 'PUT',
        headers,
        body: JSON.stringify(nextLoc),
      });
    } catch {
      // Ignore transient network errors
    }
  };

  const handleNavigate = (view: StoreView) => {
    setCurrentView(view);
    if (view !== 'search') {
      setSearchQuery('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
  };

  const handleSearchSubmit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (currentView !== 'fashion' && currentView !== 'beauty' && currentView !== 'customer-care') {
      setCurrentView('search');
    }
    showToast(`Showing results for "${trimmed}"`);
  };

  const handleAddToCart = (product: Product, size?: string, color?: string) => {
    const chosenSize = size ?? product.sizes?.[0];
    const chosenColor = color ?? product.colors?.[0];
    setCart((prev) => {
      const idx = prev.findIndex(
        (item) =>
          item.productId === product.id &&
          item.selectedSize === chosenSize &&
          item.selectedColor === chosenColor
      );
      let next: CartItem[];
      if (idx >= 0) {
        next = prev.map((item, i) =>
          i === idx ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item
        );
      } else {
        next = [
          ...prev,
          {
            productId: product.id,
            quantity: 1,
            selectedSize: chosenSize,
            selectedColor: chosenColor,
          },
        ];
      }
      void syncCartToServer(next);
      return next;
    });
    showToast(`${product.name} added to cart`);
  };

  const handleUpdateCartQty = (index: number, delta: number) => {
    setCart((prev) => {
      const next = prev
        .map((item, i) => (i === index ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0);
      void syncCartToServer(next);
      return next;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== index);
      void syncCartToServer(next);
      return next;
    });
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      void syncWishlistToServer(next);
      showToast(exists ? 'Removed from wishlist' : 'Saved to wishlist');
      return next;
    });
  };

  const handleSelectLocation = (loc: DeliveryLocation) => {
    setLocation(loc);
    void syncLocationToServer(loc);
    showToast(`Delivery location updated to ${loc.city} ${loc.pincode}`);
  };

  const handleOrderPlaced = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
    setCart([]);
    void syncCartToServer([]);
    showToast(`Order #${order.orderId} confirmed!`);
  };

  const handleSignOut = async () => {
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'FindKart' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      await fetch('/api/auth/logout', { method: 'POST', headers });
    } catch {
      // Ignore network errors
    }
    setUser(null);
    setAuthToken(null);
    setCart([]);
    setWishlistIds([]);
    setOrders([]);
    writeStorageJson(GUEST_CART_KEY, []);
    writeStorageJson(GUEST_WISHLIST_KEY, []);
    writeStorageJson(GUEST_ORDERS_KEY, []);
    setCurrentView('auth');
    showToast('Signed out of FindKart');
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (currentView === 'auth') {
    return (
      <MotionConfig reducedMotion="user">
        <AuthView
          guestCart={cart}
          guestWishlist={wishlistIds}
          onAuthSuccess={(payload) => {
            setAuthToken(payload.token);
            setUser({
              id: payload.user.id,
              name: payload.user.name,
              email: payload.user.email,
              location: payload.user.location,
            });
            setCart(payload.user.cart || []);
            setWishlistIds(payload.user.wishlist || []);
            setOrders(payload.user.orders || []);
            if (payload.user.location) setLocation(payload.user.location);
            writeStorageJson(GUEST_CART_KEY, []);
            writeStorageJson(GUEST_WISHLIST_KEY, []);
            setCurrentView('home');
            showToast(`Welcome, ${payload.user.name.split(' ')[0]}!`);
          }}
          onBackToStore={() => setCurrentView('home')}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-light-surface-container-lowest text-light-on-surface font-body">
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        location={location}
        onOpenLocation={() => setLocationOpen(true)}
        user={user}
        onOpenAuth={() => setCurrentView('auth')}
        onOpenOrders={() => setOrdersOpen(true)}
        wishlistCount={wishlistIds.length}
        onOpenWishlist={() => setWishlistOpen(true)}
        cartCount={totalCartCount}
        onOpenCart={() => setCartOpen(true)}
        fashionSubNav={fashionSubNav}
        onSelectFashionSubNav={setFashionSubNav}
        beautySubNav={beautySubNav}
        onSelectBeautySubNav={setBeautySubNav}
      />

      <main className="flex-1 flex flex-col">
        {currentView === 'home' && (
          <HomeView
            wishlistIds={wishlistIds}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={setSelectedProduct}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'fashion' && (
          <FashionView
            activeSubNav={fashionSubNav}
            onChangeSubNav={setFashionSubNav}
            searchQuery={searchQuery}
            wishlistIds={wishlistIds}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={setSelectedProduct}
          />
        )}

        {currentView === 'beauty' && (
          <BeautyView
            activeSubNav={beautySubNav}
            onChangeSubNav={setBeautySubNav}
            searchQuery={searchQuery}
            wishlistIds={wishlistIds}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={setSelectedProduct}
          />
        )}

        {currentView === 'customer-care' && (
          <CustomerCareView
            user={user}
            authToken={authToken}
            location={location}
            orders={orders}
            searchQuery={searchQuery}
            preselectedOrderId={preselectedSupportOrderId}
            onClearPreselectedOrder={() => setPreselectedSupportOrderId(null)}
            onShowToast={showToast}
            onBackToStore={() => handleNavigate('home')}
          />
        )}

        {currentView !== 'home' &&
          currentView !== 'fashion' &&
          currentView !== 'beauty' &&
          currentView !== 'customer-care' && (
          <CategoryView
            view={currentView}
            searchQuery={searchQuery}
            wishlistIds={wishlistIds}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={setSelectedProduct}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      <Footer
        onNavigate={handleNavigate}
        onOpenOrders={() => setOrdersOpen(true)}
        onShowInfo={(title, content) => setInfoModal({ title, content })}
      />

      {/* Drawers & Modals */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        location={location}
        user={user}
        authToken={authToken}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onOrderPlaced={handleOrderPlaced}
        onOpenAuth={() => setCurrentView('auth')}
      />

      <WishlistDrawer
        isOpen={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        wishlistIds={wishlistIds}
        onToggleWishlist={handleToggleWishlist}
        onMoveToCart={(p) => {
          handleAddToCart(p);
          handleToggleWishlist(p.id);
        }}
      />

      <ProductModal
        product={selectedProduct}
        isWishlisted={selectedProduct ? wishlistIds.includes(selectedProduct.id) : false}
        location={location}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        onToggleWishlist={handleToggleWishlist}
      />

      <LocationModal
        isOpen={locationOpen}
        currentLocation={location}
        onClose={() => setLocationOpen(false)}
        onSelectLocation={handleSelectLocation}
      />

      <OrdersModal
        isOpen={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        user={user}
        orders={orders}
        onSignOut={handleSignOut}
        onOpenAuth={() => setCurrentView('auth')}
        onContactSupport={(orderId) => {
          setPreselectedSupportOrderId(orderId || null);
          handleNavigate('customer-care');
        }}
      />

      {/* Footer Support/Policy Info Modal */}
      {infoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-gutter-md"
          role="dialog"
          aria-modal="true"
          aria-label={infoModal.title}
        >
          <div className="fixed inset-0 bg-black/50" onClick={() => setInfoModal(null)} aria-hidden="true" />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain bg-light-surface-container-lowest rounded-md border border-light-outline-variant shadow-xl p-gutter-md sm:p-gutter-lg flex flex-col gap-gutter-md">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-headline text-title-lg text-light-on-surface">{infoModal.title}</h2>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                aria-label="Close modal"
                className="w-9 h-9 rounded hover:bg-light-surface-container flex items-center justify-center shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <p className="font-body text-body-md text-light-on-surface-variant">{infoModal.content}</p>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full py-2.5 rounded bg-light-primary text-light-on-primary font-label text-label-md cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-40 px-gutter-md py-3 rounded bg-light-inverse-surface text-light-inverse-on-surface shadow-md flex items-center gap-gutter-sm"
        >
          <span className="material-symbols-outlined text-[18px] text-accent-yellow shrink-0" aria-hidden="true">
            check_circle
          </span>
          <span className="font-body text-body-md leading-snug">{toastMessage}</span>
        </div>
      )}
      </div>
    </MotionConfig>
  );
}
