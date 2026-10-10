// Express app: middleware and routes are added here. Kept separate from index.ts so tests can import the app. (CHA-7, CHA-9)
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import express from 'express';
import authRouter from './auth/routes.js';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`a ${req.method} request was made to ${req.path}`);

  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authRouter);

// Unknown /api routes: answer in the contract's JSON error shape, not an HTML page.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler. Express knows it's an error handler because it has 4 arguments,
// so `_next` has to stay even though it's unused. It must come after every route.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  // express.json() sets status 400 when the request body isn't valid JSON.
  if (err.status === 400) {
    res.status(400).json({ error: 'Request body must be valid JSON' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

export default app;
