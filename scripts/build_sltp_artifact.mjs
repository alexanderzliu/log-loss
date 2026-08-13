#!/usr/bin/env node
import fs from 'fs';
const template = fs.readFileSync('sltp_backtest.html', 'utf8');
const trades = fs.readFileSync('scripts/sltp_trades.json', 'utf8');
// Escape </script> inside the JSON payload (defensive — JSON shouldn't contain it, but just in case).
const safe = trades.replace(/<\/script>/gi, '<\\/script>');
const filled = template.replace('__TRADES_JSON__', safe);
fs.writeFileSync('sltp_backtest.html', filled);
console.error(`Wrote sltp_backtest.html (${(fs.statSync('sltp_backtest.html').size / 1024).toFixed(1)} KB)`);
