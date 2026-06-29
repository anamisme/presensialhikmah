package com.yayasanbaitulhikmah.presensi;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import com.yayasanbaitulhikmah.presensi.plugins.MockLocationDetector;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MockLocationDetector.class);
        super.onCreate(savedInstanceState);
    }
}
