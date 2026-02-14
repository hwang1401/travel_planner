import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App";

class AppErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err, info) { console.error("[App] Error:", err, info); }
  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = err?.message || String(err);
      const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, background: "#f5f5f5", color: "#333", fontFamily: "system-ui, sans-serif", textAlign: "center",
        }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 20 }}>오류가 발생했습니다</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#666" }}>새로고침하거나 잠시 후 다시 시도해 주세요.</p>
          {isDev && msg && (
            <p style={{ marginTop: 16, fontSize: 12, color: "#999", maxWidth: 360, wordBreak: "break-all" }}>{msg}</p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
