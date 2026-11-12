package com.thrishank.expensetracker;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.HashSet;
import java.util.Set;

/**
 * The app's side of payment capture (see PaymentListenerService):
 * whether it's switched on and allowed, the payments seen so far, and a
 * live "payment" event while the app is open. Also tells the app where it
 * was installed from (Play Store or not).
 *
 * Bank SMS (BankSmsReceiver) is a second source with its own switch and
 * Android's SMS permission. Both exist only in the Play Store build.
 */
@CapacitorPlugin(name = "PaymentCapture", permissions = {
    @Permission(alias = "sms", strings = { Manifest.permission.RECEIVE_SMS })
})
public class PaymentCapturePlugin extends Plugin {
    private static WeakReference<PaymentCapturePlugin> live = new WeakReference<>(null);

    @Override
    public void load() { live = new WeakReference<>(this); }

    static void onCaptured(JSONObject item) {
        PaymentCapturePlugin p = live.get();
        if (p == null) return;
        try { p.notifyListeners("payment", JSObject.fromJSONObject(item)); } catch (Exception ignored) { }
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PaymentListenerService.PREFS, Context.MODE_PRIVATE);
    }

    private boolean allowed() {
        return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName());
    }

    /** Only the Play Store build declares the listener (see src/play). */
    private boolean available() {
        try {
            getContext().getPackageManager().getServiceInfo(new ComponentName(getContext(), PaymentListenerService.class), 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /** The SMS receiver is declared only in the Play Store build (see src/play). */
    private boolean smsAvailable() {
        try {
            getContext().getPackageManager().getReceiverInfo(new ComponentName(getContext(), BankSmsReceiver.class), 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private boolean smsAllowed() {
        return getContext().checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject state() {
        JSObject r = new JSObject();
        r.put("available", available());
        r.put("enabled", prefs().getBoolean(PaymentListenerService.KEY_ENABLED, false));
        r.put("allowed", allowed());
        boolean sms = smsAvailable();
        r.put("smsAvailable", sms);
        r.put("sms", sms && prefs().getBoolean(BankSmsReceiver.KEY_SMS, false));
        r.put("smsAllowed", sms && smsAllowed());
        return r;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(state());
    }

    /** Bank SMS on/off. Turning it on asks Android for the SMS permission once. */
    @PluginMethod
    public void setSms(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (!smsAvailable()) { call.resolve(state()); return; }
        if (on && !smsAllowed()) {
            requestPermissionForAlias("sms", call, "smsPermission");
            return;
        }
        prefs().edit().putBoolean(BankSmsReceiver.KEY_SMS, on).apply();
        call.resolve(state());
    }

    @PermissionCallback
    private void smsPermission(PluginCall call) {
        boolean granted = getPermissionState("sms") == PermissionState.GRANTED;
        prefs().edit().putBoolean(BankSmsReceiver.KEY_SMS, granted).apply();
        JSObject r = state();
        r.put("denied", !granted);
        call.resolve(r);
    }

    /** Android's app page (to allow SMS after "Don't allow"). */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SharedPreferences.Editor e = prefs().edit().putBoolean(PaymentListenerService.KEY_ENABLED, on);
        if (!on) e.remove(PaymentListenerService.KEY_PENDING);   // off = forget what was seen
        e.apply();
        if (on && allowed()) {
            // Ask Android to (re)bind the listener in case it was stopped
            try { android.service.notification.NotificationListenerService.requestRebind(new ComponentName(getContext(), PaymentListenerService.class)); } catch (Exception ignored) { }
        }
        status(call);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        if (Build.VERSION.SDK_INT >= 30) {
            Intent detail = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            detail.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, new ComponentName(getContext(), PaymentListenerService.class).flattenToString());
            if (detail.resolveActivity(getContext().getPackageManager()) != null) i = detail;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void pending(PluginCall call) {
        try {
            JSObject r = new JSObject();
            r.put("items", new JSArray(prefs().getString(PaymentListenerService.KEY_PENDING, "[]")));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not read captured payments", e);
        }
    }

    /** Forget these (added to the ledger or dismissed). */
    @PluginMethod
    public void remove(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids", new JSArray());
            Set<String> drop = new HashSet<>();
            for (int i = 0; i < ids.length(); i++) drop.add(ids.getString(i));
            synchronized (PaymentListenerService.class) {
                JSONArray old = new JSONArray(prefs().getString(PaymentListenerService.KEY_PENDING, "[]"));
                JSONArray kept = new JSONArray();
                for (int i = 0; i < old.length(); i++) {
                    JSONObject o = old.getJSONObject(i);
                    if (!drop.contains(o.optString("id"))) kept.put(o);
                }
                prefs().edit().putString(PaymentListenerService.KEY_PENDING, kept.toString()).apply();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not update captured payments", e);
        }
    }

    /** "com.android.vending" when installed from the Play Store. */
    @PluginMethod
    public void installSource(PluginCall call) {
        String installer = null;
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            if (Build.VERSION.SDK_INT >= 30) {
                InstallSourceInfo info = pm.getInstallSourceInfo(pkg);
                installer = info.getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(pkg);
            }
        } catch (Exception ignored) { }
        JSObject r = new JSObject();
        r.put("installer", installer);
        r.put("play", "com.android.vending".equals(installer));
        call.resolve(r);
    }
}
