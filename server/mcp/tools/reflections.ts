import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '../../database';
import { rowToReflection } from '../../helpers/rowMappers';

export function registerReflectionTools(server: McpServer) {
  server.registerTool(
    'add_reflection',
    {
      title: 'Add Reflection',
      description: 'Add a reflection (success, lesson, or mistake) linked to a specific trade.',
      inputSchema: {
        tradeId: z.string().describe('Trade UUID to attach the reflection to'),
        type: z.enum(['success', 'lesson', 'mistake']).default('lesson'),
        content: z.string().min(1).describe('Reflection content'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const trade = db.prepare('SELECT id FROM trades WHERE id = ?').get(args.tradeId);
        if (!trade) {
          return { content: [{ type: 'text' as const, text: 'Trade not found' }], isError: true };
        }

        const id = uuidv4();
        db.prepare('INSERT INTO reflections (id, trade_id, type, content) VALUES (?, ?, ?, ?)')
          .run(id, args.tradeId, args.type, args.content);

        const row = db.prepare(`
          SELECT r.*, t.underlying, t.asset_type
          FROM reflections r JOIN trades t ON t.id = r.trade_id
          WHERE r.id = ?
        `).get(id) as Record<string, unknown>;

        return { content: [{ type: 'text' as const, text: JSON.stringify(rowToReflection(row), null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );
}
