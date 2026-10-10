# Kitsune Repo Pet: User Flow

How people move through the app. Decided Oct 10. Routes refer to the dashboard (React); API routes are in [API.md](API.md).

## Principles

- **The Dashboard (`/`) is the hub.** Everything is reachable from it.
- **Nobody is forced into setup.** New users land on the dashboard and can look around first.
- **Fun before fiddly.** You pick your fox before the webhook steps.
- **Every page has a way forward and a way back.** No dead ends.

## The flow

```
/signup or /login ──► /  DASHBOARD (hub)
                          │   your repos + pets, "Connect a repo"
                          │
        ┌─────────────────┼──────────────────────────────┐
        ▼                 ▼                              ▼
   /connect          /repos/:repoId  PET VIEW        Log out ──► /login
   type owner/repo    mood, events, rename,
        │             webhook setup, disconnect
        ▼
   /repos/:repoId/pick-character     pick the kitsune, name it
        │
        ▼
   /repos/:repoId/webhook            copy URL + secret into GitHub
        │
        ▼
   /repos/:repoId                    "Listening for your first signal"
```

## Pages

| Page                | Path                            | Who can see it | What it's for                                                                  |
| ------------------- | ------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| Log in              | `/login`                        | Logged out     | Log in. Logged-in users are sent to `/`.                                       |
| Sign up             | `/signup`                       | Logged out     | Create an account (also logs you in).                                          |
| Dashboard           | `/`                             | Logged in      | One card per connected repo, with its pet and mood. Empty state for new users. |
| Connect a repo      | `/connect`                      | Logged in      | Enter `owner/repo-name`.                                                       |
| Pick your character | `/repos/:repoId/pick-character` | Logged in      | Choose the kitsune and name it.                                                |
| Webhook setup       | `/repos/:repoId/webhook`        | Logged in      | Copy the webhook URL and secret into GitHub. Can be reopened anytime.          |
| Pet view            | `/repos/:repoId`                | Logged in      | The pet, its mood, and the event log for one repo.                             |
| Style guide         | `/styleguide`                   | Anyone         | Shows every shared component. For the team.                                    |
| Not found           | anything else                   | Anyone         | A way back to the dashboard.                                                   |

Logged-out visitors to a "Logged in" page are sent to `/login`.

## Navigation: every way out of every page

| Page                | Ways out                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Header (every page) | Logo → `/` (or `/login` when logged out) · Log out → `/login`                              |
| Log in / Sign up    | Link to each other · on success → `/`                                                      |
| Dashboard           | "Connect a repo" → `/connect` · repo card → pet view, or pick a character if it has no pet |
| Connect a repo      | Cancel → `/` · Submit → pick your character                                                |
| Pick your character | Back → `/` · Create pet → webhook setup                                                    |
| Webhook setup       | Done → pet view · Skip for now → pet view · Generate new secret (stays on the page)        |
| Pet view            | Back to dashboard · Rename · Webhook setup · Disconnect repo (confirm first) → `/`         |
| Not found           | Back to dashboard                                                                          |

## Decisions and why

| Decision                                                                    | Why                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/` is the dashboard, not a redirect into setup                             | People may want to look around before connecting anything                                                               |
| Connect → Pick character → Webhook                                          | The fun part gets people invested before the fiddly part. The data model allows it: a pet only needs its repo to exist. |
| Webhook setup can be reopened, with "Generate new secret"                   | A refresh or a lost secret is never a dead end                                                                          |
| Several repos: one card each, each pet has its own event log                | Matches the data model (one pet per repo)                                                                               |
| Disconnecting a repo also removes its pet and events                        | They can't exist without the repo. The user confirms first.                                                             |
| Pet view before any events: normal mood + "Listening for your first signal" | A fresh setup shouldn't look broken                                                                                     |

## In the extension

- The pet shows **only** on a GitHub repo that is connected **and** has a pet. Different repos show their own pets.
- On any other GitHub page: nothing, or the minimized bubble.
- Logged out: a sleeping fox bubble, "Log in to wake me up."
- Connected repo with no pet: "Pick a character in the dashboard."

## Stretch, in order

1. **Sleepy mood:** the fox falls asleep when a repo has been quiet for a while
2. **Combined activity log** on the dashboard, across all repos
3. **Roam mode:** the fox walks along the bottom of the page
