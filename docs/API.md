# Kitsune Repo Pet: API Contract

## Conventions

- Every route starts with `/api`.
- URLs use **nouns, not verbs**. The method is the verb. (Exception: auth routes.)
- Collections are **plural** (`/repos`). One-of-a-kind things are **singular** (`/pet`, since each repo has exactly one pet).
- A specific item's ID goes in teh URL: `/api/repos/:repoId`.
- Related things are nested: `/api/repos/:repoId/events`.
- URL params use camelCase: `:repoId`.

## Methods

| Method   | Meaning                      |
| -------- | ---------------------------- |
| `GET`    | Read something               |
| `POST`   | Create something new         |
| `PATCH`  | Change part of something     |
| `DELETE` | Remove something             |

## Auth

There are three kinds of route:

| Kind      | How it's protected            | Routes                        |
| --------- | ----------------------------- | ----------------------------- |
| Public    | Nothing (no token exists yet) | Sign up, log in               |
| Token     | User's login token            | Everything under `/api/repos` |
| Signature | GitHub's webhook signature    | `/api/webhooks/github`        |

**Sending the token (proposed):** token routes expect this header:
```
Authorization: Bearer <token>
```

Both the dashboard and the extension send it the same way.

**Authentication vs. Authorization**
 - **Authentication:** who are you? (valid token)
 - **Authorization:** what are you allowed to do? (does this repo belog to you?)

 **Ownership check:** every route with `:repoId` must confirm the repo's `user_id` matches the logged-in user.

## Status codes

| Status | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| `200`  | OK                                                        |
| `201`  | Created: something new was saved                          |
| `400`  | Bad request: input missing or invalid                     |
| `401`  | Authentication failed: no token, or a bad one             |
| `403`  | Authenticated, but not allowed (e.g. someone else's repo) |
| `404`  | Not found                                                 |
| `409`  | Conflict: clashes with something that already exists      |
| `500`  | Unexpected server error (global error handler)            |

## Error format (proposed)

Every error response uses the same shape:

```json
{ "error": "Human-readable message" }
```

## Route

| #   | Action           | Method | URL                         | Auth      |
| --- | ---------------- | ------ | --------------------------- | --------- |
| 1   | Sign up          | `POST` | `/api/auth/signup`          | Public    |
| 2   | Log in           | `POST` | `/api/auth/login`           | Public    |
| 3   | List my repos    | `GET`  | `/api/repos`                | Token     |
| 4   | Connect a repo   | `POST` | `/api/repos`                | Token     |
| 5   | Create the pet   | `POST` | `/api/repos/:repoId/pet`    | Token     |
| 6   | Get pet + mood   | `GET`  | `/api/repos/:repoId/pet`    | Token     |
| 7   | Get event log    | `GET`  | `/api/repos/:repoId/events` | Token     |
| 8   | GitHub event     | `POST` | `/api/webhooks/github`      | Signature |

## Route Details

### 1. Sign up: `POST /api/auth/signup`

- **Auth:** Public
- **Notes:** The user sends their real password. The **server** hashes it. If the browser sent a hash, the hash would effectively become the password. Signing up also logs the user in.

```
Input:   { "email": "string", "password": "string" }
Output:  201 Created
         { "token": "string", "user": { "id": number, "email": "string" } }
Errors:  400  missing or invalid email/password
         409  email already registered
         500  unexpected server error
```

### 2. Log in: `POST /api/auth/login`

- **Auth:** Public
- **Notes:** `POST`, not `GET`, so the password never goes in the URL. `200`, not `201`, because nothing new is saved. The `401` message is the same whether the email or the password is wrong, so attackers can't find out which emails have accounts (user enumeration).

```
Input:   { "email": "string", "password": "string" }
Output:  200 OK
         { "token": "string", "user": { "id": number, "email": "string" } }
Errors:  400  missing email or password
         401  "Invalid email or password"
         500  unexpected server error
```

### 3. List my repos: `GET /api/repos`

- **Auth:** Token
- **Notes:** No user ID in the URL. The server gets the user from the token, so nobody can request someone else's repos by changing a number. `hasPet` lets the dashboard know whether to show the pet or a "pick a character" screen.

```
Input:   none (token in header)
Output:  200 OK
         [ { "id": number, "fullName": "string", "hasPet": boolean, "createdAt": "string" } ]
Errors:  401  missing or invalid token
         500  unexpected server error
```

### 4. Connect a repo: `POST /api/repos`

- **Auth:** Token
- **Notes:** Same URL as #3. The method tells them apart. The response includes the webhook URL and secret for the user to paste into their GitHub repo settings. **The secret is only shown here, once**, and never sent again by any other route.

```
Input:   { "fullName": "owner/repo-name" }
Output:  201 Created
         { "id": number, "fullName": "string", "webhookUrl": "string",
           "webhookSecret": "string", "createdAt": "string" }
Errors:  400  missing fullName, or not in "owner/name" format
         401  missing or invalid token
         409  repo already connected
         500  unexpected server error
```

### 5. Create the pet: `POST /api/repos/:repoId/pet`

- **Auth:** Token + ownership check
- **Notes:** The pet doesn't exist until the user picks a character, so this creates it. Returns the same pet shape as #6. A brand-new pet's mood is calculated from the repo's events like always.

```
Input:   { "name": "string", "character": "kitsune" }
Output:  201 Created
         { "id": number, "name": "string", "character": "string", "mood": "string",
           "createdAt": "string", "updatedAt": "string" }
Errors:  400  missing name, or character isn't one we support
         401  missing or invalid token
         403  repo belongs to someone else
         404  repo not found
         409  this repo already has a pet
         500  unexpected server error
```

### 6. Get pet + mood: `GET /api/repos/:repoId/pet`

- **Auth:** Token + ownership check
- **Notes:** Used by both the dashboard and the extension. `mood` is calculated from recent events, never stored. **If the repo has no pet yet, this returns `404`** with `"No pet yet"`. The extension then shows "Pick a character in the dashboard."

```
Input:   none (token in header)
Output:  200 OK
         { "id": number, "name": "string", "character": "string", "mood": "happy" | "normal" | "sick",
           "createdAt": "string", "updatedAt": "string" }
Errors:  401  missing or invalid token
         403  repo belongs to someone else
         404  repo not found, or no pet yet
         500  unexpected server error
```

### 7. Get event log: `GET /api/repos/:repoId/events`

- **Auth:** Token + ownership check
- **Notes:** Newest first. `limit` is an optional **query parameter** (part of the URL after `?`), e.g. `/api/repos/11/events?limit=20`. Default 20.

```
Input:   optional query: ?limit=number
Output:  200 OK
         [ { "id": number, "type": "pr_merged" | "tests_passed" | "tests_failed", "createdAt": "string" } ]
Errors:  401  missing or invalid token
         403  repo belongs to someone else
         404  repo not found
         500  unexpected server error
```

### 8. GitHub event: `POST /api/webhooks/github`

- **Auth:** Signature (GitHub can't have a login token)
- **Notes:** `POST` because each webhook creates a new event row. Nothing existing is changed. The signature must be checked against the **raw** request body, before Express parses the JSON. GitHub only needs a `2xx` back, and it marks the delivery failed after about 10 seconds, so respond quickly.
- **Event mapping:** the server translates GitHub's events into ours.

| GitHub sends                                                 | We save        |
| ------------------------------------------------------------ | -------------- |
| `pull_request`, action `closed`, `merged: true`              | `pr_merged`    |
| `workflow_run`, action `completed`, conclusion `success`     | `tests_passed` |
| `workflow_run`, action `completed`, conclusion `failure`     | `tests_failed` |
| Anything else (including GitHub's `ping` when first set up)  | Nothing, but still respond `200` |

```
Input:   Headers set by GitHub:
           X-GitHub-Event        event name, e.g. "pull_request"
           X-GitHub-Delivery     unique ID → saved as github_delivery_id
           X-Hub-Signature-256   signature to verify
         Body: GitHub's JSON payload (includes repository.full_name)
Output:  200 OK
         { "received": true }
Errors:  401  signature missing or invalid
         404  repo not connected to Kitsune
         500  unexpected server error
Duplicates: same X-GitHub-Delivery seen before → 200, ignored (not an error)
```

## Open decisions

- [x] What #6 returns when the repo has no pet yet → `404` "No pet yet" (proposed)
- [x] Standard error format → `{ "error": "message" }` (proposed)
- [ ] Where the dashboard stores the token (localStorage vs. cookie)
- [ ] Can two users connect the **same** GitHub repo? This draft says no (`409`), which keeps webhook matching simple: one `fullName` maps to one repo row.
- [ ] Someone else's repo: `403` (honest) or `404` (hides that the repo exists, like the login message)? This draft uses `403`.

