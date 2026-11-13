package com.thrishank.expensetracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Home-screen widget — drawn by WidgetRender.summary() from the app's latest summary. */
public class SummaryWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, WidgetRender.summary(context, manager, id));
    }

    /** Resized on the home screen: the chart is redrawn for the new size. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, WidgetRender.summary(context, manager, id));
    }
}
