package com.thrishank.expensetracker;

import android.os.Build;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App lock: unlock with the phone's fingerprint, face or screen lock.
 *
 *   status()          → { available, reason }  can this phone verify the user now?
 *   verify({ title }) → resolves { verified: true }; rejects "cancelled" when
 *                       the user backs out, "failed" otherwise
 *
 * Android 11+ also accepts the phone's own PIN/pattern; older phones show a
 * "Use app PIN" button instead.
 */
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {

    private static int authenticators() {
        if (Build.VERSION.SDK_INT >= 30) {
            return BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        return BiometricManager.Authenticators.BIOMETRIC_WEAK;
    }

    @PluginMethod
    public void status(PluginCall call) {
        int code = BiometricManager.from(getContext()).canAuthenticate(authenticators());
        JSObject result = new JSObject();
        result.put("available", code == BiometricManager.BIOMETRIC_SUCCESS);
        switch (code) {
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                result.put("reason", "none-enrolled");
                break;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                result.put("reason", "no-hardware");
                break;
            default:
                result.put("reason", code == BiometricManager.BIOMETRIC_SUCCESS ? "ok" : "unavailable");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void verify(PluginCall call) {
        final String title = call.getString("title", "Unlock Expense Tracker");
        final String subtitle = call.getString("subtitle", "");
        getActivity().runOnUiThread(() -> {
            FragmentActivity activity = getActivity();
            BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult r) {
                        JSObject result = new JSObject();
                        result.put("verified", true);
                        call.resolve(result);
                    }

                    @Override
                    public void onAuthenticationError(int code, @NonNull CharSequence message) {
                        boolean cancelled = code == BiometricPrompt.ERROR_USER_CANCELED
                            || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                            || code == BiometricPrompt.ERROR_CANCELED;
                        call.reject(message.toString(), cancelled ? "cancelled" : "failed");
                    }
                    // onAuthenticationFailed: a finger that didn't match — the prompt stays up and lets them retry
                });
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setAllowedAuthenticators(authenticators());
            if (!subtitle.isEmpty()) info.setSubtitle(subtitle);
            if (Build.VERSION.SDK_INT < 30) info.setNegativeButtonText("Use app PIN");
            try {
                prompt.authenticate(info.build());
            } catch (Exception e) {
                call.reject(e.getMessage(), "failed");
            }
        });
    }
}
