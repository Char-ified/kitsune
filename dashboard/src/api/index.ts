import { realApi, type Api } from './client';
import { mockApi } from './mocks';

// Pages import `api` from here and never know which one they got.
// To use the fake data, create dashboard/.env.local with: VITE_USE_MOCKS=true
// (.env.local is ignored by git, so the fakes can never be switched on in production.)
export const api: Api = import.meta.env.VITE_USE_MOCKS === 'true' ? mockApi : realApi;

export { ApiError } from './client';
