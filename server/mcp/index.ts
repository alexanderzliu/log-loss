// CRITICAL: Redirect console.log to stderr BEFORE any imports.
// MCP stdio transport uses stdout for the JSON-RPC protocol stream.
// Any console.log (e.g., from database.ts "Database initialized successfully")
// would corrupt the protocol and crash the connection.
console.log = console.error;

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDatabase, db } from '../database';
import { registerImportTools } from './tools/import';
import { registerTradeTools } from './tools/trades';
import { registerAnalyticsTools } from './tools/analytics';
import { registerReflectionTools } from './tools/reflections';
import { registerRuleTools } from './tools/rules';

// Initialize database (creates tables if needed)
initDatabase();

const server = new McpServer({
  name: 'trading-journal',
  version: '1.0.0',
});

// Register all tools
registerImportTools(server);
registerTradeTools(server);
registerAnalyticsTools(server);
registerReflectionTools(server);
registerRuleTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Trading Journal MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
