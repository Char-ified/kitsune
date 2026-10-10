# Kitsune Repo Pet: API Contract

## Conventions

- Every route starts with `/api`.
- URLs use **nouns, not verbs**. The method is the verb. (Exception: auth routes.)
- Collections are **plural** (`/repos`). One-of-a-kind things are **singular** (`/pet`, since each repo has exactly one pet).
- A specific item's ID goes in the URL: `/api/repos/:repoId`.
- Related things are nested: `/api/repos/:repoId/events`.
- URL params use camelCase: `:repoId`.
- **JSON uses camelCase** (`fullName`, `createdAt`), even though the database uses snake_case (`full_name`, `created_at`). The server translates between them.

## Methods

| Method   | Meaning                  |
| -------- | ------------------------ |
| `GET`    | Read something           |
| `POST`   | Create something new     |
| `PATCH`  | Change part of something |
| `DELETE` | Remove something         |

## Hosting

**Express serves the built dashboard**, so the dashboard and the API share one domain. This keeps the login cookie "first-party," which browsers allow. (If they were on separate domains, many browsers would block it.)

## Auth

There are three kinds of route:

| Kind      | How it's protected                 | Routes                                 |
| --------- | ---------------------------------- | -------------------------------------- |
| Public    | Nothing (no token needed)          | Health check, sign up, log in, log out |
| Logged in | Cookie **or** Bearer token (below) | Me, everything under `/api/repos`      |
| Signature | GitHub's webhook signature         | `/api/webhooks/github/:repoId`         |

### Two clients, two ways to send the token

| Client    | How it sends the token                          | Why                                                                  |
| --------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Dashboard | **httpOnly cookie**, set by the server at login | Page scripts can't read it, so injected scripts (XSS) can't steal it |
| Extension | `Authorization: Bearer <token>` header          | Saved in `chrome.storage` after the extension logs in                |

**The auth middleware checks the cookie first, then the header.** One middleware, two clients.

**Cookie settings:** `httpOnly`, `secure` (HTTPS only, in production), `sameSite: 'lax'`.

**Dashboard rule:** never save the token from a response body. The cookie handles it.

### Authentication vs. authorization

- **Authentication:** who are you? (valid cookie or token)
- **Authorization:** what are you allowed to do? (does this repo belong to you?)

**Ownership check:** every route with `:repoId` must confirm the repo's `user_id` matches the logged-in user. **If it doesn't, return `404`, the same as if the repo didn't exist.** This hides which repo IDs exist, the same idea as the vague login error.

## Status codes

| Status | Meaning                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | OK                                                                                                                               |
| `201`  | Created: something new was saved                                                                                                 |
| `400`  | Bad request: input missing or invalid                                                                                            |
| `401`  | Authentication failed: not logged in, or a bad token                                                                             |
| `404`  | Not found, **or not yours** (we don't use `403`, to avoid revealing what exists). Unknown `/api/...` URLs also get a JSON `404`. |
| `409`  | Conflict: clashes with something that already exists                                                                             |
| `500`  | Unexpected server error (global error handler)                                                                                   |

## Error format

Every error response uses the same shape:

```json
{ "error": "Human-readable message" }
```

## Routes

| #   | Action             | Method   | URL                                 | Auth      |
| --- | ------------------ | -------- | ----------------------------------- | --------- |
| 0   | Health check       | `GET`    | `/api/health`                       | Public    |
| 1   | Sign up            | `POST`   | `/api/auth/signup`                  | Public    |
| 2   | Log in             | `POST`   | `/api/auth/login`                   | Public    |
| 3   | Log out            | `POST`   | `/api/auth/logout`                  | Public    |
| 4   | Who am I?          | `GET`    | `/api/auth/me`                      | Logged in |
| 5   | List my repos      | `GET`    | `/api/repos`                        | Logged in |
| 6   | Connect a repo     | `POST`   | `/api/repos`                        | Logged in |
| 7   | Create the pet     | `POST`   | `/api/repos/:repoId/pet`            | Logged in |
| 8   | Get pet + mood     | `GET`    | `/api/repos/:repoId/pet`            | Logged in |
| 9   | Get event log      | `GET`    | `/api/repos/:repoId/events`         | Logged in |
| 10  | GitHub event       | `POST`   | `/api/webhooks/github/:repoId`      | Signature |
| 11  | Update the pet     | `PATCH`  | `/api/repos/:repoId/pet`            | Logged in |
| 12  | Disconnect a repo  | `DELETE` | `/api/repos/:repoId`                | Logged in |
| 13  | New webhook secret | `POST`   | `/api/repos/:repoId/webhook-secret` | Logged in |

### CRUD at a glance

| Resource | Create      | Read    | Update                        | Delete              |
| -------- | ----------- | ------- | ----------------------------- | ------------------- |
| User     | #1 sign up  | #4 me   | not in MVP                    | not in MVP          |
| Repo     | #6 connect  | #5 list | #13 new secret                | #12 disconnect      |
| Pet      | #7 create   | #8 get  | #11 rename / change character | with its repo (#12) |
| Event    | #10 webhook | #9 log  | never                         | never               |

Events are a record of what happened, so they are never edited or deleted on their own. Not every resource should have full CRUD.

## Route details

### 0. Health check: `GET /api/health`

- **Auth:** Public
- **Notes:** Confirms the server is running. Hosting platforms can use it to check the server is alive.

```
Input:   none
Output:  200 OK
         { "status": "ok" }
```

### 1. Sign up: `POST /api/auth/signup`

- **Auth:** Public
- **Notes:** The user sends their real password. The **server** hashes it. If the browser sent a hash, the hash would effectively become the password. Signing up also logs the user in: the server sets the cookie (for the dashboard) and returns the token in the body (for the extension). Emails are trimmed and lowercased before saving, so `Maia@x.com` and `maia@x.com` are one account.

```
Input:   { "email": "string", "password": "string" }
Output:  201 Created
         Sets httpOnly cookie
         { "token": "string", "user": { "id": number, "email": "string" } }
Errors:  400  missing or invalid: email must contain "@", password must be a string of at least 8 characters
         409  email already registered
         500  unexpected server error
```

### 2. Log in: `POST /api/auth/login`

- **Auth:** Public
- **Notes:** `POST`, not `GET`, so the password never goes in the URL. `200`, not `201`, because nothing new is saved. The `401` message is the same whether the email or the password is wrong, so attackers can't find out which emails have accounts (user enumeration). The email is trimmed and lowercased the same way as at sign up. Log in doesn't check the password rules, so a wrong-looking attempt gets the same vague `401`.

```
Input:   { "email": "string", "password": "string" }
Output:  200 OK
         Sets httpOnly cookie
         { "token": "string", "user": { "id": number, "email": "string" } }
Errors:  400  missing email or password
         401  "Invalid email or password"
         500  unexpected server error
```

### 3. Log out: `POST /api/auth/logout`

- **Auth:** Public
- **Notes:** Needed because of the httpOnly cookie: page scripts **can't** delete it, so the server has to clear it. **Public on purpose:** logging out when you're already logged out does no harm, so it always returns `200` and can never get stuck. The extension logs out by deleting its token from `chrome.storage`, without calling this route.

```
Input:   none
Output:  200 OK
         Clears the cookie
         { "loggedOut": true }
Errors:  500  unexpected server error
```

### 4. Who am I?: `GET /api/auth/me`

- **Auth:** Logged in
- **Notes:** Also needed because of the httpOnly cookie. When the dashboard loads, it can't read the cookie to see if the user is logged in, so it asks the server. `200` = logged in. `401` = show the login page.

```
Input:   none
Output:  200 OK
         { "user": { "id": number, "email": "string" } }
Errors:  401  not logged in
         500  unexpected server error
```

### 5. List my repos: `GET /api/repos`

- **Auth:** Logged in
- **Notes:** No user ID in the URL. The server gets the user from the cookie or token, so nobody can request someone else's repos by changing a number. `hasPet` tells the dashboard whether to show the pet or a "pick a character" screen. `pet` gives the dashboard's repo cards what they need (name, character, calculated mood) without a second request per repo. It is `null` when the repo has no pet yet. The extension uses this list to decide which pet to show on which GitHub repo.

```
Input:   none
Output:  200 OK
         [ { "id": number, "fullName": "string", "hasPet": boolean,
             "pet": { "name": "string", "character": "string", "mood": "happy" | "normal" | "sick" } | null,
             "createdAt": "string" } ]
Errors:  401  not logged in
         500  unexpected server error
```

### 6. Connect a repo: `POST /api/repos`

- **Auth:** Logged in
- **Notes:** Same URL as #5. The method tells them apart. **Different users can connect the same GitHub repo** (e.g. the whole team on one project repo). Each connection gets its own row, its own secret, and its own webhook URL. The **same user** connecting the same repo twice is a `409`. The secret is returned here and by #13 (new webhook secret), and never by any `GET` route. The server builds `webhookUrl` from the `PUBLIC_URL` environment variable (the server's public address).

```
Input:   { "fullName": "owner/repo-name" }
Output:  201 Created
         { "id": number, "fullName": "string",
           "webhookUrl": "<PUBLIC_URL>/api/webhooks/github/<id>",
           "webhookSecret": "string", "createdAt": "string" }
Errors:  400  missing fullName, or not in "owner/name" format
         401  not logged in
         409  you already connected this repo
         500  unexpected server error
```

### 7. Create the pet: `POST /api/repos/:repoId/pet`

- **Auth:** Logged in + ownership check
- **Notes:** The pet doesn't exist until the user picks a character, so this creates it. Returns the same pet shape as #8.

```
Input:   { "name": "string", "character": "kitsune" }
Output:  201 Created
         { "id": number, "name": "string", "character": "string", "mood": "string",
           "createdAt": "string", "updatedAt": "string" }
Errors:  400  missing name, or character isn't one we support
         401  not logged in
         404  repo not found (or not yours)
         409  this repo already has a pet
         500  unexpected server error
```

### 8. Get pet + mood: `GET /api/repos/:repoId/pet`

- **Auth:** Logged in + ownership check
- **Notes:** Used by both the dashboard and the extension. `mood` is calculated from recent events, never stored. If the repo has no pet yet, this returns `404` with `"No pet yet"`, and the extension shows "Pick a character in the dashboard."
- **Extension note:** a content script running on github.com is treated like part of GitHub's page, so the browser may block its requests to our server (CORS). Make the request from the extension's **background service worker** instead, with our server's URL in the manifest's `host_permissions`.

```
Input:   none
Output:  200 OK
         { "id": number, "name": "string", "character": "string", "mood": "happy" | "normal" | "sick",
           "createdAt": "string", "updatedAt": "string" }
Errors:  401  not logged in
         404  repo not found (or not yours), or no pet yet
         500  unexpected server error
```

### 9. Get event log: `GET /api/repos/:repoId/events`

- **Auth:** Logged in + ownership check
- **Notes:** Newest first. `limit` is an optional **query parameter** (part of the URL after `?`), e.g. `/api/repos/11/events?limit=20`. Default 20. `details` holds extra info about the event (see the table under route 10). It can be `{}` if there's nothing extra.

```
Input:   optional query: ?limit=number
Output:  200 OK
         [ { "id": number, "type": "pr_merged" | "tests_passed" | "tests_failed",
             "details": object, "createdAt": "string" } ]

Example: { "id": 7, "type": "pr_merged",
           "details": { "number": 12, "title": "add login route", "url": "https://github.com/..." },
           "createdAt": "2026-10-09T10:42:00Z" }
Errors:  401  not logged in
         404  repo not found (or not yours)
         500  unexpected server error
```

### 10. GitHub event: `POST /api/webhooks/github/:repoId`

- **Auth:** Signature (GitHub can't log in)
- **Notes:** `POST` because each webhook creates a new event row. The `:repoId` in the URL says exactly which connection this is, so the server checks the signature against **that row's** secret. Check the signature against the **raw** request body, before Express parses the JSON. GitHub only needs a `2xx` back and marks the delivery failed after about 10 seconds, so respond quickly.
- **Event mapping:** the server translates GitHub's events into ours.

| GitHub sends                                                | We save                          |
| ----------------------------------------------------------- | -------------------------------- |
| `pull_request`, action `closed`, `merged: true`             | `pr_merged`                      |
| `workflow_run`, action `completed`, conclusion `success`    | `tests_passed`                   |
| `workflow_run`, action `completed`, conclusion `failure`    | `tests_failed`                   |
| Anything else (including GitHub's `ping` when first set up) | Nothing, but still respond `200` |

- **Event details:** along with the type, the server saves useful info from GitHub's payload in `events.details` (JSONB). This powers the event log ("PR merged #12 add login route") and future speech bubbles.

| Our type                        | `details` saved                                                         |
| ------------------------------- | ----------------------------------------------------------------------- |
| `pr_merged`                     | `number`, `title`, `url` of the PR                                      |
| `tests_passed` / `tests_failed` | workflow `name`, `url` of the run, and the PR `number` if it ran on one |

```
Input:   Headers set by GitHub:
           X-GitHub-Event        event name, e.g. "pull_request"
           X-GitHub-Delivery     unique ID → saved as github_delivery_id
           X-Hub-Signature-256   signature to verify
         Body: GitHub's JSON payload
Output:  200 OK
         { "received": true }
Errors:  401  signature missing or invalid
         404  no connected repo with this ID
         500  unexpected server error
Duplicates: same X-GitHub-Delivery seen before → 200, ignored (not an error)
```

### 11. Update the pet: `PATCH /api/repos/:repoId/pet`

- **Auth:** Logged in + ownership check
- **Notes:** `PATCH` because it changes part of something that exists. Send `name`, `character`, or both. Updates `updated_at`. Returns the same pet shape as #8.

```
Input:   { "name"?: "string", "character"?: "kitsune" }   (at least one)
Output:  200 OK
         { "id": number, "name": "string", "character": "string", "mood": "string",
           "createdAt": "string", "updatedAt": "string" }
Errors:  400  nothing to update, empty name, or character isn't one we support
         401  not logged in
         404  repo not found (or not yours), or no pet yet
         500  unexpected server error
```

### 12. Disconnect a repo: `DELETE /api/repos/:repoId`

- **Auth:** Logged in + ownership check
- **Notes:** Removes the repo connection. Its pet and events are deleted with it (the schema's `ON DELETE CASCADE`). This is also how a pet gets deleted. The dashboard asks the user to confirm first. The webhook in GitHub keeps existing until the user removes it there; its deliveries will get a `404`.

```
Input:   none
Output:  200 OK
         { "deleted": true }
Errors:  401  not logged in
         404  repo not found (or not yours)
         500  unexpected server error
```

### 13. New webhook secret: `POST /api/repos/:repoId/webhook-secret`

- **Auth:** Logged in + ownership check
- **Notes:** Replaces the repo's secret with a new random one and returns it. This is the fix for "I lost my secret": the webhook setup page calls it, so the page can be reopened anytime. `POST`, not `GET`, because it changes data. After calling it, the user must update the secret in GitHub's webhook settings, or deliveries will fail the signature check.

```
Input:   none
Output:  200 OK
         { "webhookUrl": "<PUBLIC_URL>/api/webhooks/github/<id>", "webhookSecret": "string" }
Errors:  401  not logged in
         404  repo not found (or not yours)
         500  unexpected server error
```

## Decisions log

| Decision                   | Choice                                                     | Why                                                                                |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Dashboard token storage    | httpOnly cookie                                            | Safe from XSS; common real-world pattern                                           |
| Extension token storage    | `chrome.storage` + Bearer header                           | Extensions can't easily share the dashboard's cookie                               |
| Dashboard hosting          | Served by Express                                          | Same domain, so the cookie stays first-party                                       |
| Same repo, different users | Allowed; each gets its own webhook URL `/github/:repoId`   | The team can all use the project repo; no guessing which row                       |
| Someone else's repo        | `404`                                                      | Hides which repo IDs exist                                                         |
| Repo with no pet           | `404` "No pet yet"                                         | The pet doesn't exist yet                                                          |
| Error format               | `{ "error": "message" }`                                   | Every client handles errors the same way                                           |
| Log out                    | Public, always `200`                                       | Logging out twice is harmless, so it can never get stuck                           |
| Webhook secrets            | One per connected repo, stored in the database             | No global webhook secret env var                                                   |
| Webhook URL                | Built from `PUBLIC_URL` env var                            | The server needs its own public address to build the URL                           |
| Event details              | `details` JSONB column on `events`                         | Log and speech bubbles can name the PR; new event types fit without a table change |
| Lost webhook secret        | "New webhook secret" route (#13)                           | Webhook setup can be reopened anytime; a refresh is never a dead end               |
| CRUD                       | Full CRUD on repos and pets; events are create + read only | Events are a record of what happened, so they aren't edited                        |
| Emails                     | Trimmed and lowercased                                     | One account per email, whatever the capitalization                                 |
| Password rule              | At least 8 characters, checked at sign up only             | Log in stays vague on purpose                                                      |
| Unexpected errors          | Global handler returns `{ "error": ... }` with `500`       | Clients always get JSON, and no stack traces leak                                  |
| User flow                  | See `docs/USER-FLOW.md`                                    | Dashboard at `/` is the hub; setup is Connect → Pick character → Webhook           |
