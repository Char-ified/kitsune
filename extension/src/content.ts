// Content script: runs on github.com pages and shows the pet roaming along the bottom. (CHA-22)
// It only draws. The background worker does the talking to our server.
import type { Mood } from '@kitsune/shared';
import { DASHBOARD_URL } from './config';
import type { ExtensionRequest, PetResponse } from './messages';
import { repoFromPath } from './repo';
import { WIDGET_CSS } from './widget.css';

// How often to ask for a fresh mood, and how often to check whether the page changed.
const REFRESH_MS = 30_000;
const URL_CHECK_MS = 1_000;
const MINIMIZED_KEY = 'widgetMinimized';

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
// What was last drawn, so a refresh with nothing new doesn't restart the fox's walk.
let drawn = '';

// Small helper for building elements without innerHTML. The pet's name is typed by
// a user, so it must only ever be inserted as text, never as HTML.
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

const link = (text: string, path: string) => {
  const a = el('a', '', text);
  a.href = `${DASHBOARD_URL}${path}`;
  a.target = '_blank';
  a.rel = 'noreferrer';
  return a;
};

const row = (...items: Node[]) => {
  const box = el('div', 'row');
  box.append(...items);
  return box;
};

const setMinimized = (value: boolean) => {
  minimized = value;
  cardOpen = false;
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

// What each state looks like: which sprite, whether the fox walks, and what its card says.
const describe = (pet: PetResponse): { file: string; classes: string; card: Node[] } | null => {
  switch (pet.state) {
    case 'pet':
      return {
        // A sick fox sits still. Otherwise it walks, and a happy one walks faster.
        file: pet.mood === 'sick' ? 'kitsune-sick.png' : 'kitsune-walking.png',
        classes: pet.mood === 'sick' ? 'sick' : `roaming ${pet.mood}`,
        card: [
          row(el('span', 'name', pet.name), el('span', `badge ${pet.mood}`, pet.mood)),
          meter(pet.mood),
          row(link('Dashboard', `/repos/${pet.repoId}`), hideButton()),
        ],
      };
    case 'noPet':
      return {
        file: 'kitsune-unknown.png',
        classes: '',
        card: [
          el('p', 'message', 'This repo has no guardian yet.'),
          row(link('Pick a character', `/repos/${pet.repoId}/pick-character`), hideButton()),
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

// Redraws the widget, but only when something it depends on has changed.
const render = () => {
  const next = JSON.stringify([current, minimized, cardOpen]);
  if (next === drawn) return;
  // Opening or closing the card must not send a walking fox back to the start,
  // so that case only swaps the card and leaves the fox element alone.
  const onlyCardChanged =
    drawn !== '' &&
    JSON.stringify([current, minimized]) === JSON.stringify(JSON.parse(drawn).slice(0, 2));
  drawn = next;

  const look = describe(current);

  if (onlyCardChanged && look && !minimized) {
    const walker = shadow.querySelector('.walker');
    if (walker) {
      walker.classList.toggle('open', cardOpen);
      walker.querySelector('.card')?.remove();
      if (cardOpen) {
        const card = el('div', 'card');
        card.append(...look.card);
        walker.prepend(card);
      }
      return;
    }
  }

  shadow.replaceChildren();
  if (!look) return;

  if (minimized) {
    const bubble = el('button', 'bubble');
    bubble.setAttribute('aria-label', 'Show your kitsune');
    bubble.append(sprite('', 'kitsune-face.png'));
    bubble.addEventListener('click', () => setMinimized(false));
    shadow.append(bubble);
    return;
  }

  const walker = el('div', `walker ${look.classes}`);
  walker.classList.toggle('open', cardOpen);

  if (cardOpen) {
    const card = el('div', 'card');
    card.append(...look.card);
    walker.append(card);
  }

  // Clicking the fox opens or closes its card.
  const foxButton = el('button', 'fox-button');
  foxButton.setAttribute('aria-label', 'Show or hide details about your kitsune');
  const facing = el('span', 'facing');
  facing.append(sprite('fox', look.file));
  foxButton.append(facing);
  foxButton.addEventListener('click', () => {
    cardOpen = !cardOpen;
    render();
  });

  walker.append(foxButton);
  shadow.append(walker);
};

// Asks the background worker what to show for the repo this page belongs to.
const refresh = async () => {
  const fullName = repoFromPath(location.pathname);

  if (!fullName) {
    current = { state: 'notConnected' };
    render();
    return;
  }

  const request: ExtensionRequest = { type: 'getPet', fullName };
  const response: PetResponse = await chrome.runtime.sendMessage(request);

  // If the server couldn't be reached, keep showing the last thing we knew.
  if (response.state !== 'error') current = response;
  render();
};

const start = async () => {
  const stored = await chrome.storage.local.get(MINIMIZED_KEY);
  minimized = stored[MINIMIZED_KEY] === true;

  document.body.append(host);
  refresh();

  // Keep the mood fresh.
  setInterval(refresh, REFRESH_MS);

  // GitHub swaps pages without a full reload, so watch for the address changing.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      cardOpen = false;
      refresh();
    }
  }, URL_CHECK_MS);

  // Logging in or out from the popup changes the stored token: update right away.
  chrome.storage.onChanged.addListener((changes) => {
    if ('token' in changes) refresh();
  });
};

start();
