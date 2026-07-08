const storageKey = "habit-streak-tracker-v1";
const themeKey = "habit-streak-tracker-theme";
const supabaseUrl = "https://ojgffpfrgqkvaenkotwu.supabase.co";
const supabaseKey = "sb_publishable_6HKUhHOR5A1F1nkzr62NhQ_QNvhjgMD";
const startDate = "2026-06-29";
const historyDays = 14;
const cloudReady = Boolean(window.supabase && supabaseUrl && supabaseKey);
const supabaseClient = cloudReady ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

const categories = [
  { key: "health", label: "Health" },
  { key: "mental", label: "Mental" },
  { key: "study", label: "Study" },
  { key: "sleep", label: "Sleep" },
  { key: "avoidance", label: "Avoidance" },
  { key: "life", label: "Life" },
];

const defaultDay = () => ({
  supplements: false,
  floss: false,
  legExercise: false,
  mentalRoutine: false,
  studyHours: "",
  bedtime: "",
  wakeTime: "",
  noSocialMedia: false,
  noPorn: false,
  freezeUsed: false,
});

let state = loadState();
let activeDate = isoToday();
let theme = loadTheme();
let currentUser = null;
let cloudHydrated = false;
let saveTimer = null;
let syncInProgress = false;
const pendingSaveDates = new Set();

const els = {
  todayLine: document.querySelector("#todayLine"),
  todayScore: document.querySelector("#todayScore"),
  syncStatus: document.querySelector("#syncStatus"),
  authPanel: document.querySelector("#authPanel"),
  authTitle: document.querySelector("#authTitle"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  signInButton: document.querySelector("#signInButton"),
  signUpButton: document.querySelector("#signUpButton"),
  signedInPanel: document.querySelector("#signedInPanel"),
  signedInEmail: document.querySelector("#signedInEmail"),
  signOutButton: document.querySelector("#signOutButton"),
  authMessage: document.querySelector("#authMessage"),
  lifeStreak: document.querySelector("#lifeStreak"),
  bestLife: document.querySelector("#bestLife"),
  freezeState: document.querySelector("#freezeState"),
  scoreFill: document.querySelector("#scoreFill"),
  scoreStatus: document.querySelector("#scoreStatus"),
  themeToggle: document.querySelector("#themeToggle"),
  summaryRows: document.querySelector("#summaryRows"),
  historyRows: document.querySelector("#historyRows"),
  activeDate: document.querySelector("#activeDate"),
  studyHours: document.querySelector("#studyHours"),
  bedtime: document.querySelector("#bedtime"),
  wakeTime: document.querySelector("#wakeTime"),
  sleepHours: document.querySelector("#sleepHours"),
  studyTarget: document.querySelector("#studyTarget"),
  asleepTarget: document.querySelector("#asleepTarget"),
  wakeTarget: document.querySelector("#wakeTarget"),
  sleepTarget: document.querySelector("#sleepTarget"),
  studyCard: document.querySelector("#studyCard"),
  bedtimeCard: document.querySelector("#bedtimeCard"),
  wakeCard: document.querySelector("#wakeCard"),
  sleepCard: document.querySelector("#sleepCard"),
};

applyTheme();
setupNetworkStatus();

document.querySelector("#prevDay").addEventListener("click", () => {
  activeDate = addDays(activeDate, -1);
  render();
});

document.querySelector("#nextDay").addEventListener("click", () => {
  activeDate = addDays(activeDate, 1);
  render();
});

els.signInButton.addEventListener("click", signIn);
els.signUpButton.addEventListener("click", signUp);
els.signOutButton.addEventListener("click", signOut);
els.themeToggle.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem(themeKey, theme);
  applyTheme();
});

els.activeDate.addEventListener("change", event => {
  activeDate = event.target.value || isoToday();
  ensureDay(activeDate);
  render();
});

for (const field of ["studyHours", "bedtime", "wakeTime"]) {
  els[field].addEventListener("input", event => {
    const day = ensureDay(activeDate);
    day[field] = event.target.value;
    saveState();
    render();
  });
}

document.querySelectorAll(".field-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const day = ensureDay(activeDate);
    const field = button.dataset.field;
    day[field] = !day[field];
    saveState();
    render();
  });
});

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    if (parsed && parsed.days) return parsed;
  } catch {
    localStorage.removeItem(storageKey);
  }
  return { days: {} };
}

function loadTheme() {
  const saved = localStorage.getItem(themeKey);
  return saved === "light" ? "light" : "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.textContent = theme === "dark" ? "Dark" : "Light";
  els.themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  queueCloudSave(activeDate);
}

async function initializeCloud() {
  if (!cloudReady) {
    setSyncStatus("Local");
    setAuthMessage("Cloud library not loaded.");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  await handleSession(data.session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}

async function handleSession(session) {
  currentUser = session?.user || null;
  cloudHydrated = false;
  renderAuth();

  if (currentUser) {
    setSyncStatus("Loading cloud", true, "saving");
    await loadCloudDays();
    await syncAllLocalDays();
    cloudHydrated = true;
    if (!navigator.onLine) {
      setSyncStatus("Offline", true, "offline");
    } else if (pendingSaveDates.size === 0) {
      setSyncStatus("Cloud synced", true);
    }
    render();
  } else {
    setSyncStatus("Local");
    render();
  }
}

async function signUp() {
  const credentials = getCredentials();
  if (!credentials) return;
  setAuthMessage("Creating account...");
  const { error } = await supabaseClient.auth.signUp(credentials);
  if (error) {
    setAuthMessage(error.message);
    return;
  }
  setAuthMessage("Account created. You can sign in now.");
}

async function signIn() {
  const credentials = getCredentials();
  if (!credentials) return;
  setAuthMessage("Signing in...");
  const { error } = await supabaseClient.auth.signInWithPassword(credentials);
  if (error) {
    setAuthMessage(error.message);
    return;
  }
  setAuthMessage("");
}

async function signOut() {
  if (!cloudReady) return;
  await supabaseClient.auth.signOut();
  setAuthMessage("Signed out. Local mode active.");
}

function getCredentials() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setAuthMessage("Enter email and password.");
    return null;
  }
  return { email, password };
}

function renderAuth() {
  const signedIn = Boolean(currentUser);
  els.authPanel.classList.toggle("is-compact", signedIn);
  els.authTitle.textContent = signedIn ? "Cloud synced" : "Sign in";
  els.authForm.hidden = signedIn;
  els.signedInPanel.hidden = !signedIn;
  els.signedInEmail.textContent = signedIn ? currentUser.email : "";
}

function setAuthMessage(message) {
  els.authMessage.textContent = message;
}

function setSyncStatus(message, cloud = false, state = "") {
  els.syncStatus.textContent = message;
  els.syncStatus.classList.toggle("is-cloud", cloud);
  els.syncStatus.classList.toggle("is-saving", state === "saving");
  els.syncStatus.classList.toggle("is-error", state === "error");
  els.syncStatus.classList.toggle("is-offline", state === "offline");
  if (currentUser) {
    els.authTitle.textContent = message;
  }
}

async function loadCloudDays() {
  const { data, error } = await supabaseClient
    .from("habit_days")
    .select("date,data")
    .order("date", { ascending: true });

  if (error) {
    setSyncStatus("Cloud error", true, "error");
    setAuthMessage(error.message);
    return;
  }

  for (const row of data || []) {
    state.days[row.date] = { ...defaultDay(), ...row.data };
  }
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function syncAllLocalDays() {
  const dates = Object.keys(state.days);
  for (const date of dates) {
    pendingSaveDates.add(date);
  }
  await savePendingDays();
}

function queueCloudSave(date) {
  if (!currentUser || !cloudHydrated) return;
  pendingSaveDates.add(date);
  window.clearTimeout(saveTimer);
  if (!navigator.onLine) {
    setSyncStatus("Offline", true, "offline");
    return;
  }
  saveTimer = window.setTimeout(() => {
    savePendingDays();
  }, 350);
}

async function savePendingDays() {
  if (!currentUser || syncInProgress || pendingSaveDates.size === 0) return;
  if (!navigator.onLine) {
    setSyncStatus("Offline", true, "offline");
    return;
  }

  syncInProgress = true;
  setSyncStatus("Saving...", true, "saving");
  let hadError = false;
  while (pendingSaveDates.size > 0 && navigator.onLine) {
    const [date] = pendingSaveDates;
    const saved = await saveCloudDay(date);
    if (saved) {
      pendingSaveDates.delete(date);
    } else {
      hadError = true;
      break;
    }
  }
  syncInProgress = false;

  if (!navigator.onLine) {
    setSyncStatus("Offline", true, "offline");
  } else if (!hadError && pendingSaveDates.size === 0) {
    setSyncStatus("Cloud synced", true);
    setAuthMessage("");
  } else {
    setSyncStatus("Cloud error", true, "error");
  }
}

async function saveCloudDay(date) {
  if (!currentUser || !state.days[date]) return true;
  const { error } = await supabaseClient.from("habit_days").upsert({
    user_id: currentUser.id,
    date,
    data: state.days[date],
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,date" });

  if (error) {
    setSyncStatus("Cloud error", true, "error");
    setAuthMessage(error.message);
    return false;
  }
  return true;
}

function setupNetworkStatus() {
  window.addEventListener("offline", () => {
    if (currentUser) {
      setSyncStatus("Offline", true, "offline");
    }
  });

  window.addEventListener("online", () => {
    if (!currentUser) return;
    if (pendingSaveDates.size > 0) {
      savePendingDays();
    } else {
      setSyncStatus("Cloud synced", true);
    }
  });
}

function ensureDay(date) {
  if (!state.days[date]) {
    state.days[date] = defaultDay();
  }
  return state.days[date];
}

function render() {
  const day = ensureDay(activeDate);
  const computed = computeDay(activeDate);
  const stats = computeStats();

  els.activeDate.value = activeDate;
  els.todayLine.textContent = `${formatDayName(activeDate)} - ${formatShortDate(activeDate)}`;
  els.studyHours.value = day.studyHours;
  els.bedtime.value = day.bedtime;
  els.wakeTime.value = day.wakeTime;
  els.sleepHours.value = computed.sleepHoursText;

  document.querySelectorAll(".field-toggle").forEach(button => {
    const value = Boolean(day[button.dataset.field]);
    button.classList.toggle("is-on", value);
    button.setAttribute("aria-pressed", String(value));
    if (button.classList.contains("freeze-action")) {
      button.textContent = value ? "Freeze Active" : "Activate Freeze";
    }
  });

  updateInputStatus(els.studyCard, els.studyTarget, computed.studyOk, day.studyHours !== "");
  updateInputStatus(els.bedtimeCard, els.asleepTarget, computed.asleepOk, day.bedtime !== "");
  updateInputStatus(els.wakeCard, els.wakeTarget, computed.wakeOk, day.wakeTime !== "");
  updateInputStatus(els.sleepCard, els.sleepTarget, computed.sleepOk, computed.sleepHoursText !== "");

  els.todayScore.textContent = computed.dailyScore;
  els.scoreFill.style.width = `${computed.dailyScore}%`;
  els.scoreStatus.textContent = scoreStatus(computed.dailyScore, computed.lifeOk, day.freezeUsed);
  els.lifeStreak.textContent = stats.life.current;
  els.bestLife.textContent = stats.life.best;
  els.freezeState.textContent = yesNo(day.freezeUsed);

  els.summaryRows.innerHTML = categories.map(category => {
    const item = stats[category.key];
    return `
      <tr>
        <td>${category.label}</td>
        <td>${item.current}</td>
        <td>${item.best}</td>
        <td>${item.tokens}</td>
        <td>${item.rawPerfect}</td>
        <td>${item.used}</td>
        <td>${item.today}</td>
      </tr>
    `;
  }).join("");

  els.historyRows.innerHTML = makeHistoryRows();
}

function updateInputStatus(card, element, value, hasValue) {
  element.textContent = yesNo(value);
  element.className = value ? "status-good" : "status-bad";
  card.classList.toggle("is-ok", hasValue && value);
  card.classList.toggle("is-missed", hasValue && !value);
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function scoreStatus(score, lifeOk, freezeUsed) {
  if (lifeOk && freezeUsed) return "Streak protected";
  if (score === 100) return "Perfect day burning";
  if (lifeOk) return "Streak burning";
  if (score >= 70) return "Strong partial";
  if (score >= 40) return "Still in motion";
  return "Open day";
}

function computeDay(date) {
  const day = ensureDay(date);
  const studyHours = Number.parseFloat(day.studyHours);
  const sleepHours = calculateSleepHours(day.bedtime, day.wakeTime);
  const asleepOk = isAsleepBeforeMidnight(day.bedtime);
  const wakeOk = isWakeBefore0830(day.wakeTime);
  const sleepOk = sleepHours >= 8;
  const studyOk = Number.isFinite(studyHours) && studyHours >= 7;
  const studyScore = Number.isFinite(studyHours) ? Math.max(0, Math.min(studyHours / 7, 1)) : 0;
  const raw = {
    health: day.supplements && day.floss && day.legExercise,
    mental: day.mentalRoutine,
    study: studyOk,
    sleep: asleepOk && wakeOk && sleepOk,
    avoidance: day.noSocialMedia && day.noPorn && asleepOk,
  };
  const ok = {
    health: raw.health || day.freezeUsed,
    mental: raw.mental || day.freezeUsed,
    study: raw.study || day.freezeUsed,
    sleep: raw.sleep || day.freezeUsed,
    avoidance: raw.avoidance || day.freezeUsed,
  };
  const completed = [
    day.supplements,
    day.floss,
    day.legExercise,
    day.mentalRoutine,
    studyScore,
    asleepOk,
    wakeOk,
    sleepOk,
    day.noSocialMedia,
    day.noPorn,
  ].reduce((sum, value) => sum + Number(value), 0);
  const dailyScore = Math.round((completed / 10) * 100);
  const lifeOk = dailyScore >= 80 || day.freezeUsed;

  return {
    studyOk,
    studyScore,
    asleepOk,
    wakeOk,
    sleepOk,
    raw,
    ok,
    lifeOk,
    dailyScore,
    sleepHours,
    sleepHoursText: Number.isFinite(sleepHours) ? sleepHours.toFixed(1) : "",
  };
}

function computeStats() {
  const dates = sortedDates();
  const stats = {};
  for (const category of categories) {
    stats[category.key] = {
      current: 0,
      best: 0,
      tokens: 0,
      rawPerfect: 0,
      used: 0,
      today: "Open",
    };
  }

  const streaks = Object.fromEntries(categories.map(category => [category.key, 0]));
  const bests = Object.fromEntries(categories.map(category => [category.key, 0]));

  for (const date of dates) {
    const day = ensureDay(date);
    const computed = computeDay(date);
    for (const key of ["health", "mental", "study", "sleep", "avoidance"]) {
      const ok = computed.ok[key];
      streaks[key] = ok ? streaks[key] + 1 : 0;
      bests[key] = Math.max(bests[key], streaks[key]);
      if (computed.raw[key]) stats[key].rawPerfect += 1;
      if (day.freezeUsed) stats[key].used += 1;
    }
    streaks.life = computed.lifeOk ? streaks.life + 1 : 0;
    bests.life = Math.max(bests.life, streaks.life);
    if (computed.lifeOk && !day.freezeUsed) stats.life.rawPerfect += 1;
  }

  for (const key of ["health", "mental", "study", "sleep", "avoidance"]) {
    stats[key].current = streaks[key];
    stats[key].best = bests[key];
    stats[key].tokens = Math.max(0, Math.floor(stats[key].rawPerfect / 10) - stats[key].used);
    stats[key].today = computeDay(activeDate).ok[key] ? "Protected" : "Open";
  }
  stats.life.current = streaks.life;
  stats.life.best = bests.life;
  stats.life.tokens = "";
  stats.life.used = "";
  stats.life.today = computeDay(activeDate).lifeOk ? "Active" : "Partial";

  return stats;
}

function makeHistoryRows() {
  const rows = [];
  for (let offset = 0; offset < historyDays; offset += 1) {
    const date = addDays(activeDate, -offset);
    const day = ensureDay(date);
    const computed = computeDay(date);
    const lifeStreak = streakAt(date);
    rows.push(`
      <tr>
        <td>${formatShortDate(date)}</td>
        <td>${formatDayName(date)}</td>
        <td>${computed.dailyScore}</td>
        <td>${yesNo(day.freezeUsed)}</td>
        <td>${lifeStreak}</td>
      </tr>
    `);
  }
  return rows.join("");
}

function streakAt(date) {
  let streak = 0;
  let cursor = date;
  while (true) {
    if (!computeDay(cursor).lifeOk) return streak;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
}

function sortedDates() {
  const known = new Set(Object.keys(state.days));
  let cursor = startDate;
  const end = maxDate(isoToday(), activeDate);
  while (cursor <= end) {
    known.add(cursor);
    cursor = addDays(cursor, 1);
  }
  return [...known].sort();
}

function calculateSleepHours(bedtime, wakeTime) {
  const bed = minutesFromTime(bedtime);
  const wake = minutesFromTime(wakeTime);
  if (bed === null || wake === null) return Number.NaN;
  const diff = (wake - bed + 1440) % 1440;
  return diff / 60;
}

function isAsleepBeforeMidnight(time) {
  const minutes = minutesFromTime(time);
  if (minutes === null) return false;
  return minutes >= 12 * 60;
}

function isWakeBefore0830(time) {
  const minutes = minutesFromTime(time);
  if (minutes === null) return false;
  return minutes <= 8 * 60 + 30;
}

function minutesFromTime(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isoToday() {
  const date = new Date();
  return toIsoDate(date);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function maxDate(a, b) {
  return a > b ? a : b;
}

function formatShortDate(iso) {
  const [, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}`;
}

function formatDayName(iso) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${iso}T12:00:00`));
}

renderAuth();
render();
initializeCloud();
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // The tracker still works as a normal website if install support is unavailable.
    });
  });
}
