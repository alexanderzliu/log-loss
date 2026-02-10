import type React from 'react';

export function PrefixInput({ prefix, ...props }: { prefix: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span
        className="absolute left-3.5 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}
      >
        {prefix}
      </span>
      <input
        {...props}
        className={`w-full ${props.className || ''}`}
        style={{ paddingLeft: '28px', ...props.style }}
      />
    </div>
  );
}
