package com.thrishank.expensetracker;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Entries made from the home screen (QuickEntryActivity) wait here until the
 * app takes them into the ledger: [{ id, kind, amount, name, at }].
 * Nothing is removed until the app says which ids it saved.
 */
final class WidgetQueue {
    private WidgetQueue() {}
    private static final String KEY = "queue";
    private static final int MAX = 200;

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(WidgetsPlugin.PREFS, Context.MODE_PRIVATE);
    }

    static synchronized JSONArray all(Context ctx) {
        try {
            String s = prefs(ctx).getString(KEY, null);
            return s == null ? new JSONArray() : new JSONArray(s);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static synchronized void add(Context ctx, String id, String kind, double amount, String name, long at) {
        try {
            JSONArray q = all(ctx);
            if (q.length() >= MAX) return;
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("kind", kind); o.put("amount", amount); o.put("name", name); o.put("at", at);
            q.put(o);
            prefs(ctx).edit().putString(KEY, q.toString()).commit();
        } catch (Exception ignored) { }
    }

    static synchronized void remove(Context ctx, List<String> ids) {
        Set<String> gone = new HashSet<>(ids);
        JSONArray q = all(ctx), keep = new JSONArray();
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null && !gone.contains(o.optString("id"))) keep.put(o);
        }
        prefs(ctx).edit().putString(KEY, keep.toString()).commit();
    }

    /** What is waiting, by kind; `today` is the part of the expenses made today. */
    static double[] pending(Context ctx) {
        double expense = 0, income = 0, savings = 0, today = 0;
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        long dayStart = c.getTimeInMillis();
        JSONArray q = all(ctx);
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o == null) continue;
            double a = o.optDouble("amount", 0);
            String k = o.optString("kind");
            if ("income".equals(k)) income += a;
            else if ("savings".equals(k)) savings += a;
            else { expense += a; if (o.optLong("at", 0) >= dayStart) today += a; }
        }
        return new double[] { expense, income, savings, today, q.length() };
    }
}
