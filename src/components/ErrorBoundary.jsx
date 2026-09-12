import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Yuniverse ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem("yuniverse_user");
    } catch (_) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#090b12",
            color: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #7c6cff, #5b49ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: "bold",
              marginBottom: "20px",
              boxShadow: "0 8px 24px rgba(91, 73, 255, 0.4)",
            }}
          >
            Y
          </div>
          <h2 style={{ fontSize: "22px", marginBottom: "10px", fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              maxWidth: "420px",
              marginBottom: "20px",
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || "An unexpected error occurred while loading this view."}
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                background: "#5b49ff",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Reload App
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                background: "transparent",
                color: "#ffffff",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
