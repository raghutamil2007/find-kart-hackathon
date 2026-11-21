import type { StoreView } from '../types/findkart.ts';

interface FooterProps {
  onNavigate: (view: StoreView) => void;
  onOpenOrders: () => void;
  onShowInfo: (title: string, content: string) => void;
}

export function Footer({ onNavigate, onOpenOrders, onShowInfo }: FooterProps) {
  return (
    <footer className="bg-light-inverse-surface text-light-inverse-on-surface py-gutter-lg md:py-section">
      <div className="max-w-7xl mx-auto px-gutter-md md:px-gutter-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-lg md:gap-gutter-xl">
        <div className="flex flex-col gap-gutter-sm">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="font-headline text-title-lg text-light-on-primary text-left w-fit cursor-pointer"
          >
            About FindKart
          </button>
          <p className="font-body text-body-sm text-light-outline-variant">
            FindKart is an Indian online shopping platform offering electronics, fashion, beauty, home essentials, and Cash on Delivery across 19,000+ pin codes.
          </p>
        </div>

        <div className="flex flex-col gap-gutter-sm">
          <span className="font-label text-label-lg text-light-on-primary">Customer Support</span>
          <button
            type="button"
            onClick={() => onNavigate('customer-care')}
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            Customer Care (Submit a Ticket)
          </button>
          <button
            type="button"
            onClick={() => onNavigate('customer-care')}
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            Track Your Complaint
          </button>
          <button
            type="button"
            onClick={onOpenOrders}
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            Track Your Order
          </button>
          <button
            type="button"
            onClick={() =>
              onShowInfo(
                '7-Day Returns & Refunds',
                'Unused products in original packaging with tags intact are eligible for doorstep pickup within 7 days of delivery. Cash on Delivery refunds are credited within 48 hours of pickup verification.'
              )
            }
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            7-Day Returns &amp; Refunds
          </button>
        </div>

        <div className="flex flex-col gap-gutter-sm">
          <span className="font-label text-label-lg text-light-on-primary">Policies</span>
          <button
            type="button"
            onClick={() =>
              onShowInfo(
                'Privacy Policy',
                'FindKart collects only the contact details and delivery addresses necessary to fulfill and deliver your orders. Your account passwords are encrypted and never shared with third-party advertisers.'
              )
            }
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() =>
              onShowInfo(
                'Terms of Use',
                'All prices on FindKart are listed in Indian Rupees (INR) inclusive of applicable GST. Orders above ₹499 qualify for complimentary doorstep delivery across India.'
              )
            }
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            Terms of Use
          </button>
          <button
            type="button"
            onClick={() =>
              onShowInfo(
                'Cash on Delivery Policy',
                'Pay conveniently at your doorstep by cash or UPI scan upon inspecting your sealed FindKart parcel. Cash on Delivery is serviceable across 19,000+ Indian pin codes.'
              )
            }
            className="font-body text-body-sm text-light-outline-variant hover:text-light-on-primary text-left w-fit cursor-pointer"
          >
            Cash on Delivery Policy
          </button>
        </div>

        <div className="flex flex-col gap-gutter-sm">
          <span className="font-label text-label-lg text-light-on-primary">Human Support Promise</span>
          <span className="font-body text-body-sm text-light-outline-variant">
            No AI replies • 6-hour human response SLA
          </span>
          <span className="font-body text-body-sm text-light-outline-variant">
            FindKart Retail Pvt. Ltd., Outer Ring Road, Bengaluru 560103
          </span>
          <span className="font-body text-body-sm text-light-outline-variant">
            support@findkart.in • 1800-120-4500
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-gutter-md md:px-gutter-lg mt-gutter-lg md:mt-gutter-xl pt-gutter-lg border-t border-light-outline/30 flex flex-col sm:flex-row items-center justify-between gap-gutter-sm">
        <span className="font-body text-body-sm text-light-outline-variant">
          © 2026 FindKart. All rights reserved.
        </span>
        <span className="font-label text-label-sm text-accent-yellow">
          Cash on Delivery • Verified Sellers • Powered by Aiven PostgreSQL
        </span>
      </div>
    </footer>
  );
}
