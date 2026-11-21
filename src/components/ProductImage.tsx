import { useEffect, useState } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: string;
}

export function ProductImage({
  src,
  alt,
  className = 'w-full h-44 object-contain',
  fallbackIcon = 'shopping_bag',
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} bg-light-surface-container rounded flex flex-col items-center justify-center gap-1.5 p-3 text-light-on-surface-variant`}
      >
        <span className="material-symbols-outlined text-[28px] text-light-primary" aria-hidden="true">
          {fallbackIcon}
        </span>
        <span className="font-label text-label-sm text-center line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
