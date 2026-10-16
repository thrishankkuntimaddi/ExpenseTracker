package com.thrishank.expensetracker;

import android.accounts.Account;
import android.accounts.AccountManager;
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
 *   authorize({ interactive, scopes?, account? }) → { accessToken, email? }
 *   chooseAccount() → { email }   Google's account picker (no permission needed)
 *
 * Once the user has said yes, Google returns tokens silently — that is what
 * lets the daily backup run without asking again. interactive: false never
 * shows a screen; it rejects "consent-required" instead.
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {
    static final String SCOPE = "https://www.googleapis.com/auth/drive.file";

    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private ActivityResultLauncher<Intent> pickerLauncher;
    private PluginCall pending;
    private PluginCall picking;

    @Override
    public void load() {
        // Registered while the activity is being created (Capacitor loads plugins then)
        consentLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), this::onConsent);
        pickerLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), this::onPicked);
    }

    /** Which Google account backups go to: Google's own picker (it can add one too). */
    @PluginMethod
    public void chooseAccount(PluginCall call) {
        Intent intent = AccountManager.newChooseAccountIntent(
            null, null, new String[] { "com.google" }, null, null, null, null);
        if (picking != null) picking.reject("Superseded", "cancelled");
        picking = call;
        pickerLauncher.launch(intent);
    }

    private void onPicked(ActivityResult activityResult) {
        PluginCall call = picking;
        picking = null;
        if (call == null) return;
        Intent data = activityResult.getData();
        String email = data == null ? null : data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
        if (activityResult.getResultCode() != Activity.RESULT_OK || email == null) {
            call.reject("No account was picked", "cancelled");
            return;
        }
        JSObject out = new JSObject();
        out.put("email", email);
        call.resolve(out);
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
        AuthorizationRequest.Builder builder = AuthorizationRequest.builder().setRequestedScopes(scopes);
        String account = call.getString("account");
        if (account != null && !account.isEmpty()) builder.setAccount(new Account(account, "com.google"));
        AuthorizationRequest request = builder.build();
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
