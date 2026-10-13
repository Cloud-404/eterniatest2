import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

type VideoSDKAction = "get-token" | "create-room";

interface ParsedFunctionError {
  message: string;
  retryableAuth: boolean;
}

const isAuthErrorMessage = (message: string) =>
  /session|jwt|token|unauthorized|auth|expired/i.test(message);

const parseInvokeError = async (error: unknown): Promise<ParsedFunctionError> => {
  if (error instanceof FunctionsHttpError) {
    let details = "Video service request failed";
    let code: string | undefined;
    const status = error.context?.status;

    try {
      const raw = await error.context.text();
      const json = JSON.parse(raw) as { error?: string; details?: string; message?: string };
      details = json.details || json.message || json.error || details;
      code = json.error;
    } catch {
      // Response body may already be consumed by the SDK
      if (error.message) details = error.message;
    }

    return {
      message: details,
      retryableAuth: status === 401 || code === "SESSION_INVALID" || isAuthErrorMessage(details),
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    message: message || "Video service request failed",
    retryableAuth: isAuthErrorMessage(message),
  };
};

/**
 * Invoke the videosdk-token edge function.
 * Auth is handled automatically by supabase.functions.invoke() — no custom headers needed.
 */
async function invokeVideoSDK(action: VideoSDKAction): Promise<Record<string, any>> {
  // Pre-check: ensure we have a valid session before calling
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw new Error("Session expired. Please sign in again.");
  }

  const callFn = async () => {
    const { data, error } = await supabase.functions.invoke("videosdk-token", {
      body: { action },
    });

    if (error) throw error;
    if (!data) throw new Error("Empty response from video service");

    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        throw new Error("Invalid response from video service");
      }
    }
    return data as Record<string, any>;
  };

  try {
    return await callFn();
  } catch (err) {
    const parsed = await parseInvokeError(err);

    if (parsed.retryableAuth) {
      // One retry after refreshing the session
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error("Session expired. Please sign in again.");

      try {
        return await callFn();
      } catch (retryErr) {
        const retryParsed = await parseInvokeError(retryErr);
        throw new Error(retryParsed.message);
      }
    }

    console.error("[VideoSDK] Error:", err, "Parsed:", parsed.message);
    throw new Error(parsed.message);
  }
}

export const getVideoSDKToken = async (): Promise<string> => {
  const data = await invokeVideoSDK("get-token");
  return data.token;
};

export const createVideoSDKRoom = async (): Promise<{ token: string; roomId: string }> => {
  const data = await invokeVideoSDK("create-room");
  return { token: data.token, roomId: data.roomId };
};
