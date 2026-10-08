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

| Kind      | How it's protected                 | Routes                                     |
| --------- | ---------------------------------- | ------------------------------------------ |
| Public    | Nothing (no token exists yet)      | Sign up, log in                            |
| Logged in | Cookie **or** Bearer token (below) | Log out, me, everything under `/api/repos` |
| Signature | GitHub's webhook signature         | `/api/webhooks/github/:repoId`             |

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

| Status | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| `200`  | OK                                                                               |
| `201`  | Created: something new was saved                                                 |
| `400`  | Bad request: input missing or invalid                                            |
| `401`  | Authentication failed: not logged in, or a bad token                             |
| `404`  | Not found, **or not yours** (we don't use `403`, to avoid revealing what exists) |
| `409`  | Conflict: clashes with something that already exists                             |
| `500`  | Unexpected server error (global error handler)                                   |

## Error format

Every error response uses the same shape:

```json
{ "error": "Human-readable message" }
```

## Routes

| #   | Action         | Method | URL                            | Auth      |
| --- | -------------- | ------ | ------------------------------ | --------- |
| 1   | Sign up        | `POST` | `/api/auth/signup`             | Public    |
| 2   | Log in         | `POST` | `/api/auth/login`              | Public    |
| 3   | Log out        | `POST` | `/api/auth/logout`             | Logged in |
| 4   | Who am I?      | `GET`  | `/api/auth/me`                 | Logged in |
| 5   | List my repos  | `GET`  | `/api/repos`                   | Logged in |
| 6   | Connect a repo | `POST` | `/api/repos`                   | Logged in |
| 7   | Create the pet | `POST` | `/api/repos/:repoId/pet`       | Logged in |
| 8   | Get pet + mood | `GET`  | `/api/repos/:repoId/pet`       | Logged in |
| 9   | Get event log  | `GET`  | `/api/repos/:repoId/events`    | Logged in |
| 10  | GitHub event   | `POST` | `/api/webhooks/github/:repoId` | Signature |

## Route details

### 1. Sign up: `POST /api/auth/signup`

- **Auth:** Public
- **Notes:** The user sends their real password. The **server** hashes it. If the browser sent a hash, the hash would effectively become the password. Signing up also logs the user in: the server sets the cookie (for the dashboard) and returns the token in the body (for the extension).

```
Input:   { "email": "string", "password": "string" }
Output:  201 Created
         Sets httpOnly cookie
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
         Sets httpOnly cookie
         { "token": "string", "user": { "id": number, "email": "string" } }
Errors:  400  missing email or password
         401  "Invalid email or password"
         500  unexpected server error
```

### 3. Log out: `POST /api/auth/logout`

- **Auth:** Logged in
- **Notes:** Needed because of the httpOnly cookie: page scripts **can't** delete it, so the server has to clear it. The extension logs out by deleting its token from `chrome.storage`, without calling this route.

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
- **Notes:** No user ID in the URL. The server gets the user from the cookie or token, so nobody can request someone else's repos by changing a number. `hasPet` tells the dashboard whether to show the pet or a "pick a character" screen.

```
Input:   none
Output:  200 OK
         [ { "id": number, "fullName": "string", "hasPet": boolean, "createdAt": "string" } ]
Errors:  401  not logged in
         500  unexpected server error
```

### 6. Connect a repo: `POST /api/repos`

- **Auth:** Logged in
- **Notes:** Same URL as #5. The method tells them apart. **Different users can connect the same GitHub repo** (e.g. the whole team on one project repo). Each connection gets its own row, its own secret, and its own webhook URL. The **same user** connecting the same repo twice is a `409`. The secret is **only shown here, once**, and never sent again by any other route.

```
Input:   { "fullName": "owner/repo-name" }
Output:  201 Created
         { "id": number, "fullName": "string",
           "webhookUrl": "https://<our-domain>/api/webhooks/github/<id>",
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
- **Notes:** Newest first. `limit` is an optional **query parameter** (part of the URL after `?`), e.g. `/api/repos/11/events?limit=20`. Default 20.

```
Input:   optional query: ?limit=number
Output:  200 OK
         [ { "id": number, "type": "pr_merged" | "tests_passed" | "tests_failed", "createdAt": "string" } ]
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

## Decisions log

| Decision                   | Choice                                                   | Why                                                          |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Dashboard token storage    | httpOnly cookie                                          | Safe from XSS; common real-world pattern                     |
| Extension token storage    | `chrome.storage` + Bearer header                         | Extensions can't easily share the dashboard's cookie         |
| Dashboard hosting          | Served by Express                                        | Same domain, so the cookie stays first-party                 |
| Same repo, different users | Allowed; each gets its own webhook URL `/github/:repoId` | The team can all use the project repo; no guessing which row |
| Someone else's repo        | `404`                                                    | Hides which repo IDs exist                                   |
| Repo with no pet           | `404` "No pet yet"                                       | The pet doesn't exist yet                                    |
| Error format               | `{ "error": "message" }`                                 | Every client handles errors the same way                     |
