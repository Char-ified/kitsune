// The widget's styles, kept as a string because they go inside a shadow root
// (see content.ts). Same night palette as the dashboard and the popup.
export const WIDGET_CSS = `
/* The host is an invisible strip along the bottom of the page. Clicks pass straight
   through it to GitHub; only the fox, its card, and the bubble can be clicked. */
:host {
  all: initial;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #e8e6e3;
}

[hidden] {
  display: none !important;
}

/* ---------- The fox ---------- */

/* The walker is what moves along the page. By default it rests near the right edge. */
.walker {
  position: absolute;
  bottom: 6px;
  left: calc(100% - 128px);
  width: 64px;
  pointer-events: auto;
}

/* Roaming: slide from the left side to the right side and back, forever.
   The ends are kept away from the edges so the card always fits on screen. */
.walker.roaming {
  animation: roam var(--lap, 50s) linear infinite;
}

@keyframes roam {
  0%,
  100% {
    left: 64px;
  }
  50% {
    left: calc(100% - 128px);
  }
}

/* The fox turns around at each end. Same length as roam, so they stay in step. */
.walker.roaming .facing {
  animation: face var(--lap, 50s) step-end infinite;
}

@keyframes face {
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(-1);
  }
}

/* A little two-frame hop, like a sprite in an old game. */
.walker.roaming .fox {
  animation: hop var(--hop, 0.7s) steps(2, jump-none) infinite;
}

@keyframes hop {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

/* A happy fox moves faster. */
.walker.happy {
  --lap: 32s;
  --hop: 0.45s;
}

/* Stop moving while the mouse is over the fox or its card is open, so it can be clicked. */
.walker:hover,
.walker:hover .facing,
.walker:hover .fox,
.walker.open,
.walker.open .facing,
.walker.open .fox {
  animation-play-state: paused;
}

.fox-button {
  display: block;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}

.facing {
  display: block;
}

.fox {
  display: block;
  width: 64px;
  height: 64px;
  /* The sprites aren't all the same shape, so fit each one in the box without
  stretching it, standing on the bottom edge. */
  object-fit: contain;
  object-position: bottom;
  image-rendering: pixelated;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5));
}

/* People who ask their computer for less motion get a fox that sits still. */
@media (prefers-reduced-motion: reduce) {
  .walker.roaming,
  .walker.roaming .facing,
  .walker.roaming .fox {
    animation: none;
  }
}

/* ---------- The card that opens above the fox ---------- */

.card {
  position: absolute;
  bottom: 72px;
  left: 50%;
  width: 176px;
  margin-left: -88px;
  box-sizing: border-box;
  padding: 10px;
  background: #1a1f33;
  border: 2px solid #2c3350;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.name {
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  flex-shrink: 0;
  padding: 1px 5px;
  border: 2px solid currentColor;
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
}

.meter {
  display: flex;
  gap: 2px;
  margin: 8px 0;
}

.segment {
  flex: 1;
  height: 6px;
  background: #2c3350;
}

.segment.filled {
  background: currentColor;
}

.badge.happy,
.meter.happy {
  color: #4fb89a;
}

.badge.normal,
.meter.normal {
  color: #f2b544;
}

.badge.sick,
.meter.sick {
  color: #e8452c;
}

.message {
  margin: 0 0 8px;
  color: #9aa0b5;
  line-height: 1.4;
}

a {
  color: #f2b544;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.text-button {
  padding: 0;
  background: none;
  border: none;
  color: #9aa0b5;
  font: inherit;
  cursor: pointer;
}

.text-button:hover {
  color: #e8e6e3;
}

/* ---------- The small square the fox hides in ---------- */

.bubble {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  padding: 0;
  background: #1a1f33;
  border: 2px solid #2c3350;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  pointer-events: auto;
}

.bubble img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  image-rendering: pixelated;
}
`;
