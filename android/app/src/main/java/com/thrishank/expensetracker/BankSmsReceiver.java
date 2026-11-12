package com.thrishank.expensetracker;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Bank SMS ("Rs 450 debited from A/c XX1234 … UPI/Swiggy"), straight from
 * Android — so it works whatever SMS app the phone uses. Declared only in
 * the Play Store build (src/play), and does nothing unless the user turned
 * on "Auto-capture payments" → "Bank SMS" in the app and allowed SMS.
 *
 * Only messages from business senders (letters, like "AD-HDFCBK") that
 * mention money are kept, on this phone, for the app to offer as
 * "Add this payment?". Personal messages (from phone numbers) are never
 * looked at. Nothing is sent anywhere from here.
 */
public class BankSmsReceiver extends BroadcastReceiver {
    static final String KEY_SMS = "sms";
    private static final Pattern MONEY = Pattern.compile("(₹|\\brs\\.?\\s*\\d|\\binr\\b|debited|credited)", Pattern.CASE_INSENSITIVE);
    /** DLT business headers: "VM-HDFCBK", "AX-SBIUPI-S", "HDFCBK". A number like +9198… is a person. */
    private static final Pattern BUSINESS = Pattern.compile(".*[A-Za-z].*");

    @Override
    public void onReceive(Context ctx, Intent intent) {
        try {
            if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
            SharedPreferences prefs = ctx.getSharedPreferences(PaymentListenerService.PREFS, Context.MODE_PRIVATE);
            if (!prefs.getBoolean(PaymentListenerService.KEY_ENABLED, false) || !prefs.getBoolean(KEY_SMS, false)) return;
            if (ctx.checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) return;

            SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (parts == null) return;
            // A long message arrives in parts: join them per sender
            Map<String, StringBuilder> bodies = new LinkedHashMap<>();
            Map<String, Long> times = new LinkedHashMap<>();
            for (SmsMessage m : parts) {
                if (m == null) continue;
                String from = m.getDisplayOriginatingAddress();
                if (from == null || !BUSINESS.matcher(from).matches()) continue;
                StringBuilder b = bodies.get(from);
                if (b == null) { b = new StringBuilder(); bodies.put(from, b); times.put(from, m.getTimestampMillis()); }
                if (m.getDisplayMessageBody() != null) b.append(m.getDisplayMessageBody());
            }
            for (Map.Entry<String, StringBuilder> e : bodies.entrySet()) {
                String text = e.getValue().toString().trim();
                if (text.isEmpty() || !MONEY.matcher(text).find() || !text.matches("(?s).*\\d.*")) continue;
                Long t = times.get(e.getKey());
                PaymentListenerService.store(ctx, "sms", e.getKey(), text, t != null && t > 0 ? t : System.currentTimeMillis());
            }
        } catch (Exception ignored) {
            // A malformed message must never crash the app
        }
    }
}
