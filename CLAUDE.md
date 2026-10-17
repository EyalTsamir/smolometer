# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ה0מאלנומטר ("Smolometer") — a short satirical Hebrew quiz that "measures how left-wing you are" and shows the result on an animated gauge. It is a plain static site: vanilla HTML/CSS/JS, no framework, no build step, no `package.json`, no tests, no linter. The page is Hebrew, `dir="rtl"`. It is meant to be served from GitHub Pages at `https://eyaltsamir.github.io/smolometer/`.

## Running it

```sh
python3 -m http.server 8000   # then open http://localhost:8000/
```

Opening `index.html` directly over `file://` also works (scripts are classic, not modules, and the History API calls fall back silently).

Useful query params:
- `?preview=85` — jump straight to the result screen at 85% (for working on result design/copy without answering).
- `?s=85` — what a recipient of a shared link sees: a "the sender got 85%" challenge banner on the intro screen.

Both are stripped from the URL on the first in-app navigation. Verification is manual in a browser; the browser console logs a note when answers are missing `score` values.

## Architecture

**Content vs. mechanics.** `js/quiz-data.js` assigns `window.QUIZ = { questions, results, loading }` and holds all copy and scoring; its header comment documents every field (`text`, `note`, `image`/`imageAlt`/`imagePosition`, `score`). `js/app.js` is a single IIFE that reads `window.QUIZ` and contains no quiz copy, so it must load after `quiz-data.js`. Changes to questions, answers, scores, or result tiers belong in `quiz-data.js` only.

**Scoring.** The result is a percentage normalized between the lowest and highest sum attainable across all questions (`computePercent`), so a question with a wider score range weighs more. `score: null` counts as 0; if no answer has a score, everyone gets 50%. `results` tiers are sorted by `from` and the tier is the last one with `from <= pct`. Each tier's `color` also paints that tier's segment of the gauge.

**Screens and navigation.** Four `<section class="screen">` elements in `index.html` (intro, quiz, loading, result). `setView()` toggles their `hidden` attribute and sets `body[data-view]`; CSS keys page-level styling off `body[data-view]`, `body[data-accent]` (rotates through the palette per question), and the `--tier` custom property on the result screen. Every question is a `history.pushState` entry `{view, index, depth}`, so the browser/phone back button steps back one question; `popstate` re-renders, and a page refresh resumes from `history.state`. Answers are persisted in `sessionStorage` under `smolometer:answers`. The loading ("measuring") screen is not a history entry; it only runs between the last answer and the result.

**Timers and animation loops.** `render()` calls `clearTimers()`, which cancels pending `later()` timeouts and bumps `runId` so any `loop()` requestAnimationFrame loop from the previous screen stops on its own. Screen-scoped timeouts and rAF loops must go through `later()`/`loop()` so they are cancelled when the screen changes.

**Generated SVG.** The gauge (`buildGauge`, built twice: loading screen without labels, result screen with labels) and the rotating stamp text on the intro are generated in JS. Gauge orientation is the joke: 0% points right (ימין), 100% points left (שמאל); needle angle is `pct * 1.8` degrees.

**Reduced motion.** `prefers-reduced-motion` is honored in JS (skips the measuring screen, needle spring, sparks, and confetti; shortens the answer delay) as well as in the CSS kill-switch at the end of `style.css`. Keep both in sync when adding motion.

## Things that are easy to miss

- The question count is set from the data at runtime (`#q-count`, progress `aria-valuemax`), but the hard-coded "9" in `og:description` and the initial `1/9` / `aria-valuemax="9"` in `index.html` must be edited by hand if the number of questions changes.
- `og:url` and `og:image` are absolute GitHub Pages URLs; update them if the site address changes.
- The intro collage photos (`images/aloni.jpg`, `peres.jpg`, `rabin.jpg`) and their names are hard-coded in `index.html`, separately from optional per-question `image` stickers in `quiz-data.js`.
- Current state (per the first commit, "שלב 1"): all `score` values are still `null`, and the `results` titles/texts are marked as temporary placeholders.

## Conventions

- Code comments, UI copy, and commit messages are in Hebrew. UI copy uses gender-inclusive dot forms (`את.ה`, `שמאלני.ת`) and the brand spelling "0מאל" (zero for ש); keep both.
- Visual language (see the header of `css/style.css`): cream paper, dark ink, thick outlines, flat offset shadows that fall to the bottom-left because light "comes from the right" in an RTL site, hence the negative x offsets in `--shadow*`. Colors and shadows are tokens on `:root`; use them rather than raw values. Fonts are Fredoka (display), Rubik (body), and Amatic SC (handwritten), loaded from Google Fonts.
