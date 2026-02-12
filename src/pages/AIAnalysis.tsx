import { useState, useEffect } from 'react';
import { Brain, Lightbulb, TrendingUp, Target, Loader2, RefreshCw, Info } from 'lucide-react';
import { generateAnalysis } from '../api/ai';
import PageTransition from '../components/PageTransition';
import type { AIAnalysis } from '../types';

const CACHE_KEY = 'ai_analysis_cache';

function getCachedAnalysis(): AIAnalysis | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as AIAnalysis;
  } catch {
    return null;
  }
}

function setCachedAnalysis(analysis: AIAnalysis) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(analysis));
}

export default function AIAnalysisPage() {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSetupError, setIsSetupError] = useState(false);

  useEffect(() => {
    const cached = getCachedAnalysis();
    if (cached) {
      setAnalysis(cached);
    }
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setIsSetupError(false);
    try {
      const result = await generateAnalysis();
      setAnalysis(result);
      setCachedAnalysis(result);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('API key')) {
        setIsSetupError(true);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="page-container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="page-header">AI Analysis</h1>
          <p className="page-subtitle">AI-powered insights into your trading patterns and performance</p>
        </div>

        {/* Setup instructions if API key missing */}
        {isSetupError && (
          <div className="card" style={{
            padding: '24px',
            marginBottom: '24px',
            borderLeft: '3px solid var(--accent-violet)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Info size={18} style={{ color: 'var(--accent-violet)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Setup Required
              </h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
              To use AI features, you need to set the <code style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--bg-tertiary)',
                fontSize: '13px',
                fontFamily: "'DM Mono', monospace",
              }}>OPENAI_API_KEY</code> environment variable before starting the server.
            </p>
            <pre style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontFamily: "'DM Mono', monospace",
              overflowX: 'auto',
            }}>
              OPENAI_API_KEY=sk-... npm run dev
            </pre>
          </div>
        )}

        {/* Generate Button */}
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: loading
                ? 'var(--bg-tertiary)'
                : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(16, 185, 129, 0.1))',
              color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : analysis ? (
              <RefreshCw size={16} />
            ) : (
              <Brain size={16} />
            )}
            {loading ? 'Analyzing your trades...' : analysis ? 'Regenerate Analysis' : 'Generate Analysis'}
          </button>

          {error && !isSetupError && (
            <p style={{ fontSize: '13px', color: 'var(--loss)', marginTop: '10px' }}>
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Timestamp */}
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Generated {new Date(analysis.generatedAt).toLocaleString()}
            </p>

            {/* Insights */}
            <AnalysisSection
              title="Key Insights"
              icon={Lightbulb}
              color="var(--accent-violet)"
              bg="rgba(139, 92, 246, 0.08)"
              border="rgba(139, 92, 246, 0.2)"
              items={analysis.insights}
            />

            {/* Patterns */}
            <AnalysisSection
              title="Trading Patterns"
              icon={TrendingUp}
              color="var(--accent)"
              bg="rgba(16, 185, 129, 0.08)"
              border="rgba(16, 185, 129, 0.2)"
              items={analysis.patterns}
            />

            {/* Recommendations */}
            <AnalysisSection
              title="Recommendations"
              icon={Target}
              color="var(--accent-warm)"
              bg="rgba(245, 158, 11, 0.08)"
              border="rgba(245, 158, 11, 0.2)"
              items={analysis.recommendations}
            />
          </div>
        )}

        {/* Empty state if no analysis and no error */}
        {!analysis && !error && !loading && (
          <div className="card empty-state">
            <Brain size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.3 }} />
            <p className="empty-state-title" style={{ fontSize: '16px', fontWeight: 600 }}>
              No analysis generated yet
            </p>
            <p className="empty-state-text">
              Click the button above to generate an AI-powered analysis of your trading performance
            </p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function AnalysisSection({
  title,
  icon: Icon,
  color,
  bg,
  border,
  items,
}: {
  title: string;
  icon: typeof Lightbulb;
  color: string;
  bg: string;
  border: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="card" style={{
      padding: '24px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color }} />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: bg,
              border: `1px solid ${border}`,
              animation: `slideUp 0.35s ease-out ${idx * 0.06}s both`,
            }}
          >
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              fontWeight: 600,
              color,
              minWidth: '20px',
              textAlign: 'center',
              paddingTop: '1px',
            }}>
              {idx + 1}
            </span>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
