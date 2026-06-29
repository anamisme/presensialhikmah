/**
 * Native Mock Location Detection
 * Uses Android native API to detect fake GPS apps and mock providers.
 * Falls back gracefully on web browsers (no-op).
 */

interface MockLocationResult {
  isMocked: boolean;
  reason: string;
}

export async function checkMockLocation(): Promise<MockLocationResult> {
  try {
    // Check if running in Capacitor native environment
    const Capacitor = (window as any).Capacitor;
    if (!Capacitor || !Capacitor.isNativePlatform()) {
      // Web browser - can't detect mock location natively
      return { isMocked: false, reason: '' };
    }

    // Call native plugin
    const { Plugins } = Capacitor;
    if (Plugins && Plugins.MockLocationDetector) {
      const result = await Plugins.MockLocationDetector.checkMockLocation();
      return {
        isMocked: result.isMocked || false,
        reason: result.reason || ''
      };
    }

    return { isMocked: false, reason: '' };
  } catch (err) {
    console.warn('Mock location check failed:', err);
    return { isMocked: false, reason: '' };
  }
}
