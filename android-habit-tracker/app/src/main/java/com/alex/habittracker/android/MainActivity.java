package com.alex.habittracker.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

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
        view.setWebViewClient(new WebViewClient());
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
        long end = date.plusDays(1).atStartOfDay(ZONE).toInstant().toEpochMilli();
        List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);
        if (stats == null) stats = new ArrayList<>();

        Map<String, Long> byPackage = new HashMap<>();
        long total = 0L;
        long social = 0L;
        for (UsageStats stat : stats) {
            long foreground = Math.max(0L, stat.getTotalTimeInForeground());
            if (foreground <= 0L) continue;
            byPackage.merge(stat.getPackageName(), foreground, Long::sum);
            total += foreground;
            if (SOCIAL_PACKAGES.contains(stat.getPackageName())) {
                social += foreground;
            }
        }

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
            .put("lateNightMinutes", readLateNightMinutes(manager, start, end))
            .put("appBreakdown", breakdown);
    }

    private int readLateNightMinutes(UsageStatsManager manager, long start, long end) {
        long lateStart = LocalDate.ofInstant(Instant.ofEpochMilli(start), ZONE)
            .plusDays(1)
            .atStartOfDay(ZONE)
            .toInstant()
            .toEpochMilli();
        long lateEnd = Math.min(end, lateStart + (3L * 60L * 60L * 1000L));
        if (lateEnd <= lateStart) return 0;
        List<UsageStats> lateStats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, lateStart, lateEnd);
        if (lateStats == null) return 0;
        long total = 0L;
        for (UsageStats stat : lateStats) {
            total += Math.max(0L, stat.getTotalTimeInForeground());
        }
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
