import express from 'express';
import cors from 'cors';
import { initDatabase, db } from './database';
import tradesRouter from './routes/trades';
import pricesRouter from './routes/prices';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Routes
app.use('/api/trades', tradesRouter);
app.use('/api/prices', pricesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
