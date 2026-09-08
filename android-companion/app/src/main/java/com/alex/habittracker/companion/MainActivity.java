package com.alex.habittracker.companion;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.Gravity;
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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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
    private static final int COLOR_GREEN = Color.rgb(165, 211, 143);
    private static final int COLOR_RED = Color.rgb(229, 122, 99);
    private static final Set<String> SOCIAL_PACKAGES = new HashSet<>(Arrays.asList(
        "com.instagram.android",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.snapchat.android",
        "com.facebook.katana",
        "com.facebook.orca",
        "com.twitter.android",
        "com.x.android",
        "com.reddit.frontpage",
        "com.google.android.youtube",
        "com.discord",
        "org.telegram.messenger"
    ));

    private EditText emailInput;
    private EditText passwordInput;
    private TextView statusText;
    private TextView previewText;
    private String accessToken;
    private String userId;
    private UsageSnapshot latestSnapshot;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        refreshPermissionStatus();
    }

    private void buildUi() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setBackgroundColor(COLOR_BG);
        scrollView.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(22), dp(18), dp(28));
        scrollView.addView(root);

        TextView title = new TextView(this);
        title.setText("Habit Companion");
        title.setTextSize(26);
        title.setTextColor(COLOR_INK);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        root.addView(title, matchWrap());

        TextView subtitle = new TextView(this);
        subtitle.setText("Sync Android screen time into your habit tracker.");
        subtitle.setTextSize(15);
        subtitle.setTextColor(COLOR_MUTED);
        subtitle.setPadding(0, dp(6), 0, dp(18));
        root.addView(subtitle, matchWrap());

        LinearLayout accountCard = card();
        root.addView(accountCard, matchWrap());
        accountCard.addView(sectionLabel("Account"));

        emailInput = new EditText(this);
        emailInput.setHint("Supabase email");
        emailInput.setInputType(InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        styleInput(emailInput);
        accountCard.addView(emailInput, matchWrap());

        passwordInput = new EditText(this);
        passwordInput.setHint("Supabase password");
        passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        passwordInput.setTransformationMethod(PasswordTransformationMethod.getInstance());
        styleInput(passwordInput);
        accountCard.addView(passwordInput, matchWrap());

        Button signInButton = button("Sign in");
        signInButton.setOnClickListener(view -> signIn());
        accountCard.addView(signInButton, matchWrap());

        LinearLayout syncCard = card();
        root.addView(syncCard, matchWrap());
        syncCard.addView(sectionLabel("Phone Usage"));

        Button permissionButton = button("Open Usage Access Settings");
        permissionButton.setOnClickListener(view -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)));
        syncCard.addView(permissionButton, matchWrap());

        Button loadButton = button("Load Today's Usage");
        loadButton.setOnClickListener(view -> loadTodayUsage());
        syncCard.addView(loadButton, matchWrap());

        Button uploadButton = button("Upload Today");
        uploadButton.setOnClickListener(view -> uploadToday());
        syncCard.addView(uploadButton, matchWrap());

        Button syncButton = primaryButton("Sync Today");
        syncButton.setOnClickListener(view -> syncToday());
        syncCard.addView(syncButton, matchWrap());

        statusText = new TextView(this);
        statusText.setTextSize(14);
        statusText.setTextColor(COLOR_MUTED);
        statusText.setPadding(0, dp(16), 0, dp(10));
        root.addView(statusText, matchWrap());

        previewText = new TextView(this);
        previewText.setTextSize(16);
        previewText.setTextColor(COLOR_INK);
        previewText.setPadding(dp(14), dp(14), dp(14), dp(14));
        previewText.setBackground(cardBackground(COLOR_PANEL, COLOR_LINE));
        root.addView(previewText, matchWrap());

        setContentView(scrollView);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshPermissionStatus();
    }

    private void refreshPermissionStatus() {
        setStatus(hasUsageAccess()
            ? "Usage Access is enabled."
            : "Usage Access is not enabled yet.");
    }

    private void signIn() {
        final String email = emailInput.getText().toString().trim();
        final String password = passwordInput.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            setStatus("Enter email and password.");
            return;
        }

        setStatus("Signing in...");
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject()
                    .put("email", email)
                    .put("password", password);
                JSONObject response = postJson(
                    SUPABASE_URL + "/auth/v1/token?grant_type=password",
                    body.toString(),
                    null,
                    false
                );
                accessToken = response.getString("access_token");
                userId = response.getJSONObject("user").getString("id");
                runOnUiThread(() -> setStatus("Signed in."));
            } catch (Exception exception) {
                runOnUiThread(() -> setStatus("Sign-in failed: " + exception.getMessage()));
            }
        }).start();
    }

    private void loadTodayUsage() {
        if (!hasUsageAccess()) {
            setStatus("Enable Usage Access first.");
            return;
        }

        setStatus("Reading phone usage...");
        new Thread(() -> {
            try {
                latestSnapshot = collectUsage(LocalDate.now(ZONE));
                runOnUiThread(() -> {
                    setStatus("Usage loaded.");
                    previewText.setText(latestSnapshot.preview());
                });
            } catch (Exception exception) {
                runOnUiThread(() -> setStatus("Usage read failed: " + exception.getMessage()));
            }
        }).start();
    }

    private void uploadToday() {
        if (accessToken == null || userId == null) {
            setStatus("Sign in first.");
            return;
        }
        if (latestSnapshot == null) {
            setStatus("Load today's usage first.");
            return;
        }

        setStatus("Uploading...");
        new Thread(() -> {
            try {
                JSONArray rows = new JSONArray();
                rows.put(latestSnapshot.toJson(userId));
                postJson(
                    SUPABASE_URL + "/rest/v1/phone_usage_days?on_conflict=user_id,date",
                    rows.toString(),
                    accessToken,
                    true
                );
                runOnUiThread(() -> setStatus("Uploaded to Supabase."));
            } catch (Exception exception) {
                runOnUiThread(() -> setStatus("Upload failed: " + exception.getMessage()));
            }
        }).start();
    }

    private void syncToday() {
        if (accessToken == null || userId == null) {
            setStatus("Sign in first.");
            return;
        }
        if (!hasUsageAccess()) {
            setStatus("Enable Usage Access first.");
            return;
        }

        setStatus("Syncing today's phone usage...");
        new Thread(() -> {
            try {
                latestSnapshot = collectUsage(LocalDate.now(ZONE));
                JSONArray rows = new JSONArray();
                rows.put(latestSnapshot.toJson(userId));
                postJson(
                    SUPABASE_URL + "/rest/v1/phone_usage_days?on_conflict=user_id,date",
                    rows.toString(),
                    accessToken,
                    true
                );
                runOnUiThread(() -> {
                    setStatus("Synced today to Supabase.");
                    previewText.setText(latestSnapshot.preview());
                });
            } catch (Exception exception) {
                runOnUiThread(() -> setStatus("Sync failed: " + exception.getMessage()));
            }
        }).start();
    }

    private UsageSnapshot collectUsage(LocalDate date) {
        long dayStart = date.atStartOfDay(ZONE).toInstant().toEpochMilli();
        long now = System.currentTimeMillis();
        long lateNightEnd = date.atStartOfDay(ZONE).plusHours(4).toInstant().toEpochMilli();

        UsageWindow fullDay = collectUsageWindow(dayStart, now);
        UsageWindow lateNight = collectUsageWindow(dayStart, Math.min(now, lateNightEnd));

        return new UsageSnapshot(
            date.toString(),
            fullDay.totalMinutes,
            fullDay.socialMinutes,
            lateNight.totalMinutes,
            fullDay.appBreakdown
        );
    }

    private UsageWindow collectUsageWindow(long startMillis, long endMillis) {
        UsageStatsManager manager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMillis, endMillis);
        PackageManager packageManager = getPackageManager();
        Map<String, Integer> appBreakdown = new HashMap<>();
        int total = 0;
        int social = 0;

        for (UsageStats item : stats) {
            long foregroundMs = item.getTotalTimeInForeground();
            if (foregroundMs <= 0) continue;

            int minutes = (int) Math.round(foregroundMs / 60000.0);
            if (minutes <= 0) continue;

            total += minutes;
            if (SOCIAL_PACKAGES.contains(item.getPackageName())) {
                social += minutes;
            }

            String appName = appLabel(packageManager, item.getPackageName());
            appBreakdown.put(appName, appBreakdown.getOrDefault(appName, 0) + minutes);
        }

        return new UsageWindow(total, social, appBreakdown);
    }

    private String appLabel(PackageManager packageManager, String packageName) {
        try {
            ApplicationInfo info = packageManager.getApplicationInfo(packageName, 0);
            return packageManager.getApplicationLabel(info).toString();
        } catch (Exception ignored) {
            return packageName;
        }
    }

    private JSONObject postJson(String endpoint, String body, String bearerToken, boolean preferUpsert) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("apikey", SUPABASE_KEY);
        connection.setRequestProperty("Content-Type", "application/json");
        if (bearerToken != null) {
            connection.setRequestProperty("Authorization", "Bearer " + bearerToken);
        }
        if (preferUpsert) {
            connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal");
        }

        try (OutputStream stream = connection.getOutputStream()) {
            stream.write(body.getBytes(StandardCharsets.UTF_8));
        }

        int code = connection.getResponseCode();
        String response = readResponse(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
        if (code < 200 || code >= 300) {
            throw new IllegalStateException(response.isEmpty() ? "HTTP " + code : response);
        }
        return response.isEmpty() ? new JSONObject() : new JSONObject(response);
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

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
        int mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(COLOR_INK);
        button.setBackground(cardBackground(COLOR_PANEL_STRONG, COLOR_LINE));
        button.setPadding(dp(12), dp(10), dp(12), dp(10));
        return button;
    }

    private Button primaryButton(String label) {
        Button button = button(label);
        button.setTextColor(Color.rgb(38, 24, 10));
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(cardBackground(COLOR_AMBER, COLOR_AMBER));
        return button;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(14), dp(14), dp(10));
        card.setBackground(cardBackground(COLOR_PANEL, COLOR_LINE));
        return card;
    }

    private TextView sectionLabel(String label) {
        TextView text = new TextView(this);
        text.setText(label.toUpperCase(Locale.ROOT));
        text.setTextColor(COLOR_AMBER);
        text.setTextSize(12);
        text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        text.setPadding(0, 0, 0, dp(10));
        return text;
    }

    private void styleInput(EditText input) {
        input.setTextColor(COLOR_INK);
        input.setHintTextColor(COLOR_MUTED);
        input.setSingleLine(true);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        input.setBackground(cardBackground(COLOR_BG, COLOR_LINE));
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

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void setStatus(String message) {
        statusText.setText(message);
    }

    private static class UsageWindow {
        final int totalMinutes;
        final int socialMinutes;
        final Map<String, Integer> appBreakdown;

        UsageWindow(int totalMinutes, int socialMinutes, Map<String, Integer> appBreakdown) {
            this.totalMinutes = totalMinutes;
            this.socialMinutes = socialMinutes;
            this.appBreakdown = appBreakdown;
        }
    }

    private static class UsageSnapshot {
        final String date;
        final int totalScreenMinutes;
        final int socialMinutes;
        final int lateNightMinutes;
        final Map<String, Integer> appBreakdown;

        UsageSnapshot(String date, int totalScreenMinutes, int socialMinutes, int lateNightMinutes, Map<String, Integer> appBreakdown) {
            this.date = date;
            this.totalScreenMinutes = totalScreenMinutes;
            this.socialMinutes = socialMinutes;
            this.lateNightMinutes = lateNightMinutes;
            this.appBreakdown = appBreakdown;
        }

        JSONObject toJson(String userId) throws Exception {
            JSONObject breakdown = new JSONObject();
            for (Map.Entry<String, Integer> entry : appBreakdown.entrySet()) {
                breakdown.put(entry.getKey(), entry.getValue());
            }
            return new JSONObject()
                .put("user_id", userId)
                .put("date", date)
                .put("total_screen_minutes", totalScreenMinutes)
                .put("social_minutes", socialMinutes)
                .put("late_night_minutes", lateNightMinutes)
                .put("app_breakdown", breakdown)
                .put("updated_at", Instant.now().toString());
        }

        String preview() {
            return String.format(
                Locale.getDefault(),
                "Today\nTotal screen: %s\nSocial media: %s\nLate night: %s\n\nTop apps\n%s",
                minutes(totalScreenMinutes),
                minutes(socialMinutes),
                minutes(lateNightMinutes),
                topAppsText()
            );
        }

        private String topAppsText() {
            if (appBreakdown.isEmpty()) return "No app usage found yet.";

            List<Map.Entry<String, Integer>> apps = new ArrayList<>(appBreakdown.entrySet());
            apps.sort(Comparator.comparingInt((Map.Entry<String, Integer> entry) -> entry.getValue()).reversed());

            StringBuilder builder = new StringBuilder();
            int limit = Math.min(5, apps.size());
            for (int index = 0; index < limit; index++) {
                Map.Entry<String, Integer> app = apps.get(index);
                if (index > 0) builder.append("\n");
                builder.append(index + 1)
                    .append(". ")
                    .append(app.getKey())
                    .append(" - ")
                    .append(minutes(app.getValue()));
            }
            return builder.toString();
        }

        private static String minutes(int value) {
            int hours = value / 60;
            int minutes = value % 60;
            if (hours == 0) return minutes + "m";
            if (minutes == 0) return hours + "h";
            return hours + "h " + minutes + "m";
        }
    }
}
