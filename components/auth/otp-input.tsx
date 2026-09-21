'use client';

import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split value into 6 characters (padded with empty strings)
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, char: string) => {
    // If user typed or pasted more than 1 character
    if (char.length > 1) {
      const sanitized = char.replace(/\D/g, '').slice(0, 6);
      onChange(sanitized);
      const targetIndex = Math.min(sanitized.length, 5);
      inputRefs.current[targetIndex]?.focus();
      return;
    }

    const cleanChar = char.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleanChar;
    const nextValue = newDigits.join('').slice(0, 6);
    onChange(nextValue);

    // Auto-advance to next input if a digit was entered
    if (cleanChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is empty, jump to previous box and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const sanitized = pastedData.replace(/\D/g, '').slice(0, 6);
    if (sanitized) {
      onChange(sanitized);
      const targetIndex = Math.min(sanitized.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 my-2" onPaste={handlePaste}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-2xl border transition-all select-none ${
            digit
              ? 'border-[#E11F26] bg-red-50/30 text-slate-900 ring-2 ring-[#E11F26]/15'
              : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:border-[#E11F26] focus:ring-2 focus:ring-[#E11F26]/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
        />
      ))}
    </div>
  );
}
