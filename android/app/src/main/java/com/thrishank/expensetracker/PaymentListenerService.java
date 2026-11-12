package com.thrishank.expensetracker;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Reads notifications from UPI apps and SMS apps (bank messages) — only
 * when the user turned on "Auto-capture payments" in the app AND granted
 * notification access in Android settings. Anything that looks like money
 * is kept on this phone for the app to offer as "Add this payment?".
 * Nothing is sent anywhere from here; other apps' notifications are ignored.
 */
public class PaymentListenerService extends NotificationListenerService {
    static final String PREFS = "payment_capture";
    static final String KEY_PENDING = "pending";
    static final String KEY_ENABLED = "enabled";
    private static final int MAX_KEPT = 300;
    private static final long KEEP_MS = 30L * 24 * 3600 * 1000;

    static final Set<String> SOURCES = new HashSet<>(Arrays.asList(
        "com.google.android.apps.nbu.paisa.user", "com.phonepe.app", "net.one97.paytm", "in.org.npci.upiapp",
        "com.dreamplug.androidapp", "in.amazon.mShop.android.shopping", "com.mobikwik_new", "com.whatsapp",
        "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms",
        "com.oneplus.mms", "com.android.messaging"
    ));
    private static final Pattern MONEY = Pattern.compile("(₹|\\brs\\.?\\s*\\d|\\binr\\b|debited|credited)", Pattern.CASE_INSENSITIVE);

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            boolean testSource = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 && "com.android.shell".equals(pkg);   // adb test notifications
            if (!SOURCES.contains(pkg) && !testSource) return;
            SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (!prefs.getBoolean(KEY_ENABLED, false)) return;
            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            Bundle x = n.extras;
            String title = str(x.getCharSequence(Notification.EXTRA_TITLE));
            String text = str(x.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (text.isEmpty()) text = str(x.getCharSequence(Notification.EXTRA_TEXT));
            // Messaging apps: the latest message
            Parcelable[] msgs = x.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (msgs != null && msgs.length > 0 && msgs[msgs.length - 1] instanceof Bundle) {
                String last = str(((Bundle) msgs[msgs.length - 1]).getCharSequence("text"));
                if (!last.isEmpty()) text = last;
            }
            String all = title + "\n" + text;
            if (!MONEY.matcher(all).find() || !all.matches("(?s).*\\d.*")) return;
            store(this, pkg, title, text, sbn.getPostTime());
        } catch (Exception ignored) {
            // A malformed notification must never crash the listener
        }
    }

    static synchronized void store(Context ctx, String pkg, String title, String text, long time) throws Exception {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray old = new JSONArray(prefs.getString(KEY_PENDING, "[]"));
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < old.length(); i++) {
            JSONObject o = old.getJSONObject(i);
            long t = o.optLong("time");
            if (now - t > KEEP_MS) continue;
            // The same notification updated in place: keep one
            if (o.optString("pkg").equals(pkg) && o.optString("text").equals(text) && Math.abs(t - time) < 10 * 60 * 1000) return;
            kept.put(o);
        }
        JSONObject item = new JSONObject();
        item.put("id", Long.toString(time, 36) + "_" + Integer.toHexString((pkg + title + text).hashCode()).replace("-", "m"));
        item.put("pkg", pkg);
        item.put("title", title);
        item.put("text", text);
        item.put("time", time);
        kept.put(item);
        while (kept.length() > MAX_KEPT) kept.remove(0);
        prefs.edit().putString(KEY_PENDING, kept.toString()).apply();
        PaymentCapturePlugin.onCaptured(item);
    }

    private static String str(CharSequence c) {
        return c == null ? "" : c.toString().trim();
    }
}
