import { Router } from 'express';
import { db } from '../database';
import { getOpenAIClient, isAIEnabled } from '../ai/openai';
import type { Execution, Reflection, ReflectionSuggestion } from '../../shared/types.ts';
import { rowToPosition } from '../helpers/rowMappers';

const router = Router();

// Format prices preserving significant digits for micro-prices (e.g. 0.000000081 => "$0.000000081")
function fmtPrice(value: number): string {
  if (value === 0) return '$0.00';
  const abs = Math.abs(value);
  if (abs >= 0.01) return `$${value.toFixed(2)}`;
  // For micro-prices, show enough decimals to capture significant digits
  const str = abs.toFixed(20);
  const decimals = str.slice(2);
  let zeroCount = 0;
  for (const ch of decimals) {
    if (ch === '0') zeroCount++;
    else break;
  }
  const formatted = abs.toFixed(zeroCount + 4);
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

// POST /suggest-reflections
router.post('/suggest-reflections', async (req, res) => {
  try {
    if (!isAIEnabled()) {
      return res.status(503).json({ error: 'AI features require an OpenAI API key. Set the OPENAI_API_KEY environment variable.' });
    }

    const { positionId } = req.body;
    if (!positionId || typeof positionId !== 'string') {
      return res.status(400).json({ error: 'positionId is required' });
    }

    // Fetch position
    const posRow = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId) as Record<string, unknown> | undefined;
    if (!posRow) {
      return res.status(404).json({ error: 'Position not found' });
    }
    const position = rowToPosition(posRow);

    // Fetch executions
    const execRows = db.prepare(
      'SELECT * FROM executions WHERE position_id = ? ORDER BY executed_at ASC'
    ).all(positionId) as Record<string, unknown>[];
    const executions: Execution[] = execRows.map(row => ({
      id: row.id as string,
      positionId: row.position_id as string,
      side: row.side as Execution['side'],
      price: row.price as number,
      quantity: row.quantity as number,
      executedAt: row.executed_at as string,
      pnl: row.pnl as number | null,
      pnlPercent: row.pnl_percent as number | null,
      notes: row.notes as string,
      createdAt: row.created_at as string,
    }));

    // Fetch existing reflections
    const refRows = db.prepare(
      'SELECT * FROM reflections WHERE position_id = ? ORDER BY created_at DESC'
    ).all(positionId) as Record<string, unknown>[];
    const reflections: Reflection[] = refRows.map(row => ({
      id: row.id as string,
      positionId: row.position_id as string,
      type: row.type as Reflection['type'],
      content: row.content as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));

    const isOpen = position.status === 'open';

    const systemPrompt = isOpen
      ? `You are a trading coach analyzing an OPEN position. Focus on:
- Risk management: Is the stop loss appropriate? Is position sizing reasonable?
- Process quality: Was the entry well-timed? Is the hypothesis clear and testable?
- Emotional awareness: Signs of FOMO, overconfidence, or fear
- What to watch for going forward

Respond with a JSON object containing a "suggestions" array. Each suggestion has "type" (one of "success", "lesson", "mistake") and "content" (a concise 1-2 sentence reflection). Provide exactly 3 suggestions.`
      : `You are a trading coach analyzing a CLOSED position. Focus on:
- What went well in the trading process (not just the outcome)
- What lessons can be extracted regardless of P&L
- Any mistakes in process, timing, or risk management
- Psychological patterns (revenge trading, cutting winners short, letting losers run)

Respond with a JSON object containing a "suggestions" array. Each suggestion has "type" (one of "success", "lesson", "mistake") and "content" (a concise 1-2 sentence reflection). Provide exactly 3 suggestions.`;

    const tradeContext = `
Position: ${position.symbol} (${position.assetType})
Direction: ${position.direction}
Status: ${position.status}
Entry Price: ${fmtPrice(position.avgEntryPrice)}
Total Quantity: ${position.totalQuantity}
Cost Basis: ${fmtPrice(position.totalCostBasis)}
${position.stopLoss ? `Stop Loss: $${position.stopLoss}` : 'No stop loss set'}
${position.takeProfit ? `Take Profit: $${position.takeProfit}` : 'No take profit set'}
Hypothesis: ${position.hypothesis || '(none)'}
${!isOpen ? `Realized P&L: $${position.realizedPnl.toFixed(2)} (${position.realizedPnlPercent?.toFixed(1)}%)` : ''}

Executions:
${executions.map(e => `- ${e.side.toUpperCase()} ${e.quantity} @ ${fmtPrice(e.price)} on ${e.executedAt}${e.pnl != null ? ` (P&L: $${e.pnl.toFixed(2)})` : ''}${e.notes ? ` Notes: ${e.notes}` : ''}`).join('\n')}

${reflections.length > 0 ? `Existing reflections:\n${reflections.map(r => `- [${r.type}] ${r.content}`).join('\n')}` : 'No existing reflections.'}`;

    const client = getOpenAIClient()!;
    const completion = await client.chat.completions.create({
      model: 'gpt-5',

      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: tradeContext },
      ],

      max_completion_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const parsed = JSON.parse(extractJSON(responseText));
    const suggestions: ReflectionSuggestion[] = (parsed.suggestions || []).map(
      (s: { type: string; content: string }) => ({
        type: ['success', 'lesson', 'mistake'].includes(s.type) ? s.type : 'lesson',
        content: s.content,
      })
    );

    res.json(suggestions);
  } catch (error) {
    console.error('Error suggesting reflections:', error);
    if ((error as { status?: number }).status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    if ((error as { code?: string }).code === 'ETIMEDOUT' || (error as Error).message?.includes('timeout')) {
      return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    }
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// POST /analysis
router.post('/analysis', async (_req, res) => {
  try {
    if (!isAIEnabled()) {
      return res.status(503).json({ error: 'AI features require an OpenAI API key. Set the OPENAI_API_KEY environment variable.' });
    }

    // Aggregate trade data
    const positions = db.prepare('SELECT * FROM positions ORDER BY opened_at DESC').all() as Record<string, unknown>[];
    const allPositions = positions.map(rowToPosition);

    const closedPositions = allPositions.filter(p => p.status === 'closed');
    const openPositions = allPositions.filter(p => p.status === 'open');

    // Fetch all reflections
    const allReflections = db.prepare(`
      SELECT r.*, p.symbol, p.asset_type
      FROM reflections r
      JOIN positions p ON p.id = r.position_id
      ORDER BY r.created_at DESC
    `).all() as Record<string, unknown>[];

    const reflections = allReflections.map(row => ({
      type: row.type as string,
      content: row.content as string,
      symbol: row.symbol as string,
    }));

    // Stats
    const totalPnl = closedPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
    const wins = closedPositions.filter(p => p.realizedPnl > 0).length;
    const losses = closedPositions.filter(p => p.realizedPnl < 0).length;
    const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 'N/A';

    // Top symbols
    const symbolPnl = new Map<string, number>();
    for (const p of closedPositions) {
      symbolPnl.set(p.symbol, (symbolPnl.get(p.symbol) || 0) + p.realizedPnl);
    }
    const topSymbols = Array.from(symbolPnl.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol, pnl]) => `${symbol}: $${pnl.toFixed(2)}`);

    const tradeDataSummary = `
Trading Portfolio Summary:
- Total positions: ${allPositions.length} (${openPositions.length} open, ${closedPositions.length} closed)
- Total realized P&L: $${totalPnl.toFixed(2)}
- Win rate: ${winRate}% (${wins} wins, ${losses} losses)
- Top symbols by P&L: ${topSymbols.join(', ') || 'None'}

Open positions:
${openPositions.slice(0, 10).map(p => `- ${p.symbol} (${p.direction}): entry ${fmtPrice(p.avgEntryPrice)}, qty ${p.remainingQuantity}${p.hypothesis ? `, hypothesis: ${p.hypothesis}` : ''}`).join('\n') || 'None'}

Recent closed positions:
${closedPositions.slice(0, 10).map(p => `- ${p.symbol}: P&L $${p.realizedPnl.toFixed(2)} (${p.realizedPnlPercent?.toFixed(1)}%)`).join('\n') || 'None'}

Reflections and learnings:
${reflections.slice(0, 20).map(r => `- [${r.type}] ${r.symbol}: ${r.content}`).join('\n') || 'None recorded'}`;

    const systemPrompt = `You are an expert trading coach and portfolio analyst. Analyze the trader's portfolio data and reflections to provide actionable insights.

Respond with a JSON object containing:
- "insights": array of 3-5 strings, each a key observation about the trader's performance, patterns, or behavior
- "patterns": array of 3-5 strings, each identifying a recurring pattern (positive or negative) in their trading
- "recommendations": array of 3-5 strings, each a specific, actionable recommendation to improve trading performance

Focus on process over outcomes. Be specific and reference actual data points when possible. Avoid generic advice.`;

    const client = getOpenAIClient()!;
    const completion = await client.chat.completions.create({
      model: 'gpt-5',

      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: tradeDataSummary },
      ],

      max_completion_tokens: 8000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const parsed = JSON.parse(extractJSON(responseText));
    res.json({
      insights: parsed.insights || [],
      patterns: parsed.patterns || [],
      recommendations: parsed.recommendations || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    if ((error as { status?: number }).status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    if ((error as { code?: string }).code === 'ETIMEDOUT' || (error as Error).message?.includes('timeout')) {
      return res.status(504).json({ error: 'AI request timed out. Please try again.' });
    }
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

export default router;
