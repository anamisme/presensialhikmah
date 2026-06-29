package com.yayasanbaitulhikmah.presensi;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.yayasanbaitulhikmah.presensi.plugins.MockLocationDetector;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MockLocationDetector.class);
        super.onCreate(savedInstanceState);

        // Override WebView user-agent to avoid Google's "disallowed_useragent" block
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // Use Chrome mobile user-agent (removes "wv" flag that Google blocks)
            String defaultUA = settings.getUserAgentString();
            // Remove "; wv" from user-agent which marks it as WebView
            String chromeUA = defaultUA.replace("; wv", "");
            settings.setUserAgentString(chromeUA);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setSupportMultipleWindows(true);
        }
    }
}
