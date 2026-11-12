package com.thrishank.expensetracker;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web app hands over a small, already-formatted summary (utils/widgetData.js);
 * it's kept on the phone and every home-screen widget is redrawn from it.
 */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {
    static final String PREFS = "et_widgets";
    static final String KEY = "data";

    @PluginMethod
    public void update(PluginCall call) {
        JSObject data = call.getObject("data", new JSObject());
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY, data.toString()).apply();
        WidgetRender.refreshAll(getContext());
        call.resolve();
    }

    /** Whether any widget is on the home screen (to hint in Profile). */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("placed", WidgetRender.placedCount(getContext()));
        call.resolve(r);
    }
}
