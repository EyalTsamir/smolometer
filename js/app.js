/* =================================================================
   ה0מאלנומטר — מכניקה
   התוכן עצמו (שאלות, ציונים, תוצאות) נמצא ב־quiz-data.js
   ================================================================= */
(() => {
  "use strict";

  const QUIZ = window.QUIZ;
  const questions = QUIZ.questions;
  const total = questions.length;
  const tiers = [...QUIZ.results].sort((a, b) => a.from - b.from);

  const LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];
  const ACCENTS = ["coral", "sun", "mint", "sky", "lilac", "pink"];
  const PALETTE = ["#FF7A5C", "#FFC847", "#45CFA0", "#6BAEFF", "#AE96FF", "#FF8DBE"];
  const INK = "#241B3B";
  const STORE_KEY = "smolometer:answers";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const $ = (sel) => document.querySelector(sel);
  const el = {
    topbar: $("#topbar"),
    screens: {
      intro: $("#screen-intro"),
      quiz: $("#screen-quiz"),
      loading: $("#screen-loading"),
      result: $("#screen-result"),
    },
    qCount: $("#q-count"),
    challenge: $("#challenge"),
    stampRing: $("#stamp-ring"),
    start: $("#start-btn"),
    back: $("#back-btn"),
    progress: $("#progress"),
    progressFill: $("#progress-fill"),
    progressCount: $("#progress-count"),
    qcard: $("#qcard"),
    qTag: $("#q-tag"),
    qSticker: $("#q-sticker"),
    qImage: $("#q-image"),
    qTitle: $("#q-title"),
    answers: $("#answers"),
    loadingGauge: $("#loading-gauge"),
    loadingLine: $("#loading-line"),
    rcard: $("#rcard"),
    gauge: $("#gauge"),
    resultGauge: $("#result-gauge"),
    resultPct: $("#result-pct"),
    resultTitle: $("#result-title"),
    resultText: $("#result-text"),
    shareWa: $("#share-wa"),
    shareCopy: $("#share-copy"),
    shareNative: $("#share-native"),
    restart: $("#restart-btn"),
    toast: $("#toast"),
  };

  const state = {
    view: "intro",
    index: 0,
    answers: loadAnswers(),
    locked: false,
    share: null,
  };

  let resultNeedle;
  let loadingNeedle;

  /* ---------------- טיימרים ולולאות אנימציה ---------------- */

  let timers = [];
  let runId = 0; // מתחלף בכל מעבר מסך, ולולאות ישנות עוצרות מעצמן

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    runId++;
  }
  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }
  function loop(fn) {
    const id = runId;
    const tick = (now) => {
      if (id !== runId) return;
      if (fn(now) !== false) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- שמירת תשובות (נשמרות רק ללשונית הנוכחית) ---------------- */

  function loadAnswers() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }
  function saveAnswers() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state.answers));
    } catch {
      /* גלישה פרטית וכו׳ — מסתדרים בלי */
    }
  }

  /* ---------------- ניקוד ---------------- */

  const clampPct = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
  const scoreOf = (answer) => (typeof answer.score === "number" && Number.isFinite(answer.score) ? answer.score : 0);

  // 0% = הסכום הנמוך ביותר שאפשר לצבור, 100% = הגבוה ביותר
  function computePercent(answers) {
    let min = 0;
    let max = 0;
    let got = 0;
    questions.forEach((q, i) => {
      const scores = q.answers.map(scoreOf);
      min += Math.min(...scores);
      max += Math.max(...scores);
      got += scores[answers[i]] ?? 0;
    });
    if (max === min) return 50; // עוד אין ציונים — כולם באמצע
    return clampPct(((got - min) / (max - min)) * 100);
  }

  function tierFor(pct) {
    let tier = tiers[0];
    for (const t of tiers) if (pct >= t.from) tier = t;
    return tier;
  }

  const isAnswered = (i) =>
    Number.isInteger(state.answers[i]) && state.answers[i] >= 0 && state.answers[i] < questions[i].answers.length;

  function firstUnanswered() {
    for (let i = 0; i < total; i++) if (!isAnswered(i)) return i;
    return -1;
  }

  function warnMissingScores() {
    const all = questions.flatMap((q) => q.answers);
    const missing = all.filter((a) => typeof a.score !== "number").length;
    if (missing === all.length) {
      console.info("ה0מאלנומטר: עוד אין ציונים (score) — כל מי שעונה יוצא.ת 50%. לתצוגה מקדימה של תוצאה: ?preview=85");
    } else if (missing) {
      console.info(`ה0מאלנומטר: ל־${missing} תשובות עוד אין ציון (score), והן נספרות כ־0.`);
    }
  }

  /* ---------------- ניווט ---------------- */
  // כל שאלה נכנסת להיסטוריה של הדפדפן, כך שכפתור "אחורה" (גם בטלפון)
  // חוזר שאלה אחת אחורה במקום לצאת מהאתר.

  function writeHistory(method, entry, url) {
    try {
      history[method](entry, "", url);
    } catch {
      try {
        history[method](entry, "");
      } catch {
        /* בלי היסטוריה (file://, מסגרות מוגבלות) — האתר עדיין עובד */
      }
    }
  }

  function navigate(entry, opts = {}) {
    const depth = (history.state && history.state.depth) || 0;
    const next = { ...entry, depth: opts.replace ? depth : depth + 1 };
    const url = location.search ? location.pathname : undefined; // מנקים ?s= / ?preview=
    writeHistory(opts.replace ? "replaceState" : "pushState", next, url);
    render(next, opts);
  }

  function render(entry, opts = {}) {
    clearTimers();
    if (entry.view === "quiz" && Number.isInteger(entry.index) && entry.index < total) {
      return showQuestion(entry.index, opts.direction || "next");
    }
    if (entry.view === "result") return showResult(entry, opts);
    return showIntro();
  }

  window.addEventListener("popstate", (e) => {
    const entry = e.state || { view: "intro" };
    let direction = "prev";
    if (entry.view === "quiz") {
      if (state.view === "intro") direction = "next";
      else if (state.view === "quiz") direction = entry.index > state.index ? "next" : "prev";
    }
    render(entry, { direction });
  });

  function setView(name) {
    for (const [key, screen] of Object.entries(el.screens)) screen.hidden = key !== name;
    document.body.dataset.view = name;
    el.topbar.hidden = name === "intro";
    state.view = name;
    window.scrollTo(0, 0);
  }

  function startQuiz() {
    state.answers = [];
    saveAnswers();
    navigate({ view: "quiz", index: 0 });
  }

  function goBack() {
    if (((history.state && history.state.depth) || 0) > 0) history.back();
    else if (state.index > 0) navigate({ view: "quiz", index: state.index - 1 }, { replace: true, direction: "prev" });
    else navigate({ view: "intro" }, { replace: true });
  }

  /* ---------------- פתיחה ---------------- */

  function showIntro() {
    setView("intro");
  }

  // מי שנכנס.ה מקישור ששותף רואה את התוצאה של מי ששלח.ה
  function setupChallenge(params) {
    const raw = params.get("s");
    if (raw === null || !/^\d{1,3}$/.test(raw)) return;
    const pct = clampPct(raw);
    const pctEl = document.createElement("b");
    pctEl.textContent = `${pct}%`;
    el.challenge.replaceChildren("מי ששלח.ה לך את הקישור קיבל.ה ", pctEl, ` — ״${tierFor(pct).title}״. עכשיו תורך.`);
    el.challenge.hidden = false;
  }

  function buildStamp() {
    const chars = Array.from("מדע מדויק ✦ בערך ✦ ".repeat(2));
    const step = 360 / chars.length;
    // נגד כיוון השעון, כדי שהטקסט ייקרא מימין לשמאל
    el.stampRing.innerHTML = chars
      .map((ch, k) => `<text x="60" y="17" text-anchor="middle" transform="rotate(${(-k * step).toFixed(2)} 60 60)">${ch}</text>`)
      .join("");
  }

  /* ---------------- שאלות ---------------- */

  function showQuestion(i, direction) {
    const q = questions[i];
    state.index = i;
    state.locked = false;
    setView("quiz");
    document.body.dataset.accent = ACCENTS[i % ACCENTS.length];

    el.progressFill.style.width = `${((i + 1) / total) * 100}%`;
    el.progress.setAttribute("aria-valuenow", String(i + 1));
    el.progress.setAttribute("aria-valuetext", `שאלה ${i + 1} מתוך ${total}`);
    el.progressCount.textContent = `${i + 1}/${total}`;
    el.qTag.textContent = i === total - 1 ? "שאלה אחרונה!" : `שאלה ${i + 1}`;
    el.qTitle.textContent = q.text;

    el.qSticker.hidden = !q.image;
    if (q.image) {
      el.qImage.src = q.image;
      el.qImage.alt = q.imageAlt || "";
      el.qImage.style.objectPosition = q.imagePosition || "50% 30%";
    }

    el.answers.classList.remove("is-locked");
    el.answers.replaceChildren(...q.answers.map((answer, ai) => answerItem(i, answer, ai)));

    el.qcard.classList.remove("enter-next", "enter-prev");
    void el.qcard.offsetWidth; // מאתחל את אנימציית הכניסה
    el.qcard.classList.add(direction === "prev" ? "enter-prev" : "enter-next");
    el.qTitle.focus({ preventScroll: true });
  }

  function answerItem(qi, answer, ai) {
    const li = document.createElement("li");
    li.style.setProperty("--i", ai);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer";
    const selected = state.answers[qi] === ai;
    btn.classList.toggle("is-selected", selected);
    btn.setAttribute("aria-pressed", String(selected));

    const letter = document.createElement("span");
    letter.className = "answer__letter";
    letter.setAttribute("aria-hidden", "true");
    letter.innerHTML = '<svg><use href="#i-check"/></svg>';
    letter.prepend(LETTERS[ai] || String(ai + 1));

    const body = document.createElement("span");
    body.className = "answer__body";
    const text = document.createElement("span");
    text.className = "answer__text";
    text.textContent = answer.text;
    body.append(text);
    if (answer.note) {
      const note = document.createElement("span");
      note.className = "answer__note";
      note.textContent = answer.note;
      body.append(note);
    }

    btn.append(letter, body);
    btn.addEventListener("click", () => choose(qi, ai, btn));
    li.append(btn);
    return li;
  }

  function choose(qi, ai, btn) {
    if (state.locked) return;
    state.locked = true;
    state.answers[qi] = ai;
    saveAnswers();

    for (const b of el.answers.querySelectorAll(".answer")) {
      b.classList.remove("is-selected");
      b.setAttribute("aria-pressed", String(b === btn));
    }
    void btn.offsetWidth;
    btn.classList.add("is-selected");
    el.answers.classList.add("is-locked");
    burst(btn.querySelector(".answer__letter"));

    later(() => {
      if (qi + 1 < total) navigate({ view: "quiz", index: qi + 1 });
      else navigate({ view: "result" }, { measure: true });
    }, reduceMotion.matches ? 150 : 620);
  }

  function onKey(e) {
    if (state.view !== "quiz" || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = Number(e.key);
    const buttons = el.answers.querySelectorAll(".answer");
    if (n >= 1 && n <= buttons.length) {
      e.preventDefault();
      buttons[n - 1].click();
    }
  }

  /* ---------------- מחוג ---------------- */
  // 0% = המחוג מצביע ימינה, 100% = שמאלה (כן, ממש שמאלה).

  const G = { cx: 180, cy: 180, rOut: 152, rIn: 116 };
  const fx = (n) => n.toFixed(2);
  const pt = (r, p) => [G.cx + r * Math.cos(Math.PI * p), G.cy - r * Math.sin(Math.PI * p)];

  function sector(p1, p2) {
    const [x1, y1] = pt(G.rOut, p1);
    const [x2, y2] = pt(G.rOut, p2);
    const [x3, y3] = pt(G.rIn, p2);
    const [x4, y4] = pt(G.rIn, p1);
    return `M${fx(x1)} ${fx(y1)}A${G.rOut} ${G.rOut} 0 0 0 ${fx(x2)} ${fx(y2)}L${fx(x3)} ${fx(y3)}A${G.rIn} ${G.rIn} 0 0 1 ${fx(x4)} ${fx(y4)}Z`;
  }

  function buildGauge(svg, { labels }) {
    const housing = "M10 180A170 170 0 0 1 350 180V200Q350 208 342 208H18Q10 208 10 200Z";
    const segments = tiers
      .map((t, k) => {
        const next = tiers[k + 1] ? tiers[k + 1].from : 100;
        return `<path class="g-seg" fill="${t.color}" d="${sector(t.from / 100, next / 100)}"/>`;
      })
      .join("");

    let ticks = "";
    for (let v = 0; v <= 100; v += 5) {
      const major = v % 25 === 0;
      const [x1, y1] = pt(110, v / 100);
      const [x2, y2] = pt(major ? 96 : 103, v / 100);
      ticks += `<line class="g-tick${major ? " g-tick--major" : ""}" x1="${fx(x1)}" y1="${fx(y1)}" x2="${fx(x2)}" y2="${fx(y2)}"/>`;
    }

    const text = labels
      ? `<text class="g-end" x="314" y="201" text-anchor="middle">ימין</text>
         <text class="g-end" x="46" y="201" text-anchor="middle">שמאל</text>
         <text class="g-unit" x="180" y="142" text-anchor="middle">יחידות: 0מאל</text>`
      : "";

    svg.setAttribute("viewBox", "-4 4 368 214");
    svg.innerHTML = `
      <path class="g-shadow" d="${housing}" transform="translate(-6 6)"/>
      <path class="g-housing" d="${housing}"/>
      ${segments}${ticks}${text}
      <g transform="translate(${G.cx} ${G.cy})">
        <g class="g-needle-wrap" transform="rotate(0)">
          <g class="g-wobble"><path class="g-needle" d="M-17 -6.5 126 -1.6Q133 0 126 1.6L-17 6.5Q-23 0-17-6.5Z"/></g>
        </g>
        <circle class="g-hub" r="15"/>
        <circle class="g-hub-dot" r="4.5"/>
      </g>`;
    return svg.querySelector(".g-needle-wrap");
  }

  const setNeedle = (needle, deg) => needle.setAttribute("transform", `rotate(${fx(-deg)})`);

  /* ---------------- מדידה ותוצאה ---------------- */

  function showResult(entry, opts) {
    let pct;
    if (typeof entry.preview === "number") {
      pct = entry.preview;
    } else {
      const missing = firstUnanswered();
      if (missing !== -1) return navigate({ view: "quiz", index: missing }, { replace: true, direction: "prev" });
      pct = computePercent(state.answers);
    }
    const tier = tierFor(pct);
    if (opts.measure && !reduceMotion.matches) runMeasuring(() => revealResult(pct, tier));
    else revealResult(pct, tier);
  }

  function runMeasuring(done) {
    setView("loading");
    const lines = shuffle(QUIZ.loading || []).slice(0, 3);
    const step = 950;
    el.loadingLine.textContent = "";
    lines.forEach((line, k) =>
      later(() => {
        el.loadingLine.textContent = line;
        el.loadingLine.classList.remove("is-in");
        void el.loadingLine.offsetWidth;
        el.loadingLine.classList.add("is-in");
      }, k * step)
    );

    // המחט "מחפשת" עד שהתוצאה מוכנה
    const t0 = performance.now();
    loop((now) => {
      const t = (now - t0) / 1000;
      setNeedle(loadingNeedle, 90 + 64 * Math.sin(t * 3.3) * Math.cos(t * 1.2) + 10 * Math.sin(t * 11));
      return state.view === "loading";
    });

    later(done, Math.max(lines.length, 2) * step + 250);
  }

  function revealResult(pct, tier) {
    setView("result");
    document.body.style.setProperty("--tier", tier.color);
    el.resultTitle.textContent = tier.title;
    el.resultText.textContent = tier.text;
    el.gauge.setAttribute("aria-label", `המחוג מראה ${pct}% 0מאלנות`);
    updateShare(pct, tier);
    el.rcard.classList.remove("is-revealed");

    if (reduceMotion.matches) {
      setNeedle(resultNeedle, pct * 1.8);
      el.resultPct.textContent = pct;
      el.rcard.classList.add("is-revealed");
      return;
    }

    // קפיץ מרוסן: המחט עוברת את היעד, חוזרת ומתייצבת (ונעצרת בקצוות כמו מחוג אמיתי)
    const target = pct * 1.8;
    const delay = 250;
    const duration = 2300;
    const t0 = performance.now() + delay;
    setNeedle(resultNeedle, 0);
    el.resultPct.textContent = "0";
    loop((now) => {
      const t = Math.max(0, (now - t0) / duration);
      if (t >= 1) {
        setNeedle(resultNeedle, target);
        el.resultPct.textContent = pct;
        return false;
      }
      const spring = 1 - Math.exp(-5.2 * t) * Math.cos(3 * Math.PI * t);
      setNeedle(resultNeedle, Math.min(181, Math.max(-1, target * spring)));
      const count = 1 - Math.pow(1 - Math.min(1, t / 0.45), 3);
      el.resultPct.textContent = Math.round(pct * count);
      return true;
    });

    later(() => {
      el.rcard.classList.add("is-revealed");
      el.resultTitle.focus({ preventScroll: true });
      const r = el.gauge.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height * 0.75);
    }, delay + duration * 0.42);
  }

  /* ---------------- שיתוף ---------------- */

  function updateShare(pct, tier) {
    const url = `${location.href.split(/[?#]/)[0]}?s=${pct}`;
    const text = `יצא לי ${pct}% במד ה0מאלנומטר: ״${tier.title}״. ואצלך?`;
    state.share = { title: "ה0מאלנומטר", text, url };
    el.shareWa.href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    el.shareNative.hidden = typeof navigator.share !== "function";
  }

  async function copyShare() {
    const value = `${state.share.text}\n${state.share.url}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = legacyCopy(value);
    }
    toast(ok ? "הועתק! עכשיו רק להדביק בקבוצה של המשפחה" : "לא הצלחנו להעתיק, סליחה");
  }

  function legacyCopy(value) {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  async function nativeShare() {
    try {
      await navigator.share(state.share);
    } catch {
      /* בוטל */
    }
  }

  let toastTimer;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("is-shown"), 2600);
  }

  /* ---------------- קישוטים ---------------- */

  function burst(target) {
    if (reduceMotion.matches || !target) return;
    const r = target.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let k = 0; k < 10; k++) {
      const s = document.createElement("span");
      const a = (k / 10) * Math.PI * 2 + Math.random() * 0.5;
      const d = 30 + Math.random() * 26;
      s.className = "spark";
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      s.style.background = PALETTE[k % PALETTE.length];
      if (k % 3 === 0) s.style.borderRadius = "50%";
      s.style.setProperty("--dx", `${fx(Math.cos(a) * d)}px`);
      s.style.setProperty("--dy", `${fx(Math.sin(a) * d)}px`);
      s.addEventListener("animationend", () => s.remove());
      document.body.append(s);
    }
  }

  function confetti(x, y) {
    if (reduceMotion.matches) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.className = "confetti";
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    document.body.append(canvas);

    const parts = Array.from({ length: 150 }, (_, k) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 6 + Math.random() * 12;
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: PALETTE[k % PALETTE.length],
        round: Math.random() < 0.3,
      };
    });

    const life = 3200;
    const t0 = performance.now();
    let last = t0;
    const tick = (now) => {
      const age = now - t0;
      const dt = Math.min(3, (now - last) / 16.67); // אותה מהירות גם במסכי 120Hz
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - life * 0.6) / (life * 0.4));
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      for (const p of parts) {
        p.vx *= Math.pow(0.985, dt);
        p.vy = p.vy * Math.pow(0.985, dt) + 0.32 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.round) ctx.arc(0, 0, p.h * 0.7, 0, Math.PI * 2);
        else ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (age < life) requestAnimationFrame(tick);
      else canvas.remove();
    };
    requestAnimationFrame(tick);
  }

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------- הפעלה ---------------- */

  function init() {
    el.qCount.textContent = total;
    el.progress.setAttribute("aria-valuemax", String(total));
    buildStamp();
    resultNeedle = buildGauge(el.resultGauge, { labels: true });
    loadingNeedle = buildGauge(el.loadingGauge, { labels: false });

    const params = new URLSearchParams(location.search);
    setupChallenge(params);

    el.start.addEventListener("click", startQuiz);
    el.restart.addEventListener("click", startQuiz);
    el.back.addEventListener("click", goBack);
    el.shareCopy.addEventListener("click", copyShare);
    el.shareNative.addEventListener("click", nativeShare);
    document.addEventListener("keydown", onKey);
    warnMissingScores();

    // ?preview=85 — קפיצה ישר למסך התוצאה (לעבודה על העיצוב והטקסטים)
    const preview = params.get("preview");
    if (preview !== null) {
      const entry = { view: "result", preview: clampPct(preview), depth: 0 };
      writeHistory("replaceState", entry);
      render(entry);
      return;
    }

    // רענון באמצע החידון ממשיך מאותה נקודה
    const saved = history.state;
    if (saved && (saved.view === "quiz" || saved.view === "result")) {
      render(saved);
      return;
    }
    writeHistory("replaceState", { view: "intro", depth: 0 });
    render({ view: "intro" });
  }

  init();
})();
