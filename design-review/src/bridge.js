/* גשר בין המעבדה לאתר: מדליק/מכבה הצעות ומנווט בין מסכים */
(function () {
  "use strict";
  const S = window.__smolo;
  if (!S) return;
  const root = document.documentElement;
  const active = new Set();
  const lab = { challengePct: null, suppressScroll: 0 };
  const PEACE =
    '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21"/><path d="M24 3v42M24 24 9.2 38.8M24 24l14.8 14.8"/></svg>';
  const PALETTE = ["#FF7A5C", "#FFC847", "#45CFA0", "#6BAEFF", "#AE96FF", "#FF8DBE"];
  const LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];
  const startLabel = S.el.start.querySelector("span");
  const startOrig = startLabel.textContent;

  /* ---------- G2: ה־0 כסמל שלום ---------- */
  const ZERO_SPLIT = /0(?=[א-ת])/;
  function wrapZeros() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest("svg, script, style, noscript, .zero-glyph, .sr-only, #result-pct")) return NodeFilter.FILTER_REJECT;
        return ZERO_SPLIT.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const parts = n.nodeValue.split(ZERO_SPLIT);
      const frag = document.createDocumentFragment();
      parts.forEach((part, i) => {
        if (i > 0) {
          const s = document.createElement("span");
          s.className = "zero-glyph";
          s.innerHTML = '<span class="sr-only">0</span>' + PEACE;
          frag.append(s);
        }
        if (part) frag.append(part);
      });
      n.replaceWith(frag);
    }
  }
  function unwrapZeros() {
    document.querySelectorAll(".zero-glyph").forEach((s) => {
      const parent = s.parentNode;
      s.replaceWith("0");
      if (parent) parent.normalize();
    });
  }
  let zeroQueued = false;
  new MutationObserver((list) => {
    if (!active.has("zero") || zeroQueued) return;
    if (list.every((m) => m.target.id === "result-pct" || (m.target.parentElement && m.target.parentElement.id === "result-pct"))) return;
    zeroQueued = true;
    queueMicrotask(() => {
      zeroQueued = false;
      wrapZeros();
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  /* ---------- I5: חותמת עם ריווח לפי רוחב האותיות ---------- */
  function buildStampProportional() {
    const svg = S.el.stampRing;
    const NS = "http://www.w3.org/2000/svg";
    const chars = Array.from("מדע מדויק ✦ בערך ✦ ".repeat(2)).map((c) => (c === " " ? " " : c));
    svg.replaceChildren();
    const widths = chars.map((ch) => {
      const t = document.createElementNS(NS, "text");
      t.textContent = ch;
      svg.append(t);
      const w = t.getComputedTextLength() || 7;
      t.remove();
      return ch === " " ? w * 1.15 : w;
    });
    const sum = widths.reduce((a, b) => a + b, 0);
    let acc = 0;
    svg.innerHTML = chars
      .map((ch, k) => {
        const mid = acc + widths[k] / 2;
        acc += widths[k];
        const ang = -(mid / sum) * 360;
        return `<text x="60" y="17.5" text-anchor="middle" transform="rotate(${ang.toFixed(2)} 60 60)">${ch}</text>`;
      })
      .join("");
  }

  /* ---------- I6: כרטיס אתגר ---------- */
  function renderChallenge() {
    if (lab.challengePct == null) {
      startLabel.textContent = startOrig;
      return;
    }
    const pct = lab.challengePct;
    const tier = S.tierFor(pct);
    if (active.has("challenge")) {
      const box = S.el.challenge;
      box.replaceChildren();
      const badge = document.createElement("span");
      badge.className = "ch-pct";
      badge.textContent = `${pct}%`;
      const text = document.createElement("span");
      text.className = "ch-text";
      const b = document.createElement("b");
      b.textContent = `״${tier.title}״`;
      const turn = document.createElement("span");
      turn.className = "ch-turn";
      turn.textContent = "עכשיו תורך לעקוף.";
      text.append("זה מה שיצא למי ששלח.ה לך את הקישור: ", b, ".", turn);
      box.append(badge, text);
      box.hidden = false;
      startLabel.textContent = "יאללה, מודדים ומשווים";
    } else {
      S.setupChallenge(new URLSearchParams("s=" + pct));
      startLabel.textContent = startOrig;
    }
  }

  /* ---------- Q3: סרגל מקוטע ---------- */
  function syncSegments() {
    const prog = S.el.progress;
    let segs = prog.querySelectorAll(".pseg");
    if (!active.has("pseg")) {
      segs.forEach((s) => s.remove());
      return;
    }
    if (segs.length !== S.total) {
      segs.forEach((s) => s.remove());
      for (let i = 0; i < S.total; i++) {
        const s = document.createElement("span");
        s.className = "pseg";
        s.style.setProperty("--c", PALETTE[i % PALETTE.length]);
        prog.append(s);
      }
      segs = prog.querySelectorAll(".pseg");
    }
    const cur = Number(prog.getAttribute("aria-valuenow")) - 1;
    segs.forEach((s, i) => {
      s.classList.toggle("is-done", i < cur);
      s.classList.toggle("is-current", i === cur);
    });
  }
  new MutationObserver(syncSegments).observe(S.el.progress, { attributes: true, attributeFilter: ["aria-valuenow"] });

  /* ---------- Q6: מקשי אותיות ---------- */
  const hint = document.querySelector(".quiz__hint");
  const hintOrig = hint ? hint.textContent : "";
  document.addEventListener("keydown", (e) => {
    if (!active.has("keys") || S.state.view !== "quiz" || e.altKey || e.ctrlKey || e.metaKey) return;
    const i = LETTERS.indexOf(e.key);
    const buttons = S.el.answers.querySelectorAll(".answer");
    if (i >= 0 && i < buttons.length) {
      e.preventDefault();
      buttons[i].click();
    }
  });

  /* ---------- R1: תווית היחידות מתחת לציר ---------- */
  const HOUSING = "M10 180A170 170 0 0 1 350 180V200Q350 208 342 208H18Q10 208 10 200Z";
  const HOUSING_TALL = "M10 180A170 170 0 0 1 350 180V213Q350 221 342 221H18Q10 221 10 213Z";
  function unitFix(on) {
    const svg = S.el.resultGauge;
    svg.querySelectorAll(".g-shadow, .g-housing").forEach((p) => p.setAttribute("d", on ? HOUSING_TALL : HOUSING));
    svg.setAttribute("viewBox", on ? "-4 4 368 227" : "-4 4 368 214");
    const unit = svg.querySelector(".g-unit");
    if (unit) unit.setAttribute("y", on ? "213" : "142");
    svg.querySelectorAll(".g-end").forEach((t) => t.setAttribute("y", on ? "213" : "201"));
  }

  /* ---------- R4: קריאה לשיתוף ---------- */
  const shareLabel = document.querySelector(".share__label");
  const shareOrig = shareLabel.textContent;

  const HOOKS = {
    zero: { on: wrapZeros, off: unwrapZeros },
    stamp: {
      on: () => document.fonts.ready.then(() => active.has("stamp") && buildStampProportional()),
      off: () => S.buildStamp(),
    },
    challenge: { on: renderChallenge, off: renderChallenge },
    pseg: { on: syncSegments, off: syncSegments },
    keys: {
      on: () => hint && (hint.textContent = "אפשר לענות גם מהמקלדת: באותיות (א, ב, ג…) או במספרים"),
      off: () => hint && (hint.textContent = hintOrig),
    },
    unit: { on: () => unitFix(true), off: () => unitFix(false) },
    sharecopy: {
      on: () => (shareLabel.textContent = "שלחו לקבוצה ותראו מי יותר 0מאלני.ת"),
      off: () => (shareLabel.textContent = shareOrig),
    },
  };

  function setPatches(classes, hooks) {
    [...root.classList].filter((c) => c.startsWith("p-") && !classes.includes(c)).forEach((c) => root.classList.remove(c));
    classes.forEach((c) => root.classList.add(c));
    for (const name of Object.keys(HOOKS)) {
      const want = hooks.includes(name);
      if (want === active.has(name)) continue;
      if (want) active.add(name);
      else active.delete(name);
      HOOKS[name][want ? "on" : "off"]();
    }
  }

  function goto(o) {
    S.el.challenge.hidden = true;
    lab.challengePct = null;
    renderChallenge();
    switch (o.screen) {
      case "challenge":
        lab.challengePct = o.pct;
        renderChallenge();
        S.render({ view: "intro" });
        break;
      case "quiz":
        S.render({ view: "quiz", index: o.q }, { direction: "next" });
        break;
      case "selected": {
        S.render({ view: "quiz", index: o.q }, { direction: "next" });
        const b = S.el.answers.querySelectorAll(".answer")[o.a];
        if (b) {
          b.classList.add("is-selected");
          b.setAttribute("aria-pressed", "true");
          S.el.answers.classList.add("is-locked");
        }
        break;
      }
      case "loading":
        S.clearTimers();
        S.runMeasuring(() => {});
        break;
      case "result":
        S.render({ view: "result", preview: o.pct });
        break;
      default:
        S.render({ view: "intro" });
    }
    syncSegments();
    if (active.has("zero")) wrapZeros();
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data || !e.data.lab) return;
    const d = e.data;
    if (d.cmd === "patches") setPatches(d.classes || [], d.hooks || []);
    if (d.cmd === "goto") goto(d);
    if (d.cmd === "scroll") {
      lab.suppressScroll = performance.now() + 150;
      window.scrollTo(0, d.y);
    }
  });

  let scrollQueued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (performance.now() < lab.suppressScroll || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        window.parent.postMessage({ lab: 1, scroll: window.scrollY }, "*");
      });
    },
    { passive: true }
  );

  window.parent.postMessage({ lab: 1, ready: true }, "*");
})();
