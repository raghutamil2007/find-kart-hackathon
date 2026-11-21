import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CourierShipment,
  DeliveryLocation,
  Order,
  SupportTicket,
  SupportTicketCategory,
  UserProfile,
} from '../types/findkart.ts';
import {
  fallbackCreateTicket,
  readFallbackTickets,
  safeParseApiResponse,
  writeFallbackTickets,
} from '../utils/api.ts';
import { ScrollReveal } from './ScrollReveal.tsx';

interface CustomerCareViewProps {
  user: UserProfile | null;
  authToken: string | null;
  location: DeliveryLocation;
  orders: Order[];
  searchQuery: string;
  preselectedOrderId?: string | null;
  onClearPreselectedOrder?: () => void;
  onShowToast: (msg: string) => void;
  onBackToStore: () => void;
}

const GUEST_TICKETS_STORAGE_KEY = 'findkart_guest_support_ticket_ids';

const ISSUE_CATEGORIES: SupportTicketCategory[] = [
  'Product',
  'Delivery & Shipping',
  'Returns & Refunds',
  'Payment & Billing',
  'Warranty & Damage',
  'Account & Order',
];

const DEFAULT_SHIPMENTS: CourierShipment[] = [
  {
    orderId: 'FK-2026-88412',
    label: 'FK-2026-88412 — SoundCore ANC Headphones',
    courierName: 'BlueDart Express',
    trackingNumber: 'BD88412093IN',
    status: 'In Transit',
    hubLocation: 'Bengaluru Peenya Sortation Hub',
    estimatedDelivery: 'Tomorrow, 10:00 AM – 2:00 PM',
    supportUrl: 'https://www.bluedart.com/tracking',
    supportPhone: '1860-233-1234',
    supportEmail: 'customerservice@bluedart.com',
    checkpoints: [
      {
        time: 'Today, 07:40 AM',
        location: 'Bengaluru Peenya Hub',
        detail: 'Arrived at destination city hub and cleared priority line-haul sortation.',
      },
      {
        time: 'Yesterday, 09:15 PM',
        location: 'Mumbai Bhiwandi Gateway',
        detail: 'Dispatched via express air cargo to Bengaluru.',
      },
      {
        time: '18 Nov 2026, 04:30 PM',
        location: 'FindKart Fulfillment Center',
        detail: 'Parcel packed, sealed, and handed over to BlueDart Express.',
      },
    ],
  },
  {
    orderId: 'FK-2026-87904',
    label: 'FK-2026-87904 — UrbanWeave Linen Shirt',
    courierName: 'Delhivery Express',
    trackingNumber: 'DLV77904321IN',
    status: 'Out for Delivery',
    hubLocation: 'Indiranagar Last-Mile Center',
    estimatedDelivery: 'Today by 7:00 PM',
    supportUrl: 'https://www.delhivery.com/support',
    supportPhone: '0124-671-9500',
    supportEmail: 'support@delhivery.com',
    checkpoints: [
      {
        time: 'Today, 08:50 AM',
        location: 'Indiranagar Dispatch Center',
        detail: 'Out for delivery with delivery executive (Cash on Delivery / Open-box ready).',
      },
      {
        time: 'Yesterday, 11:20 PM',
        location: 'Bengaluru South Hub',
        detail: 'Received at local delivery facility.',
      },
    ],
  },
  {
    orderId: 'FK-2026-86219',
    label: 'FK-2026-86219 — BrewMaster Electric Kettle',
    courierName: 'Ecom Express',
    trackingNumber: 'ECM62198804IN',
    status: 'Delivered',
    hubLocation: 'Koramangala Delivery Hub',
    estimatedDelivery: 'Delivered on 17 Nov 2026',
    supportUrl: 'https://ecomexpress.in/customer-care',
    supportPhone: '8376-888-888',
    supportEmail: 'care@ecomexpress.in',
    checkpoints: [
      {
        time: '17 Nov 2026, 02:18 PM',
        location: 'Bengaluru 560001',
        detail: 'Delivered safely to recipient.',
      },
      {
        time: '17 Nov 2026, 09:05 AM',
        location: 'Koramangala Delivery Hub',
        detail: 'Out for delivery.',
      },
    ],
  },
];

function readGuestTicketIds(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_TICKETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveGuestTicketId(ticketId: string): void {
  try {
    const existing = readGuestTicketIds();
    const next = Array.from(new Set([ticketId, ...existing])).slice(0, 30);
    localStorage.setItem(GUEST_TICKETS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage issues
  }
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTicketStatusClasses(status: SupportTicket['status']): string {
  if (status === 'Responded') {
    return 'bg-light-primary/10 text-light-primary border border-light-primary/20';
  }
  if (status === 'Under Review') {
    return 'bg-warning-container text-on-warning-container border border-warning/25';
  }
  return 'bg-success-container text-on-success-container border border-success/25';
}

function getShipmentStatusClasses(status: CourierShipment['status']): string {
  if (status === 'In Transit' || status === 'Preparing Dispatch') {
    return 'bg-accent-yellow text-on-accent-yellow';
  }
  if (status === 'Out for Delivery') {
    return 'bg-light-primary text-light-on-primary';
  }
  return 'bg-success-container text-on-success-container';
}

export function CustomerCareView({
  user,
  authToken,
  location,
  orders,
  searchQuery,
  preselectedOrderId,
  onClearPreselectedOrder,
  onShowToast,
  onBackToStore,
}: CustomerCareViewProps) {
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Merge user's real placed orders with default active shipments so dropdown always has rich data
  const shipments = useMemo<CourierShipment[]>(() => {
    const userShipments: CourierShipment[] = orders.map((order, index) => {
      const firstItemName = order.items[0]?.name || 'FindKart Order';
      const extraCount = order.items.length > 1 ? ` +${order.items.length - 1} more` : '';
      const useBlueDart = index % 2 === 0;
      return {
        orderId: order.orderId,
        label: `${order.orderId} — ${firstItemName}${extraCount}`,
        courierName: useBlueDart ? 'BlueDart Express' : 'Delhivery Express',
        trackingNumber: `${useBlueDart ? 'BD' : 'DLV'}${order.orderId.replace(/\D/g, '')}IN`,
        status: 'Preparing Dispatch',
        hubLocation: `${order.shipping.city || location.city} Regional Hub`,
        estimatedDelivery: '2–3 business days',
        supportUrl: useBlueDart
          ? 'https://www.bluedart.com/tracking'
          : 'https://www.delhivery.com/support',
        supportPhone: useBlueDart ? '1860-233-1234' : '0124-671-9500',
        supportEmail: useBlueDart ? 'customerservice@bluedart.com' : 'support@delhivery.com',
        checkpoints: [
          {
            time: formatDateTime(order.createdAt),
            location: `${order.shipping.city || location.city} (${order.shipping.pincode})`,
            detail: `Order #${order.orderId} confirmed and assigned to ${
              useBlueDart ? 'BlueDart Express' : 'Delhivery Express'
            } for dispatch.`,
          },
        ],
      };
    });

    const seen = new Set(userShipments.map((s) => s.orderId));
    return [...userShipments, ...DEFAULT_SHIPMENTS.filter((s) => !seen.has(s.orderId))];
  }, [orders, location.city]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(shipments[0]?.orderId || '');
  const selectedShipment = useMemo(
    () => shipments.find((s) => s.orderId === selectedOrderId) || shipments[0],
    [shipments, selectedOrderId]
  );

  // Contact Customer Care form state
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('Product');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; type: string; size: number } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<SupportTicket | null>(null);

  // Support Tracking state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | SupportTicket['status']>('All');
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [courierModalOpen, setCourierModalOpen] = useState(false);

  // Follow-up reply state inside Ticket Response modal
  const [followUpText, setFollowUpText] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState(false);

  // Hydrate name/email when user signs in
  useEffect(() => {
    if (user?.name && !customerName) setCustomerName(user.name);
    if (user?.email && !email) setEmail(user.email);
  }, [user]);

  // Ensure selectedOrderId tracks valid shipment
  useEffect(() => {
    if (!shipments.some((s) => s.orderId === selectedOrderId) && shipments[0]) {
      setSelectedOrderId(shipments[0].orderId);
    }
  }, [shipments, selectedOrderId]);

  // Apply preselected order if opened from OrdersModal
  useEffect(() => {
    if (!preselectedOrderId) return;
    setSelectedOrderId(preselectedOrderId);
    setOrderIdInput(preselectedOrderId);
    setCategory('Delivery & Shipping');
    setSubject(`Support request for Order ${preselectedOrderId}`);
    onClearPreselectedOrder?.();
  }, [preselectedOrderId, onClearPreselectedOrder]);

  // Close local modals on Escape
  useEffect(() => {
    if (!activeTicket && !courierModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTicket) setActiveTicket(null);
        else if (courierModalOpen) setCourierModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeTicket, courierModalOpen]);

  // Fetch tickets from backend
  useEffect(() => {
    let cancelled = false;
    setLoadingTickets(true);
    const guestIds = readGuestTicketIds();
    const query = guestIds.length > 0 ? `?ticketIds=${encodeURIComponent(guestIds.join(','))}` : '';
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    fetch(`/api/support/tickets${query}`, { headers })
      .then((res) => safeParseApiResponse<{ tickets: SupportTicket[] }>(res))
      .then((parsed) => {
        if (cancelled) return;
        if (parsed.isHtmlFallback) {
          setTickets(readFallbackTickets());
        } else if (parsed.ok && Array.isArray(parsed.data?.tickets)) {
          setTickets(parsed.data.tickets);
        }
      })
      .catch(() => {
        if (!cancelled) setTickets(readFallbackTickets());
      })
      .finally(() => {
        if (!cancelled) setLoadingTickets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setFormError('Please upload a JPG, PNG, or PDF file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Attachment must be 5 MB or smaller.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFormError(null);
    setAttachment({ name: file.name, type: file.type, size: file.size });
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(null);

    if (customerName.trim().length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter your registered email address.');
      return;
    }
    if (subject.trim().length < 4) {
      setFormError('Please enter a brief subject (at least 4 characters).');
      return;
    }
    if (message.trim().length < 10) {
      setFormError('Please describe your issue in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: customerName.trim(),
          email: email.trim(),
          orderId: orderIdInput.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          attachmentName: attachment?.name,
          attachmentType: attachment?.type,
        }),
      });
      const parsed = await safeParseApiResponse<{ ticket: SupportTicket }>(res);
      let created: SupportTicket;
      if (parsed.isHtmlFallback) {
        created = fallbackCreateTicket({
          customerName: customerName.trim(),
          email: email.trim(),
          orderId: orderIdInput.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          attachmentName: attachment?.name,
          attachmentType: attachment?.type,
        });
      } else if (!parsed.ok || !parsed.data?.ticket) {
        throw new Error(parsed.errorMessage || 'Unable to submit support email.');
      } else {
        created = parsed.data.ticket;
      }

      if (!user) {
        saveGuestTicketId(created.ticketId);
      }

      setTickets((prev) => [created, ...prev]);
      setSubmitSuccess(created);
      setSubject('');
      setMessage('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onShowToast(`Ticket ${created.ticketId} submitted — human reply within 6 hours`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to reach Customer Care service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendDeliveryComplaint = () => {
    if (!selectedShipment) return;
    setOrderIdInput(selectedShipment.orderId);
    setCategory('Delivery & Shipping');
    setSubject(
      `Delivery issue for ${selectedShipment.orderId} (${selectedShipment.courierName})`
    );
    setFormError(null);
    onShowToast(`Pre-filled delivery complaint for ${selectedShipment.orderId}`);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      subjectInputRef.current?.focus();
    }, 350);
  };

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || followUpText.trim().length < 2) return;

    setSendingFollowUp(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch(`/api/support/tickets/${encodeURIComponent(activeTicket.ticketId)}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: followUpText.trim(),
          senderName: user?.name || customerName.trim() || activeTicket.customerName,
        }),
      });
      const parsed = await safeParseApiResponse<{ ticket: SupportTicket }>(res);
      let updated: SupportTicket;
      if (parsed.isHtmlFallback) {
        updated = {
          ...activeTicket,
          status: activeTicket.status === 'Resolved' ? 'Under Review' : activeTicket.status,
          replies: [
            ...activeTicket.replies,
            {
              id: `rep_${Date.now().toString(36)}`,
              senderRole: 'customer',
              senderName: user?.name || customerName.trim() || activeTicket.customerName,
              message: followUpText.trim(),
              createdAt: new Date().toISOString(),
            },
          ],
        };
        writeFallbackTickets(tickets.map((t) => (t.ticketId === updated.ticketId ? updated : t)));
      } else if (!parsed.ok || !parsed.data?.ticket) {
        throw new Error(parsed.errorMessage || 'Could not post follow-up.');
      } else {
        updated = parsed.data.ticket;
      }
      setTickets((prev) => prev.map((t) => (t.ticketId === updated.ticketId ? updated : t)));
      setActiveTicket(updated);
      setFollowUpText('');
      onShowToast('Follow-up sent to your assigned support specialist');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Unable to send follow-up');
    } finally {
      setSendingFollowUp(false);
    }
  };

  const handleMarkResolved = async (ticketId: string) => {
    setResolvingTicket(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FindKart',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'Resolved' }),
      });
      const parsed = await safeParseApiResponse<{ ticket: SupportTicket }>(res);
      let updated: SupportTicket;
      if (parsed.isHtmlFallback && activeTicket) {
        updated = { ...activeTicket, status: 'Resolved' };
        writeFallbackTickets(tickets.map((t) => (t.ticketId === updated.ticketId ? updated : t)));
      } else if (!parsed.ok || !parsed.data?.ticket) {
        throw new Error(parsed.errorMessage || 'Could not update ticket.');
      } else {
        updated = parsed.data.ticket;
      }
      setTickets((prev) => prev.map((t) => (t.ticketId === updated.ticketId ? updated : t)));
      setActiveTicket(updated);
      onShowToast(`Ticket ${updated.ticketId} marked as Resolved`);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Unable to mark ticket resolved');
    } finally {
      setResolvingTicket(false);
    }
  };

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.ticketId.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.orderId.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, searchQuery]);

  const activeTicketCount = useMemo(
    () => tickets.filter((t) => t.status !== 'Resolved').length,
    [tickets]
  );

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-gutter-md lg:px-gutter-lg py-gutter-md sm:py-gutter-lg flex flex-col gap-gutter-md sm:gap-gutter-lg">
      {/* Breadcrumb / Back Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex items-center gap-1.5 font-label text-label-md text-light-primary hover:underline cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to FindKart Store</span>
        </button>
        <span className="font-body text-body-sm text-light-on-surface-variant hidden sm:inline">
          Delivering to {location.city} ({location.pincode})
        </span>
      </div>

      {/* Hero Banner Card */}
      <ScrollReveal yOffset={10}>
        <section
          aria-labelledby="customer-care-hero-title"
          className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 shadow-sm p-4 sm:p-gutter-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-gutter-md"
        >
          <div className="flex flex-col gap-2 min-w-0">
            <span className="inline-block w-fit px-2.5 py-1 rounded-sm bg-accent-yellow text-on-accent-yellow font-label text-label-sm uppercase tracking-wide">
              <span className="sm:hidden">CUSTOMER CARE</span>
              <span className="hidden sm:inline">FINDKART CUSTOMER CARE</span>
            </span>
            <h1
              id="customer-care-hero-title"
              className="font-headline text-headline-md sm:text-headline-lg text-light-on-surface text-balance"
            >
              We&apos;re Here to Help
            </h1>
            <p className="font-body text-body-md text-light-on-surface-variant">
              Real people. Real support. We&apos;re here for you.
            </p>
          </div>

          <div className="bg-light-surface-container-low border border-light-outline-variant/60 rounded-md p-3.5 sm:p-4 flex items-center gap-3 w-full lg:w-auto lg:min-w-[340px]">
            <div className="w-10 h-10 rounded bg-light-primary text-light-on-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                schedule
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label text-label-md text-light-primary">Guaranteed SLA</span>
              <span className="font-body text-body-sm text-light-on-surface-variant">
                Our human support team responds within 6 hours.
              </span>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* 4-Card Trust Strip */}
      <ScrollReveal delay={0.04} yOffset={10}>
        <section
          aria-label="FindKart human support promises"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-gutter-md"
        >
          <div className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-3.5 sm:p-gutter-md flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-light-primary shrink-0" aria-hidden="true">
                person_check
              </span>
              <h2 className="font-title text-label-lg sm:text-title-md text-light-on-surface leading-snug">
                <span className="sm:hidden">Reviewed by Humans</span>
                <span className="hidden sm:inline">Human Review</span>
              </h2>
            </div>
            <p className="font-body text-body-sm text-light-on-surface-variant hidden sm:block">
              Every complaint is reviewed by a real human.
            </p>
          </div>

          <div className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-3.5 sm:p-gutter-md flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-light-primary shrink-0" aria-hidden="true">
                speaker_notes_off
              </span>
              <h2 className="font-title text-label-lg sm:text-title-md text-light-on-surface leading-snug">
                <span className="sm:hidden">No AI Replies</span>
                <span className="hidden sm:inline">Zero AI Replies</span>
              </h2>
            </div>
            <p className="font-body text-body-sm text-light-on-surface-variant hidden sm:block">
              No AI-generated customer support replies.
            </p>
          </div>

          <div className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-3.5 sm:p-gutter-md flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-light-primary shrink-0" aria-hidden="true">
                schedule
              </span>
              <h2 className="font-title text-label-lg sm:text-title-md text-light-on-surface leading-snug">
                6-Hour Response
              </h2>
            </div>
            <p className="font-body text-body-sm text-light-on-surface-variant">
              Dedicated specialist reply within 6 hours.
            </p>
          </div>

          <div className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 p-3.5 sm:p-gutter-md flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-light-primary shrink-0" aria-hidden="true">
                verified
              </span>
              <h2 className="font-title text-label-lg sm:text-title-md text-light-on-surface leading-snug">
                Full Resolution
              </h2>
            </div>
            <p className="font-body text-body-sm text-light-on-surface-variant">
              Clear communication until the issue is resolved.
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* Main 2-Column Workspace: Contact Form + Delivery Support */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-md sm:gap-gutter-lg items-start">
        {/* Left: Contact Customer Care Form */}
        <section
          ref={formSectionRef}
          aria-labelledby="contact-care-heading"
          className="lg:col-span-7 bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 shadow-sm p-4 sm:p-gutter-lg flex flex-col gap-gutter-md"
        >
          <div className="flex flex-col gap-1">
            <h2 id="contact-care-heading" className="font-headline text-headline-sm text-light-on-surface">
              Contact Customer Care
            </h2>
            <p className="font-body text-body-sm text-light-on-surface-variant">
              Submit your issue below and a FindKart support specialist will reply to your registered email.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded bg-light-error-container border border-light-error/30 text-light-on-error-container font-body text-body-sm flex items-start gap-2"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
                error
              </span>
              <span>{formError}</span>
            </div>
          )}

          {submitSuccess && (
            <div
              role="status"
              className="p-3.5 rounded bg-success-container border border-success/30 text-on-success-container flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] text-success shrink-0 mt-0.5" aria-hidden="true">
                  check_circle
                </span>
                <div className="flex flex-col">
                  <span className="font-label text-label-md">
                    Ticket {submitSuccess.ticketId} received — Assigned to{' '}
                    {submitSuccess.assignedSpecialist.split(' · ')[0]}
                  </span>
                  <span className="font-body text-body-sm">
                    Guaranteed human reply to {submitSuccess.email} within 6 hours.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTicket(submitSuccess)}
                className="px-3 py-1.5 rounded bg-light-surface-container-lowest border border-success/40 font-label text-label-sm text-on-success-container hover:bg-white shrink-0 cursor-pointer"
              >
                View Ticket
              </button>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} noValidate className="flex flex-col gap-gutter-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-md">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="font-label text-label-md text-light-on-surface">Customer name</span>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full min-h-[42px] px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="font-label text-label-md text-light-on-surface">Registered email</span>
                <input
                  type="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your FindKart account email"
                  className="w-full min-h-[42px] px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-md">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="font-label text-label-md text-light-on-surface">Order ID</span>
                <input
                  type="text"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  placeholder="e.g. FK-2026-88412"
                  className="w-full min-h-[42px] px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-mono text-base sm:text-mono-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="font-label text-label-md text-light-on-surface">Issue category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  className="w-full min-h-[42px] px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none cursor-pointer"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-label text-label-md text-light-on-surface">Subject</span>
              <input
                ref={subjectInputRef}
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full min-h-[42px] px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-label text-label-md text-light-on-surface">Detailed message</span>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what happened so our team can resolve it quickly..."
                className="w-full px-3 py-2.5 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface placeholder:text-light-outline font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="font-label text-label-md text-light-on-surface">Optional attachment</span>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="customer-care-attachment"
                />
                <label
                  htmlFor="customer-care-attachment"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-light-outline-variant bg-light-surface-container-low hover:bg-light-surface-container text-light-on-surface font-label text-label-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    attach_file
                  </span>
                  <span>Choose file</span>
                </label>
                {attachment ? (
                  <div className="inline-flex items-center gap-2 text-body-sm text-light-on-surface min-w-0">
                    <span className="truncate max-w-[200px]">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-light-error hover:underline font-label text-label-sm cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="font-body text-body-sm text-light-on-surface-variant">
                    No file chosen
                  </span>
                )}
              </div>
              <span className="font-body text-body-sm text-light-on-surface-variant">
                Upload a photo or invoice (JPG, PNG, or PDF)
              </span>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-gutter-lg py-2.5 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container disabled:opacity-60 font-label text-label-lg transition-colors shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  mail
                </span>
                <span>{submitting ? 'Sending Email...' : 'Send Email'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right: Delivery Support Card */}
        <section
          aria-labelledby="delivery-support-heading"
          className="lg:col-span-5 bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 shadow-sm p-4 sm:p-gutter-lg flex flex-col gap-gutter-md"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-light-primary" aria-hidden="true">
                local_shipping
              </span>
              <h2 id="delivery-support-heading" className="font-headline text-headline-sm text-light-on-surface">
                Delivery Support
              </h2>
            </div>
            <p className="font-body text-body-sm text-light-on-surface-variant">
              Select an order to view its assigned courier partner and support options.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-label text-label-md text-light-on-surface">Select your order</span>
            <select
              value={selectedShipment?.orderId || ''}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none cursor-pointer"
            >
              {shipments.map((shipment) => (
                <option key={shipment.orderId} value={shipment.orderId}>
                  {shipment.label}
                </option>
              ))}
            </select>
          </label>

          {selectedShipment && (
            <div className="rounded-md bg-light-surface-container-low border border-light-outline-variant/60 p-gutter-md flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label text-label-sm uppercase tracking-wide text-light-on-surface-variant">
                  DELIVERY PARTNER
                </span>
                <span
                  className={`px-2 py-0.5 rounded-sm font-label text-label-sm whitespace-nowrap ${getShipmentStatusClasses(
                    selectedShipment.status
                  )}`}
                >
                  {selectedShipment.status}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="font-headline text-title-lg text-light-on-surface">
                  {selectedShipment.courierName}
                </h3>
                <p className="font-mono text-body-sm text-light-primary tabular-nums">
                  AWB: {selectedShipment.trackingNumber} · {selectedShipment.estimatedDelivery}
                </p>
                <p className="font-body text-body-sm text-light-on-surface-variant">
                  Partner contact details are linked to your active shipment dispatch record.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCourierModalOpen(true)}
                  className="w-full min-h-[42px] px-gutter-md py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest hover:border-light-primary text-light-on-surface font-label text-label-md inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Visit Official Support Page</span>
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    open_in_new
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSendDeliveryComplaint}
                  className="w-full min-h-[42px] px-gutter-md py-2 rounded bg-accent-yellow hover:bg-light-secondary-container text-on-accent-yellow font-label text-label-md inline-flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    warning
                  </span>
                  <span>Send Delivery Complaint</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Support Tracking Card */}
      <ScrollReveal yOffset={12}>
        <section
          aria-labelledby="support-tracking-heading"
          className="bg-light-surface-container-lowest rounded-md border border-light-outline-variant/60 shadow-sm p-4 sm:p-gutter-lg flex flex-col gap-gutter-md"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2
                id="support-tracking-heading"
                className="font-headline text-headline-sm text-light-on-surface"
              >
                Support Tracking
              </h2>
              <p className="font-body text-body-sm text-light-on-surface-variant">
                Track your submitted complaints and read replies from our human support specialists.
              </p>
            </div>
            <span className="font-label text-label-md text-light-primary tabular-nums shrink-0">
              {searchQuery.trim()
                ? `${filteredTickets.length} matching tickets`
                : `${tickets.length} active tickets`}
            </span>
          </div>

          {/* Interactive Status Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter tickets by status">
              {(['All', 'Under Review', 'Responded', 'Resolved'] as const).map((status) => {
                const isActive = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-sm font-label text-label-sm transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-light-primary text-light-on-primary'
                        : 'bg-light-surface-container-low text-light-on-surface hover:bg-light-surface-container'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
            <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
              {activeTicketCount} open in human review queue
            </span>
          </div>

          {loadingTickets ? (
            <div className="p-gutter-lg text-center font-body text-body-md text-light-on-surface-variant">
              Loading your support tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-gutter-lg rounded-md bg-light-surface-container-low border border-light-outline-variant/60 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[28px] text-light-primary" aria-hidden="true">
                inbox
              </span>
              <p className="font-body text-body-md text-light-on-surface-variant">
                No support tickets match the selected filter.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredTickets.map((ticket) => (
                <article
                  key={ticket.ticketId}
                  className="p-3.5 sm:px-gutter-md sm:py-3.5 rounded-md border border-light-outline-variant/60 bg-light-surface-container-lowest hover:border-light-primary/50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-gutter-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                    <span className="font-mono text-mono-md text-light-primary font-semibold shrink-0">
                      {ticket.ticketId}
                    </span>
                    <h3 className="font-title text-body-md text-light-on-surface truncate">
                      {ticket.subject}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0">
                    <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
                      {formatShortDate(ticket.createdAt)}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-sm font-label text-label-sm whitespace-nowrap ${getTicketStatusClasses(
                        ticket.status
                      )}`}
                    >
                      {ticket.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTicket(ticket)}
                      className="min-h-[36px] px-3 py-1.5 rounded-sm border border-light-outline-variant hover:border-light-primary text-light-on-surface font-label text-label-sm transition-colors cursor-pointer whitespace-nowrap"
                    >
                      View Response
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* Specialist Response & Thread Modal */}
      {activeTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-gutter-md"
          role="dialog"
          aria-modal="true"
          aria-label={`Support ticket ${activeTicket.ticketId}`}
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setActiveTicket(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain bg-light-surface-container-lowest rounded-md border border-light-outline-variant shadow-xl p-gutter-md sm:p-gutter-lg flex flex-col gap-gutter-md">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-light-outline-variant/60">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-mono-md font-semibold text-light-primary">
                    {activeTicket.ticketId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-sm font-label text-label-sm ${getTicketStatusClasses(
                      activeTicket.status
                    )}`}
                  >
                    {activeTicket.status}
                  </span>
                  <span className="font-body text-body-sm text-light-on-surface-variant">
                    Order: {activeTicket.orderId} · {activeTicket.category}
                  </span>
                </div>
                <h2 className="font-headline text-title-lg sm:text-headline-sm text-light-on-surface">
                  {activeTicket.subject}
                </h2>
                <span className="font-body text-body-sm text-light-on-surface-variant">
                  Assigned specialist: {activeTicket.assignedSpecialist}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTicket(null)}
                aria-label="Close ticket response modal"
                className="w-9 h-9 rounded hover:bg-light-surface-container flex items-center justify-center shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            {/* Original Customer Issue */}
            <div className="p-3.5 rounded-md bg-light-surface-container-low border border-light-outline-variant/60 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-light-on-surface-variant">
                <span className="font-label text-label-md text-light-on-surface">
                  {activeTicket.customerName} ({activeTicket.email})
                </span>
                <span className="tabular-nums">{formatDateTime(activeTicket.createdAt)}</span>
              </div>
              <p className="font-body text-body-md text-light-on-surface">{activeTicket.message}</p>
              {activeTicket.attachmentName && (
                <div className="pt-1 flex items-center gap-1.5 text-body-sm text-light-primary">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    attach_file
                  </span>
                  <span>Attachment: {activeTicket.attachmentName}</span>
                </div>
              )}
            </div>

            {/* Conversation Thread */}
            <div className="flex flex-col gap-3">
              <span className="font-label text-label-md text-light-on-surface">
                Human Specialist Updates &amp; Replies
              </span>
              {activeTicket.replies.map((reply) => {
                const isSpecialist = reply.senderRole === 'specialist';
                return (
                  <div
                    key={reply.id}
                    className={`p-3.5 rounded-md border flex flex-col gap-1.5 ${
                      isSpecialist
                        ? 'bg-light-primary/5 border-light-primary/20'
                        : 'bg-light-surface-container-lowest border-light-outline-variant/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isSpecialist ? 'text-light-primary' : 'text-light-on-surface-variant'
                          }`}
                          aria-hidden="true"
                        >
                          {isSpecialist ? 'support_agent' : 'person'}
                        </span>
                        <span className="font-label text-label-md text-light-on-surface">
                          {reply.senderName}
                        </span>
                        {reply.senderTitle && (
                          <span className="font-body text-body-sm text-light-on-surface-variant">
                            · {reply.senderTitle}
                          </span>
                        )}
                      </div>
                      <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
                        {formatDateTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="font-body text-body-md text-light-on-surface">{reply.message}</p>
                  </div>
                );
              })}
            </div>

            {/* Add Follow-up Reply */}
            <form onSubmit={handleSendFollowUp} className="flex flex-col gap-2 pt-2 border-t border-light-outline-variant/60">
              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-md text-light-on-surface">
                  Send a follow-up note to {activeTicket.assignedSpecialist.split(' · ')[0]}
                </span>
                <textarea
                  rows={2}
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder="Add an update, delivery instruction, or question..."
                  className="w-full px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest font-body text-base sm:text-body-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {activeTicket.status !== 'Resolved' ? (
                  <button
                    type="button"
                    disabled={resolvingTicket}
                    onClick={() => handleMarkResolved(activeTicket.ticketId)}
                    className="min-h-[40px] px-3.5 py-2 rounded border border-light-outline-variant hover:border-success text-success font-label text-label-md cursor-pointer disabled:opacity-60"
                  >
                    {resolvingTicket ? 'Updating...' : 'Mark Issue as Resolved'}
                  </button>
                ) : (
                  <span className="font-label text-label-sm text-success inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      verified
                    </span>
                    Marked Resolved
                  </span>
                )}

                <button
                  type="submit"
                  disabled={sendingFollowUp || followUpText.trim().length < 2}
                  className="min-h-[40px] px-4 py-2 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container disabled:opacity-50 font-label text-label-md cursor-pointer"
                >
                  {sendingFollowUp ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courier Partner Official Support & Tracking Modal */}
      {courierModalOpen && selectedShipment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-gutter-md"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedShipment.courierName} official support`}
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setCourierModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain bg-light-surface-container-lowest rounded-md border border-light-outline-variant shadow-xl p-gutter-md sm:p-gutter-lg flex flex-col gap-gutter-md">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-light-outline-variant/60">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-label text-label-sm text-light-primary uppercase">
                  Official Courier Dispatch Record
                </span>
                <h2 className="font-headline text-title-lg text-light-on-surface">
                  {selectedShipment.courierName}
                </h2>
                <span className="font-mono text-body-sm text-light-on-surface-variant tabular-nums">
                  Order {selectedShipment.orderId} · AWB {selectedShipment.trackingNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCourierModalOpen(false)}
                aria-label="Close courier support modal"
                className="w-9 h-9 rounded hover:bg-light-surface-container flex items-center justify-center shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div className="p-3.5 rounded-md bg-light-surface-container-low border border-light-outline-variant/60 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label text-label-md text-light-on-surface">
                  Partner Contact Details
                </span>
                <span
                  className={`px-2 py-0.5 rounded-sm font-label text-label-sm ${getShipmentStatusClasses(
                    selectedShipment.status
                  )}`}
                >
                  {selectedShipment.status}
                </span>
              </div>
              <div className="font-body text-body-sm text-light-on-surface flex flex-col gap-1">
                <span>Helpline: {selectedShipment.supportPhone}</span>
                <span>Email: {selectedShipment.supportEmail}</span>
                <span className="break-all text-light-primary">
                  Official Portal: {selectedShipment.supportUrl}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-label text-label-md text-light-on-surface">
                Live Shipment Checkpoints
              </span>
              {selectedShipment.checkpoints.map((cp, idx) => (
                <div
                  key={`${cp.time}-${idx}`}
                  className="p-3 rounded border border-light-outline-variant/60 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="font-label text-label-md text-light-on-surface">
                      {cp.location}
                    </span>
                    <span className="text-light-on-surface-variant tabular-nums">{cp.time}</span>
                  </div>
                  <p className="font-body text-body-sm text-light-on-surface-variant">{cp.detail}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-light-outline-variant/60">
              <button
                type="button"
                onClick={() => {
                  setCourierModalOpen(false);
                  handleSendDeliveryComplaint();
                }}
                className="min-h-[40px] px-4 py-2 rounded bg-accent-yellow hover:bg-light-secondary-container text-on-accent-yellow font-label text-label-md cursor-pointer"
              >
                Escalate to FindKart Support
              </button>
              <button
                type="button"
                onClick={() => setCourierModalOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-label-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
