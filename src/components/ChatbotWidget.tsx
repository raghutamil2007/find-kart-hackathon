import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_PRODUCTS } from '../data/catalog.ts';
import type { ChatProductMatch, Product, StockNotification, UserProfile } from '../types/findkart.ts';
import {
  fallbackSubscribeStockNotification,
  safeParseApiResponse,
} from '../utils/api.ts';
import { buildDeterministicStockReply, getProductStock, toChatProductMatch } from '../utils/stock.ts';
import { ProductImage } from './ProductImage.tsx';

interface ChatbotWidgetProps {
  user: UserProfile | null;
  authToken: string | null;
  stockOverrides: Record<string, number>;
  notifications: StockNotification[];
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onNotificationCreated: (notification: StockNotification) => void;
  onShowToast: (msg: string) => void;
  hidden?: boolean;
}

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  matches?: ChatProductMatch[];
  askNotificationFor?: ChatProductMatch[];
  isError?: boolean;
  timestamp: string;
}

interface ChatApiResponse {
  reply?: string;
  matches?: ChatProductMatch[];
  askNotificationFor?: ChatProductMatch[];
  message?: string;
}

interface NotificationApiResponse {
  notification?: StockNotification;
  message?: string;
}

const QUICK_PROMPTS = [
  'SoundCore Headphones stock',
  'Classic Navy Jacket stock',
  'Out of stock products',
  'Sunscreen & Perfume stock',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChatbotWidget({
  user,
  authToken,
  stockOverrides,
  notifications,
  onAddToCart,
  onSelectProduct,
  onNotificationCreated,
  onShowToast,
  hidden = false,
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'alerts'>('chat');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingNotifyProduct, setPendingNotifyProduct] = useState<ChatProductMatch | null>(null);
  const [activeEmailProductId, setActiveEmailProductId] = useState<string | null>(null);
  const [notifyEmailInput, setNotifyEmailInput] = useState(user?.email || '');
  const [subscribingProductId, setSubscribingProductId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      text: 'Hello! I am your FindKart Stock Assistant. Ask me about any product to check live stock levels. If a product has 0 stock, I will mark it "Product Unavailable" and set up a restock notification for you.',
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const productMap = useMemo(() => new Map(CATALOG_PRODUCTS.map((p) => [p.id, p])), []);

  useEffect(() => {
    if (user?.email && !notifyEmailInput) {
      setNotifyEmailInput(user.email);
    }
  }, [user?.email, notifyEmailInput]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat') return;
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, activeTab, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Keep rendered stock counts fresh whenever live stockOverrides update
  const hydrateMatchStock = (match: ChatProductMatch): ChatProductMatch => {
    const catalogProd = productMap.get(match.id);
    if (!catalogProd) return match;
    return {
      ...match,
      stock: getProductStock(catalogProd, stockOverrides),
    };
  };

  const subscribeToProductAlert = async (product: ChatProductMatch, rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      onShowToast('Please enter a valid email address for notification');
      setActiveEmailProductId(product.id);
      return;
    }

    setSubscribingProductId(product.id);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch('/api/stock-notifications', {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId: product.id, email }),
      });

      const parsed = await safeParseApiResponse<NotificationApiResponse>(res);
      let savedNotification: StockNotification;
      let confirmMsg: string;

      if (parsed.isHtmlFallback) {
        savedNotification = fallbackSubscribeStockNotification({
          productId: product.id,
          productName: product.name,
          email,
        });
        confirmMsg = `Notification registered! We will notify ${email} as soon as ${product.name} is back in stock.`;
      } else if (!parsed.ok || !parsed.data?.notification) {
        throw new Error(parsed.errorMessage || 'Could not register restock notification.');
      } else {
        savedNotification = parsed.data.notification;
        confirmMsg =
          parsed.data.message ||
          `Notification registered! We will notify ${email} as soon as ${product.name} is back in stock.`;
      }

      onNotificationCreated(savedNotification);
      onShowToast(`Restock alert set for ${product.name}`);
      setActiveEmailProductId(null);
      setPendingNotifyProduct(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now().toString(36)}_notif`,
          role: 'assistant',
          text: confirmMsg,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Could not set notification');
    } finally {
      setSubscribingProductId(null);
    }
  };

  const sendMessage = async (rawPrompt: string) => {
    const text = rawPrompt.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `msg_${Date.now().toString(36)}_u`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    const lower = text.toLowerCase();

    // Handle conversational confirmation when bot asked for restock notification on a 0-stock item
    if (pendingNotifyProduct) {
      if (EMAIL_REGEX.test(text)) {
        await subscribeToProductAlert(pendingNotifyProduct, text);
        return;
      }
      if (/^(yes|yeah|yep|sure|ok|okay|please|notify|notify me|alert me|yes please|do it)\b/.test(lower)) {
        if (user?.email) {
          await subscribeToProductAlert(pendingNotifyProduct, user.email);
        } else {
          setActiveEmailProductId(pendingNotifyProduct.id);
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now().toString(36)}_askemail`,
              role: 'assistant',
              text: `Sure! Please type your email address (or enter it in the "${pendingNotifyProduct.name}" alert card above) so we can notify you when it is back in stock.`,
              matches: [pendingNotifyProduct],
              askNotificationFor: [pendingNotifyProduct],
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        return;
      }
      if (/^(no|nope|nah|cancel|not now)\b/.test(lower)) {
        const dismissedName = pendingNotifyProduct.name;
        setPendingNotifyProduct(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now().toString(36)}_no`,
            role: 'assistant',
            text: `No problem! I will not subscribe you for ${dismissedName}. Feel free to ask about any other FindKart product.`,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }
    }

    setIsLoading(true);
    try {
      const historyPayload = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, history: historyPayload }),
      });

      const parsed = await safeParseApiResponse<ChatApiResponse>(res);

      if (parsed.isHtmlFallback) {
        const local = buildDeterministicStockReply(text, stockOverrides);
        if (local.askNotificationFor.length > 0) {
          setPendingNotifyProduct(local.askNotificationFor[0]);
        } else {
          setPendingNotifyProduct(null);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now().toString(36)}_b`,
            role: 'assistant',
            text: local.reply,
            matches: local.matches,
            askNotificationFor: local.askNotificationFor,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      if (!parsed.ok || !parsed.data) {
        const fallbackMatches = parsed.data?.matches || [];
        const askList = parsed.data?.askNotificationFor || fallbackMatches.filter((m) => m.stock === 0);
        if (askList.length > 0) setPendingNotifyProduct(askList[0]);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now().toString(36)}_err`,
            role: 'assistant',
            text:
              parsed.errorMessage ||
              'Assistant could not complete the AI response right now. Here is our live catalog stock lookup:',
            matches: fallbackMatches,
            askNotificationFor: askList,
            isError: true,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const matches = (parsed.data.matches || []).map(hydrateMatchStock);
      const askFor = matches.filter((m) => m.stock === 0);
      setPendingNotifyProduct(askFor[0] || null);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now().toString(36)}_b`,
          role: 'assistant',
          text: parsed.data?.reply || 'Here are the latest stock details:',
          matches,
          askNotificationFor: askFor,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      const local = buildDeterministicStockReply(text, stockOverrides);
      if (local.askNotificationFor.length > 0) {
        setPendingNotifyProduct(local.askNotificationFor[0]);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now().toString(36)}_net`,
          role: 'assistant',
          text: local.reply,
          matches: local.matches,
          askNotificationFor: local.askNotificationFor,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(inputText);
  };

  const handleViewProduct = (match: ChatProductMatch) => {
    const full = productMap.get(match.id);
    if (full) {
      onSelectProduct(full);
      if (window.innerWidth < 640) {
        setIsOpen(false);
      }
    }
  };

  const handleAddProduct = (match: ChatProductMatch) => {
    const full = productMap.get(match.id);
    if (full) {
      onAddToCart(full);
    }
  };

  if (hidden) return null;

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 120);
          }}
          aria-label="Open FindKart Stock Assistant chatbot"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2.5 px-3.5 sm:px-4 h-12 sm:h-12 rounded-md bg-light-primary text-light-on-primary hover:bg-light-primary-container shadow-xl border border-accent-yellow/40 transition-all duration-150 cursor-pointer"
        >
          <span className="relative flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px] text-accent-yellow" aria-hidden="true">
              support_agent
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success ring-2 ring-light-primary" />
          </span>
          <span className="font-label text-label-md whitespace-nowrap">
            <span className="sm:hidden">Stock Bot</span>
            <span className="hidden sm:inline">Stock Assistant</span>
          </span>
          {notifications.length > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm flex items-center justify-center tabular-nums">
              {notifications.length}
            </span>
          )}
        </button>
      )}

      {/* Responsive Chatbot Panel (Full-width bottom sheet on mobile, docked widget on tablet/desktop) */}
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="FindKart Stock Assistant Chatbot"
          className="fixed inset-x-2 bottom-2 top-16 sm:top-auto sm:left-auto sm:bottom-6 sm:right-6 z-40 w-auto sm:w-[400px] md:w-[430px] sm:h-[590px] sm:max-h-[82dvh] flex flex-col rounded-md bg-light-surface-container-lowest border border-light-outline-variant shadow-2xl overflow-hidden"
        >
          {/* Chat Header */}
          <div className="bg-light-primary text-light-on-primary px-3.5 sm:px-4 py-3 flex items-center justify-between gap-2 shrink-0 border-b border-light-primary-container">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded bg-accent-yellow text-on-accent-yellow flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  smart_toy
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-title text-title-md text-light-on-primary leading-tight truncate">
                  FindKart Stock Assistant
                </h2>
                <p className="font-body text-[11px] text-light-inverse-primary truncate">
                  Live inventory check &amp; restock notifications
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'chat' ? 'alerts' : 'chat')}
                className={`px-2 py-1.5 rounded-sm font-label text-label-sm inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  activeTab === 'alerts'
                    ? 'bg-accent-yellow text-on-accent-yellow'
                    : 'bg-light-primary-container text-light-on-primary hover:bg-light-primary-container/80'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                  notifications_active
                </span>
                <span>Alerts ({notifications.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chatbot"
                className="w-8 h-8 rounded hover:bg-light-primary-container flex items-center justify-center cursor-pointer text-light-on-primary"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          </div>

          {activeTab === 'alerts' ? (
            <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4 flex flex-col gap-3 bg-light-surface-container-low">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-title text-title-md text-light-on-surface">
                  Your Restock Notifications
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className="font-label text-label-sm text-light-primary hover:underline cursor-pointer"
                >
                  Back to chat
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-light-surface-container-lowest rounded border border-light-outline-variant/60 gap-2">
                  <span className="material-symbols-outlined text-[36px] text-light-outline" aria-hidden="true">
                    notifications_off
                  </span>
                  <p className="font-title text-title-md text-light-on-surface">
                    No restock alerts yet
                  </p>
                  <p className="font-body text-body-sm text-light-on-surface-variant">
                    Ask about any unavailable product (0 stock) in chat and click &ldquo;Notify Me&rdquo; to get alerted when it returns.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {notifications.map((notif) => {
                    const catalogProd = productMap.get(notif.productId);
                    const liveStock = catalogProd ? getProductStock(catalogProd, stockOverrides) : 0;
                    return (
                      <li
                        key={notif.id}
                        className="p-3 rounded bg-light-surface-container-lowest border border-light-outline-variant/70 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-title text-label-md text-light-on-surface truncate">
                            {notif.productName}
                          </p>
                          <p className="font-body text-body-sm text-light-on-surface-variant truncate">
                            Alert email: {notif.email}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 mt-1 font-label text-label-sm ${
                              liveStock > 0 ? 'text-success' : 'text-light-error'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                              {liveStock > 0 ? 'check_circle' : 'schedule'}
                            </span>
                            {liveStock > 0
                              ? `Back in Stock (${liveStock} units)`
                              : 'Product Unavailable · Waiting for restock'}
                          </span>
                        </div>
                        {catalogProd && (
                          <button
                            type="button"
                            onClick={() => handleViewProduct(toChatProductMatch(catalogProd, stockOverrides))}
                            className="px-2.5 py-1.5 rounded-sm border border-light-outline-variant font-label text-label-sm text-light-primary hover:bg-light-surface-container cursor-pointer shrink-0"
                          >
                            View
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* Quick Prompt Bar */}
              <div className="px-3 py-2 bg-light-surface-container-low border-b border-light-outline-variant/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isLoading}
                    onClick={() => void sendMessage(prompt)}
                    className="px-2.5 py-1 rounded-sm bg-light-surface-container-lowest border border-light-outline-variant text-light-on-surface hover:border-light-primary hover:text-light-primary font-label text-label-sm whitespace-nowrap cursor-pointer transition-colors shrink-0"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 flex flex-col gap-3 bg-light-surface-container-low">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const displayMatches = (msg.matches || []).map(hydrateMatchStock);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-md px-3.5 py-2.5 font-body text-body-sm sm:text-body-md leading-relaxed ${
                          isUser
                            ? 'bg-light-primary text-light-on-primary'
                            : msg.isError
                              ? 'bg-light-error-container/40 text-light-on-surface border border-light-error/30'
                              : 'bg-light-surface-container-lowest text-light-on-surface border border-light-outline-variant/70 shadow-xs'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Matched Product Stock Cards */}
                      {displayMatches.length > 0 && (
                        <div className="w-full flex flex-col gap-2">
                          {displayMatches.map((match) => {
                            const isUnavailable = match.stock === 0;
                            const isLowStock = match.stock > 0 && match.stock <= 5;
                            const existingNotif = notifications.find((n) => n.productId === match.id);
                            const isEditingEmail = activeEmailProductId === match.id;
                            const isSubscribing = subscribingProductId === match.id;

                            return (
                              <div
                                key={`${msg.id}_${match.id}`}
                                className="w-full rounded-md bg-light-surface-container-lowest border border-light-outline-variant/80 p-2.5 flex flex-col gap-2 shadow-xs"
                              >
                                <div className="flex items-start gap-2.5">
                                  <div className="w-14 h-14 rounded bg-light-surface-container-low p-1 shrink-0 flex items-center justify-center">
                                    <ProductImage
                                      src={match.imageUrl}
                                      alt={match.imageAlt}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleViewProduct(match)}
                                        className="text-left font-title text-label-md text-light-on-surface hover:text-light-primary line-clamp-2 cursor-pointer"
                                      >
                                        {match.name}
                                      </button>
                                      <span className="font-title text-label-md text-light-on-surface tabular-nums shrink-0">
                                        ₹{match.price.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                    <p className="font-body text-[11px] text-light-on-surface-variant truncate">
                                      {match.brand} · {match.category}
                                    </p>

                                    {/* Stock Availability Indicator */}
                                    <div className="mt-1.5 flex items-center flex-wrap gap-1.5">
                                      {isUnavailable ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-light-error-container text-light-error font-label text-label-sm">
                                          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                                            cancel
                                          </span>
                                          Product Unavailable · 0 in stock
                                        </span>
                                      ) : isLowStock ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-accent-yellow/25 text-light-on-surface font-label text-label-sm tabular-nums">
                                          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                                            inventory_2
                                          </span>
                                          Low Stock · {match.stock} left
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-success/15 text-success font-label text-label-sm tabular-nums">
                                          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                                            check_circle
                                          </span>
                                          In Stock · {match.stock} units
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Unavailable Restock Notification Prompt */}
                                {isUnavailable ? (
                                  <div className="pt-2 border-t border-light-outline-variant/60 flex flex-col gap-2">
                                    {existingNotif ? (
                                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm bg-success/10 text-success font-label text-label-sm">
                                        <span className="inline-flex items-center gap-1 min-w-0 truncate">
                                          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                                            notifications_active
                                          </span>
                                          <span className="truncate">
                                            Notification active for {existingNotif.email}
                                          </span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleViewProduct(match)}
                                          className="underline shrink-0 cursor-pointer"
                                        >
                                          Details
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="font-body text-[12px] text-light-on-surface-variant">
                                          This product is currently unavailable. Would you like a notification when it is back in stock?
                                        </p>
                                        {isEditingEmail ? (
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="email"
                                              value={notifyEmailInput}
                                              onChange={(e) => setNotifyEmailInput(e.target.value)}
                                              placeholder="Enter email for restock alert"
                                              aria-label={`Email for ${match.name} restock notification`}
                                              className="flex-1 min-w-0 h-9 px-2.5 rounded-sm border border-light-outline-variant bg-light-surface-container-lowest font-body text-base sm:text-body-sm text-light-on-surface focus:outline-none focus:ring-2 focus:ring-light-primary"
                                            />
                                            <button
                                              type="button"
                                              disabled={isSubscribing}
                                              onClick={() => void subscribeToProductAlert(match, notifyEmailInput)}
                                              className="h-9 px-3 rounded-sm bg-light-primary text-light-on-primary font-label text-label-sm hover:bg-light-primary-container cursor-pointer shrink-0 disabled:opacity-60"
                                            >
                                              {isSubscribing ? 'Saving...' : 'Notify'}
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              disabled={isSubscribing}
                                              onClick={() => {
                                                if (user?.email) {
                                                  void subscribeToProductAlert(match, user.email);
                                                } else {
                                                  setActiveEmailProductId(match.id);
                                                }
                                              }}
                                              className="flex-1 py-1.5 px-2.5 rounded-sm bg-accent-yellow text-on-accent-yellow hover:bg-light-secondary-container font-label text-label-sm inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                                            >
                                              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                                                notifications_active
                                              </span>
                                              <span>
                                                {isSubscribing ? 'Subscribing...' : 'Notify Me When Available'}
                                              </span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleViewProduct(match)}
                                              className="py-1.5 px-2.5 rounded-sm border border-light-outline-variant text-light-on-surface hover:border-light-primary font-label text-label-sm cursor-pointer"
                                            >
                                              View
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="pt-1.5 border-t border-light-outline-variant/60 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAddProduct(match)}
                                      className="flex-1 py-1.5 px-2.5 rounded-sm bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-label-sm cursor-pointer"
                                    >
                                      Add to Cart
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleViewProduct(match)}
                                      className="py-1.5 px-2.5 rounded-sm border border-light-outline-variant text-light-on-surface hover:border-light-primary font-label text-label-sm cursor-pointer"
                                    >
                                      View Details
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-start">
                    <div className="rounded-md px-3.5 py-2.5 bg-light-surface-container-lowest border border-light-outline-variant/70 text-light-on-surface-variant font-body text-body-sm inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-light-primary animate-pulse" />
                      <span>Checking product stock...</span>
                    </div>
                  </div>
                )}
                <div ref={scrollEndRef} />
              </div>

              {/* Responsive Chat Input Bar */}
              <form
                onSubmit={handleFormSubmit}
                className="p-2.5 sm:p-3 bg-light-surface-container-lowest border-t border-light-outline-variant/80 flex items-center gap-2 shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask product stock (e.g. Classic Navy Jacket)..."
                  aria-label="Ask FindKart Stock Assistant"
                  className="flex-1 min-w-0 h-10 px-3 rounded border border-light-outline-variant bg-light-surface-container-low text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:outline-none focus:ring-2 focus:ring-light-primary"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  aria-label="Send message"
                  className="w-10 h-10 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container disabled:opacity-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    send
                  </span>
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
