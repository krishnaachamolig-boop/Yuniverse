import React, { useState } from "react";

export default function Navbar({
  user,
  onNavigate,
  activePage,
  onToggleSidebar,
  sidebarCollapsed,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate("search", { query: searchQuery.trim() });
    } else {
      onNavigate("search");
    }
  };

  const initial = (
    user?.fullName ||
    user?.username ||
    user?.email ||
    "U"
  ).charAt(0).toUpperCase();

  return (
    <header className="yuniverse-navbar">
      {/* LEFT: MENU TOGGLE & BRAND */}
      <div className="navbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="navbar-icon-btn sidebar-toggle-btn"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="hamburger-icon">☰</span>
          </button>
        )}

        <button
          type="button"
          className="navbar-brand-btn"
          onClick={() => onNavigate("home")}
          aria-label="Yuniverse Home"
        >
          <div className="brand-badge">✦</div>
          <span className="brand-text">
            Y<span className="brand-highlight">universe</span>
          </span>
        </button>
      </div>

      {/* CENTER: DESKTOP SEARCH BAR */}
      <div className="navbar-center">
        <form className="navbar-search-form" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrap">
            <span className="search-leading-icon">⌕</span>
            <input
              type="search"
              className="navbar-search-input"
              placeholder="Search videos, channels, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search Yuniverse"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="navbar-search-submit"
            aria-label="Submit search"
          >
            Search
          </button>
        </form>
      </div>

      {/* RIGHT: ACTIONS */}
      <div className="navbar-right">
        {/* MOBILE SEARCH BUTTON */}
        <button
          type="button"
          className="navbar-icon-btn mobile-search-btn"
          onClick={() => onNavigate("search")}
          aria-label="Open search"
        >
          ⌕
        </button>

        {/* CREATE / UPLOAD BUTTON */}
        <button
          type="button"
          className="navbar-upload-btn"
          onClick={() => onNavigate("upload")}
          aria-label="Create video"
        >
          <span className="upload-plus">＋</span>
          <span className="upload-label">Create</span>
        </button>

        {/* SUBSCRIPTIONS / NOTIFICATIONS */}
        <button
          type="button"
          className={`navbar-icon-btn ${activePage === "subscriptions" ? "active" : ""}`}
          onClick={() => onNavigate("subscriptions")}
          aria-label="Subscriptions"
        >
          🔔
        </button>

        {/* PROFILE AVATAR */}
        <button
          type="button"
          className={`navbar-avatar-btn ${activePage === "profile" ? "active" : ""}`}
          onClick={() => onNavigate("profile")}
          aria-label="Open profile"
        >
          {user?.avatar_url || user?.profile?.channel_avatar_url ? (
            <img
              src={user.avatar_url || user.profile.channel_avatar_url}
              alt="User profile"
              className="navbar-avatar-img"
            />
          ) : (
            <div className="navbar-avatar-fallback">{initial}</div>
          )}
        </button>
      </div>
    </header>
  );
}
