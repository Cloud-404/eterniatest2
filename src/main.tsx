import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recoverFromChunkLoadFailure } from "@/lib/chunkRecovery";

// Handle Vite preload errors (stale chunks after deploy)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault?.();
  void recoverFromChunkLoadFailure("vite_preload_reload");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
