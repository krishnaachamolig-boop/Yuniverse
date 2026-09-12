import React from "react";

export default function BottomNav({ activePage, onNavigate }) {
  const items = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "search", label: "Search", icon: "⌕" },
    { id: "upload", label: "Create", icon: "＋", isAction: true },
    { id: "subscriptions", label: "Subscribed", icon: "🔔" },
    { id: "profile", label: "You", icon: "👤" },
  ];

  return (
    <nav className="yuniverse-bottom-nav" aria-label="Bottom Navigation">
      <div className="bottom-nav-container">
        {items.map((item) => {
          const isActive = activePage === item.id;
          if (item.isAction) {
            return (
              <button
                key={item.id}
                type="button"
                className="bottom-nav-action-btn"
                onClick={() => onNavigate(item.id)}
                aria-label="Upload new video"
              >
                <div className="action-btn-glow" />
                <span className="action-btn-icon">{item.icon}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-item ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
            >
              <div className="bottom-nav-icon-wrap">
                <span className="bottom-nav-icon">{item.icon}</span>
                {isActive && <span className="bottom-nav-active-dot" />}
              </div>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
