(function () {
  const panel = document.querySelector("#relationshipInsights");
  if (!panel || typeof renderRelationshipInsights !== "function") return;

  renderRelationshipInsights = function renderTopRelationshipDrivers(rows) {
    if (rows.length === 0) {
      panel.innerHTML = `<p class="empty-insight">No tracked days yet.</p>`;
      return;
    }

    const drivers = relationshipHabitDefinitions()
      .map(habit => relationshipDriver(rows, habit))
      .filter(Boolean)
      .sort((a, b) => b.difference - a.difference)
      .slice(0, 3);

    if (drivers.length === 0) {
      panel.innerHTML = `<p class="empty-insight">Track fulfilled and missed days for habits to see score drivers.</p>`;
      return;
    }

    panel.innerHTML = drivers.map(relationshipDriverCard).join("");
  };

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

    const fulfilledScore = averageScore(fulfilledRows);
    const missedScore = averageScore(missedRows);
    return {
      label: habit.label,
      fulfilledCount: fulfilledRows.length,
      missedCount: missedRows.length,
      fulfilledScore,
      missedScore,
      difference: fulfilledScore - missedScore,
    };
  }

  function averageScore(rows) {
    return rows.reduce((sum, row) => sum + row.computed.dailyScore, 0) / rows.length;
  }

  function relationshipDriverCard(driver) {
    const diff = Math.round(driver.difference);
    return `
      <article class="relationship-card">
        <div>
          <strong>${driver.label}</strong>
          <span>Average score difference on fulfilled vs missed days.</span>
        </div>
        <div class="relationship-values">
          <p><span>Fulfilled</span><strong>${Math.round(driver.fulfilledScore)}</strong><small>${driver.fulfilledCount}d</small></p>
          <p><span>Missed</span><strong>${Math.round(driver.missedScore)}</strong><small>${driver.missedCount}d</small></p>
          <p><span>Difference</span><strong>${diff > 0 ? "+" : ""}${diff}</strong><small>pts</small></p>
        </div>
      </article>
    `;
  }
})();
