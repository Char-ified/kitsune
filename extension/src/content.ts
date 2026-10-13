// Content script: runs on github.com pages and shows the pet in the corner. It sits most
// of the time, gets up for a walk now and then, and speaks up when something happens
// in the repo. (CHA-22, CHA-45)
// It only draws. The background worker does the talking to our server.
import type { Mood, RepoEvent } from '@kitsune/shared';
import { DASHBOARD_URL } from './config';
import type { ExtensionRequest, PetResponse } from './messages';
import { repoFromPath } from './repo';
import { describeEvent, eventToAnnounce } from './speech';
import { shouldStroll } from './stroll';
import { WIDGET_CSS } from './widget.css';

// How often to ask for fresh news, and how often to check whether the page changed.
const REFRESH_MS = 30_000;
const URL_CHECK_MS = 1_000;
const STROLL_CHECK_MS = 5_000;
// How long a speech bubble stays up: long enough to notice, read, and decide.
const SPEECH_MS = 30_000;
// After the mouse leaves a bubble it was resting on, how much longer it stays.
const SPEECH_LINGER_MS = 8_000;

const MINIMIZED_KEY = 'widgetMinimized';
// When the last walk started. Kept in storage so opening a new page doesn't set off a walk.
const LAST_STROLL_KEY = 'lastStrollAt';
// The newest event already announced for each repo, so news is only told once.
const SEEN_KEY = 'seenEvents';

const TOTAL_SEGMENTS = 20;
const FILLED_SEGMENTS: Record<Mood, number> = { happy: 20, normal: 10, sick: 4 };

const image = (file: string) => chrome.runtime.getURL(file);

// The widget lives in a shadow root: GitHub's CSS can't leak in and restyle it,
// and our CSS can't leak out and break GitHub.
const host = document.createElement('div');
const shadow = host.attachShadow({ mode: 'open' });
const styles = new CSSStyleSheet();
styles.replaceSync(WIDGET_CSS);
shadow.adoptedStyleSheets = [styles];

// Everything the widget's look depends on.
let current: PetResponse = { state: 'notConnected' };
let minimized = false;
let cardOpen = false;
let walking = false;
// The event the fox is talking about right now, if any.
let speaking: RepoEvent | null = null;
let speechTimer: ReturnType<typeof setTimeout> | undefined;

// What is on screen now. The fox and what floats above it (speech or card) are tracked
// separately, so changing the bubble never restarts a walk.
let drawnFox = '';
let drawnOverlay = '';

// People who ask their computer for less motion get a fox that never walks.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Small helper for building elements without innerHTML. Pet names and pull request
// titles are typed by people, so text must only ever be inserted as text, never as HTML.
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const sprite = (className: string, file: string) => {
  const img = el('img', className);
  img.src = image(file);
  img.alt = '';
  return img;
};

const link = (text: string, url: string, className = '') => {
  const a = el('a', className, text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noreferrer';
  return a;
};

const dashboardLink = (text: string, path: string) => link(text, `${DASHBOARD_URL}${path}`);

const row = (...items: Node[]) => {
  const box = el('div', 'row');
  box.append(...items);
  return box;
};

const setMinimized = (value: boolean) => {
  minimized = value;
  cardOpen = false;
  walking = false;
  chrome.storage.local.set({ [MINIMIZED_KEY]: value });
  render();
};

const hideButton = () => {
  const button = el('button', 'text-button', 'Hide');
  button.addEventListener('click', () => setMinimized(true));
  return button;
};

const meter = (mood: Mood) => {
  const bar = el('div', `meter ${mood}`);
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `Mood: ${mood}`);
  for (let i = 0; i < TOTAL_SEGMENTS; i++) {
    bar.append(el('span', i < FILLED_SEGMENTS[mood] ? 'segment filled' : 'segment'));
  }
  return bar;
};

// The last few events, right in the card, so nobody has to open the dashboard for them.
const miniLog = (events: RepoEvent[]) => {
  const list = el('ul', 'log');
  for (const event of events) {
    const line = describeEvent(event);
    const item = el('li', `log-item ${event.type}`);
    item.append(line.url ? link(line.text, line.url) : el('span', '', line.text));
    list.append(item);
  }
  return list;
};

// Speech

const readSeen = async (): Promise<Record<string, number>> => {
  const stored = await chrome.storage.local.get(SEEN_KEY);
  const seen: unknown = stored[SEEN_KEY];
  return typeof seen === 'object' && seen !== null ? (seen as Record<string, number>) : {};
};

// The user has seen (or dismissed) what the fox was saying: remember it and go quiet.
const finishSpeaking = async () => {
  clearTimeout(speechTimer);
  if (!speaking || current.state !== 'pet') return;

  const seen = await readSeen();
  await chrome.storage.local.set({ [SEEN_KEY]: { ...seen, [current.repoId]: speaking.id } });
  speaking = null;
  render();
};

const quietAfter = (ms: number) => {
  clearTimeout(speechTimer);
  speechTimer = setTimeout(finishSpeaking, ms);
};

// Decides whether there is news to tell, and starts or stops talking to match.
const updateSpeech = async () => {
  if (current.state !== 'pet') {
    clearTimeout(speechTimer);
    speaking = null;
    return;
  }

  const seen = await readSeen();
  const lastSeenId = seen[current.repoId] ?? null;
  const next = eventToAnnounce(current.events, lastSeenId, Date.now());

  if (!next) {
    clearTimeout(speechTimer);
    speaking = null;
  } else if (speaking?.id !== next.id) {
    speaking = next;
    quietAfter(SPEECH_MS);
  }
};

const speechBubble = (event: RepoEvent) => {
  const line = describeEvent(event);
  const bubble = el('div', `speech ${event.type}`);
  bubble.setAttribute('role', 'status');
  bubble.append(el('span', 'speech-text', line.text));

  if (line.url) {
    const view = link('View', line.url, 'speech-link');
    view.addEventListener('click', finishSpeaking);
    bubble.append(view);
  }

  const close = el('button', 'speech-close', '×');
  close.setAttribute('aria-label', 'Dismiss');
  close.addEventListener('click', finishSpeaking);
  bubble.append(close, el('span', 'speech-tail'));

  // Resting the mouse on the bubble keeps it open while you read.
  bubble.addEventListener('mouseenter', () => clearTimeout(speechTimer));
  bubble.addEventListener('mouseleave', () => quietAfter(SPEECH_LINGER_MS));
  return bubble;
};

// Drawing

// What each state looks like: which sprite, its CSS classes, and what its card says.
const describe = (pet: PetResponse): { file: string; classes: string; card: Node[] } | null => {
  switch (pet.state) {
    case 'pet':
      return {
        // Sitting shows the mood's own sprite. Walking swaps to the side-view sprite.
        file: walking ? 'kitsune-walking.png' : `kitsune-${pet.mood}.png`,
        classes: walking ? `roaming ${pet.mood}` : pet.mood,
        card: [
          row(el('span', 'name', pet.name), el('span', `badge ${pet.mood}`, pet.mood)),
          meter(pet.mood),
          ...(pet.events.length > 0 ? [miniLog(pet.events)] : []),
          row(dashboardLink('Dashboard', `/repos/${pet.repoId}`), hideButton()),
        ],
      };
    case 'noPet':
      return {
        file: 'kitsune-unknown.png',
        classes: '',
        card: [
          el('p', 'message', 'This repo has no guardian yet.'),
          row(
            dashboardLink('Pick a character', `/repos/${pet.repoId}/pick-character`),
            hideButton(),
          ),
        ],
      };
    case 'loggedOut':
      return {
        file: 'kitsune-sleeping.png',
        classes: '',
        card: [
          el('p', 'message', 'Log in to wake me up. Click the Kitsune icon in your toolbar.'),
          row(el('span', ''), hideButton()),
        ],
      };
    default:
      // Not a connected repo: stay out of the way entirely.
      return null;
  }
};

// Draws the fox itself: walking or sitting in the corner, or hidden behind its face.
const drawFox = (look: { file: string; classes: string }) => {
  shadow.replaceChildren();

  if (minimized) {
    const corner = el('div', 'corner');
    const face = el('button', 'bubble');
    face.setAttribute('aria-label', 'Show your kitsune');
    face.append(sprite('', 'kitsune-face.png'));
    face.addEventListener('click', () => setMinimized(false));
    corner.append(el('div', 'overlay'), face);
    shadow.append(corner);
    return;
  }

  const walker = el('div', `walker ${look.classes}`);

  // Clicking the fox opens or closes its card. Opening it counts as seeing the news.
  const foxButton = el('button', 'fox-button');
  foxButton.setAttribute('aria-label', 'Show or hide details about your kitsune');
  const facing = el('span', 'facing');
  facing.append(sprite('fox', look.file));
  foxButton.append(facing);
  foxButton.addEventListener('click', () => {
    cardOpen = !cardOpen;
    if (cardOpen) finishSpeaking();
    render();
  });

  // When the walk is over the fox sits back down.
  walker.addEventListener('animationend', (event) => {
    if (event.animationName === 'roam') {
      walking = false;
      render();
    }
  });

  walker.append(el('div', 'overlay'), foxButton);
  shadow.append(walker);
};

// Draws what floats above the fox: its card if open, otherwise whatever it's saying.
const drawOverlay = (card: Node[]) => {
  const overlay = shadow.querySelector('.overlay');
  if (!overlay) return;

  shadow.querySelector('.walker')?.classList.toggle('open', cardOpen);

  if (cardOpen && !minimized) {
    const box = el('div', 'card');
    box.append(...card);
    overlay.replaceChildren(box);
  } else if (speaking) {
    overlay.replaceChildren(speechBubble(speaking));
  } else {
    overlay.replaceChildren();
  }
};

// Redraws only the parts that changed.
const render = () => {
  const look = describe(current);

  if (!look) {
    shadow.replaceChildren();
    drawnFox = '';
    drawnOverlay = '';
    return;
  }

  // The fox is rebuilt only when its own look changes, because rebuilding restarts a walk.
  const fox = JSON.stringify([look.file, look.classes, minimized]);
  if (fox !== drawnFox) {
    drawFox(look);
    drawnFox = fox;
    drawnOverlay = '';
  }

  const overlay = JSON.stringify([current, cardOpen, speaking?.id ?? null]);
  if (overlay !== drawnOverlay) {
    drawOverlay(look.card);
    drawnOverlay = overlay;
  }
};

// Walking

// Sends the fox on one walk across the page and back.
const startStroll = () => {
  if (walking || minimized || reducedMotion.matches) return;
  if (current.state !== 'pet' || current.mood === 'sick') return;

  walking = true;
  chrome.storage.local.set({ [LAST_STROLL_KEY]: Date.now() });
  render();
};

// Runs every few seconds: has the fox rested long enough to go for another walk?
const maybeStroll = async () => {
  if (current.state !== 'pet' || cardOpen) return;

  const stored = await chrome.storage.local.get(LAST_STROLL_KEY);
  const last: unknown = stored[LAST_STROLL_KEY];
  const lastStrollAt = typeof last === 'number' ? last : null;

  if (shouldStroll(current.mood, lastStrollAt, Date.now())) startStroll();
};

// Keeping up to date

// Puts the widget on the page. It goes on <html>, not <body>: when you click around,
// GitHub swaps in a whole new <body>, which would take the fox away with it.
const attach = () => {
  if (!host.isConnected) document.documentElement.append(host);
};

// Asks the background worker what to show for the repo this page belongs to.
const refresh = async () => {
  const fullName = repoFromPath(location.pathname);

  if (!fullName) {
    current = { state: 'notConnected' };
    walking = false;
    await updateSpeech();
    render();
    return;
  }

  const request: ExtensionRequest = { type: 'getPet', fullName };
  const response: PetResponse = await chrome.runtime.sendMessage(request);

  // If the server couldn't be reached, keep showing the last thing we knew.
  if (response.state === 'error') return;

  const moodBefore = current.state === 'pet' ? current.mood : null;
  const firstLook = current.state !== 'pet';
  current = response;

  // A fox that just got sick stops where it is and sits down.
  if (current.state !== 'pet' || current.mood === 'sick') walking = false;
  await updateSpeech();
  render();

  // Something happened in the repo: the mood changed, so get up and take a lap.
  if (current.state === 'pet' && !firstLook && current.mood !== moodBefore) startStroll();
};

const start = async () => {
  const stored = await chrome.storage.local.get(MINIMIZED_KEY);
  minimized = stored[MINIMIZED_KEY] === true;

  attach();
  refresh();

  // Keep the mood and the news fresh.
  setInterval(refresh, REFRESH_MS);

  // Every so often, see whether it's time for a walk.
  setInterval(maybeStroll, STROLL_CHECK_MS);

  // GitHub swaps pages without a full reload, so watch for the address changing.
  let lastPath = location.pathname;
  setInterval(() => {
    // Belt and braces: if anything ever removes the widget, put it back.
    attach();

    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      cardOpen = false;
      refresh();
    }
  }, URL_CHECK_MS);

  chrome.storage.onChanged.addListener(async (changes) => {
    // Logging in or out from the popup changes the stored token: update right away.
    if ('token' in changes) refresh();

    // The news was read in another tab: stop repeating it in this one.
    if (SEEN_KEY in changes) {
      await updateSpeech();
      render();
    }
  });
};

start();
