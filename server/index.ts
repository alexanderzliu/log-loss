import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase, db } from './database';
import positionsRouter from './routes/positions';
import pricesRouter from './routes/prices';
import predictionsRouter from './routes/predictions';
import reflectionsRouter from './routes/reflections';
import rulesRouter from './routes/rules';
import aiRouter from './routes/ai';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Routes
app.use('/api/positions', positionsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/reflections', reflectionsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/ai', aiRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error-handling middleware for malformed JSON and unexpected errors
app.use((err: Error & { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  next(err);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
