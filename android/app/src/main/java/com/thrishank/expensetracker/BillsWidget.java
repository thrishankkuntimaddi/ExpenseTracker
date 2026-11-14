package com.thrishank.expensetracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Home-screen widget — drawn by WidgetRender.bills() from the app's latest summary. */
public class BillsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, WidgetRender.bills(context));
        WidgetRender.scheduleMidnight(context);
    }
}
