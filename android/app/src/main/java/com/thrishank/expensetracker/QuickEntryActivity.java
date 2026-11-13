package com.thrishank.expensetracker;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.UUID;

/**
 * Quick entry from a home-screen widget: a small card over the home screen —
 * amount, what it was, Save — without opening the app. A widget itself can't
 * hold a text box (Android doesn't allow it), so this is as close as it gets.
 *
 * The entry waits on the phone (WidgetQueue) and the widgets count it at
 * once; the app puts it in the ledger the next time it is opened.
 */
public class QuickEntryActivity extends Activity {
    static final String EXTRA_KIND = "kind";
    private static final String[] KINDS = { "expense", "income", "savings" };
    private static final String[] LABELS = { "Expense", "Money in", "Savings" };
    private static final String[] HINTS = { "What for? Tea, petrol, groceries…", "From? Salary, a friend…", "Where? SIP, gold, cash…" };
    private static final int[] TONES = { 0xFFFF3B30, 0xFF1E9E4A, 0xFF007AFF };

    private int kind = 0;
    private boolean dark;
    private EditText amount, name;
    private TextView save;
    private final TextView[] tabs = new TextView[3];

    private int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    private GradientDrawable box(int color, float radiusDp, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        if (stroke != 0) g.setStroke(dp(1), stroke);
        return g;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        String want = state != null ? state.getString(EXTRA_KIND) : getIntent().getStringExtra(EXTRA_KIND);
        for (int i = 0; i < KINDS.length; i++) if (KINDS[i].equals(want)) kind = i;
        JSONObject data = WidgetRender.data(this);
        dark = WidgetRender.dark(this, data);
        String symbol = WidgetRender.symbol(data);

        int surface = dark ? 0xFF1C1C1E : 0xFFFFFFFF, text = dark ? 0xFFF5F5F7 : 0xFF0A0A0C, muted = dark ? 0xFFAEAEB2 : 0xFF6C6C70;
        int field = dark ? 0xFF2C2C2E : 0xFFF2F2F7, line = dark ? 0x22FFFFFF : 0x1A0A0A0C;

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        getWindow().setDimAmount(0.55f);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);

        FrameLayout root = new FrameLayout(this);
        root.setOnClickListener((v) -> finish());           // a tap outside the card closes it
        root.setFitsSystemWindows(true);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(box(surface, 24, line));
        card.setPadding(dp(16), dp(16), dp(16), dp(14));
        card.setClickable(true);
        card.setElevation(dp(12));
        // Near the top, so the keyboard never covers it
        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        cardLp.setMargins(dp(18), dp(64), dp(18), 0);
        root.addView(card, cardLp);

        // Expense · Money in · Savings
        LinearLayout seg = new LinearLayout(this);
        seg.setBackground(box(field, 14, 0));
        seg.setPadding(dp(3), dp(3), dp(3), dp(3));
        for (int i = 0; i < 3; i++) {
            final int idx = i;
            TextView t = new TextView(this);
            t.setText(LABELS[i]);
            t.setGravity(Gravity.CENTER);
            t.setTextSize(13);
            t.setTypeface(Typeface.DEFAULT_BOLD);
            t.setPadding(0, dp(9), 0, dp(9));
            t.setOnClickListener((v) -> { kind = idx; paint(text, muted, surface); });
            tabs[i] = t;
            seg.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        }
        card.addView(seg, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Amount
        LinearLayout amtRow = new LinearLayout(this);
        amtRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView sym = new TextView(this);
        sym.setText(symbol);
        sym.setTextSize(26);
        sym.setTextColor(muted);
        sym.setTypeface(Typeface.DEFAULT_BOLD);
        amtRow.addView(sym);
        amount = new EditText(this);
        amount.setHint("0");
        amount.setHintTextColor(muted);
        amount.setTextColor(text);
        amount.setTextSize(34);
        amount.setTypeface(Typeface.DEFAULT_BOLD);
        amount.setBackground(null);
        amount.setSingleLine(true);
        amount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        amount.setImeOptions(EditorInfo.IME_ACTION_NEXT);
        amount.setPadding(dp(8), dp(6), 0, dp(6));
        amtRow.addView(amount, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout.LayoutParams amtLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        amtLp.topMargin = dp(10);
        card.addView(amtRow, amtLp);

        // What it was
        name = new EditText(this);
        name.setTextColor(text);
        name.setHintTextColor(muted);
        name.setTextSize(15);
        name.setSingleLine(true);
        name.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        name.setImeOptions(EditorInfo.IME_ACTION_DONE);
        name.setBackground(box(field, 14, 0));
        name.setPadding(dp(14), dp(12), dp(14), dp(12));
        name.setOnEditorActionListener((v, action, ev) -> { if (action == EditorInfo.IME_ACTION_DONE) { save(); return true; } return false; });
        LinearLayout.LayoutParams nameLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nameLp.topMargin = dp(6);
        card.addView(name, nameLp);

        // Open the app · Save
        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        TextView more = new TextView(this);
        more.setText("More options in the app");
        more.setTextSize(12.5f);
        more.setTextColor(muted);
        more.setPadding(dp(2), dp(10), dp(8), dp(10));
        more.setOnClickListener((v) -> {
            Intent i = new Intent(this, MainActivity.class);
            i.setAction(Intent.ACTION_VIEW);
            i.setData(android.net.Uri.parse("expensetracker://add/" + KINDS[kind]));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
            finish();
        });
        actions.addView(more, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        save = new TextView(this);
        save.setText("Save");
        save.setTextSize(15);
        save.setTextColor(0xFFFFFFFF);
        save.setTypeface(Typeface.DEFAULT_BOLD);
        save.setGravity(Gravity.CENTER);
        save.setPadding(dp(28), dp(12), dp(28), dp(12));
        save.setOnClickListener((v) -> save());
        actions.addView(save);
        LinearLayout.LayoutParams actLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        actLp.topMargin = dp(12);
        card.addView(actions, actLp);

        setContentView(root);
        paint(text, muted, surface);
        amount.requestFocus();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString(EXTRA_KIND, KINDS[kind]);
    }

    private void paint(int text, int muted, int surface) {
        for (int i = 0; i < 3; i++) {
            boolean on = i == kind;
            tabs[i].setTextColor(on ? TONES[i] : muted);
            tabs[i].setBackground(on ? box(surface, 11, 0) : null);
        }
        name.setHint(HINTS[kind]);
        save.setBackground(box(TONES[kind], 14, 0));
    }

    private void save() {
        double value;
        try { value = Double.parseDouble(amount.getText().toString().trim()); } catch (Exception e) { value = 0; }
        if (!(value > 0) || value > 1e10) {
            amount.requestFocus();
            Toast.makeText(this, "Enter the amount", Toast.LENGTH_SHORT).show();
            return;
        }
        value = Math.round(value * 100) / 100.0;
        String what = name.getText().toString().trim();
        if (what.isEmpty()) what = LABELS[kind];
        if (what.length() > 120) what = what.substring(0, 120);
        Context ctx = getApplicationContext();
        WidgetQueue.add(ctx, UUID.randomUUID().toString(), KINDS[kind], value, what, System.currentTimeMillis());
        WidgetRender.refreshAll(ctx);
        Toast.makeText(ctx, "Saved " + WidgetRender.money(WidgetRender.symbol(WidgetRender.data(ctx)), value) + " · " + what, Toast.LENGTH_SHORT).show();
        finish();
    }
}
