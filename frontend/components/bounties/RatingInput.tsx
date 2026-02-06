'use client';

import { useState } from 'react';

interface RatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingInput({
  value,
  onChange,
  disabled = false,
  size = 'md',
}: RatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const displayValue = hovered !== null ? hovered : value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className={`${sizeClasses[size]} transition-colors ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          } ${
            star <= displayValue ? 'text-yellow-400' : 'text-slate-600'
          } hover:scale-110 transition-transform`}
        >
          &#9733;
        </button>
      ))}
      <span className="ml-2 text-slate-400 text-sm">
        {displayValue} star{displayValue !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

interface RatingDisplayProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  count?: number;
}

export function RatingDisplay({
  value,
  size = 'sm',
  showCount = false,
  count = 0,
}: RatingDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  // Round to nearest 0.5
  const roundedValue = Math.round(value * 2) / 2;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull = star <= Math.floor(roundedValue);
        const isHalf = !isFull && star === Math.ceil(roundedValue) && roundedValue % 1 !== 0;

        return (
          <span
            key={star}
            className={`${sizeClasses[size]} ${
              isFull || isHalf ? 'text-yellow-400' : 'text-slate-600'
            }`}
          >
            {isHalf ? '&#9734;' : '&#9733;'}
          </span>
        );
      })}
      {showCount && (
        <span className="ml-1 text-slate-400 text-xs">
          ({count})
        </span>
      )}
    </div>
  );
}
