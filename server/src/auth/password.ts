import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Asynchronous Hashing
export const hashPassword = async (password: string): Promise<string> => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
};

// Asynchronous Comparison
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const verified = await bcrypt.compare(password, hash);
  return verified;
};
