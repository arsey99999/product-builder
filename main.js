const snippets = {
  python: {
    title: "Python · 데이터 정제",
    code: `import pandas as pd

df = pd.read_csv("sales.csv")
df["price"] = df["price"].fillna(0)
df["region"] = df["region"].str.title()

summary = (
    df.groupby("region")["price"]
      .mean()
      .reset_index()
)
print(summary.sort_values("price", ascending=False))`,
  },
  java: {
    title: "Java · 스트림 변환",
    code: `import java.util.List;
import java.util.stream.Collectors;

List<String> names = List.of("Ada", "Grace", "Linus");
List<String> result = names.stream()
    .filter(name -> name.length() > 3)
    .map(String::toUpperCase)
    .collect(Collectors.toList());

System.out.println(result);`,
  },
  sql: {
    title: "SQL · 윈도우 함수",
    code: `WITH ranked AS (
  SELECT
    user_id,
    total_amount,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC
    ) AS rn
  FROM orders
)
SELECT user_id, total_amount
FROM ranked
WHERE rn = 1;`,
  },
  js: {
    title: "JavaScript · 비동기 처리",
    code: `async function fetchMetrics() {
  const res = await fetch("/api/metrics");
  if (!res.ok) throw new Error("Request failed");
  const data = await res.json();
  return data.items.map((item) => ({
    id: item.id,
    score: item.score ?? 0
  }));
}`,
  },
  react: {
    title: "React · 훅 패턴",
    code: `import { useMemo } from "react";

export default function ScoreBoard({ rows }) {
  const top = useMemo(() => {
    return rows
      .filter((row) => row.score > 80)
      .slice(0, 5);
  }, [rows]);

  return (
    <ul>
      {top.map((row) => (
        <li key={row.id}>{row.name}</li>
      ))}
    </ul>
  );
}`,
  },
  pandas: {
    title: "Pandas · 시계열",
    code: `df["date"] = pd.to_datetime(df["date"])
monthly = (
    df.set_index("date")
      .resample("M")["revenue"]
      .sum()
      .reset_index()
)
monthly["growth"] = monthly["revenue"].pct_change()
print(monthly.tail())`,
  },
};

const themeToggle = document.getElementById("theme-toggle");
const sunIcon = document.getElementById("sun-icon");
const moonIcon = document.getElementById("moon-icon");
const body = document.body;

function setTheme(theme) {
  body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (theme === "dark") {
    sunIcon.classList.remove("hidden");
    moonIcon.classList.add("hidden");
  } else {
    sunIcon.classList.add("hidden");
    moonIcon.classList.remove("hidden");
  }
}

function toggleTheme() {
  const currentTheme = body.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

// Apply saved theme or detect system preference on load
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  setTheme(savedTheme);
} else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
  setTheme("light");
} else {
  setTheme("dark"); // Default to dark if no preference and not light system preference
}

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

const heroTitle = document.getElementById("snippet-title");
const heroCode = document.getElementById("snippet-code");
const practiceTitle = document.getElementById("practice-title");
const practiceCode = document.getElementById("practice-code");
const typingInput = document.getElementById("typing-input");
const progressText = document.getElementById("progress-text");
const mistakeCount = document.getElementById("mistake-count");
const metricWpmLive = document.getElementById("metric-wpm-live");
const metricWpmTotal = document.getElementById("metric-wpm-total");
const metricCpm = document.getElementById("metric-cpm");
const metricAccuracy = document.getElementById("metric-accuracy");
const metricPattern = document.getElementById("metric-pattern");
const metricProgress = document.getElementById("metric-progress");
const metricHint = document.getElementById("metric-hint");
const resetTyping = document.getElementById("reset-typing");
const nextSnippet = document.getElementById("next-snippet");
const typingVisual = document.getElementById("typing-visual");
const chips = Array.from(document.querySelectorAll(".chip"));

let currentLang = "python";
let startTime = null;
let lastMistakes = [];
let snippetKeys = Object.keys(snippets);
let snippetIndex = 0;
let keystrokes = [];
const LIVE_WINDOW_MS = 10000;
let lastInputLength = 0;
let pendingRender = false;
let latestTyped = "";

function setSnippet(lang) {
  const data = snippets[lang];
  if (!data) return;
  currentLang = lang;
  heroTitle.textContent = data.title;
  heroCode.textContent = data.code;
  practiceTitle.textContent = data.title;
  practiceCode.textContent = data.code;
  resetSession();
}

function resetSession() {
  typingInput.value = "";
  startTime = null;
  lastMistakes = [];
  keystrokes = [];
  lastInputLength = 0;
  renderInputVisual("");
  updateMetrics();
  updateProgress(0, 0);
}

function updateProgress(progress, mistakes) {
  const clamped = Math.min(100, Math.max(0, progress));
  progressText.textContent = `${Math.round(clamped)}%`;
  mistakeCount.textContent = mistakes;
  metricProgress.style.width = `${clamped}%`;
}

function updateMetrics() {
  const typed = typingInput.value;
  const target = snippets[currentLang].code;
  const elapsedMinutes = startTime ? (Date.now() - startTime) / 60000 : 0;
  const wpmTotal = elapsedMinutes > 0 ? (typed.length / 5) / elapsedMinutes : 0;
  const cpmTotal = elapsedMinutes > 0 ? typed.length / elapsedMinutes : 0;
  const wpmLive = calculateLiveWpm();
  const { mistakes, accuracy, pattern } = analyzeTyping(typed, target);

  metricWpmLive.textContent = Math.round(wpmLive);
  metricWpmTotal.textContent = Math.round(wpmTotal);
  metricCpm.textContent = Math.round(cpmTotal);
  metricAccuracy.textContent = `${accuracy}%`;
  metricPattern.textContent = pattern || "-";
  metricHint.textContent = typed.length
    ? "실시간으로 정확도와 속도를 계산 중입니다."
    : "타이핑을 시작하면 실시간 지표가 보여요.";

  const progress = (typed.length / target.length) * 100;
  updateProgress(progress, mistakes);
}

function analyzeTyping(typed, target) {
  if (!typed.length) {
    return { mistakes: 0, accuracy: 100, pattern: "" };
  }
  let mistakes = 0;
  const mismatchChars = [];
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] !== target[i]) {
      mistakes += 1;
      mismatchChars.push(typed[i] || "");
    }
  }
  const accuracy = Math.max(0, Math.round(((typed.length - mistakes) / typed.length) * 100));
  const pattern = detectPattern(mismatchChars);
  return { mistakes, accuracy, pattern };
}

function detectPattern(chars) {
  if (!chars.length) return "";
  const counts = chars.reduce((acc, char) => {
    const key = char.trim() === "" ? "공백" : char;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return "";
  return sorted[0][0];
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatChar(char) {
  if (char === " ") {
    return { char: "·", isSpace: true };
  }
  if (char === "\t") {
    return { char: "·", isSpace: true };
  }
  return { char, isSpace: false };
}

function renderInputVisual(typed) {
  const target = snippets[currentLang].code;
  const max = Math.max(target.length, typed.length);
  let html = "";
  for (let i = 0; i < max; i += 1) {
    const tChar = target[i];
    const inputChar = typed[i];

    if (typeof tChar === "undefined") {
      const { char, isSpace } = formatChar(inputChar || "");
      const cls = isSpace ? "extra space" : "extra";
      html += `<span class="char ${cls}">${escapeHtml(char)}</span>`;
      continue;
    }

    if (typeof inputChar === "undefined") {
      const { char, isSpace } = formatChar(tChar);
      const cls = isSpace ? "pending space" : "pending";
      html += `<span class="char ${cls}">${escapeHtml(char)}</span>`;
      continue;
    }

    let charToDisplay;
    const base = inputChar === tChar ? "correct" : "wrong";
    if (base === "correct") {
      charToDisplay = tChar; // 정답일 경우, 목표 글자를 표시
    } else {
      charToDisplay = inputChar; // 오타일 경우, 사용자가 입력한 글자를 표시
    }
    const { char: formattedChar, isSpace } = formatChar(charToDisplay);
    const cls = isSpace ? `${base} space` : base;
    html += `<span class="char ${cls}">${escapeHtml(formattedChar)}</span>`;
  }
  typingVisual.innerHTML = html || "<span class=\"pending\">타이핑을 시작하세요.</span>";
}

function scheduleRender(typed) {
  latestTyped = typed;
  if (pendingRender) return;
  pendingRender = true;
  requestAnimationFrame(() => {
    pendingRender = false;
    renderInputVisual(latestTyped);
  });
}

function calculateLiveWpm() {
  if (!keystrokes.length) return 0;
  const now = Date.now();
  keystrokes = keystrokes.filter((t) => now - t <= LIVE_WINDOW_MS);
  const charsInWindow = keystrokes.length;
  const minutes = LIVE_WINDOW_MS / 60000;
  return (charsInWindow / 5) / minutes;
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    setSnippet(chip.dataset.lang);
  });
});

document.getElementById("cta-hero").addEventListener("click", () => {
  document.getElementById("practice").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("cta-top").addEventListener("click", () => {
  document.getElementById("practice").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("cta-sample").addEventListener("click", () => {
  document.getElementById("practice").scrollIntoView({ behavior: "smooth" });
});

typingInput.addEventListener("input", () => {
  if (!startTime) startTime = Date.now();
  const delta = typingInput.value.length - lastInputLength;
  if (delta > 0) {
    const now = Date.now();
    for (let i = 0; i < delta; i += 1) {
      keystrokes.push(now);
    }
  }
  lastInputLength = typingInput.value.length;
  scheduleRender(typingInput.value);
  updateMetrics();
});

typingInput.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    if (!startTime) startTime = Date.now();
    const start = typingInput.selectionStart;
    const end = typingInput.selectionEnd;
    const value = typingInput.value;
    const insertion = "    ";
    typingInput.value = value.slice(0, start) + insertion + value.slice(end);
    typingInput.selectionStart = typingInput.selectionEnd = start + insertion.length;
    lastInputLength = typingInput.value.length;
    const now = Date.now();
    for (let i = 0; i < insertion.length; i += 1) {
      keystrokes.push(now);
    }
    scheduleRender(typingInput.value);
    updateMetrics();
  }
});

typingInput.addEventListener("scroll", () => {
  typingVisual.scrollTop = typingInput.scrollTop;
  typingVisual.scrollLeft = typingInput.scrollLeft;
});

resetTyping.addEventListener("click", resetSession);

nextSnippet.addEventListener("click", () => {
  snippetIndex = (snippetIndex + 1) % snippetKeys.length;
  const nextLang = snippetKeys[snippetIndex];
  chips.forEach((item) => item.classList.remove("active"));
  const nextChip = chips.find((chip) => chip.dataset.lang === nextLang);
  if (nextChip) nextChip.classList.add("active");
  setSnippet(nextLang);
});

setSnippet("python");
// Added a comment to trigger a new deployment.