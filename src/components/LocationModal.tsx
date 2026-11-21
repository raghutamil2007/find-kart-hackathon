import React, { useState } from 'react';
import { INDIAN_LOCATIONS } from '../data/catalog.ts';
import type { DeliveryLocation } from '../types/findkart.ts';

interface LocationModalProps {
  isOpen: boolean;
  currentLocation: DeliveryLocation;
  onClose: () => void;
  onSelectLocation: (loc: DeliveryLocation) => void;
}

export function LocationModal({
  isOpen,
  currentLocation,
  onClose,
  onSelectLocation,
}: LocationModalProps) {
  const [city, setCity] = useState(currentLocation.city);
  const [pincode, setPincode] = useState(currentLocation.pincode);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (city.trim().length < 2) {
      setError('Enter a valid Indian city name.');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setError('Enter a valid 6-digit Indian pin code.');
      return;
    }
    onSelectLocation({ city: city.trim(), pincode: pincode.trim() });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-gutter-md"
      role="dialog"
      aria-modal="true"
      aria-label="Choose delivery location"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain bg-light-surface-container-lowest rounded-md border border-light-outline-variant shadow-xl p-gutter-md sm:p-gutter-lg flex flex-col gap-gutter-md">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline text-title-lg text-light-on-surface">
            Choose Delivery Location
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location modal"
            className="w-9 h-9 rounded hover:bg-light-surface-container flex items-center justify-center shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <p className="font-body text-body-sm text-light-on-surface-variant">
          Select a city or enter your 6-digit Indian pin code to verify Cash on Delivery availability.
        </p>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
          {INDIAN_LOCATIONS.map((loc) => {
            const active =
              loc.city === currentLocation.city && loc.pincode === currentLocation.pincode;
            return (
              <button
                key={loc.pincode}
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`p-2.5 rounded border text-left transition-colors min-w-0 cursor-pointer ${
                  active
                    ? 'border-light-primary bg-light-surface-container-low text-light-primary'
                    : 'border-light-outline-variant hover:border-light-primary text-light-on-surface'
                }`}
              >
                <div className="font-label text-label-md truncate">{loc.city}</div>
                <div className="font-mono text-body-sm text-light-on-surface-variant tabular-nums">
                  {loc.pincode}
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="pt-2 border-t border-light-outline-variant/60 flex flex-col gap-3">
          {error && (
            <span role="alert" className="font-body text-body-sm text-light-error">
              {error}
            </span>
          )}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-gutter-sm">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="font-label text-label-sm text-light-on-surface">City</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                className="w-full px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest font-body text-base sm:text-body-sm focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="font-label text-label-sm text-light-on-surface">Pin Code</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="560001"
                className="w-full px-3 py-2 rounded border border-light-outline-variant bg-light-surface-container-lowest font-mono text-base sm:text-mono-md focus:border-light-primary focus:ring-2 focus:ring-light-primary/20 focus:outline-none"
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-label-md cursor-pointer"
          >
            Apply Pin Code
          </button>
        </form>
      </div>
    </div>
  );
}
