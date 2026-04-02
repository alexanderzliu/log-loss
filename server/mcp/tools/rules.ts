import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '../../database';

function rowToRule(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function registerRuleTools(server: McpServer) {
  server.registerTool(
    'get_rules',
    {
      title: 'Get Trading Rules',
      description: 'Fetch all trading rules. Useful for coaching — reference these when reviewing trades.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const rows = db.prepare('SELECT * FROM rules ORDER BY created_at ASC').all() as Record<string, unknown>[];
        return { content: [{ type: 'text' as const, text: JSON.stringify(rows.map(rowToRule), null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'add_rule',
    {
      title: 'Add Trading Rule',
      description: 'Create a new trading rule based on patterns or lessons identified.',
      inputSchema: {
        content: z.string().min(1).max(500).describe('Trading rule text'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const id = uuidv4();
        db.prepare('INSERT INTO rules (id, content) VALUES (?, ?)').run(id, args.content.trim());
        const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as Record<string, unknown>;
        return { content: [{ type: 'text' as const, text: JSON.stringify(rowToRule(row), null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );
}
