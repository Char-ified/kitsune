import express from 'express';
import type { Request, Response } from 'express';

const authRouter = express.Router();

authRouter.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }
  res.status(201).json({ message: 'signup works' });
});

export default authRouter;
