package com.thrishank.expensetracker;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

/**
 * What comes into the app from outside:
 *  - "Share → Expense Tracker" from another app: a payment message (text)
 *    or a screenshot / photo of a receipt (read on the phone with ML Kit,
 *    nothing uploaded) → event "shared" { text, image }
 *  - a widget tap: expensetracker://add/expense, …/page/bills → event "action" { url }
 * Events are retained until the web app listens, so a cold start isn't lost.
 * Also recognize({ base64 }) for the Add form's Scan button.
 */
@CapacitorPlugin(name = "Intake")
public class IntakePlugin extends Plugin {

    private TextRecognizer recognizer;

    @Override
    public void load() {
        if (getActivity() != null) handle(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handle(intent);
    }

    private TextRecognizer recognizer() {
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return recognizer;
    }

    private void handle(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null && "expensetracker".equals(intent.getData().getScheme())) {
            JSObject ev = new JSObject();
            ev.put("url", intent.getData().toString());
            notifyListeners("action", ev, true);
            intent.setData(null);
            return;
        }
        if (!Intent.ACTION_SEND.equals(action)) return;
        String type = intent.getType() == null ? "" : intent.getType();
        if (type.startsWith("text/")) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text != null && !text.trim().isEmpty()) {
                JSObject ev = new JSObject();
                ev.put("text", text);
                ev.put("image", false);
                notifyListeners("shared", ev, true);
            }
        } else if (type.startsWith("image/")) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) readImage(uri);
        }
        intent.setAction(null);   // handled — don't repeat on rotation
    }

    private void readImage(Uri uri) {
        try {
            InputImage image = InputImage.fromFilePath(getContext(), uri);
            recognizer().process(image)
                .addOnSuccessListener((result) -> {
                    JSObject ev = new JSObject();
                    ev.put("text", result.getText());
                    ev.put("image", true);
                    notifyListeners("shared", ev, true);
                })
                .addOnFailureListener((e) -> {
                    JSObject ev = new JSObject();
                    ev.put("text", "");
                    ev.put("image", true);
                    ev.put("error", "Couldn't read that picture");
                    notifyListeners("shared", ev, true);
                });
        } catch (Exception e) {
            JSObject ev = new JSObject();
            ev.put("text", "");
            ev.put("image", true);
            ev.put("error", "Couldn't open that picture");
            notifyListeners("shared", ev, true);
        }
    }

    /** Read the text in a picture (base64, with or without a data: prefix). */
    @PluginMethod
    public void recognize(PluginCall call) {
        String data = call.getString("base64", "");
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma > 0) data = data.substring(comma + 1);
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp == null) { call.reject("Not a picture"); return; }
            recognizer().process(InputImage.fromBitmap(bmp, 0))
                .addOnSuccessListener((result) -> {
                    JSObject r = new JSObject();
                    r.put("text", result.getText());
                    call.resolve(r);
                })
                .addOnFailureListener((e) -> call.reject("Couldn't read the picture", e));
        } catch (Exception e) {
            call.reject("Couldn't read the picture", e);
        }
    }
}
