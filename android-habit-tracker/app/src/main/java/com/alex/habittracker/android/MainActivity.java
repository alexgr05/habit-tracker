package com.alex.habittracker.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsets.Type;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

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

public class MainActivity extends Activity {
    private static final String APP_URL = "file:///android_asset/index.html";
    private static final ZoneId ZONE = ZoneId.systemDefault();
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

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        webView = new WebView(this);
        configureWebView(webView);
        webView.addJavascriptInterface(new PhoneUsageBridge(), "HabitAndroid");
        setContentView(webView);
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        view.setPadding(0, statusBarHeight() + dp(2), 0, navigationBarHeight());
        view.setClipToPadding(false);
        view.setWebViewClient(new WebViewClient());
        view.setFitsSystemWindows(true);
        view.setOnApplyWindowInsetsListener((target, insets) -> {
            int top;
            int bottom;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(Type.statusBars() | Type.navigationBars());
                top = bars.top + dp(2);
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop() + dp(2);
                bottom = insets.getSystemWindowInsetBottom();
            }
            target.setPadding(0, top, 0, bottom);
            return insets;
        });
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(android.graphics.Color.rgb(16, 13, 10));
        window.setNavigationBarColor(android.graphics.Color.rgb(16, 13, 10));
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.getDecorView().setSystemUiVisibility(0);
    }

    private int statusBarHeight() {
        return systemDimension("status_bar_height");
    }

    private int navigationBarHeight() {
        return systemDimension("navigation_bar_height");
    }

    private int systemDimension(String name) {
        int resourceId = getResources().getIdentifier(name, "dimen", "android");
        if (resourceId <= 0) return 0;
        return getResources().getDimensionPixelSize(resourceId);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private class PhoneUsageBridge {
        @JavascriptInterface
        public boolean hasUsageAccess() {
            return MainActivity.this.hasUsageAccess();
        }

        @JavascriptInterface
        public void openUsageAccessSettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)));
        }

        @JavascriptInterface
        public String readUsageForDate(String isoDate) {
            try {
                LocalDate date = LocalDate.parse(isoDate);
                return readUsageSnapshot(date).toString();
            } catch (Exception exception) {
                String message = exception.getMessage() == null ? "Unable to read phone usage." : exception.getMessage();
                return "{\"error\":" + JSONObject.quote(message) + "}";
            }
        }
    }

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private JSONObject readUsageSnapshot(LocalDate date) throws Exception {
        if (!hasUsageAccess()) {
            return new JSONObject().put("needsPermission", true);
        }

        UsageStatsManager manager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null) {
            return new JSONObject().put("error", "UsageStatsManager unavailable.");
        }

        long start = date.atStartOfDay(ZONE).toInstant().toEpochMilli();
        long dayEnd = date.plusDays(1).atStartOfDay(ZONE).toInstant().toEpochMilli();
        long end = Math.min(dayEnd, System.currentTimeMillis());
        if (end <= start) end = dayEnd;
        Map<String, Long> byPackage = collectForegroundMillis(manager, start, end);
        long total = byPackage.values().stream().mapToLong(Long::longValue).sum();
        long social = byPackage.entrySet().stream()
            .filter(entry -> SOCIAL_PACKAGES.contains(entry.getKey()))
            .mapToLong(Map.Entry::getValue)
            .sum();

        JSONObject breakdown = new JSONObject();
        List<Map.Entry<String, Long>> entries = new ArrayList<>(byPackage.entrySet());
        entries.sort(Map.Entry.comparingByValue(Comparator.reverseOrder()));
        int limit = Math.min(10, entries.size());
        for (int index = 0; index < limit; index++) {
            Map.Entry<String, Long> entry = entries.get(index);
            breakdown.put(labelForPackage(entry.getKey()), Math.round(entry.getValue() / 60000.0));
        }

        return new JSONObject()
            .put("date", date.toString())
            .put("totalScreenMinutes", Math.round(total / 60000.0))
            .put("socialMinutes", Math.round(social / 60000.0))
            .put("lateNightMinutes", readLateNightMinutes(manager, date))
            .put("appBreakdown", breakdown);
    }

    private Map<String, Long> collectForegroundMillis(UsageStatsManager manager, long start, long end) {
        UsageEvents events = manager.queryEvents(start, end);
        Map<String, Long> activeStarts = new HashMap<>();
        Map<String, Long> totals = new HashMap<>();
        UsageEvents.Event event = new UsageEvents.Event();

        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            String packageName = event.getPackageName();
            if (packageName == null) continue;

            int type = event.getEventType();
            long timestamp = Math.max(start, Math.min(end, event.getTimeStamp()));
            if (isForegroundEvent(type)) {
                activeStarts.put(packageName, timestamp);
            } else if (isBackgroundEvent(type)) {
                Long activeStart = activeStarts.remove(packageName);
                if (activeStart != null && timestamp > activeStart) {
                    totals.merge(packageName, timestamp - activeStart, Long::sum);
                }
            }
        }

        for (Map.Entry<String, Long> active : activeStarts.entrySet()) {
            if (end > active.getValue()) {
                totals.merge(active.getKey(), end - active.getValue(), Long::sum);
            }
        }

        return totals;
    }

    private boolean isForegroundEvent(int type) {
        return type == UsageEvents.Event.MOVE_TO_FOREGROUND
            || type == UsageEvents.Event.ACTIVITY_RESUMED;
    }

    private boolean isBackgroundEvent(int type) {
        return type == UsageEvents.Event.MOVE_TO_BACKGROUND
            || type == UsageEvents.Event.ACTIVITY_PAUSED
            || type == UsageEvents.Event.ACTIVITY_STOPPED;
    }

    private int readLateNightMinutes(UsageStatsManager manager, LocalDate date) {
        long lateStart = date
            .atStartOfDay(ZONE)
            .toInstant()
            .toEpochMilli();
        long lateEnd = Math.min(lateStart + (3L * 60L * 60L * 1000L), System.currentTimeMillis());
        if (lateEnd <= lateStart) return 0;
        long total = collectForegroundMillis(manager, lateStart, lateEnd)
            .values()
            .stream()
            .mapToLong(Long::longValue)
            .sum();
        return (int) Math.round(total / 60000.0);
    }

    private String labelForPackage(String packageName) {
        try {
            PackageManager packageManager = getPackageManager();
            ApplicationInfo info = packageManager.getApplicationInfo(packageName, 0);
            CharSequence label = packageManager.getApplicationLabel(info);
            if (label != null && label.length() > 0) {
                return label.toString();
            }
        } catch (PackageManager.NameNotFoundException ignored) {
        }
        return packageName;
    }
}
