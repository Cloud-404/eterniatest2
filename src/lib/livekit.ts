import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError, FunctionsFetchError } from "@supabase/supabase-js";

export type MediaSessionKind = "appointment" | "peer" | "blackbox" | "l3";

export interface LiveKitTokenRequest {
  kind: MediaSessionKind;
  id: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
  participantIdentity: string;
}

interface ParsedFunctionError {
  message: string;
  retryableAuth: boolean;
}

const isAuthErrorMessage = (message: string) =>
  /jwt\s*(expired|invalid)|invalid\s*jwt|token\s*expired|invalid\s*claim|PGRST301/i.test(message);

const parseInvokeError = async (error: unknown): Promise<ParsedFunctionError> => {
  if (error instanceof FunctionsFetchError || (error instanceof Error && error.name === "FunctionsFetchError")) {
    return {
      message:
        "Unable to reach the LiveKit media function. Please verify that the 'livekit-token' Edge Function is deployed to your Supabase project.",
      retryableAuth: false,
    };
  }

  if (error instanceof FunctionsHttpError) {
    let details = "LiveKit service request failed";
    let code: string | undefined;
    const status = error.context?.status;

    try {
      const raw = await error.context.text();
      const json = JSON.parse(raw) as { error?: string; details?: string; message?: string };
      details = json.details || json.message || json.error || details;
      code = json.error;
    } catch {
      if (error.message) details = error.message;
    }

    return {
      message: details,
      retryableAuth: status === 401 || code === "UNAUTHORIZED" || isAuthErrorMessage(details),
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    message: message || "Media service request failed",
    retryableAuth: false,
  };
};

/**
 * Invoke the livekit-token edge function with authorized kind and record ID.
 * Returns connection credentials scoped strictly to that session.
 */
export async function getLiveKitToken(request: LiveKitTokenRequest): Promise<LiveKitTokenResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    if (session?.refresh_token) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed?.session?.access_token) {
        throw new Error("Session expired. Please sign in again.");
      }
    } else {
      throw new Error("You must be signed in to connect to the session.");
    }
  }

  const callFn = async (): Promise<LiveKitTokenResponse> => {
    const { data, error } = await supabase.functions.invoke("livekit-token", {
      body: { kind: request.kind, id: request.id },
    });

    if (error) throw error;
    if (!data) throw new Error("Empty response from media service");

    const payload = typeof data === "string" ? JSON.parse(data) : data;
    if (!payload.token || !payload.roomName) {
      throw new Error(payload.details || payload.error || "Invalid response from media service");
    }

    return payload as LiveKitTokenResponse;
  };

  try {
    return await callFn();
  } catch (err) {
    const parsed = await parseInvokeError(err);

    if (parsed.retryableAuth && session?.refresh_token) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error("Session expired. Please sign in again.");

      try {
        return await callFn();
      } catch (retryErr) {
        const retryParsed = await parseInvokeError(retryErr);
        throw new Error(retryParsed.message);
      }
    }

    console.error("[LiveKit] Token Error:", err, "Parsed:", parsed.message);
    throw new Error(parsed.message);
  }
}

