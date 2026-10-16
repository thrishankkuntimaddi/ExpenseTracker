package com.thrishank.expensetracker;

import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.getcapacitor.JSArray;

import java.util.ArrayList;
import java.util.List;

import java.util.Collections;

/**
 * Backups to the user's own Google Drive: a short-lived access token for
 * the scopes the app asks for — "drive.appdata" (its hidden storage) and
 * "drive.file" (only files this app creates). Defaults to drive.file.
 *
 *   authorize({ interactive, scopes? }) → { accessToken, email? }
 *
 * Once the user has said yes, Google returns tokens silently — that is what
 * lets the daily backup run without asking again. interactive: false never
 * shows a screen; it rejects "consent-required" instead.
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {
    static final String SCOPE = "https://www.googleapis.com/auth/drive.file";

    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pending;

    @Override
    public void load() {
        // Registered while the activity is being created (Capacitor loads plugins then)
        consentLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), this::onConsent);
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
        List<Scope> scopes = new ArrayList<>();
        try {
            JSArray asked = call.getArray("scopes");
            if (asked != null) for (int i = 0; i < asked.length(); i++) {
                String sc = asked.getString(i);
                if (sc.startsWith("https://www.googleapis.com/auth/drive.")) scopes.add(new Scope(sc));
            }
        } catch (Exception ignored) { }
        if (scopes.isEmpty()) scopes.add(new Scope(SCOPE));
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(scopes)
            .build();
        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    if (!interactive || result.getPendingIntent() == null) {
                        call.reject("Google Drive access needs your OK", "consent-required");
                        return;
                    }
                    IntentSenderRequest isr = new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build();
                    if (pending != null) pending.reject("Superseded", "cancelled");
                    pending = call;
                    consentLauncher.launch(isr);
                } else {
                    resolve(call, result);
                }
            })
            .addOnFailureListener(e -> call.reject(e.getMessage(), "failed"));
    }

    private void onConsent(ActivityResult activityResult) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            call.reject("Google Drive access was not granted", "cancelled");
            return;
        }
        try {
            Intent data = activityResult.getData();
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data);
            resolve(call, result);
        } catch (ApiException e) {
            call.reject(e.getMessage(), "failed");
        }
    }

    private void resolve(PluginCall call, AuthorizationResult result) {
        if (result.getAccessToken() == null) {
            call.reject("Google returned no access token", "failed");
            return;
        }
        JSObject out = new JSObject();
        out.put("accessToken", result.getAccessToken());
        if (result.toGoogleSignInAccount() != null) out.put("email", result.toGoogleSignInAccount().getEmail());
        call.resolve(out);
    }
}
