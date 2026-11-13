package com.thrishank.expensetracker;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
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

    /** Entries made from the home screen that the app hasn't taken yet. */
    @PluginMethod
    public void queue(PluginCall call) {
        JSObject r = new JSObject();
        try { r.put("items", new JSArray(WidgetQueue.all(getContext()).toString())); } catch (Exception e) { r.put("items", new JSArray()); }
        call.resolve(r);
    }

    /** The app saved these: drop them from the queue. */
    @PluginMethod
    public void clearQueue(PluginCall call) {
        try {
            WidgetQueue.remove(getContext(), call.getArray("ids", new JSArray()).<String>toList());
            WidgetRender.refreshAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't clear the queue", e);
        }
    }

    /** Whether any widget is on the home screen (to hint in Profile). */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("placed", WidgetRender.placedCount(getContext()));
        call.resolve(r);
    }
}
