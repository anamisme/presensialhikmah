package com.yayasanbaitulhikmah.presensi.plugins;

import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
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

        // Check 1: Check last known location for isMock flag (API 18+)
        LocationManager locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager != null) {
            try {
                Location lastGPS = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (lastGPS != null && lastGPS.isFromMockProvider()) {
                    isMocked = true;
                    reason = "Lokasi GPS palsu terdeteksi dari mock provider.";
                }

                if (!isMocked) {
                    Location lastNetwork = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    if (lastNetwork != null && lastNetwork.isFromMockProvider()) {
                        isMocked = true;
                        reason = "Lokasi jaringan palsu terdeteksi dari mock provider.";
                    }
                }
            } catch (SecurityException e) {
                // Location permission not granted yet
            }
        }

        // Check 2: Detect common fake GPS apps
        if (!isMocked) {
            boolean hasFakeGpsApps = detectFakeGpsApps(context);
            if (hasFakeGpsApps) {
                isMocked = true;
                reason = "Aplikasi fake GPS terdeteksi di perangkat.";
            }
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
