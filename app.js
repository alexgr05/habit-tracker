const storageKey = "habit-streak-tracker-v1";
const themeKey = "habit-streak-tracker-theme";
const supabaseUrl = "https://ojgffpfrgqkvaenkotwu.supabase.co";
const supabaseKey = "sb_publishable_6HKUhHOR5A1F1nkzr62NhQ_QNvhjgMD";
const startDate = "2026-06-29";
const noPornStreakAnchorDate = "2026-08-01";
const noPornStreakAnchorDays = 39;
const historyDays = 14;
const cloudReady = Boolean(window.supabase && supabaseUrl && supabaseKey);
const supabaseClient = cloudReady ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
const themes = ["dark", "light", "calm"];
const themeLabels = {
  dark: "Dark",
  light: "Light",
  calm: "Calm Heat",
};

const categories = [
  { key: "health", label: "Health" },
  { key: "mental", label: "Mental" },
  { key: "study", label: "Study" },
  { key: "sleep", label: "Sleep" },
  { key: "avoidance", label: "Avoidance" },
  { key: "life", label: "Life" },
];

const defaultDay = (mode = "semester") => ({
  mode,
  supplements: false,
  floss: false,
  legExercise: false,
  mentalRoutine: false,
  sports: false,
  fourthMeal: false,
  backStretching: false,
  studyHours: "",
  bedtime: "",
  wakeTime: "",
  noSocialMedia: false,
  noPorn: false,
  masturbating: false,
  freezeUsed: false,
});

let state = loadState();
let activeDate = isoToday();
let theme = loadTheme();
let currentUser = null;
let cloudHydrated = false;
let saveTimer = null;
let syncInProgress = false;
let passwordRecoveryMode = false;
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
  resetPasswordButton: document.querySelector("#resetPasswordButton"),
  passwordResetForm: document.querySelector("#passwordResetForm"),
  newPassword: document.querySelector("#newPassword"),
  updatePasswordButton: document.querySelector("#updatePasswordButton"),
  signedInPanel: document.querySelector("#signedInPanel"),
  signedInEmail: document.querySelector("#signedInEmail"),
  changePasswordButton: document.querySelector("#changePasswordButton"),
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
  semesterMode: document.querySelector("#semesterMode"),
  breakMode: document.querySelector("#breakMode"),
  insightTrackedDays: document.querySelector("#insightTrackedDays"),
  insightAverageScore: document.querySelector("#insightAverageScore"),
  insightStreakDays: document.querySelector("#insightStreakDays"),
  insightAverageStudy: document.querySelector("#insightAverageStudy"),
  insightPenaltyDays: document.querySelector("#insightPenaltyDays"),
  scoreTrend: document.querySelector("#scoreTrend"),
  weeklyScoreTrend: document.querySelector("#weeklyScoreTrend"),
  habitConsistency: document.querySelector("#habitConsistency"),
  scoreDrivers: document.querySelector("#scoreDrivers"),
  modeComparison: document.querySelector("#modeComparison"),
  relationshipInsights: document.querySelector("#relationshipInsights"),
  insightNotes: document.querySelector("#insightNotes"),
  activeDate: document.querySelector("#activeDate"),
  sportsTile: document.querySelector("#sportsTile"),
  fourthMealTile: document.querySelector("#fourthMealTile"),
  backStretchingTile: document.querySelector("#backStretchingTile"),
  studyHours: document.querySelector("#studyHours"),
  bedtime: document.querySelector("#bedtime"),
  wakeTime: document.querySelector("#wakeTime"),
  sleepHours: document.querySelector("#sleepHours"),
  studyTarget: document.querySelector("#studyTarget"),
  asleepTarget: document.querySelector("#asleepTarget"),
  wakeTarget: document.querySelector("#wakeTarget"),
  sleepTarget: document.querySelector("#sleepTarget"),
  noPornTileStreak: document.querySelector("#noPornTileStreak"),
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
els.resetPasswordButton.addEventListener("click", sendPasswordReset);
els.updatePasswordButton.addEventListener("click", updatePassword);
els.changePasswordButton.addEventListener("click", showPasswordResetForm);
els.signOutButton.addEventListener("click", signOut);
els.semesterMode.addEventListener("click", () => setMode("semester"));
els.breakMode.addEventListener("click", () => setMode("break"));
els.themeToggle.addEventListener("click", () => {
  theme = themes[(themes.indexOf(theme) + 1) % themes.length];
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
  return themes.includes(saved) ? saved : "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
  els.themeToggle.textContent = themeLabels[theme];
  els.themeToggle.setAttribute("aria-label", `Switch to ${themeLabels[nextTheme]} theme`);
  els.themeToggle.title = `Switch to ${themeLabels[nextTheme]} theme`;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  queueCloudSave(activeDate);
}

function setMode(mode) {
  const day = ensureDay(activeDate);
  day.mode = mode;
  saveState();
  render();
}

async function initializeCloud() {
  if (!cloudReady) {
    setSyncStatus("Local");
    setAuthMessage("Cloud library not loaded.");
    return;
  }

  passwordRecoveryMode = isRecoveryRedirect();
  const { data } = await supabaseClient.auth.getSession();
  await handleSession(data.session);
  if (passwordRecoveryMode && data.session?.user) {
    renderAuth();
    setAuthMessage("Enter a new password.");
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      passwordRecoveryMode = true;
      currentUser = session?.user || null;
      renderAuth();
      setAuthMessage("Enter a new password.");
      return;
    }
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

async function sendPasswordReset() {
  if (!cloudReady) return;
  const email = els.authEmail.value.trim();
  if (!email) {
    setAuthMessage("Enter your email first.");
    return;
  }

  setAuthMessage("Sending reset email...");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) {
    setAuthMessage(error.message);
    return;
  }
  setAuthMessage("Reset email sent. Open the link in your inbox.");
}

async function updatePassword() {
  if (!cloudReady) return;
  const password = els.newPassword.value;
  if (!password || password.length < 6) {
    setAuthMessage("Use at least 6 characters.");
    return;
  }

  setAuthMessage("Saving new password...");
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    setAuthMessage(error.message);
    return;
  }
  passwordRecoveryMode = false;
  els.newPassword.value = "";
  renderAuth();
  setAuthMessage("Password updated. You are signed in.");
}

function showPasswordResetForm() {
  if (!currentUser) return;
  passwordRecoveryMode = true;
  renderAuth();
  setAuthMessage("Enter a new password.");
  els.newPassword.focus();
}

function isRecoveryRedirect() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

async function signOut() {
  if (!cloudReady) return;
  passwordRecoveryMode = false;
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
  els.authPanel.classList.toggle("is-compact", signedIn && !passwordRecoveryMode);
  els.authTitle.textContent = passwordRecoveryMode ? "New password" : signedIn ? "Cloud synced" : "Sign in";
  els.authForm.hidden = signedIn || passwordRecoveryMode;
  els.passwordResetForm.hidden = !passwordRecoveryMode;
  els.signedInPanel.hidden = !signedIn || passwordRecoveryMode;
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
    state.days[row.date] = { ...defaultDay(row.data?.mode), ...row.data };
  }
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function syncAllLocalDays() {
  const dates = Object.keys(state.days).filter(date => hasTrackedData(state.days[date]));
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
  const dates = [...pendingSaveDates].filter(date => state.days[date]);
  const saved = await saveCloudDays(dates);
  if (saved) {
    for (const date of dates) {
      pendingSaveDates.delete(date);
    }
  }
  syncInProgress = false;

  if (!navigator.onLine) {
    setSyncStatus("Offline", true, "offline");
  } else if (saved && pendingSaveDates.size === 0) {
    setSyncStatus("Cloud synced", true);
    setAuthMessage("");
  } else if (saved && pendingSaveDates.size > 0) {
    savePendingDays();
  } else {
    setSyncStatus("Cloud error", true, "error");
  }
}

async function saveCloudDays(dates) {
  if (!currentUser || dates.length === 0) return true;
  const rows = dates.map(date => ({
    user_id: currentUser.id,
    date,
    data: state.days[date],
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseClient.from("habit_days").upsert(rows, { onConflict: "user_id,date" });

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
    state.days[date] = defaultDay(previousMode(date));
  }
  return state.days[date];
}

function previousMode(date) {
  let cursor = addDays(date, -1);
  while (cursor >= startDate) {
    if (state.days[cursor]?.mode) return state.days[cursor].mode;
    cursor = addDays(cursor, -1);
  }
  return "semester";
}

function render() {
  const day = ensureDay(activeDate);
  const computed = computeDay(activeDate);
  const stats = computeStats();
  const breakMode = computed.mode === "break";

  els.activeDate.value = activeDate;
  els.todayLine.textContent = `${formatDayName(activeDate)} - ${formatShortDate(activeDate)}`;
  els.studyHours.value = day.studyHours;
  els.bedtime.value = day.bedtime;
  els.wakeTime.value = day.wakeTime;
  els.sleepHours.value = computed.sleepHoursText;
  els.studyCard.hidden = breakMode;
  els.sportsTile.hidden = !breakMode;
  els.fourthMealTile.hidden = !breakMode;
  els.backStretchingTile.hidden = !breakMode;
  els.semesterMode.classList.toggle("is-active", !breakMode);
  els.breakMode.classList.toggle("is-active", breakMode);

  document.querySelectorAll(".field-toggle").forEach(button => {
    const value = Boolean(day[button.dataset.field]);
    button.classList.toggle("is-on", value);
    button.setAttribute("aria-pressed", String(value));
    if (button.classList.contains("freeze-action")) {
      button.textContent = value ? "Freeze Active" : "Activate Freeze";
    }
  });

  if (!breakMode) {
    updateInputStatus(els.studyCard, els.studyTarget, computed.studyOk, day.studyHours !== "");
  }
  updateInputStatus(els.bedtimeCard, els.asleepTarget, computed.asleepOk, day.bedtime !== "");
  updateInputStatus(els.wakeCard, els.wakeTarget, computed.wakeOk, day.wakeTime !== "");
  updateInputStatus(els.sleepCard, els.sleepTarget, computed.sleepOk, computed.sleepHoursText !== "");

  els.todayScore.textContent = computed.dailyScore;
  els.scoreFill.style.width = `${computed.dailyScore}%`;
  els.scoreStatus.textContent = scoreStatus(computed.dailyScore, computed.lifeOk, day.freezeUsed);
  els.lifeStreak.textContent = stats.life.current;
  els.bestLife.textContent = stats.life.best;
  els.freezeState.textContent = yesNo(day.freezeUsed);
  els.noPornTileStreak.textContent = `${noPornStreakAt(activeDate)}d`;

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
  renderInsights(stats);
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
  const mode = day.mode || "semester";
  const studyHours = Number.parseFloat(day.studyHours);
  const sleepHours = calculateSleepHours(day.bedtime, day.wakeTime);
  const asleepOk = isAsleepBeforeMidnight(day.bedtime);
  const wakeOk = isWakeBefore0830(day.wakeTime);
  const sleepOk = sleepHours >= 8;
  const studyOk = Number.isFinite(studyHours) && studyHours >= 7;
  const studyScore = Number.isFinite(studyHours) ? Math.max(0, Math.min(studyHours / 7, 1)) : 0;
  const studyOrSportsOk = mode === "break" ? day.sports : studyOk;
  const scoreItems = [
    { key: "supplements", label: "Supplements", group: "health", value: Number(day.supplements) },
    { key: "floss", label: "Floss", group: "health", value: Number(day.floss) },
    { key: "legExercise", label: "Leg Exercise", group: "health", value: Number(day.legExercise) },
    { key: "mentalRoutine", label: "Mental Routine", group: "mental", value: Number(day.mentalRoutine) },
    {
      key: mode === "break" ? "sports" : "studyHours",
      label: mode === "break" ? "Sports" : "Study Hours",
      group: "study",
      value: Number(mode === "break" ? day.sports : studyScore),
    },
    { key: "asleep", label: "Before 00", group: "sleep", value: Number(asleepOk) },
    { key: "wake", label: "Wake 8:30", group: "sleep", value: Number(wakeOk) },
    { key: "sleep8h", label: "8h Sleep", group: "sleep", value: Number(sleepOk) },
    { key: "noSocialMedia", label: "No Social Media", group: "avoidance", value: Number(day.noSocialMedia) },
    { key: "noPorn", label: "No Porn", group: "avoidance", value: Number(day.noPorn) },
  ];
  if (mode === "break") {
    scoreItems.push(
      { key: "fourthMeal", label: "4th Meal", group: "health", value: Number(day.fourthMeal) },
      { key: "backStretching", label: "Back Stretching", group: "health", value: Number(day.backStretching) },
    );
  }
  const raw = {
    health: day.supplements && day.floss && day.legExercise,
    mental: day.mentalRoutine,
    study: studyOrSportsOk,
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
  const completed = scoreItems.reduce((sum, item) => sum + item.value, 0);
  const penalty = day.masturbating ? 10 : 0;
  const dailyScore = Math.max(0, Math.round((completed / scoreItems.length) * 100) - penalty);
  const lifeOk = dailyScore >= 80 || day.freezeUsed;

  return {
    mode,
    studyOk,
    studyScore,
    studyOrSportsOk,
    activeScoreItems: scoreItems.length,
    scoreItems,
    penalty,
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

function renderInsights(stats) {
  const days = trackedDates();
  const rows = days.map(date => {
    const day = ensureDay(date);
    const computed = computeDay(date);
    return { date, day, computed };
  });

  const trackedCount = rows.length;
  const averageScore = trackedCount
    ? Math.round(rows.reduce((sum, row) => sum + row.computed.dailyScore, 0) / trackedCount)
    : 0;
  const streakDays = rows.filter(row => row.computed.lifeOk).length;
  const studyRows = rows
    .map(row => Number.parseFloat(row.day.studyHours))
    .filter(Number.isFinite);
  const averageStudy = studyRows.length
    ? studyRows.reduce((sum, hours) => sum + hours, 0) / studyRows.length
    : 0;
  const penaltyDays = rows.filter(row => row.day.masturbating).length;

  els.insightTrackedDays.textContent = trackedCount;
  els.insightAverageScore.textContent = averageScore;
  els.insightStreakDays.textContent = streakDays;
  els.insightAverageStudy.textContent = `${formatNumber(averageStudy)}h`;
  els.insightPenaltyDays.textContent = penaltyDays;

  renderScoreTrend(rows.slice(-14));
  renderWeeklyScoreTrend(rows);
  renderHabitConsistency(rows);
  renderScoreDrivers(rows);
  renderModeComparison(rows);
  renderRelationshipInsights(rows);
  renderInsightNotes(rows, stats, averageScore, averageStudy);
}

function renderScoreTrend(rows) {
  if (rows.length === 0) {
    els.scoreTrend.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  els.scoreTrend.innerHTML = rows.map(row => `
    <article class="score-bar" title="${formatShortDate(row.date)}: ${row.computed.dailyScore}">
      <div style="height: ${Math.max(row.computed.dailyScore, 4)}%"></div>
      <span>${formatShortDate(row.date)}</span>
    </article>
  `).join("");
}

function renderWeeklyScoreTrend(rows) {
  if (rows.length === 0) {
    els.weeklyScoreTrend.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  const weeks = new Map();
  for (const row of rows) {
    const week = weekStart(row.date);
    const current = weeks.get(week) || { week, scores: [] };
    current.scores.push(row.computed.dailyScore);
    weeks.set(week, current);
  }

  const weekRows = [...weeks.values()]
    .map(item => ({
      week: item.week,
      average: Math.round(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length),
      days: item.scores.length,
    }))
    .slice(-8);

  els.weeklyScoreTrend.innerHTML = weekRows.map(row => `
    <article class="weekly-score-bar" title="Week of ${formatShortDate(row.week)}: ${row.average}">
      <div style="height: ${Math.max(row.average, 4)}%"></div>
      <span>${formatShortDate(row.week)}</span>
      <strong>${row.average}</strong>
    </article>
  `).join("");
}

function renderHabitConsistency(rows) {
  const habits = [
    { label: "Supplements", value: row => row.day.supplements },
    { label: "Floss", value: row => row.day.floss },
    { label: "Leg Exercise", value: row => row.day.legExercise },
    { label: "Mental", value: row => row.day.mentalRoutine },
    { label: "Study 7h", value: row => row.computed.studyOk, available: row => row.computed.mode === "semester" },
    { label: "Sports", value: row => row.day.sports, available: row => row.computed.mode === "break" },
    { label: "4th Meal", value: row => row.day.fourthMeal, available: row => row.computed.mode === "break" },
    { label: "Back Stretch", value: row => row.day.backStretching, available: row => row.computed.mode === "break" },
    { label: "Sleep 8h", value: row => row.computed.sleepOk },
    { label: "Before 00", value: row => row.computed.asleepOk },
    { label: "Wake 8:30", value: row => row.computed.wakeOk },
    { label: "No Social", value: row => row.day.noSocialMedia },
    { label: "No Porn", value: row => row.day.noPorn },
  ];

  if (rows.length === 0) {
    els.habitConsistency.innerHTML = `<p class="empty-insight">Track a few days to see patterns.</p>`;
    return;
  }

  els.habitConsistency.innerHTML = habits.map(habit => {
    const availableRows = rows.filter(row => !habit.available || habit.available(row));
    const percent = availableRows.length
      ? Math.round((availableRows.filter(row => habit.value(row)).length / availableRows.length) * 100)
      : null;
    return `
      <article class="habit-row">
        <span>${habit.label}</span>
        <div class="habit-meter"><div style="width: ${percent ?? 0}%"></div></div>
        <strong>${percent === null ? "n/a" : `${percent}%`}</strong>
      </article>
    `;
  }).join("");
}

function renderScoreDrivers(rows) {
  if (rows.length === 0) {
    els.scoreDrivers.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  const losses = new Map();
  for (const row of rows) {
    const weight = 100 / row.computed.scoreItems.length;
    for (const item of row.computed.scoreItems) {
      const current = losses.get(item.label) || { label: item.label, lost: 0, count: 0 };
      current.lost += (1 - item.value) * weight;
      current.count += 1;
      losses.set(item.label, current);
    }
    if (row.day.masturbating) {
      const current = losses.get("Masturbating penalty") || { label: "Masturbating penalty", lost: 0, count: 0 };
      current.lost += 10;
      current.count += 1;
      losses.set("Masturbating penalty", current);
    }
  }

  const drivers = [...losses.values()]
    .map(item => ({ ...item, averageLoss: item.lost / rows.length }))
    .sort((a, b) => b.averageLoss - a.averageLoss);
  const worst = drivers.slice(0, 5);
  const best = drivers.filter(item => item.averageLoss === 0).slice(0, 3);

  els.scoreDrivers.innerHTML = `
    <div class="mini-section">
      <strong>Biggest score losses</strong>
      ${worst.map(item => insightListRow(item.label, `${formatNumber(item.averageLoss)} pts/day`, Math.min(item.averageLoss * 4, 100))).join("")}
    </div>
    <div class="mini-section">
      <strong>Most stable</strong>
      ${best.length
        ? best.map(item => insightListRow(item.label, "0 pts lost", 100)).join("")
        : `<p class="empty-insight">No habit was perfect across this window.</p>`}
    </div>
  `;
}

function renderModeComparison(rows) {
  const modes = ["semester", "break"].map(mode => {
    const modeRows = rows.filter(row => row.computed.mode === mode);
    const count = modeRows.length;
    const averageScore = average(modeRows.map(row => row.computed.dailyScore));
    const streakRate = percentOf(modeRows, row => row.computed.lifeOk);
    const sleepRate = percentOf(modeRows, row => row.computed.sleepOk);
    const avoidanceRate = percentOf(modeRows, row => row.day.noSocialMedia && row.day.noPorn && !row.day.masturbating);
    const penaltyDays = modeRows.filter(row => row.day.masturbating).length;
    return { mode, count, averageScore, streakRate, sleepRate, avoidanceRate, penaltyDays };
  });

  if (rows.length === 0) {
    els.modeComparison.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  els.modeComparison.innerHTML = modes.map(item => `
    <article class="mode-card">
      <strong>${item.mode === "semester" ? "Semester" : "Break"}</strong>
      <span>${item.count} day${item.count === 1 ? "" : "s"}</span>
      <dl>
        <div><dt>Avg score</dt><dd>${item.averageScore === null ? "n/a" : Math.round(item.averageScore)}</dd></div>
        <div><dt>80+ days</dt><dd>${item.streakRate === null ? "n/a" : `${item.streakRate}%`}</dd></div>
        <div><dt>Sleep ok</dt><dd>${item.sleepRate === null ? "n/a" : `${item.sleepRate}%`}</dd></div>
        <div><dt>Clean avoid</dt><dd>${item.avoidanceRate === null ? "n/a" : `${item.avoidanceRate}%`}</dd></div>
        <div><dt>Penalty</dt><dd>${item.penaltyDays}</dd></div>
      </dl>
    </article>
  `).join("");
}

function renderRelationshipInsights(rows) {
  if (rows.length === 0) {
    els.relationshipInsights.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  const sleepKnown = rows.filter(row => row.day.bedtime && row.day.wakeTime);
  const sleepOkRows = sleepKnown.filter(row => row.computed.sleepOk);
  const sleepMissRows = sleepKnown.filter(row => !row.computed.sleepOk);
  const sleepOkScore = average(sleepOkRows.map(row => scoreWithoutGroups(row, ["sleep"])));
  const sleepMissScore = average(sleepMissRows.map(row => scoreWithoutGroups(row, ["sleep"])));

  const studyKnown = rows.filter(row => row.computed.mode === "semester" && Number.isFinite(Number.parseFloat(row.day.studyHours)));
  const studyOkRows = studyKnown.filter(row => row.computed.studyOk);
  const studyMissRows = studyKnown.filter(row => !row.computed.studyOk);
  const studyOkScore = average(studyOkRows.map(row => scoreWithoutGroups(row, ["study"])));
  const studyMissScore = average(studyMissRows.map(row => scoreWithoutGroups(row, ["study"])));

  els.relationshipInsights.innerHTML = [
    relationshipCard(
      "Sleep vs score",
      "Compares days after removing sleep points from the score.",
      sleepOkRows.length,
      sleepMissRows.length,
      sleepOkScore,
      sleepMissScore,
      "8h+ sleep",
      "missed sleep",
    ),
    relationshipCard(
      "Study vs score",
      "Compares semester days after removing study points from the score.",
      studyOkRows.length,
      studyMissRows.length,
      studyOkScore,
      studyMissScore,
      "7h+ study",
      "below 7h",
    ),
  ].join("");
}

function relationshipCard(title, detail, goodCount, missCount, goodScore, missScore, goodLabel, missLabel) {
  const diff = goodScore === null || missScore === null ? null : Math.round(goodScore - missScore);
  return `
    <article class="relationship-card">
      <div>
        <strong>${title}</strong>
        <span>${detail}</span>
      </div>
      <div class="relationship-values">
        <p><span>${goodLabel}</span><strong>${goodScore === null ? "n/a" : Math.round(goodScore)}</strong><small>${goodCount}d</small></p>
        <p><span>${missLabel}</span><strong>${missScore === null ? "n/a" : Math.round(missScore)}</strong><small>${missCount}d</small></p>
        <p><span>Difference</span><strong>${diff === null ? "n/a" : `${diff > 0 ? "+" : ""}${diff}`}</strong><small>pts</small></p>
      </div>
    </article>
  `;
}

function insightListRow(label, value, width) {
  return `
    <article class="insight-list-row">
      <span>${label}</span>
      <div><div style="width: ${Math.max(4, width)}%"></div></div>
      <strong>${value}</strong>
    </article>
  `;
}

function renderInsightNotes(rows, stats, averageScore, averageStudy) {
  const notes = [];
  if (rows.length === 0) {
    notes.push("No tracked days yet. Start logging and this area will become useful.");
  } else {
    const best = rows.reduce((top, row) => row.computed.dailyScore > top.computed.dailyScore ? row : top, rows[0]);
    const habitRates = insightHabitRates(rows);
    const weakest = habitRates.reduce((low, item) => item.percent < low.percent ? item : low, habitRates[0]);
    notes.push(`Best recent day: ${formatShortDate(best.date)} with ${best.computed.dailyScore} points.`);
    notes.push(`Current life streak: ${stats.life.current} day${stats.life.current === 1 ? "" : "s"}.`);
    notes.push(`Weakest tracked area: ${weakest.label} at ${weakest.percent}%.`);
    if (averageScore >= 80) {
      notes.push("Your recent average is streak-level.");
    } else {
      notes.push(`Recent average is ${Math.max(0, 80 - averageScore)} points below streak-level.`);
    }
    if (averageStudy > 0) {
      notes.push(`Average study on logged study days: ${formatNumber(averageStudy)} hours.`);
    }
    const noPornClean = longestCleanStreak(rows, row => row.day.noPorn);
    const noSocialClean = longestCleanStreak(rows, row => row.day.noSocialMedia);
    const noMasturbatingClean = longestCleanStreak(rows, row => !row.day.masturbating);
    notes.push(`Longest clean streaks: no porn ${noPornClean}d, no social ${noSocialClean}d, no masturbating ${noMasturbatingClean}d.`);
  }

  els.insightNotes.innerHTML = notes.map(note => `<li>${note}</li>`).join("");
}

function longestCleanStreak(rows, isClean) {
  let current = 0;
  let best = 0;
  for (const row of rows) {
    current = isClean(row) ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function scoreWithoutGroups(row, excludedGroups) {
  const items = row.computed.scoreItems.filter(item => !excludedGroups.includes(item.group));
  if (items.length === 0) return null;
  const completed = items.reduce((sum, item) => sum + item.value, 0);
  return Math.max(0, Math.round((completed / items.length) * 100) - row.computed.penalty);
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function percentOf(rows, predicate) {
  return rows.length ? Math.round((rows.filter(predicate).length / rows.length) * 100) : null;
}

function insightHabitRates(rows) {
  const habits = [
    { label: "Supplements", value: row => row.day.supplements },
    { label: "Floss", value: row => row.day.floss },
    { label: "Leg Exercise", value: row => row.day.legExercise },
    { label: "Mental Routine", value: row => row.day.mentalRoutine },
    { label: "Study 7h", value: row => row.computed.studyOk, available: row => row.computed.mode === "semester" },
    { label: "Sports", value: row => row.day.sports, available: row => row.computed.mode === "break" },
    { label: "4th Meal", value: row => row.day.fourthMeal, available: row => row.computed.mode === "break" },
    { label: "Back Stretching", value: row => row.day.backStretching, available: row => row.computed.mode === "break" },
    { label: "8h Sleep", value: row => row.computed.sleepOk },
    { label: "No Social Media", value: row => row.day.noSocialMedia },
    { label: "No Porn", value: row => row.day.noPorn },
  ];
  return habits
    .map(habit => {
      const availableRows = rows.filter(row => !habit.available || habit.available(row));
      return {
        label: habit.label,
        percent: availableRows.length
          ? Math.round((availableRows.filter(row => habit.value(row)).length / availableRows.length) * 100)
          : null,
      };
    })
    .filter(habit => habit.percent !== null);
}

function trackedDates() {
  return sortedDates().filter(date => date <= activeDate && hasTrackedData(ensureDay(date)));
}

function hasTrackedData(day) {
  return Boolean(
    day.supplements ||
    day.floss ||
    day.legExercise ||
    day.mentalRoutine ||
    day.sports ||
    day.fourthMeal ||
    day.backStretching ||
    (day.studyHours !== "") ||
    day.bedtime ||
    day.wakeTime ||
    day.noSocialMedia ||
    day.noPorn ||
    day.masturbating ||
    day.freezeUsed ||
    (day.mode && day.mode !== "semester")
  );
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

function noPornStreakAt(date) {
  if (date <= noPornStreakAnchorDate) {
    return Math.max(0, noPornStreakAnchorDays - daysBetween(date, noPornStreakAnchorDate));
  }

  let streak = noPornStreakAnchorDays;
  let cursor = addDays(noPornStreakAnchorDate, 1);
  while (cursor <= date) {
    const day = state.days[cursor];
    if (!day?.noPorn) {
      return cursor === date ? streak : 0;
    }
    streak += 1;
    cursor = addDays(cursor, 1);
  }
  return streak;
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

function daysBetween(start, end) {
  const startDateValue = new Date(`${start}T12:00:00`);
  const endDateValue = new Date(`${end}T12:00:00`);
  return Math.round((endDateValue - startDateValue) / 86400000);
}

function weekStart(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return toIsoDate(date);
}

function maxDate(a, b) {
  return a > b ? a : b;
}

function formatShortDate(iso) {
  const [, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1).replace(".0", "") : "0";
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
    navigator.serviceWorker.register("sw.js")
      .then(registration => registration.update())
      .catch(() => {
        // The tracker still works as a normal website if install support is unavailable.
      });
  });
}
