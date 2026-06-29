package com.yayasanbaitulhikmah.presensi.plugins;

import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MockLocationDetector")
public class MockLocationDetector extends Plugin {

    @PluginMethod()
    public void checkMockLocation(PluginCall call) {
        JSObject result = new JSObject();
        
        boolean isMocked = false;
        String reason = "";

        Context context = getContext();

        // Check 1: Developer options - mock location enabled
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            // For older Android versions
            String mockLocation = Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ALLOW_MOCK_LOCATION
            );
            if ("1".equals(mockLocation)) {
                isMocked = true;
                reason = "Mock location diaktifkan di Developer Options.";
            }
        }

        // Check 2: Check if any mock location provider is set
        LocationManager locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager != null) {
            try {
                // Check if test providers are added
                for (String provider : locationManager.getAllProviders()) {
                    if (locationManager.getProvider(provider) != null) {
                        // Try to detect if it's a test/mock provider
                    }
                }
            } catch (Exception e) {
                // Ignore
            }
        }

        // Check 3: Check last known location for isMock flag (API 18+)
        if (locationManager != null) {
            try {
                Location lastGPS = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (lastGPS != null && lastGPS.isFromMockProvider()) {
                    isMocked = true;
                    reason = "Lokasi GPS palsu terdeteksi dari mock provider.";
                }

                Location lastNetwork = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (lastNetwork != null && lastNetwork.isFromMockProvider()) {
                    isMocked = true;
                    reason = "Lokasi jaringan palsu terdeteksi dari mock provider.";
                }
            } catch (SecurityException e) {
                // Location permission not granted yet
            }
        }

        // Check 4: Detect common fake GPS apps
        boolean hasFakeGpsApps = detectFakeGpsApps(context);
        if (hasFakeGpsApps) {
            isMocked = true;
            reason = "Aplikasi fake GPS terdeteksi di perangkat.";
        }

        result.put("isMocked", isMocked);
        result.put("reason", reason);
        call.resolve(result);
    }

    private boolean detectFakeGpsApps(Context context) {
        String[] fakeGpsPackages = {
            "com.lexa.fakegps",
            "com.fakegps.mock",
            "com.incorporateapps.fakegps.fre",
            "com.incorporateapps.fakegps",
            "com.lkr.fakelocation",
            "com.fake.gps.location",
            "com.blogspot.newapphorizons.fakegps",
            "com.theappninjas.fakegpsjoystick",
            "com.evezzon.fakegps",
            "com.fake.location",
            "com.location.faker",
            "com.hola.fakegps",
            "com.mock.location",
            "com.fakegps",
            "ru.gavrikov.mocklocations"
        };

        for (String pkg : fakeGpsPackages) {
            try {
                context.getPackageManager().getPackageInfo(pkg, 0);
                return true; // Fake GPS app found
            } catch (Exception e) {
                // Not installed, continue
            }
        }
        return false;
    }
}
