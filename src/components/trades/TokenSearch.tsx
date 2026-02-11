import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchTokens } from '../../api/prices';
import { formatCompactNumber, formatPrice } from '../../utils/format';
import type { DexScreenerToken } from '../../types';

interface TokenSearchProps {
  value: string;
  chain: string | null;
  contractAddress: string | null;
  disabled?: boolean;
  onChange: (token: { symbol: string; chain: string | null; contractAddress: string | null }) => void;
}

export default function TokenSearch({ value, chain, contractAddress, disabled, onChange }: TokenSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<DexScreenerToken[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. when form resets)
  useEffect(() => { setQuery(value); }, [value]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2 || disabled) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const currentId = ++requestIdRef.current;
      const tokens = await searchTokens(query);
      if (currentId !== requestIdRef.current) return; // stale response
      setResults(tokens);
      setLoading(false);
      if (tokens.length > 0) setIsOpen(true);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, disabled]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (token: DexScreenerToken) => {
    setQuery(token.symbol.toUpperCase());
    onChange({
      symbol: token.symbol.toUpperCase(),
      chain: token.chain || null,
      contractAddress: token.contractAddress || null,
    });
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // Manual typing clears chain/contractAddress (user is entering a major coin symbol)
    onChange({ symbol: val.toUpperCase(), chain: null, contractAddress: null });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="relative">
        <Search
          size={14}
          style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          disabled={disabled}
          placeholder="Search or type symbol..."
          className="w-full uppercase disabled:opacity-50"
          style={{ paddingLeft: '32px' }}
        />
        {loading && (
          <div style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            width: '14px', height: '14px', border: '2px solid var(--border-light)',
            borderTopColor: 'var(--accent)', borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }} />
        )}
      </div>

      {/* Selected token info badge */}
      {chain && contractAddress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          <span style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', fontWeight: 500, textTransform: 'capitalize',
          }}>
            {chain}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
            {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
          </span>
        </div>
      )}

      {/* Search results dropdown */}
      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: '4px', maxHeight: '280px', overflowY: 'auto',
          background: 'var(--dropdown-bg)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-light)', borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          padding: '4px',
        }}>
          {results.map((token) => (
            <button
              key={token.chain ? `${token.chain}:${token.contractAddress}` : `major:${token.symbol}`}
              type="button"
              onClick={() => handleSelect(token)}
              style={{
                display: 'flex', flexDirection: 'column', gap: '2px',
                width: '100%', padding: '8px 12px', background: 'transparent',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
                fontFamily: 'inherit',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {token.symbol}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {token.name}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>
                  {token.priceUsd ? formatPrice(parseFloat(token.priceUsd)) : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {token.chain ? (
                  <>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                      background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', textTransform: 'capitalize',
                    }}>
                      {token.chain}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Liq: {formatCompactNumber(token.liquidity)}
                    </span>
                  </>
                ) : (
                  <span style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                    background: 'var(--accent-glow)', color: 'var(--accent)',
                    border: '1px solid var(--accent)', fontWeight: 600,
                  }}>
                    Major
                  </span>
                )}
                <span style={{
                  fontSize: '11px',
                  color: token.priceChange24h >= 0 ? 'var(--profit)' : 'var(--loss)',
                }}>
                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(1)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && results.length === 0 && !loading && query.length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: '4px', padding: '12px 16px',
          background: 'var(--dropdown-bg)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-light)', borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center',
        }}>
          No tokens found. You can still type a symbol manually.
        </div>
      )}
    </div>
  );
}
