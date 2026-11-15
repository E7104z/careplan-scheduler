import { beforeEach, describe, expect, it, vi } from "vitest";

// App Check is gated on a site key (P3-04). Mock the SDK surface and the Firebase app so
// the test never touches a real Firebase project or the network.
const appCheckMocks = vi.hoisted(() => ({
  initializeAppCheck: vi.fn(() => ({ _isAppCheck: true })),
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: appCheckMocks.initializeAppCheck,
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {},
}));

vi.mock("firebase/app", () => ({
  initializeApp: () => ({ name: "[test]" }),
}));

describe("getAppCheckInstance", () => {
  beforeEach(() => {
    vi.resetModules();
    appCheckMocks.initializeAppCheck.mockClear();
    vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "");
  });

  it("does not initialize the provider when no site key is configured", async () => {
    const { getAppCheckInstance } = await import("../../src/features/auth/firebase");
    expect(getAppCheckInstance()).toBeUndefined();
    expect(appCheckMocks.initializeAppCheck).not.toHaveBeenCalled();
  });

  it("initializes reCAPTCHA Enterprise when a site key is configured", async () => {
    vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "6Lc-test-site-key");
    const { getAppCheckInstance } = await import("../../src/features/auth/firebase");
    expect(getAppCheckInstance()).toBeDefined();
    expect(appCheckMocks.initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(appCheckMocks.initializeAppCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        isTokenAutoRefreshEnabled: true,
        provider: expect.anything(),
      }),
    );
  });
});
