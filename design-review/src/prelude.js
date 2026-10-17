/* תצוגה מקדימה בתוך המעבדה: בלי לגעת בהיסטוריה של הדף המארח, ועם כפתור "שיתוף" כמו בטלפון */
(function () {
  try {
    history.pushState = function () {};
    history.replaceState = function () {};
  } catch (e) {}
  try {
    if (typeof navigator.share !== "function") navigator.share = function () { return Promise.resolve(); };
  } catch (e) {}
})();
