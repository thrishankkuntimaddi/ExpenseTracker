package com.thrishank.expensetracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Home-screen widget — drawn by WidgetRender.quick() from the app's latest summary. */
public class QuickAddWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, WidgetRender.quick(context));
        WidgetRender.scheduleMidnight(context);
    }
}
