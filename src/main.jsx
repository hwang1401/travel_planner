import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App";

class AppErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err, info) { console.error("[App] Error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, background: "#f5f5f5", color: "#333", fontFamily: "system-ui, sans-serif", textAlign: "center",
        }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 20 }}>오류가 발생했습니다</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#666" }}>새로고침하거나 잠시 후 다시 시도해 주세요.</p>
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
