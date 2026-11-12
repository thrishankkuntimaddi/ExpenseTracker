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
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

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
        String theme = d.optString("theme", "auto");
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

    static int placedCount(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        return m.getAppWidgetIds(new ComponentName(ctx, QuickAddWidget.class)).length
            + m.getAppWidgetIds(new ComponentName(ctx, SummaryWidget.class)).length
            + m.getAppWidgetIds(new ComponentName(ctx, BillsWidget.class)).length;
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, QuickAddWidget.class))) m.updateAppWidget(id, quick(ctx));
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, SummaryWidget.class))) m.updateAppWidget(id, summary(ctx));
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, BillsWidget.class))) m.updateAppWidget(id, bills(ctx));
    }

    /* ── Quick add: Expense · Money in · Savings · Bills ── */
    static RemoteViews quick(Context ctx) {
        JSONObject d = data(ctx);
        boolean dk = dark(ctx, d);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_quick);
        v.setInt(R.id.w_root, "setBackgroundResource", dk ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        int text = dk ? 0xFFE8ECF4 : 0xFF0F172A;
        int[] labels = { R.id.w_q_expense_label, R.id.w_q_income_label, R.id.w_q_savings_label, R.id.w_q_bills_label };
        for (int id : labels) v.setTextColor(id, text);
        v.setOnClickPendingIntent(R.id.w_q_expense, open(ctx, "add/expense", 11));
        v.setOnClickPendingIntent(R.id.w_q_income, open(ctx, "add/income", 12));
        v.setOnClickPendingIntent(R.id.w_q_savings, open(ctx, "add/savings", 13));
        v.setOnClickPendingIntent(R.id.w_q_bills, open(ctx, "page/bills", 14));
        return v;
    }

    /* ── This month: the big number, today, spent, a seven-day chart ── */
    static RemoteViews summary(Context ctx) {
        JSONObject d = data(ctx);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_summary);
        boolean empty = d.length() == 0;
        v.setTextViewText(R.id.w_s_month, empty ? "Expense Tracker" : d.optString("month", ""));
        v.setTextViewText(R.id.w_s_big_label, empty ? "Open the app once to fill this in" : d.optString("bigLabel", ""));
        v.setTextViewText(R.id.w_s_big, empty ? "—" : d.optString("bigValue", ""));
        v.setTextViewText(R.id.w_s_today, "Today " + d.optString("today", "—"));
        v.setTextViewText(R.id.w_s_spent, "Spent " + d.optString("spent", "—"));
        boolean chart = d.optBoolean("chart", true) && d.optJSONArray("week") != null;
        v.setViewVisibility(R.id.w_s_chart, chart ? View.VISIBLE : View.GONE);
        if (chart) v.setImageViewBitmap(R.id.w_s_chart, weekChart(d.optJSONArray("week")));
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "page/today", 21));
        v.setOnClickPendingIntent(R.id.w_s_add, open(ctx, "add/expense", 22));
        return v;
    }

    static Bitmap weekChart(JSONArray week) {
        int w = 560, h = 120, n = Math.max(1, week.length());
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
        label.setColor(Color.argb(190, 255, 255, 255));
        label.setTextSize(20f);
        label.setTextAlign(Paint.Align.CENTER);
        double max = 1;
        for (int i = 0; i < n; i++) max = Math.max(max, week.optJSONObject(i) == null ? 0 : week.optJSONObject(i).optDouble("value", 0));
        float slot = (float) w / n, bw = slot * 0.56f, top = 6f, bottom = h - 28f;
        for (int i = 0; i < n; i++) {
            JSONObject day = week.optJSONObject(i);
            double val = day == null ? 0 : day.optDouble("value", 0);
            float bh = Math.max(4f, (float) (val / max) * (bottom - top));
            float x = i * slot + (slot - bw) / 2f;
            bar.setColor(i == n - 1 ? Color.WHITE : Color.argb(110, 255, 255, 255));
            c.drawRoundRect(new RectF(x, bottom - bh, x + bw, bottom), 8f, 8f, bar);
            c.drawText(day == null ? "" : day.optString("label", ""), x + bw / 2f, h - 4f, label);
        }
        return bmp;
    }

    /* ── Bills due: the next three ── */
    static RemoteViews bills(Context ctx) {
        JSONObject d = data(ctx);
        boolean dk = dark(ctx, d);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_bills);
        v.setInt(R.id.w_root, "setBackgroundResource", dk ? R.drawable.widget_bg_dark : R.drawable.widget_bg_light);
        int text = dk ? 0xFFE8ECF4 : 0xFF0F172A, muted = dk ? 0xFFA3ABBD : 0xFF64748B, late = dk ? 0xFFFB7185 : 0xFFE11D48;
        v.setTextColor(R.id.w_b_title, text);
        JSONArray list = d.optJSONArray("bills");
        int[][] rows = {
            { R.id.w_b_row1, R.id.w_b_name1, R.id.w_b_when1, R.id.w_b_amt1 },
            { R.id.w_b_row2, R.id.w_b_name2, R.id.w_b_when2, R.id.w_b_amt2 },
            { R.id.w_b_row3, R.id.w_b_name3, R.id.w_b_when3, R.id.w_b_amt3 },
        };
        int count = list == null ? 0 : Math.min(3, list.length());
        for (int i = 0; i < 3; i++) {
            if (i >= count) { v.setViewVisibility(rows[i][0], View.GONE); continue; }
            JSONObject b = list.optJSONObject(i);
            v.setViewVisibility(rows[i][0], View.VISIBLE);
            v.setTextViewText(rows[i][1], b.optString("name", ""));
            v.setTextViewText(rows[i][2], b.optString("when", ""));
            v.setTextViewText(rows[i][3], b.optString("amount", ""));
            v.setTextColor(rows[i][1], text);
            v.setTextColor(rows[i][2], b.optBoolean("late", false) ? late : muted);
            v.setTextColor(rows[i][3], text);
        }
        v.setViewVisibility(R.id.w_b_empty, count == 0 ? View.VISIBLE : View.GONE);
        v.setTextColor(R.id.w_b_empty, muted);
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "page/bills", 31));
        return v;
    }
}
