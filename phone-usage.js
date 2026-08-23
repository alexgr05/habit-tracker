(function () {
  if (typeof loadPhoneUsageDays === "function") return;

  const panel = document.querySelector("#phoneUsageInsights");
  if (!panel) return;

  const emptyPhoneUsage = {
    totalScreenMinutes: null,
    socialMinutes: null,
    lateNightMinutes: null,
  };
  let phoneUsageByDate = {};
  let loadedForUser = "";

  const originalRenderInsights = renderInsights;
  renderInsights = function renderInsightsWithPhoneUsage(stats) {
    originalRenderInsights(stats);
    renderPhoneUsageInsights();
  };

  window.setInterval(() => {
    if (!currentUser?.id || currentUser.id === loadedForUser) return;
    loadPhoneUsageDays();
  }, 1000);

  async function loadPhoneUsageDays() {
    if (!currentUser || !supabaseClient) return;
    loadedForUser = currentUser.id;
    const { data, error } = await supabaseClient
      .from("phone_usage_days")
      .select("date,total_screen_minutes,social_minutes,late_night_minutes")
      .order("date", { ascending: true });

    if (error) {
      phoneUsageByDate = {};
      renderPhoneUsageInsights();
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
    render();
  }

  function renderPhoneUsageInsights() {
    const rows = trackedDates().map(date => ({
      date,
      phone: phoneUsageByDate[date] || emptyPhoneUsage,
    }));
    const phoneRows = rows.filter(row => hasPhoneUsage(row.phone));
    if (phoneRows.length === 0) {
      panel.innerHTML = `<p class="empty-insight">No Android phone usage data yet.</p>`;
      return;
    }

    const latest = [...phoneRows].reverse()[0];
    const avgTotal = average(phoneRows.map(row => row.phone.totalScreenMinutes).filter(Number.isFinite));
    const avgSocial = average(phoneRows.map(row => row.phone.socialMinutes).filter(Number.isFinite));
    const avgLate = average(phoneRows.map(row => row.phone.lateNightMinutes).filter(Number.isFinite));

    panel.innerHTML = [
      phoneUsageCard("Latest total", formatMinutes(avgValue(latest.phone.totalScreenMinutes)), formatShortDate(latest.date)),
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

  function avgValue(value) {
    return Number.isFinite(value) ? value : null;
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
})();
