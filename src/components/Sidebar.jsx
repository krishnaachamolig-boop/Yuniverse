import React from "react";

export default function Sidebar({ activePage, onNavigate, collapsed = false }) {
  const navSections = [
    {
      title: "Discover",
      items: [
        { id: "home", label: "Home", icon: "⌂" },
        { id: "subscriptions", label: "Subscriptions", icon: "🔔" },
        { id: "search", label: "Explore", icon: "⌕" },
      ],
    },
    {
      title: "Library",
      items: [
        { id: "profile", label: "You", icon: "👤" },
        { id: "playlists", label: "Playlists", icon: "📑" },
      ],
    },
    {
      title: "Manage",
      items: [
        { id: "upload", label: "Upload Video", icon: "＋" },
        { id: "settings", label: "Settings", icon: "⚙" },
      ],
    },
  ];

  return (
    <aside className={`yuniverse-sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-inner">
        {navSections.map((section, idx) => (
          <div className="sidebar-section" key={section.title || idx}>
            {!collapsed && section.title && (
              <span className="sidebar-section-title">{section.title}</span>
            )}
            <ul className="sidebar-nav-list">
              {section.items.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                      onClick={() => onNavigate(item.id)}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="sidebar-item-icon">{item.icon}</span>
                      {!collapsed && (
                        <span className="sidebar-item-label">{item.label}</span>
                      )}
                      {isActive && <div className="sidebar-active-pill" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {idx < navSections.length - 1 && <div className="sidebar-divider" />}
          </div>
        ))}

        {!collapsed && (
          <div className="sidebar-footer">
            <p className="sidebar-footer-text">Yuniverse © 2026</p>
            <p className="sidebar-footer-sub">Next-gen creator platform</p>
          </div>
        )}
      </div>
    </aside>
  );
}
