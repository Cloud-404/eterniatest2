import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLiveKitToken } from "@/lib/livekit";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        refreshSession: vi.fn(),
      },
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

describe("LiveKit Token & Service Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully requests and parses a LiveKit token for appointment", async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: "mock-access-token" } },
    });

    (supabase.functions.invoke as any).mockResolvedValue({
      data: {
        token: "mock.jwt.token",
        url: "wss://livekit.test.io",
        roomName: "apt_11111111-1111-1111-1111-111111111111",
        participantIdentity: "mock-user-id",
      },
      error: null,
    });

    const res = await getLiveKitToken({
      kind: "appointment",
      id: "11111111-1111-1111-1111-111111111111",
    });

    expect(res.token).toBe("mock.jwt.token");
    expect(res.url).toBe("wss://livekit.test.io");
    expect(res.roomName).toBe("apt_11111111-1111-1111-1111-111111111111");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("livekit-token", {
      body: { kind: "appointment", id: "11111111-1111-1111-1111-111111111111" },
    });
  });

  it("attempts session refresh when session token is missing but refresh token exists", async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: null, refresh_token: "mock-refresh" } },
    });
    (supabase.auth.refreshSession as any).mockResolvedValue({
      error: new Error("Refresh token expired"),
    });

    await expect(
      getLiveKitToken({
        kind: "peer",
        id: "22222222-2222-2222-2222-222222222222",
      })
    ).rejects.toThrow("Session expired. Please sign in again.");
  });

  it("throws authentication error immediately when no session exists", async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    });

    await expect(
      getLiveKitToken({
        kind: "peer",
        id: "22222222-2222-2222-2222-222222222222",
      })
    ).rejects.toThrow("You must be signed in to connect to the session.");
  });

  it("throws descriptive error when media service response is missing token", async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: "mock-access-token" } },
    });

    (supabase.functions.invoke as any).mockResolvedValue({
      data: { error: "NOT_FOUND", details: "Appointment not found or access denied" },
      error: null,
    });

    await expect(
      getLiveKitToken({
        kind: "appointment",
        id: "33333333-3333-3333-3333-333333333333",
      })
    ).rejects.toThrow("Appointment not found or access denied");
  });
});
