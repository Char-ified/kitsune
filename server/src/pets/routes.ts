// Pet routes: create, get, and update the pet for one repo (docs/API.md routes 7, 8, 11).
// requireAuth and requireRepoOwner run before every route here (see app.ts),
// so by now we know who the user is and that res.locals.repo belongs to them.
import { Router } from 'express';
import type { Character, Pet } from '@kitsune/shared';
import pool from '../db.js';

const petRouter = Router();

const CHARACTERS: Character[] = ['kitsune'];
const MAX_NAME_LENGTH = 30;

type PetRow = {
  id: number;
  name: string;
  character: Character;
  created_at: Date;
  updated_at: Date;
};

const PET_COLUMNS = 'id, name, character, created_at, updated_at';

// Turns a database row (snake_case) into the contract's pet shape (camelCase).
const toPet = (row: PetRow): Pet => ({
  id: row.id,
  name: row.name,
  character: row.character,
  // Mood is calculated, never stored. Every pet is "normal" until the mood logic lands (CHA-17).
  mood: 'normal',
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// Returns the trimmed name, or null if it isn't a usable name.
const cleanName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH ? name : null;
};

const isCharacter = (value: unknown): value is Character => CHARACTERS.includes(value as Character);

const NAME_ERROR = `Give your pet a name (up to ${MAX_NAME_LENGTH} characters)`;
const CHARACTER_ERROR = 'Pick a character we support';

// 7. Create the pet
petRouter.post('/', async (req, res) => {
  const { name: rawName, character } = req.body ?? {};

  const name = cleanName(rawName);
  if (!name) {
    res.status(400).json({ error: NAME_ERROR });
    return;
  }
  if (!isCharacter(character)) {
    res.status(400).json({ error: CHARACTER_ERROR });
    return;
  }

  try {
    const result = await pool.query<PetRow>(
      `INSERT INTO pets (repo_id, name, character) VALUES ($1, $2, $3) RETURNING ${PET_COLUMNS}`,
      [res.locals.repo.id, name, character],
    );
    res.status(201).json(toPet(result.rows[0]));
  } catch (err) {
    // 23505 = unique violation. pets.repo_id is UNIQUE, so this repo already has a pet.
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'This repo already has a pet' });
      return;
    }
    throw err;
  }
});

// 8. Get the pet and its mood
petRouter.get('/', async (_req, res) => {
  const result = await pool.query<PetRow>(`SELECT ${PET_COLUMNS} FROM pets WHERE repo_id = $1`, [
    res.locals.repo.id,
  ]);

  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: 'No pet yet' });
    return;
  }

  res.json(toPet(row));
});

// 11. Update the pet: a new name, a new character, or both
petRouter.patch('/', async (req, res) => {
  const { name: rawName, character } = req.body ?? {};

  if (rawName === undefined && character === undefined) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  const name = rawName === undefined ? null : cleanName(rawName);
  if (rawName !== undefined && !name) {
    res.status(400).json({ error: NAME_ERROR });
    return;
  }
  if (character !== undefined && !isCharacter(character)) {
    res.status(400).json({ error: CHARACTER_ERROR });
    return;
  }

  // COALESCE keeps the current value when we pass null, so one query handles
  // "only name", "only character", and "both".
  const result = await pool.query<PetRow>(
    `UPDATE pets
     SET name = COALESCE($1, name), character = COALESCE($2, character), updated_at = now()
     WHERE repo_id = $3
     RETURNING ${PET_COLUMNS}`,
    [name, character ?? null, res.locals.repo.id],
  );

  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: 'No pet yet' });
    return;
  }

  res.json(toPet(row));
});

export default petRouter;
