import type { NextFunction, Request, Response } from 'express';

// Logs one line per request, e.g. "POST /api/repos 201 14ms". It waits for the response to
// finish, so the line can say how the request ended and how long it took.
// The query string is left out, and bodies are never logged, so no secrets end up in the logs.
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });

  next();
};
