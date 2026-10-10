package com.thrishank.expensetracker;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Colours the area behind the status and navigation bars to match the app
 * theme, and switches their icons between dark (light theme) and light
 * (dark theme).
 *
 * Android 15 draws apps edge-to-edge and ignores status-bar colours. On
 * WebView 140+ the web page itself draws behind the bars; on older WebViews
 * Capacitor pads the page and the window background shows there instead —
 * so setting that background covers both cases.
 */
@CapacitorPlugin(name = "SystemTheme")
public class SystemThemePlugin extends Plugin {

    @PluginMethod
    public void apply(PluginCall call) {
        final int color;
        try {
            color = Color.parseColor(call.getString("color", "#E4E5EA"));
        } catch (IllegalArgumentException e) {
            call.reject("Bad colour: " + call.getString("color"));
            return;
        }
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.getDecorView().setBackgroundColor(color);
            WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
            bars.setAppearanceLightStatusBars(!dark);
            bars.setAppearanceLightNavigationBars(!dark);
            if (Build.VERSION.SDK_INT < 35) {
                // Before Android 15 the bars have their own colour
                window.setStatusBarColor(color);
                window.setNavigationBarColor(color);
            }
            JSObject result = new JSObject();
            result.put("applied", true);
            call.resolve(result);
        });
    }
}
