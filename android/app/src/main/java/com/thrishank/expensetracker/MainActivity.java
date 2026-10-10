package com.thrishank.expensetracker;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts
        registerPlugin(SystemThemePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
