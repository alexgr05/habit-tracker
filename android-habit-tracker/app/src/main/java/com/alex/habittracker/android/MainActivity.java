package com.alex.habittracker.android;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends android.app.Activity {
    private static final String SUPABASE_URL = "https://ojgffpfrgqkvaenkotwu.supabase.co";
    private static final String SUPABASE_KEY = "sb_publishable_6HKUhHOR5A1F1nkzr62NhQ_QNvhjgMD";
    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final int COLOR_BG = Color.rgb(16, 13, 10);
    private static final int COLOR_PANEL = Color.rgb(33, 25, 21);
    private static final int COLOR_PANEL_STRONG = Color.rgb(43, 33, 26);
    private static final int COLOR_INK = Color.rgb(255, 243, 225);
    private static final int COLOR_MUTED = Color.rgb(207, 186, 165);
    private static final int COLOR_LINE = Color.rgb(73, 56, 45);
    private static final int COLOR_AMBER = Color.rgb(240, 168, 74);
    private static final int COLOR_RED = Color.rgb(229, 122, 99);

    private final Map<String, Button> toggleButtons = new LinkedHashMap<>();
    private EditText emailInput;
    private EditText passwordInput;
    private EditText studyInput;
    private EditText bedtimeInput;
    private EditText wakeInput;
    private TextView statusText;
    private TextView scoreText;
    private TextView modeText;
    private String accessToken;
    private String userId;
    private DayState day = new DayState();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        renderDay();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(COLOR_BG);
        LinearLayout root = column();
        root.setPadding(dp(18), dp(22), dp(18), dp(28));
        scroll.addView(root);

        TextView title = text("Habit Tracker", 28, COLOR_INK, true);
        root.addView(title, matchWrap());

        TextView subtitle = text("Native Android Today page. Data stays synced with the web app.", 14, COLOR_MUTED, false);
        subtitle.setPadding(0, dp(4), 0, dp(14));
        root.addView(subtitle, matchWrap());

        LinearLayout account = card();
        root.addView(account, matchWrap());
        account.addView(label("Account"));
        emailInput = input("Supabase email", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        account.addView(emailInput, matchWrap());
        passwordInput = input("Supabase password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        passwordInput.setTransformationMethod(PasswordTransformationMethod.getInstance());
        account.addView(passwordInput, matchWrap());
        Button signIn = secondaryButton("Sign in and load today");
        signIn.setOnClickListener(view -> signInAndLoad());
        account.addView(signIn, matchWrap());

        LinearLayout today = card();
        root.addView(today, matchWrap());
        today.addView(label("Today"));

        LinearLayout modeRow = row();
        Button semester = secondaryButton("Semester");
        semester.setOnClickListener(view -> setMode("semester"));
        Button breakMode = secondaryButton("Break");
        breakMode.setOnClickListener(view -> setMode("break"));
        modeRow.addView(semester, weightWrap());
        modeRow.addView(breakMode, weightWrap());
        today.addView(modeRow, matchWrap());
        modeText = text("", 13, COLOR_MUTED, false);
        today.addView(modeText, matchWrap());

        addToggle(today, "supplements", "Supplements");
        addToggle(today, "floss", "Floss");
        addToggle(today, "legExercise", "Leg Exercise");
        addToggle(today, "mentalRoutine", "Mental Routine");
        addToggle(today, "sports", "Sports");
        addToggle(today, "fourthMeal", "4th Meal");
        addToggle(today, "backStretching", "Back Stretching");
        addToggle(today, "noSocialMedia", "No Social Media");
        addToggle(today, "noPorn", "No Porn");
        addToggle(today, "masturbating", "Masturbating -10");

        studyInput = input("Study hours", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        studyInput.setOnFocusChangeListener((view, hasFocus) -> { if (!hasFocus) syncInputsToDay(); });
        today.addView(studyInput, matchWrap());

        bedtimeInput = input("Bedtime, e.g. 23:30", InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
        bedtimeInput.setOnFocusChangeListener((view, hasFocus) -> { if (!hasFocus) syncInputsToDay(); });
        today.addView(bedtimeInput, matchWrap());

        wakeInput = input("Wake time, e.g. 08:00", InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
        wakeInput.setOnFocusChangeListener((view, hasFocus) -> { if (!hasFocus) syncInputsToDay(); });
        today.addView(wakeInput, matchWrap());

        scoreText = text("", 42, COLOR_AMBER, true);
        today.addView(scoreText, matchWrap());

        Button save = primaryButton("Save Today");
        save.setOnClickListener(view -> saveToday());
        today.addView(save, matchWrap());

        statusText = text("Not signed in.", 14, COLOR_MUTED, false);
        root.addView(statusText, matchWrap());

        setContentView(scroll);
    }

    private void signInAndLoad() {
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            setStatus("Enter email and password.");
            return;
        }

        setStatus("Signing in...");
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject().put("email", email).put("password", password);
                JSONObject auth = postJson(SUPABASE_URL + "/auth/v1/token?grant_type=password", body.toString(), null, false);
                accessToken = auth.getString("access_token");
                userId = auth.getJSONObject("user").getString("id");
                loadTodayFromCloud();
                runOnUiThread(() -> setStatus("Signed in. Today loaded."));
            } catch (Exception exception) {
                runOnUiThread(() -> setStatus("Sign-in failed: " + exception.getMessage()));
            }
        }).start();
    }

    private void loadTodayFromCloud() throws Exception {
        String date = LocalDate.now(ZONE).toString();
        String endpoint = SUPABASE_URL + "/rest/v1/habit_days?date=eq." + encode(date) + "&select=data&limit=1";
        JSONArray rows = getJsonArray(endpoint, accessToken);
        if (rows.length() > 0 && !rows.getJSONObject(0).isNull("data")) {
            day = DayState.fromJson(rows.getJSONObject(0).getJSONObject("data"));
        }
        runOnUiThread(this::renderDay);
    }

    private void saveToday() {
        if (accessToken == null || userId == null) {
            setStatus("Sign in first.");
            return;
        }
        syncInputsToDay();
        setStatus("Saving today...");
        new Thread(() -> {
            try {
                JSONArray rows = new JSONArray();
                rows.put(new JSONObject()
                    .put("user_id", userId)
                    .put("date", LocalDate.now(ZONE).toString())
                    .put("data", day.toJson())
                    .put("updated_at", Instant.now().toString()));
                postJson(SUPABASE_URL + "/rest/v1/habit_days?on_conflict=user_id,date", rows.toString(), accessToken, true);
                runOnUiThread(() -> setStatus("Saved to Supabase."));
            } catch (Exception exception) {
                runOnUiThread(() -> setStatus("Save failed: " + exception.getMessage()));
            }
        }).start();
    }

    private void setMode(String mode) {
        day.mode = mode;
        renderDay();
    }

    private void addToggle(LinearLayout parent, String key, String label) {
        Button button = secondaryButton(label);
        button.setOnClickListener(view -> {
            day.setBoolean(key, !day.getBoolean(key));
            renderDay();
        });
        toggleButtons.put(key, button);
        parent.addView(button, matchWrap());
    }

    private void syncInputsToDay() {
        day.studyHours = studyInput.getText().toString().trim();
        day.bedtime = bedtimeInput.getText().toString().trim();
        day.wakeTime = wakeInput.getText().toString().trim();
        renderDay();
    }

    private void renderDay() {
        boolean breakMode = "break".equals(day.mode);
        modeText.setText(breakMode ? "Break mode: sports, 4th meal, back stretching." : "Semester mode: study hours.");
        for (Map.Entry<String, Button> entry : toggleButtons.entrySet()) {
            String key = entry.getKey();
            Button button = entry.getValue();
            boolean visible = !key.equals("sports") && !key.equals("fourthMeal") && !key.equals("backStretching") || breakMode;
            button.setVisibility(visible ? View.VISIBLE : View.GONE);
            boolean on = day.getBoolean(key);
            button.setText((on ? "✓ " : "○ ") + buttonLabel(key));
            button.setTextColor(key.equals("masturbating") && on ? COLOR_RED : (on ? COLOR_AMBER : COLOR_INK));
        }
        studyInput.setVisibility(breakMode ? View.GONE : View.VISIBLE);
        if (!studyInput.hasFocus()) studyInput.setText(day.studyHours);
        if (!bedtimeInput.hasFocus()) bedtimeInput.setText(day.bedtime);
        if (!wakeInput.hasFocus()) wakeInput.setText(day.wakeTime);
        scoreText.setText(computeScore(day) + "/100");
    }

    private int computeScore(DayState value) {
        boolean breakMode = "break".equals(value.mode);
        double studyHours = parseDouble(value.studyHours);
        double studyScore = Double.isNaN(studyHours) ? 0 : Math.max(0, Math.min(studyHours / 7.0, 1));
        double sleepHours = sleepHours(value.bedtime, value.wakeTime);
        int totalItems = breakMode ? 12 : 10;
        double completed = 0;
        completed += value.supplements ? 1 : 0;
        completed += value.floss ? 1 : 0;
        completed += value.legExercise ? 1 : 0;
        completed += value.mentalRoutine ? 1 : 0;
        completed += breakMode ? (value.sports ? 1 : 0) : studyScore;
        completed += beforeMidnight(value.bedtime) ? 1 : 0;
        completed += before0830(value.wakeTime) ? 1 : 0;
        completed += sleepHours >= 8 ? 1 : 0;
        completed += value.noSocialMedia ? 1 : 0;
        completed += value.noPorn ? 1 : 0;
        if (breakMode) {
            completed += value.fourthMeal ? 1 : 0;
            completed += value.backStretching ? 1 : 0;
        }
        int penalty = value.masturbating ? 10 : 0;
        return Math.max(0, (int) Math.round((completed / totalItems) * 100) - penalty);
    }

    private static boolean beforeMidnight(String time) {
        Integer minutes = minutesFromTime(time);
        return minutes != null && minutes < 24 * 60;
    }

    private static boolean before0830(String time) {
        Integer minutes = minutesFromTime(time);
        return minutes != null && minutes <= 510;
    }

    private static double sleepHours(String bedTime, String wakeTime) {
        Integer bed = minutesFromTime(bedTime);
        Integer wake = minutesFromTime(wakeTime);
        if (bed == null || wake == null) return Double.NaN;
        int duration = wake - bed;
        if (duration <= 0) duration += 24 * 60;
        return duration / 60.0;
    }

    private static Integer minutesFromTime(String time) {
        if (time == null || time.trim().isEmpty()) return null;
        try {
            LocalTime parsed = LocalTime.parse(time.trim());
            return parsed.getHour() * 60 + parsed.getMinute();
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private static double parseDouble(String value) {
        if (value == null || value.trim().isEmpty()) return Double.NaN;
        try {
            return Double.parseDouble(value.trim().replace(",", "."));
        } catch (NumberFormatException exception) {
            return Double.NaN;
        }
    }

    private JSONObject postJson(String endpoint, String body, String bearerToken, boolean preferUpsert) throws Exception {
        HttpURLConnection connection = openJsonConnection(endpoint, "POST", bearerToken);
        connection.setDoOutput(true);
        if (preferUpsert) {
            connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal");
        }
        try (OutputStream stream = connection.getOutputStream()) {
            stream.write(body.getBytes(StandardCharsets.UTF_8));
        }
        String response = responseOrThrow(connection);
        return response.isEmpty() ? new JSONObject() : new JSONObject(response);
    }

    private JSONArray getJsonArray(String endpoint, String bearerToken) throws Exception {
        HttpURLConnection connection = openJsonConnection(endpoint, "GET", bearerToken);
        String response = responseOrThrow(connection);
        return response.isEmpty() ? new JSONArray() : new JSONArray(response);
    }

    private HttpURLConnection openJsonConnection(String endpoint, String method, String bearerToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod(method);
        connection.setRequestProperty("apikey", SUPABASE_KEY);
        connection.setRequestProperty("Content-Type", "application/json");
        if (bearerToken != null) {
            connection.setRequestProperty("Authorization", "Bearer " + bearerToken);
        }
        return connection;
    }

    private String responseOrThrow(HttpURLConnection connection) throws Exception {
        int code = connection.getResponseCode();
        String response = readResponse(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
        if (code < 200 || code >= 300) {
            throw new IllegalStateException(response.isEmpty() ? "HTTP " + code : response);
        }
        return response;
    }

    private String readResponse(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private String encode(String value) throws Exception {
        return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
    }

    private Button secondaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(COLOR_INK);
        button.setBackground(cardBackground(COLOR_PANEL_STRONG, COLOR_LINE));
        return button;
    }

    private Button primaryButton(String label) {
        Button button = secondaryButton(label);
        button.setTextColor(Color.rgb(38, 24, 10));
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(cardBackground(COLOR_AMBER, COLOR_AMBER));
        return button;
    }

    private EditText input(String hint, int inputType) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setInputType(inputType);
        input.setSingleLine(true);
        input.setTextColor(COLOR_INK);
        input.setHintTextColor(COLOR_MUTED);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        input.setBackground(cardBackground(COLOR_BG, COLOR_LINE));
        return input;
    }

    private LinearLayout card() {
        LinearLayout card = column();
        card.setPadding(dp(14), dp(14), dp(14), dp(10));
        card.setBackground(cardBackground(COLOR_PANEL, COLOR_LINE));
        return card;
    }

    private LinearLayout column() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout row() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private TextView label(String value) {
        TextView text = text(value.toUpperCase(Locale.ROOT), 12, COLOR_AMBER, true);
        text.setPadding(0, 0, 0, dp(8));
        return text;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        if (bold) text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return text;
    }

    private GradientDrawable cardBackground(int fillColor, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(fillColor);
        drawable.setCornerRadius(dp(10));
        drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(4), 0, dp(8));
        return params;
    }

    private LinearLayout.LayoutParams weightWrap() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.setMargins(0, 0, dp(8), dp(8));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void setStatus(String value) {
        statusText.setText(value);
    }

    private static String buttonLabel(String key) {
        switch (key) {
            case "supplements": return "Supplements";
            case "floss": return "Floss";
            case "legExercise": return "Leg Exercise";
            case "mentalRoutine": return "Mental Routine";
            case "sports": return "Sports";
            case "fourthMeal": return "4th Meal";
            case "backStretching": return "Back Stretching";
            case "noSocialMedia": return "No Social Media";
            case "noPorn": return "No Porn";
            case "masturbating": return "Masturbating -10";
            default: return key;
        }
    }

    private static class DayState {
        String mode = "semester";
        boolean supplements;
        boolean floss;
        boolean legExercise;
        boolean mentalRoutine;
        boolean sports;
        boolean fourthMeal;
        boolean backStretching;
        String studyHours = "";
        String bedtime = "";
        String wakeTime = "";
        boolean noSocialMedia;
        boolean noPorn;
        boolean masturbating;

        static DayState fromJson(JSONObject json) {
            DayState state = new DayState();
            state.mode = json.optString("mode", "semester");
            state.supplements = json.optBoolean("supplements", false);
            state.floss = json.optBoolean("floss", false);
            state.legExercise = json.optBoolean("legExercise", false);
            state.mentalRoutine = json.optBoolean("mentalRoutine", false);
            state.sports = json.optBoolean("sports", false);
            state.fourthMeal = json.optBoolean("fourthMeal", false);
            state.backStretching = json.optBoolean("backStretching", false);
            state.studyHours = json.optString("studyHours", "");
            state.bedtime = json.optString("bedtime", "");
            state.wakeTime = json.optString("wakeTime", "");
            state.noSocialMedia = json.optBoolean("noSocialMedia", false);
            state.noPorn = json.optBoolean("noPorn", false);
            state.masturbating = json.optBoolean("masturbating", false);
            return state;
        }

        JSONObject toJson() throws Exception {
            return new JSONObject()
                .put("mode", mode)
                .put("supplements", supplements)
                .put("floss", floss)
                .put("legExercise", legExercise)
                .put("mentalRoutine", mentalRoutine)
                .put("sports", sports)
                .put("fourthMeal", fourthMeal)
                .put("backStretching", backStretching)
                .put("studyHours", studyHours)
                .put("bedtime", bedtime)
                .put("wakeTime", wakeTime)
                .put("noSocialMedia", noSocialMedia)
                .put("noPorn", noPorn)
                .put("masturbating", masturbating);
        }

        boolean getBoolean(String key) {
            switch (key) {
                case "supplements": return supplements;
                case "floss": return floss;
                case "legExercise": return legExercise;
                case "mentalRoutine": return mentalRoutine;
                case "sports": return sports;
                case "fourthMeal": return fourthMeal;
                case "backStretching": return backStretching;
                case "noSocialMedia": return noSocialMedia;
                case "noPorn": return noPorn;
                case "masturbating": return masturbating;
                default: return false;
            }
        }

        void setBoolean(String key, boolean value) {
            switch (key) {
                case "supplements": supplements = value; break;
                case "floss": floss = value; break;
                case "legExercise": legExercise = value; break;
                case "mentalRoutine": mentalRoutine = value; break;
                case "sports": sports = value; break;
                case "fourthMeal": fourthMeal = value; break;
                case "backStretching": backStretching = value; break;
                case "noSocialMedia": noSocialMedia = value; break;
                case "noPorn": noPorn = value; break;
                case "masturbating": masturbating = value; break;
            }
        }
    }
}
