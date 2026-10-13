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

| Page                | Path                            | Who can see it | What it's for                                                                                          |
| ------------------- | ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| Log in              | `/login`                        | Logged out     | Log in. Logged-in users are sent to `/`.                                                               |
| Sign up             | `/signup`                       | Logged out     | Create an account (also logs you in).                                                                  |
| Dashboard           | `/`                             | Logged in      | One card per connected repo, with its pet and mood. Empty state for new users.                         |
| Connect a repo      | `/connect`                      | Logged in      | Enter `owner/repo-name`.                                                                               |
| Pick your character | `/repos/:repoId/pick-character` | Logged in      | Choose the kitsune and name it. A repo that already has a pet skips to its pet view.                   |
| Webhook setup       | `/repos/:repoId/webhook`        | Logged in      | Generate a secret, then copy the webhook URL and secret into GitHub. Can be reopened anytime.          |
| Pet view            | `/repos/:repoId`                | Logged in      | The pet, its mood, and the event log for one repo. A repo with no pet yet goes to pick your character. |
| Style guide         | `/styleguide`                   | Anyone         | Shows every shared component. For the team.                                                            |
| Not found           | anything else                   | Anyone         | A way back to the dashboard.                                                                           |

Logged-out visitors to a "Logged in" page are sent to `/login`.

## Navigation: every way out of every page

| Page                | Ways out                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header (every page) | Logo → `/` (or `/login` when logged out) · My repos → `/` · Log out → `/login`                                                                       |
| Log in / Sign up    | Link to each other · on success → `/`                                                                                                                |
| Dashboard           | "Connect a repo" → `/connect` · repo card: Open → pet view, Webhook setup → webhook setup, or pick a character if it has no pet                      |
| Connect a repo      | Cancel → `/` · Submit → pick your character                                                                                                          |
| Pick your character | Do this later → `/` · Create pet → webhook setup · already has a pet → straight to its pet view                                                      |
| Webhook setup       | Done → pet view · Skip for now → pet view · Generate webhook secret / Generate new secret (stays on the page)                                        |
| Pet view            | No back link of its own (the header has "My repos") · Rename · in the "Bound repository" panel: Webhook setup, Disconnect repo (confirm first) → `/` |
| Not found           | Back to my repos → `/`                                                                                                                               |

## Decisions and why

| Decision                                                                                              | Why                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/` is the dashboard, not a redirect into setup                                                       | People may want to look around before connecting anything                                                                  |
| Connect → Pick character → Webhook                                                                    | The fun part gets people invested before the fiddly part. The data model allows it: a pet only needs its repo to exist.    |
| Webhook setup can be reopened, with "Generate new secret"                                             | A refresh or a lost secret is never a dead end                                                                             |
| The webhook secret is only created when the user clicks "Generate webhook secret", never on page load | Each new secret replaces the old one. Creating one on every visit would silently break a webhook already set up in GitHub. |
| Several repos: one card each, each pet has its own event log                                          | Matches the data model (one pet per repo)                                                                                  |
| Disconnecting a repo also removes its pet and events                                                  | They can't exist without the repo. The user confirms first.                                                                |
| Pet view before any events: normal mood + "Listening for your first signal"                           | A fresh setup shouldn't look broken                                                                                        |

## In the extension

The fox on the GitHub page is the main way people use the product. Nobody should have to open the dashboard to find out what happened.

**Where it shows**

- **Only** on pages of a GitHub repo that is connected **and** has a pet. Different repos show their own pets.
- Connected repo with no pet: the "?" fox, with a "Pick a character" link to the dashboard.
- Logged out: a sleeping fox, "Log in to wake me up."
- Any other GitHub page, or a repo that isn't connected: nothing at all.

**What it does**

- It **sits** in the corner most of the time, showing its mood.
- Now and then it gets up, **walks across the page and back once**, and sits down again. A happy fox walks more often. A sick fox doesn't walk.
- When the **mood changes**, it takes a walk right away.
- When there is **news**, it says one short line with a "View" link to GitHub: a pull request merged, tests failed, or tests are passing again after a failure. It stays quiet about routine passing test runs. The bubble stays for 30 seconds (longer while the mouse rests on it) and each piece of news is told once.
- **Click the fox** for its card: name, mood, the last three things that happened, and a link to the dashboard.
- **Hide** shrinks it to a small face in the corner. News still shows above the face. Click the face to bring the fox back.

**The popup** (the extension's icon): log in, log out, and "Open dashboard".

## Stretch

- **Done:** roam mode. The fox walks along the bottom of the page.
- Not built: **sleepy mood** (the fox falls asleep when a repo has been quiet for a while), and a **combined activity log** on the dashboard across all repos.
