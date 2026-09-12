import React, { useEffect, useState } from "react";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Watch from "./pages/Watch";
import Channel from "./pages/Channel";
import Upload from "./pages/Upload";
import Profile from "./pages/Profile";
import Subscriptions from "./pages/Subscriptions";
import EditChannel from "./pages/EditChannel";
import Playlists from "./pages/Playlists";
import Settings from "./pages/Settings";
import LibraryList from "./pages/LibraryList";

import "./index.css";

export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("yuniverse_user");
      if (!savedUser) return;

      const parsedUser = JSON.parse(savedUser);
      if (parsedUser) {
        setUser(parsedUser);
        setPage("home");
      }
    } catch (error) {
      console.error("Saved Yuniverse user error:", error);
      try {
        localStorage.removeItem("yuniverse_user");
      } catch (_) {}
      setUser(null);
      setPage("login");
    }
  }, []);

  function handleLogin(userData) {
    console.log("Yuniverse login successful:", userData);
    setUser(userData);
    try {
      localStorage.setItem("yuniverse_user", JSON.stringify(userData));
    } catch (e) {
      console.warn("Could not save user to localStorage:", e);
    }
    setPage("home");
  }

  function handleLogout() {
    try {
      localStorage.removeItem("yuniverse_user");
    } catch (_) {}

    setUser(null);
    setSelectedVideo(null);
    setSelectedChannel(null);
    setPage("login");
  }

  function navigate(destination, data = null) {
    if (destination === "watch") {
      setSelectedVideo(data);
    }

    if (destination === "channel") {
      setSelectedChannel(data);
    }

    setPage(destination);
  }

  // If on login page or no authenticated user, always render Login to prevent black screen
  if (page === "login" || !user) {
    return (
      <Login
        onLogin={handleLogin}
        onGuest={() =>
          handleLogin({
            id: "guest",
            username: "guest",
            fullName: "Guest Viewer",
            isGuest: true,
          })
        }
      />
    );
  }

  switch (page) {
    case "home":
      return <Home user={user} onNavigate={navigate} onLogout={handleLogout} />;

    case "search":
      return <Search user={user} onNavigate={navigate} />;

    case "watch":
      return <Watch user={user} video={selectedVideo} onNavigate={navigate} />;

    case "channel":
      return (
        <Channel user={user} channel={selectedChannel} onNavigate={navigate} />
      );

    case "upload":
      return <Upload user={user} onNavigate={navigate} />;

    case "subscriptions":
      return <Subscriptions user={user} onNavigate={navigate} />;

    case "edit-channel":
      return <EditChannel user={user} onNavigate={navigate} />;

    case "playlists":
      return <Playlists user={user} onNavigate={navigate} />;

    case "settings":
      return <Settings user={user} onNavigate={navigate} />;

    case "history":
      return <LibraryList user={user} type="history" onNavigate={navigate} />;

    case "liked":
      return <LibraryList user={user} type="liked" onNavigate={navigate} />;

    case "saved":
      return <LibraryList user={user} type="saved" onNavigate={navigate} />;

    case "profile":
      return (
        <Profile user={user} onNavigate={navigate} onLogout={handleLogout} />
      );

    default:
      return <Home user={user} onNavigate={navigate} onLogout={handleLogout} />;
  }
}
