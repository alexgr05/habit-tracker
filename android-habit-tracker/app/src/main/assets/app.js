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
const emptyPhoneUsage = {
  totalScreenMinutes: null,
  socialMinutes: null,
  lateNightMinutes: null,
};
const themes = ["calm", "dark", "light"];
const themeLabels = {
  dark: "Dark",
  light: "Light",
  calm: "Calm Heat 2.0",
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
});

let state = loadState();
let activeDate = isoToday();
let theme = loadTheme();
let currentUser = null;
let phoneUsageByDate = {};
let cloudHydrated = false;
let saveTimer = null;
let syncInProgress = false;
let passwordRecoveryMode = false;
const pendingSaveDates = new Set();

const els = {
  appViews: document.querySelectorAll(".app-view"),
  viewNavButtons: document.querySelectorAll(".view-nav-button"),
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
  scoreFill: document.querySelector("#scoreFill"),
  lifeThresholdMarker: document.querySelector("#lifeThresholdMarker"),
  scoreStatus: document.querySelector("#scoreStatus"),
  themeToggle: document.querySelector("#themeToggle"),
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
  semesterConsistencyCard: document.querySelector("#semesterConsistencyCard"),
  breakConsistencyCard: document.querySelector("#breakConsistencyCard"),
  semesterHabitConsistency: document.querySelector("#semesterHabitConsistency"),
  breakHabitConsistency: document.querySelector("#breakHabitConsistency"),
  scoreDrivers: document.querySelector("#scoreDrivers"),
  sleepAverages: document.querySelector("#sleepAverages"),
  phoneUsageInsights: document.querySelector("#phoneUsageInsights"),
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
setActiveView("today");

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

els.viewNavButtons.forEach(button => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.viewTarget);
  });
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
  return themes.includes(saved) ? saved : "calm";
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

function setActiveView(view) {
  els.appViews.forEach(section => {
    section.hidden = section.dataset.view !== view;
  });
  els.viewNavButtons.forEach(button => {
    const active = button.dataset.viewTarget === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  window.scrollTo({ top: 0, behavior: "auto" });
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
    await loadPhoneUsageDays();
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

async function loadPhoneUsageDays() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient
    .from("phone_usage_days")
    .select("date,total_screen_minutes,social_minutes,late_night_minutes")
    .order("date", { ascending: true });

  if (error) {
    phoneUsageByDate = {};
    return;
  }

  phoneUsageByDate = Object.fromEntries((data || []).map(row => [
    row.date,
    {
      totalScreenMinutes: row.total_screen_minutes,
      socialMinutes: row.social_minutes,
      lateNightMinutes: row.late_night_minutes,
    },
  ]));
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
  });

  if (!breakMode) {
    updateInputStatus(els.studyCard, els.studyTarget, computed.studyOk, day.studyHours !== "");
  }
  updateInputStatus(els.bedtimeCard, els.asleepTarget, computed.asleepOk, day.bedtime !== "");
  updateInputStatus(els.wakeCard, els.wakeTarget, computed.wakeOk, day.wakeTime !== "");
  updateInputStatus(els.sleepCard, els.sleepTarget, computed.sleepOk, computed.sleepHoursText !== "");

  els.todayScore.textContent = computed.dailyScore;
  els.scoreFill.style.width = `${computed.dailyScore}%`;
  els.lifeThresholdMarker.style.left = `${Math.max(0, Math.min(computed.lifeThreshold, 100))}%`;
  els.lifeThresholdMarker.title = `Life streak target: above ${computed.lifeThreshold}`;
  els.lifeThresholdMarker.setAttribute("aria-label", `Life streak target: above ${computed.lifeThreshold}`);
  els.scoreStatus.textContent = scoreStatus(computed.dailyScore, computed.lifeOk, computed.lifeThreshold);
  els.lifeStreak.textContent = stats.life.current;
  els.bestLife.textContent = stats.life.best;
  els.noPornTileStreak.textContent = `${noPornStreakAt(activeDate)}d`;

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

function scoreStatus(score, lifeOk, threshold) {
  if (score === 100) return "Perfect day burning";
  if (lifeOk) return `Streak burning. Target > ${threshold}`;
  if (score >= 70) return `Strong partial. Target > ${threshold}`;
  if (score >= 40) return "Still in motion";
  return "Open day";
}

function computeDay(date, dynamicThreshold = true) {
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
    health: raw.health,
    mental: raw.mental,
    study: raw.study,
    sleep: raw.sleep,
    avoidance: raw.avoidance,
  };
  const completed = scoreItems.reduce((sum, item) => sum + item.value, 0);
  const penalty = day.masturbating ? 10 : 0;
  const dailyScore = Math.max(0, Math.round((completed / scoreItems.length) * 100) - penalty);
  const lifeThreshold = dynamicThreshold ? lifeStreakThreshold(date) : 80;
  const lifeOk = dailyScore > lifeThreshold;

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
    lifeThreshold,
    dailyScore,
    sleepHours,
    sleepHoursText: Number.isFinite(sleepHours) ? sleepHours.toFixed(1) : "",
  };
}

function lifeStreakThreshold(date) {
  const previousScores = sortedDates()
    .filter(dayDate => dayDate < date && state.days[dayDate] && hasTrackedData(state.days[dayDate]))
    .slice(-10)
    .map(dayDate => computeDay(dayDate, false).dailyScore);

  if (previousScores.length === 0) return 80;
  return Math.round(previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length);
}

function computeStats() {
  const dates = sortedDates();
  const stats = {};
  for (const category of categories) {
    stats[category.key] = {
      current: 0,
      best: 0,
      today: "Open",
    };
  }

  const streaks = Object.fromEntries(categories.map(category => [category.key, 0]));
  const bests = Object.fromEntries(categories.map(category => [category.key, 0]));

  for (const date of dates) {
    const computed = computeDay(date);
    for (const key of ["health", "mental", "study", "sleep", "avoidance"]) {
      const ok = computed.ok[key];
      streaks[key] = ok ? streaks[key] + 1 : 0;
      bests[key] = Math.max(bests[key], streaks[key]);
    }
    streaks.life = computed.lifeOk ? streaks.life + 1 : 0;
    bests.life = Math.max(bests.life, streaks.life);
  }

  for (const key of ["health", "mental", "study", "sleep", "avoidance"]) {
    stats[key].current = streaks[key];
    stats[key].best = bests[key];
    stats[key].today = computeDay(activeDate).ok[key] ? "Active" : "Open";
  }
  stats.life.current = streaks.life;
  stats.life.best = bests.life;
  stats.life.today = computeDay(activeDate).lifeOk ? "Active" : "Partial";

  return stats;
}

function renderInsights(stats) {
  const days = trackedDates();
  const rows = days.map(date => {
    const day = ensureDay(date);
    const computed = computeDay(date);
    const phone = phoneUsageByDate[date] || emptyPhoneUsage;
    return { date, day, computed, phone };
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
  renderSleepAverages(rows);
  renderPhoneUsageInsights(rows);
  renderInsightNotes(rows, stats, averageScore, averageStudy, computeDay(activeDate).lifeThreshold);
}

function renderScoreTrend(rows) {
  if (rows.length === 0) {
    els.scoreTrend.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  els.scoreTrend.innerHTML = trendChart(
    rows.map(row => ({
      label: formatShortDate(row.date),
      value: row.computed.dailyScore,
      title: `${formatShortDate(row.date)}: ${row.computed.dailyScore}`,
    })),
    { averageWindow: 10, showValue: false }
  );
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

  els.weeklyScoreTrend.innerHTML = trendChart(
    weekRows.map(row => ({
      label: formatShortDate(row.week),
      value: row.average,
      title: `Week of ${formatShortDate(row.week)}: ${row.average}`,
    })),
    { averageWindow: 1, showValue: true }
  );
}

function trendChart(points, options = {}) {
  const averageWindow = options.averageWindow || 1;
  const movingAverage = points.map((point, index) => {
    const windowPoints = points.slice(Math.max(0, index - averageWindow + 1), index + 1);
    return Math.round(windowPoints.reduce((sum, item) => sum + item.value, 0) / windowPoints.length);
  });
  const trendDelta = movingAverage.length > 1 ? movingAverage[movingAverage.length - 1] - movingAverage[0] : 0;
  const svgPoints = movingAverage.map((value, index) => {
    const x = movingAverage.length === 1 ? 50 : (index / (movingAverage.length - 1)) * 100;
    const y = 100 - Math.max(0, Math.min(value, 100));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const trendLabel = trendDelta > 0 ? `+${trendDelta}` : `${trendDelta}`;

  return `
    <div class="trend-chart">
      <div class="trend-bars" style="--bar-count: ${points.length}">
        ${points.map((point, index) => `
          <article class="score-bar${index === points.length - 1 ? " is-current" : ""}" title="${point.title}">
            <div style="height: ${Math.max(point.value, 4)}%"></div>
            <span>${point.label}</span>
            ${options.showValue ? `<strong>${point.value}</strong>` : ""}
          </article>
        `).join("")}
      </div>
      <svg class="trend-average" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${svgPoints}" />
      </svg>
      <span class="trend-badge ${trendDelta >= 0 ? "is-up" : "is-down"}">${averageWindow > 1 ? `${averageWindow}d avg ` : "trend "}${trendLabel}</span>
    </div>
  `;
}

function renderHabitConsistency(rows) {
  const sharedHabits = [
    { label: "Supplements", value: row => row.day.supplements },
    { label: "Floss", value: row => row.day.floss },
    { label: "Leg Exercise", value: row => row.day.legExercise },
    { label: "Mental", value: row => row.day.mentalRoutine },
    { label: "Sleep 8h", value: row => row.computed.sleepOk },
    { label: "Before 00", value: row => row.computed.asleepOk },
    { label: "Wake 8:30", value: row => row.computed.wakeOk },
    { label: "No Social", value: row => row.day.noSocialMedia },
    { label: "No Porn", value: row => row.day.noPorn },
    { label: "No Masturbating", value: row => !row.day.masturbating },
  ];
  const semesterHabits = [
    ...sharedHabits.slice(0, 4),
    { label: "Study 7h", value: row => row.computed.studyOk },
    ...sharedHabits.slice(4),
  ];
  const breakHabits = [
    ...sharedHabits.slice(0, 4),
    { label: "Sports", value: row => row.day.sports },
    { label: "4th Meal", value: row => row.day.fourthMeal },
    { label: "Back Stretch", value: row => row.day.backStretching },
    ...sharedHabits.slice(4),
  ];
  const activeMode = computeDay(activeDate).mode;
  els.semesterConsistencyCard.hidden = activeMode !== "semester";
  els.breakConsistencyCard.hidden = activeMode !== "break";

  renderPhaseHabitConsistency(
    els.semesterHabitConsistency,
    rows.filter(row => row.computed.mode === "semester"),
    semesterHabits,
    "No semester days tracked yet."
  );
  renderPhaseHabitConsistency(
    els.breakHabitConsistency,
    rows.filter(row => row.computed.mode === "break"),
    breakHabits,
    "No break days tracked yet."
  );
}

function renderPhaseHabitConsistency(element, rows, habits, emptyMessage) {
  if (rows.length === 0) {
    element.innerHTML = `<p class="empty-insight">${emptyMessage}</p>`;
    return;
  }

  element.innerHTML = habits.map(habit => {
    const percent = Math.round((rows.filter(row => habit.value(row)).length / rows.length) * 100);
    return `
      <article class="habit-row">
        <span>${habit.label}</span>
        <div class="habit-meter"><div style="width: ${percent}%"></div></div>
        <strong>${percent}%</strong>
      </article>
    `;
  }).join("");
}

function renderScoreDrivers(rows) {
  if (rows.length === 0) {
    els.scoreDrivers.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
    return;
  }

  const drivers = relationshipHabitDefinitions()
    .map(habit => relationshipDriver(rows, habit))
    .filter(driver => driver && driver.difference > 0)
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 3);

  if (drivers.length === 0) {
    els.scoreDrivers.innerHTML = `<p class="empty-insight">Track fulfilled and missed days for habits to see score drivers.</p>`;
    return;
  }

  const maxDifference = Math.max(...drivers.map(driver => driver.difference));
  els.scoreDrivers.innerHTML = drivers.map(driver => {
    const width = maxDifference > 0 ? (driver.difference / maxDifference) * 100 : 0;
    return insightListRow(
      driver.label,
      `+${formatNumber(driver.difference)} pts`,
      width,
      `${Math.round(driver.fulfilledScore)} vs ${Math.round(driver.missedScore)}`
    );
  }).join("");
}

function renderSleepAverages(rows) {
  const bedtimeAverage = averageClockTime(
    rows.map(row => row.day.bedtime).filter(Boolean),
    true
  );
  const wakeAverage = averageClockTime(rows.map(row => row.day.wakeTime).filter(Boolean));
  const sleepAverage = average(rows.map(row => row.computed.sleepHours).filter(Number.isFinite));

  if (bedtimeAverage === null && wakeAverage === null && sleepAverage === null) {
    els.sleepAverages.innerHTML = `<p class="empty-insight">No sleep data tracked yet.</p>`;
    return;
  }

  els.sleepAverages.innerHTML = [
    sleepAverageCard("Bedtime", formatClockMinutes(bedtimeAverage), "average"),
    sleepAverageCard("Wake Time", formatClockMinutes(wakeAverage), "average"),
    sleepAverageCard("Sleep Time", sleepAverage === null ? "n/a" : `${formatNumber(sleepAverage)}h`, "average"),
  ].join("");
}

function sleepAverageCard(label, value, detail) {
  return `
    <article class="sleep-average-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </article>
  `;
}

function renderPhoneUsageInsights(rows) {
  const phoneRows = rows.filter(row => hasPhoneUsage(row.phone));
  if (phoneRows.length === 0) {
    els.phoneUsageInsights.innerHTML = `<p class="empty-insight">No Android phone usage data yet.</p>`;
    return;
  }

  const latest = [...phoneRows].reverse()[0];
  const avgTotal = average(phoneRows.map(row => row.phone.totalScreenMinutes).filter(Number.isFinite));
  const avgSocial = average(phoneRows.map(row => row.phone.socialMinutes).filter(Number.isFinite));
  const avgLate = average(phoneRows.map(row => row.phone.lateNightMinutes).filter(Number.isFinite));

  els.phoneUsageInsights.innerHTML = [
    phoneUsageCard("Latest total", formatMinutes(latest.phone.totalScreenMinutes), formatShortDate(latest.date)),
    phoneUsageCard("Avg total", formatMinutes(avgTotal), `${phoneRows.length}d`),
    phoneUsageCard("Avg social", formatMinutes(avgSocial), "tracked days"),
    phoneUsageCard("Avg late night", formatMinutes(avgLate), "after 00:00"),
  ].join("");
}

function phoneUsageCard(label, value, detail) {
  return `
    <article class="phone-usage-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </article>
  `;
}

function hasPhoneUsage(phone) {
  return [phone.totalScreenMinutes, phone.socialMinutes, phone.lateNightMinutes].some(Number.isFinite);
}

function relationshipHabitDefinitions() {
  return [
    { label: "Supplements", fulfilled: row => row.day.supplements },
    { label: "Floss", fulfilled: row => row.day.floss },
    { label: "Leg Exercise", fulfilled: row => row.day.legExercise },
    { label: "Mental Routine", fulfilled: row => row.day.mentalRoutine },
    { label: "Study Hours", fulfilled: row => row.computed.studyOk, available: row => row.computed.mode === "semester" },
    { label: "Sports", fulfilled: row => row.day.sports, available: row => row.computed.mode === "break" },
    { label: "4th Meal", fulfilled: row => row.day.fourthMeal, available: row => row.computed.mode === "break" },
    { label: "Back Stretching", fulfilled: row => row.day.backStretching, available: row => row.computed.mode === "break" },
    { label: "Before 00", fulfilled: row => row.computed.asleepOk, available: row => row.day.bedtime },
    { label: "Wake 8:30", fulfilled: row => row.computed.wakeOk, available: row => row.day.wakeTime },
    { label: "8h Sleep", fulfilled: row => row.computed.sleepOk, available: row => row.day.bedtime && row.day.wakeTime },
    { label: "No Social Media", fulfilled: row => row.day.noSocialMedia },
    { label: "No Porn", fulfilled: row => row.day.noPorn },
    { label: "No Masturbating", fulfilled: row => !row.day.masturbating },
  ];
}

function relationshipDriver(rows, habit) {
  const availableRows = rows.filter(row => !habit.available || habit.available(row));
  const fulfilledRows = availableRows.filter(row => habit.fulfilled(row));
  const missedRows = availableRows.filter(row => !habit.fulfilled(row));
  if (fulfilledRows.length === 0 || missedRows.length === 0) return null;

  const fulfilledScore = average(fulfilledRows.map(row => row.computed.dailyScore));
  const missedScore = average(missedRows.map(row => row.computed.dailyScore));
  if (fulfilledScore === null || missedScore === null) return null;

  return {
    label: habit.label,
    fulfilledCount: fulfilledRows.length,
    missedCount: missedRows.length,
    fulfilledScore,
    missedScore,
    difference: fulfilledScore - missedScore,
  };
}

function insightListRow(label, value, width, detail = "") {
  return `
    <article class="insight-list-row">
      <span>${label}${detail ? `<small>${detail}</small>` : ""}</span>
      <div><div style="width: ${Math.max(4, width)}%"></div></div>
      <strong>${value}</strong>
    </article>
  `;
}

function renderInsightNotes(rows, stats, averageScore, averageStudy, activeLifeThreshold) {
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
    if (averageScore > activeLifeThreshold) {
      notes.push(`Your recent average is above the current streak target of ${activeLifeThreshold}.`);
    } else {
      notes.push(`Recent average is ${Math.max(0, activeLifeThreshold - averageScore + 1)} points below the current streak target.`);
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

function averageClockTime(values, wrapsMidnight = false) {
  const minutes = values
    .map(minutesFromTime)
    .filter(value => value !== null)
    .map(value => wrapsMidnight && value < 12 * 60 ? value + 24 * 60 : value);
  if (minutes.length === 0) return null;
  const averageMinutes = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  return averageMinutes % (24 * 60);
}

function formatClockMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "n/a";
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mins = String(normalized % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "n/a";
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
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

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(registration => registration.update())
      .catch(() => {
        // The tracker still works as a normal website if install support is unavailable.
      });
  });
}
