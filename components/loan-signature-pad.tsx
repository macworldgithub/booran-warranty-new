'use client';

import { useRef } from 'react';

export function LoanSignaturePad({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moved = useRef(false);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - bounds.left) * 800 / bounds.width, (event.clientY - bounds.top) * 220 / bounds.height];
  };
  return <div className="space-y-2">
    <p id="loan-signature-help" className="text-xs text-slate-500">Customer: draw your signature using a mouse, finger or stylus.</p>
    <canvas ref={canvas} width={800} height={220} tabIndex={0}
      aria-label="Customer signature drawing area" aria-describedby="loan-signature-help"
      className="block w-full rounded-xl border-2 border-dashed border-slate-300 bg-white touch-none"
      style={{ aspectRatio: '800 / 220', cursor: disabled ? 'default' : 'crosshair' }}
      onPointerDown={event => {
        if (disabled) return;
        event.preventDefault();
        const context = event.currentTarget.getContext('2d');
        if (!context) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const [x, y] = point(event);
        context.beginPath(); context.moveTo(x, y);
        context.strokeStyle = '#1e3a8a'; context.lineWidth = 3;
        context.lineCap = 'round'; context.lineJoin = 'round';
        drawing.current = true; moved.current = false;
      }}
      onPointerMove={event => {
        if (!drawing.current || disabled) return;
        const [x, y] = point(event);
        const context = event.currentTarget.getContext('2d');
        context?.lineTo(x, y); context?.stroke(); moved.current = true;
      }}
      onPointerUp={event => {
        if (!drawing.current) return;
        drawing.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (moved.current) onChange(event.currentTarget.toDataURL('image/png'));
      }}
      onPointerCancel={() => { drawing.current = false; }}
    />
    <div className="flex items-center justify-between text-xs">
      <span className={value ? 'font-semibold text-emerald-700' : 'text-slate-500'}>{value ? 'Customer signature captured' : 'Customer signature required'}</span>
      <button type="button" disabled={disabled} className="font-semibold text-red-700 underline disabled:opacity-50" onClick={() => {
        canvas.current?.getContext('2d')?.clearRect(0, 0, 800, 220); onChange('');
      }}>Clear signature</button>
    </div>
  </div>;
}
