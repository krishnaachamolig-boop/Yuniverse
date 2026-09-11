import React, { useEffect, useState } from "react";

export default function Settings({ user, onNavigate }) {
  const [settings, setSettings] = useState({
    autoplay: true,
    dataSaver: false,
    notifications: true,
    newSubscribers: true,
    comments: true,
    likes: true,
    recommendations: true,
    publicChannel: true,
    showSubscriptions: true,
    showLikedVideos: false,
    darkMode: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("yuniverse_settings");

      if (saved) {
        setSettings((prev) => ({
          ...prev,
          ...JSON.parse(saved),
        }));
      }
    } catch (error) {
      console.error("Settings load error:", error);
    }
  }, []);

  function updateSetting(key, value) {
    const updated = {
      ...settings,
      [key]: value,
    };

    setSettings(updated);
    localStorage.setItem("yuniverse_settings", JSON.stringify(updated));

    if (key === "darkMode") {
      document.documentElement.classList.toggle("dark-mode", value);
    }
  }

  function handleLogout() {
    localStorage.removeItem("yuniverse_user");
    onNavigate("login");
  }

  const fullName =
    user?.fullName ||
    user?.profile?.full_name ||
    user?.firstName ||
    user?.username ||
    "Yuniverse User";

  const username = user?.username || user?.profile?.username || "username";

  const v2iId = user?.v2iId || user?.profile?.v2i_id || "V2i ID";

  function Toggle({ value, onChange }) {
    return (
      <button
        type="button"
        className={`settings-toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
        aria-label={value ? "Disable" : "Enable"}
      >
        <span />
      </button>
    );
  }

  function SettingRow({ title, description, setting }) {
    return (
      <div className="settings-row">
        <div className="settings-row-text">
          <strong>{title}</strong>
          {description && <p>{description}</p>}
        </div>

        <Toggle
          value={settings[setting]}
          onChange={(value) => updateSetting(setting, value)}
        />
      </div>
    );
  }

  return (
    <div className="app-page settings-page">
      <header className="top-header settings-header">
        <button
          className="back-button"
          onClick={() => onNavigate("profile")}
          aria-label="Back"
        >
          ←
        </button>

        <div className="settings-header-title">
          <h1>Settings</h1>
        </div>

        <button
          className="logo-button settings-logo"
          onClick={() => onNavigate("home")}
        >
          <span>Y</span>universe
        </button>
      </header>

      <main className="page-content settings-content">
        {/* ACCOUNT */}

        <section className="settings-section">
          <h2>Account</h2>

          <div className="account-card">
            <div className="account-avatar">
              {fullName.charAt(0).toUpperCase()}
            </div>

            <div className="account-info">
              <strong>{fullName}</strong>
              <span>@{username}</span>
              <small>{v2iId}</small>
            </div>

            <button
              className="settings-arrow"
              onClick={() => onNavigate("profile")}
            >
              →
            </button>
          </div>

          <button
            className="settings-link-row"
            onClick={() => onNavigate("profile")}
          >
            <div>
              <strong>Edit profile</strong>
              <p>Change your profile information</p>
            </div>
            <span>›</span>
          </button>
        </section>

        {/* PRIVACY */}

        <section className="settings-section">
          <h2>Privacy</h2>

          <SettingRow
            title="Public channel"
            description="Anyone can discover and subscribe to your channel"
            setting="publicChannel"
          />

          <SettingRow
            title="Show subscriptions"
            description="Allow others to see channels you subscribe to"
            setting="showSubscriptions"
          />

          <SettingRow
            title="Show liked videos"
            description="Allow others to see your liked videos"
            setting="showLikedVideos"
          />
        </section>

        {/* PLAYBACK */}

        <section className="settings-section">
          <h2>Playback</h2>

          <SettingRow
            title="Autoplay"
            description="Automatically play the next video"
            setting="autoplay"
          />

          <SettingRow
            title="Data saver"
            description="Use less mobile data while watching videos"
            setting="dataSaver"
          />
        </section>

        {/* NOTIFICATIONS */}

        <section className="settings-section">
          <h2>Notifications</h2>

          <SettingRow
            title="Notifications"
            description="Receive Yuniverse notifications"
            setting="notifications"
          />

          <SettingRow
            title="New subscribers"
            description="Notify me when someone subscribes"
            setting="newSubscribers"
          />

          <SettingRow
            title="Comments"
            description="Notify me about comments on my videos"
            setting="comments"
          />

          <SettingRow
            title="Likes"
            description="Notify me when someone likes my videos"
            setting="likes"
          />

          <SettingRow
            title="Recommendations"
            description="Get recommendations based on your activity"
            setting="recommendations"
          />
        </section>

        {/* CREATOR */}

        <section className="settings-section">
          <h2>Creator</h2>

          <button
            className="settings-link-row"
            onClick={() => onNavigate("channel")}
          >
            <div>
              <strong>Channel settings</strong>
              <p>Manage your Yuniverse channel</p>
            </div>
            <span>›</span>
          </button>

          <button
            className="settings-link-row"
            onClick={() => onNavigate("upload")}
          >
            <div>
              <strong>Upload video</strong>
              <p>Upload a new full-length video</p>
            </div>
            <span>›</span>
          </button>
        </section>

        {/* APPEARANCE */}

        <section className="settings-section">
          <h2>Appearance</h2>

          <SettingRow
            title="Dark mode"
            description="Use a dark interface across Yuniverse"
            setting="darkMode"
          />
        </section>

        {/* SECURITY */}

        <section className="settings-section">
          <h2>Security</h2>

          <div className="settings-info-row">
            <div>
              <strong>V2i account</strong>
              <p>Your Yuniverse identity is connected to your V2i ID.</p>
            </div>

            <span className="verified-badge">✓ V2i</span>
          </div>

          <button
            className="settings-link-row"
            onClick={() => {
              alert(
                "V2i account security is managed through your V2i account."
              );
            }}
          >
            <div>
              <strong>Account security</strong>
              <p>Manage your V2i identity and security</p>
            </div>
            <span>›</span>
          </button>
        </section>

        {/* ABOUT */}

        <section className="settings-section">
          <h2>About</h2>

          <button
            className="settings-link-row"
            onClick={() => alert("Yuniverse Community Guidelines coming soon.")}
          >
            <div>
              <strong>Community Guidelines</strong>
              <p>Learn about Yuniverse rules</p>
            </div>
            <span>›</span>
          </button>

          <button
            className="settings-link-row"
            onClick={() => alert("Yuniverse Privacy Policy coming soon.")}
          >
            <div>
              <strong>Privacy Policy</strong>
              <p>How Yuniverse handles your data</p>
            </div>
            <span>›</span>
          </button>

          <button
            className="settings-link-row"
            onClick={() => alert("Yuniverse Terms of Service coming soon.")}
          >
            <div>
              <strong>Terms of Service</strong>
              <p>Yuniverse terms and conditions</p>
            </div>
            <span>›</span>
          </button>

          <div className="settings-version">
            Yuniverse
            <span>Version 1.0.0</span>
          </div>
        </section>

        {/* LOGOUT */}

        <section className="settings-section logout-section">
          <button className="logout-button" onClick={handleLogout}>
            Sign out of Yuniverse
          </button>
        </section>
      </main>

      <nav className="bottom-nav">
        <button className="nav-item" onClick={() => onNavigate("home")}>
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button className="nav-item" onClick={() => onNavigate("search")}>
          <span>⌕</span>
          <small>Search</small>
        </button>

        <button
          className="nav-item upload-nav"
          onClick={() => onNavigate("upload")}
          aria-label="Upload video"
        >
          +
        </button>

        <button className="nav-item" onClick={() => onNavigate("subscribers")}>
          <span>🔔</span>
          <small>Subscribe</small>
        </button>

        <button
          className="nav-item active"
          onClick={() => onNavigate("profile")}
        >
          <span>○</span>
          <small>Profile</small>
        </button>
      </nav>
    </div>
  );
}
