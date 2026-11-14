package com.thrishank.expensetracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Draws the three home-screen widgets from the summary the app saved. */
final class WidgetRender {
    private WidgetRender() {}

    static JSONObject data(Context ctx) {
        try {
            String s = ctx.getSharedPreferences(WidgetsPlugin.PREFS, Context.MODE_PRIVATE).getString(WidgetsPlugin.KEY, null);
            return s == null ? new JSONObject() : new JSONObject(s);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static boolean dark(Context ctx, JSONObject d) {
        String theme = d.optString("theme", "light");
        if ("dark".equals(theme)) return true;
        if ("light".equals(theme)) return false;
        int mode = ctx.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    /** A tap that opens the app at a place: expensetracker://add/expense, …/page/bills */
    static PendingIntent open(Context ctx, String path, int code) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("expensetracker://" + path));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** A tap that opens the small entry card over the home screen (not the app). */
    static PendingIntent entry(Context ctx, String kind, int code) {
        Intent i = new Intent(ctx, QuickEntryActivity.class);
        i.setData(Uri.parse("expensetracker://quick/" + kind));
        i.putExtra(QuickEntryActivity.EXTRA_KIND, kind);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NO_HISTORY);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static String symbol(JSONObject d) {
        JSONObject raw = d.optJSONObject("raw");
        String s = raw == null ? "" : raw.optString("symbol", "");
        return s.isEmpty() ? "₹" : s;
    }

    static String money(String symbol, double v) {
        NumberFormat f = NumberFormat.getIntegerInstance(new Locale("en", "IN"));
        return (v < 0 ? "−" : "") + symbol + f.format(Math.round(Math.abs(v)));
    }

    /* ── Dates: the widgets roll on by themselves when the day changes ── */
    static String key(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }
    static String todayKey() { return key(Calendar.getInstance()); }
    static Calendar cal(String k) {
        try {
            Calendar c = Calendar.getInstance();
            c.clear();
            c.set(Integer.parseInt(k.substring(0, 4)), Integer.parseInt(k.substring(5, 7)) - 1, Integer.parseInt(k.substring(8, 10)), 12, 0);
            return c;
        } catch (Exception e) {
            return null;
        }
    }
    /** Whole days from a to b (b later: positive). Noon to noon, so daylight saving can't shift it. */
    static int daysBetween(String a, String b) {
        Calendar x = cal(a), y = cal(b);
        if (x == null || y == null) return 0;
        return (int) Math.round((y.getTimeInMillis() - x.getTimeInMillis()) / 86400000.0);
    }
    /** Same words as the app (utils/bills.js dueLabel). */
    static String dueLabel(String due, String today) {
        int diff = daysBetween(today, due);
        if (diff == 0) return "Due today";
        if (diff == 1) return "Tomorrow";
        if (diff > 1) return "In " + diff + " days";
        return diff == -1 ? "1 day late" : (-diff) + " days late";
    }

    /** A figure the app sent, moved by what was entered from the home screen since. */
    private static String moved(JSONObject raw, String key, String fallback, String symbol, double delta) {
        if (raw == null || !raw.has(key) || delta == 0) return fallback;
        return money(symbol, raw.optDouble(key, 0) + delta);
    }

    static int placedCount(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        return m.getAppWidgetIds(new ComponentName(ctx, QuickAddWidget.class)).length
            + m.getAppWidgetIds(new ComponentName(ctx, SummaryWidget.class)).length
            + m.getAppWidgetIds(new ComponentName(ctx, BillsWidget.class)).length;
    }

    static final String MIDNIGHT = "com.thrishank.expensetracker.WIDGETS_MIDNIGHT";

    /** Redraw every widget just after midnight, so "Today", the week and the
        bill labels move on without the app (inexact, never wakes the phone). */
    static void scheduleMidnight(Context ctx) {
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null || placedCount(ctx) == 0) return;
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_MONTH, 1);
            c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 1); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
            Intent i = new Intent(ctx, SummaryWidget.class).setAction(MIDNIGHT);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 41, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            am.set(android.app.AlarmManager.RTC, c.getTimeInMillis(), pi);
        } catch (Exception ignored) {
            // The hourly widget update still redraws them
        }
    }

    static void refreshAll(Context ctx) {
        scheduleMidnight(ctx);
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, QuickAddWidget.class))) m.updateAppWidget(id, quick(ctx));
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, SummaryWidget.class))) m.updateAppWidget(id, summary(ctx, m, id));
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, BillsWidget.class))) m.updateAppWidget(id, bills(ctx));
    }

    /* ── Quick add: Expense · Money in · Savings · Bills ── */
    static RemoteViews quick(Context ctx) {
        JSONObject d = data(ctx);
        boolean dk = dark(ctx, d);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_quick);
        v.setInt(R.id.w_root, "setBackgroundResource", dk ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        int text = dk ? 0xFFF5F5F7 : 0xFF0A0A0C;
        int[] labels = { R.id.w_q_expense_label, R.id.w_q_income_label, R.id.w_q_savings_label, R.id.w_q_bills_label };
        for (int id : labels) v.setTextColor(id, text);
        v.setOnClickPendingIntent(R.id.w_q_expense, entry(ctx, "expense", 11));
        v.setOnClickPendingIntent(R.id.w_q_income, entry(ctx, "income", 12));
        v.setOnClickPendingIntent(R.id.w_q_savings, entry(ctx, "savings", 13));
        v.setOnClickPendingIntent(R.id.w_q_bills, open(ctx, "page/bills", 14));
        return v;
    }

    /* ── This month: the big number, today, one more figure, a seven-day chart ── */
    static RemoteViews summary(Context ctx, AppWidgetManager manager, int id) {
        JSONObject d = data(ctx);
        JSONObject raw = d.optJSONObject("raw");
        String sym = symbol(d);
        double[] p = WidgetQueue.pending(ctx);          // expense, income, savings, today's expense, count
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_summary);
        boolean empty = d.length() == 0;
        String today = todayKey(), day = d.optString("day", "");
        int gap = day.isEmpty() ? 0 : Math.max(0, daysBetween(day, today));     // days since the app last sent figures
        String sentMonth = d.optString("monthKey", "");
        boolean newMonth = gap > 0 && !sentMonth.isEmpty() && !today.startsWith(sentMonth);
        String month = empty ? "Expense Tracker" : newMonth ? new SimpleDateFormat("MMMM", Locale.ENGLISH).format(new Date()) : d.optString("month", "");
        if (p[4] > 0) month += " · " + (int) p[4] + " new, opens in the app";
        v.setTextViewText(R.id.w_s_month, month);
        v.setTextViewText(R.id.w_s_big_label, empty ? "Open the app once to fill this in"
            : newMonth ? "Open the app to start " + month : d.optString("bigLabel", ""));
        // How the big number and the side figure move with a new entry: spent rises, left / safe / balance fall
        String bigMode = raw == null ? "" : raw.optString("bigMode", "");
        double bigDelta = "spent".equals(bigMode) ? p[0] : "left".equals(bigMode) ? -p[0] : "balance".equals(bigMode) ? p[1] - p[0] - p[2] : 0;
        v.setTextViewText(R.id.w_s_big, empty || newMonth ? "—" : moved(raw, "big", d.optString("bigValue", ""), sym, bigDelta));
        // A new day: today starts again from what was typed on the home screen today
        v.setTextViewText(R.id.w_s_today, "Today " + (gap > 0 ? money(sym, p[3]) : moved(raw, "today", d.optString("today", "—"), sym, p[3])));
        String sideMode = raw == null ? "" : raw.optString("sideMode", "");
        double sideDelta = "spent".equals(sideMode) ? p[0] : "balance".equals(sideMode) ? p[1] - p[0] - p[2] : 0;
        String sideLabel = d.optString("sideLabel", "Spent");
        v.setTextViewText(R.id.w_s_spent, sideLabel + " " + (newMonth ? "—" : moved(raw, "side", d.optString("sideValue", d.optString("spent", "—")), sym, sideDelta)));

        // The chart is drawn at the size it is shown — never stretched
        DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        Bundle o = manager.getAppWidgetOptions(id);
        boolean land = ctx.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        int wDp = o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int hDp = o.getInt(land ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (wDp <= 0) wDp = 250;                          // first placement: some launchers report no size yet
        if (hDp <= 0) hDp = 180;
        int roomDp = hDp - 132;                          // what the text above it and the padding take
        JSONArray week = rollWeek(d.optJSONArray("week"), gap);
        boolean chart = d.optBoolean("chart", true) && week != null && wDp >= 150 && roomDp >= 48;
        v.setViewVisibility(R.id.w_s_chart, chart ? View.VISIBLE : View.GONE);
        if (chart) v.setImageViewBitmap(R.id.w_s_chart, weekChart(week, p[3], wDp - 28, Math.min(roomDp, 140), dm));
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "page/today", 21));
        v.setOnClickPendingIntent(R.id.w_s_add, entry(ctx, "expense", 22));
        return v;
    }

    /** The seven days the app sent, moved on by `gap` days: older days drop off, new ones start at 0. */
    static JSONArray rollWeek(JSONArray week, int gap) {
        if (week == null || gap <= 0) return week;
        JSONArray out = new JSONArray();
        int n = week.length();
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, -(n - 1));
        for (int i = 0; i < n; i++) {
            JSONObject day = i + gap < n ? week.optJSONObject(i + gap) : null;
            if (day == null) {
                day = new JSONObject();
                try {
                    day.put("label", String.valueOf("SMTWTFS".charAt(c.get(Calendar.DAY_OF_WEEK) - 1)));
                    day.put("value", 0);
                } catch (Exception ignored) { }
            }
            out.put(day);
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        return out;
    }

    /** Seven bars, today's the bright one, the day's letter under each. Sizes in dp. */
    static Bitmap weekChart(JSONArray week, double todayExtra, int wDp, int hDp, DisplayMetrics dm) {
        float k = dm.density;
        int w = Math.max(1, Math.round(wDp * k)), h = Math.max(1, Math.round(hDp * k)), n = Math.max(1, week.length());
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        bmp.setDensity(dm.densityDpi);
        Canvas c = new Canvas(bmp);
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
        label.setTextSize(10.5f * dm.scaledDensity);
        label.setTextAlign(Paint.Align.CENTER);
        Paint base = new Paint(Paint.ANTI_ALIAS_FLAG);
        base.setColor(Color.argb(46, 255, 255, 255));
        double[] vals = new double[n];
        double max = 1;
        for (int i = 0; i < n; i++) {
            JSONObject day = week.optJSONObject(i);
            vals[i] = (day == null ? 0 : day.optDouble("value", 0)) + (i == n - 1 ? todayExtra : 0);
            max = Math.max(max, vals[i]);
        }
        float slot = (float) w / n, bw = Math.min(slot * 0.5f, 18f * k), top = 2f * k, bottom = h - 18f * k, r = bw / 2f;
        c.drawRect(0, bottom, w, bottom + Math.max(1f, k), base);
        for (int i = 0; i < n; i++) {
            JSONObject day = week.optJSONObject(i);
            boolean today = i == n - 1;
            float bh = vals[i] <= 0 ? 0 : Math.max(bw, (float) (vals[i] / max) * (bottom - top));
            float x = i * slot + (slot - bw) / 2f;
            bar.setColor(today ? Color.WHITE : Color.argb(120, 255, 255, 255));
            if (bh > 0) c.drawRoundRect(new RectF(x, bottom - bh, x + bw, bottom), r, r, bar);
            label.setColor(today ? Color.WHITE : Color.argb(170, 255, 255, 255));
            label.setFakeBoldText(today);
            c.drawText(day == null ? "" : day.optString("label", ""), x + bw / 2f, h - 4f * k, label);
        }
        return bmp;
    }

    /* ── Bills due: the next three ── */
    static RemoteViews bills(Context ctx) {
        JSONObject d = data(ctx);
        boolean dk = dark(ctx, d);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_bills);
        v.setInt(R.id.w_root, "setBackgroundResource", dk ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        int text = dk ? 0xFFF5F5F7 : 0xFF0A0A0C, muted = dk ? 0xFFAEAEB2 : 0xFF6C6C70, lateColor = dk ? 0xFFFF453A : 0xFFFF3B30;
        v.setTextColor(R.id.w_b_title, text);
        JSONArray list = d.optJSONArray("bills");
        int[][] rows = {
            { R.id.w_b_row1, R.id.w_b_name1, R.id.w_b_when1, R.id.w_b_amt1 },
            { R.id.w_b_row2, R.id.w_b_name2, R.id.w_b_when2, R.id.w_b_amt2 },
            { R.id.w_b_row3, R.id.w_b_name3, R.id.w_b_when3, R.id.w_b_amt3 },
        };
        int count = list == null ? 0 : Math.min(3, list.length());
        String today = todayKey();
        for (int i = 0; i < 3; i++) {
            if (i >= count) { v.setViewVisibility(rows[i][0], View.GONE); continue; }
            JSONObject b = list.optJSONObject(i);
            v.setViewVisibility(rows[i][0], View.VISIBLE);
            v.setTextViewText(rows[i][1], b.optString("name", ""));
            String due = b.optString("due", "");
            boolean late = due.isEmpty() ? b.optBoolean("late", false) : daysBetween(today, due) < 0;
            v.setTextViewText(rows[i][2], due.isEmpty() ? b.optString("when", "") : dueLabel(due, today));
            v.setTextViewText(rows[i][3], b.optString("amount", ""));
            v.setTextColor(rows[i][1], text);
            v.setTextColor(rows[i][2], late ? lateColor : muted);
            v.setTextColor(rows[i][3], text);
        }
        v.setViewVisibility(R.id.w_b_empty, count == 0 ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_b_empty, d.length() == 0 ? "Open the app once to fill this in" : "Nothing due in the next 30 days.\nTap to add rent, EMIs and other bills.");
        v.setTextColor(R.id.w_b_empty, muted);
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "page/bills", 31));
        return v;
    }
}
