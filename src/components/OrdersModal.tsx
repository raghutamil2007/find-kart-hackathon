import type { Order, UserProfile } from '../types/findkart.ts';

interface OrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  orders: Order[];
  onSignOut: () => void;
  onOpenAuth: () => void;
  onContactSupport?: (orderId?: string) => void;
}

export function OrdersModal({
  isOpen,
  onClose,
  user,
  orders,
  onSignOut,
  onOpenAuth,
  onContactSupport,
}: OrdersModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter-md"
      role="dialog"
      aria-modal="true"
      aria-label="Account and orders"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain bg-light-surface-container-lowest rounded-md border border-light-outline-variant shadow-xl p-gutter-md sm:p-gutter-lg flex flex-col gap-gutter-md">
        <div className="flex items-center justify-between gap-2 pb-gutter-sm border-b border-light-outline-variant/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-light-primary text-light-on-primary flex items-center justify-center font-headline text-title-md shrink-0">
              {user ? user.name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="font-headline text-title-lg text-light-on-surface truncate">
                {user ? user.name : 'Guest Shopper'}
              </h2>
              <span className="font-body text-body-sm text-light-on-surface-variant truncate">
                {user ? user.email : 'Sign in to sync orders across devices'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="w-9 h-9 rounded hover:bg-light-surface-container flex items-center justify-center shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-headline text-title-md text-light-on-surface">
            Your Orders ({orders.length})
          </h3>

          {orders.length === 0 ? (
            <div className="p-gutter-md rounded-md bg-light-surface-container-low border border-light-outline-variant/60 text-center flex flex-col gap-2">
              <span className="font-body text-body-md text-light-on-surface-variant">
                No orders placed yet in this account.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div
                  key={order.orderId}
                  className="p-gutter-md rounded-md border border-light-outline-variant/60 bg-light-surface-container-low flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-mono-md text-light-primary font-semibold">
                      #{order.orderId}
                    </span>
                    <span className="font-label text-label-sm text-success">
                      {order.status}
                    </span>
                  </div>
                  <div className="text-body-sm text-light-on-surface-variant">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {order.shipping.city} ({order.shipping.pincode})
                  </div>
                  <div className="flex flex-col gap-1 pt-1 border-t border-light-outline-variant/40">
                    {order.items.map((item, idx) => (
                      <div key={`${item.productId}-${idx}`} className="flex justify-between text-body-sm">
                        <span className="text-light-on-surface truncate">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="tabular-nums text-light-on-surface shrink-0">
                          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-light-outline-variant/40 font-title text-title-md text-light-on-surface">
                    <span>Total ({order.shipping.paymentMethod === 'cod' ? 'COD' : 'UPI'})</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">₹{order.total.toLocaleString('en-IN')}</span>
                      {onContactSupport && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onContactSupport(order.orderId);
                          }}
                          className="font-label text-label-sm text-light-primary hover:underline cursor-pointer"
                        >
                          Need help?
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-light-outline-variant/60 flex flex-col gap-2">
          {onContactSupport && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onContactSupport();
              }}
              className="w-full py-2.5 rounded border border-light-outline-variant text-light-primary hover:bg-light-surface-container-low font-label text-label-md inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                support_agent
              </span>
              <span>FindKart Customer Care (6-Hour Human Support)</span>
            </button>
          )}
          {user ? (
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="w-full py-2.5 rounded border border-light-outline-variant text-light-error hover:bg-light-error-container/30 font-label text-label-md cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full py-2.5 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-label-md cursor-pointer"
            >
              Sign in or Create Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
