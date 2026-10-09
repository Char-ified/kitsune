// Express app: middleware and routes are added here. Kept separate from index.ts so tests can import the app. (CHA-7, CHA-9)

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

export default app;
