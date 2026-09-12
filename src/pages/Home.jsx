import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import { yuniverseSupabase } from "../lib/yuniverseSupabase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import VideoCard, { VideoCardSkeleton } from "../components/VideoCard";

const CATEGORIES = [
  "All",
  "Trending",
  "Music",
  "Gaming",
  "News",
  "Technology",
  "Education",
  "Entertainment",
];

export default function Home({ user, onNavigate, onLogout }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await yuniverseSupabase
        .from("videos")
        .select(
          `
            id,
            v2i_user_id,
            title,
            description,
            video_url,
            thumbnail_url,
            duration,
            width,
            height,
            views,
            created_at,
            updated_at,
            mux_asset_id,
            mux_playback_id,
            status
          `
        )
        .eq("status", "ready")
        .not("mux_playback_id", "is", null)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const landscapeVideos = (data || [])
        .filter((video) => {
          if (!video.width || !video.height) return true;
          const width = Number(video.width);
          const height = Number(video.height);
          if (width <= height) return false;
          const ratio = width / height;
          return Math.abs(ratio - 16 / 9) <= 0.08;
        })
        .map((video) => ({
          ...video,
          views: Number(video.views || 0),
          playbackUrl: video.mux_playback_id
            ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
            : video.video_url,
          thumbnailUrl:
            video.thumbnail_url ||
            (video.mux_playback_id
              ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
              : null),
        }));

      const ownerIds = [
        ...new Set(landscapeVideos.map((v) => v.v2i_user_id).filter(Boolean)),
      ];

      let profileMap = new Map();
      if (ownerIds.length > 0) {
        const { data: channelProfiles, error: profileError } =
          await yuniverseSupabase
            .from("channel_profiles")
            .select("v2i_user_id, channel_name, channel_avatar_url, channel_bio")
            .in("v2i_user_id", ownerIds);

        if (!profileError && channelProfiles) {
          profileMap = new Map(
            channelProfiles.map((p) => [p.v2i_user_id, p])
          );
        }
      }

      const formattedVideos = landscapeVideos.map((video) => ({
        ...video,
        channelProfile: profileMap.get(video.v2i_user_id) || null,
      }));

      setVideos(formattedVideos);
    } catch (err) {
      console.error("Yuniverse videos fetch error:", err);
      setError(err?.message || "Failed to load videos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    function handleWindowFocus() {
      loadVideos();
    }
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [loadVideos]);

  const filteredVideos = videos.filter((video) => {
    if (selectedCategory === "All") return true;
    if (selectedCategory === "Trending") return (video.views || 0) > 0;
    const q = selectedCategory.toLowerCase();
    const titleMatch = (video.title || "").toLowerCase().includes(q);
    const descMatch = (video.description || "").toLowerCase().includes(q);
    return titleMatch || descMatch;
  });

  const displayVideos = filteredVideos.length > 0 ? filteredVideos : videos;

  const handleSaveVideo = async (video) => {
    const currentUserId = user?.id || user?.authUser?.id || user?.profile?.id;
    if (!currentUserId || !video?.id) return;
    try {
      await yuniverseSupabase.from("saved_videos").upsert({
        video_id: video.id,
        v2i_user_id: currentUserId,
      });
    } catch (err) {
      console.warn("Save video error:", err);
    }
  };

  return (
    <div className="app-shell">
      {/* GLOBAL NAVBAR */}
      <Navbar
        user={user}
        activePage="home"
        onNavigate={onNavigate}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="app-body">
        {/* DESKTOP SIDEBAR */}
        <Sidebar
          activePage="home"
          onNavigate={onNavigate}
          collapsed={sidebarCollapsed}
        />

        {/* MAIN FEED CONTENT */}
        <main className="app-main">
          <div className="page-content">
            {/* CATEGORY FILTER CHIPS ROW */}
            <div className="category-row">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* SECTION HEADING */}
            <div className="section-heading">
              <h2>
                {selectedCategory === "All"
                  ? "Recommended for You"
                  : selectedCategory}
              </h2>
              <button
                type="button"
                onClick={loadVideos}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh Feed"}
              </button>
            </div>

            {/* LOADING SKELETONS */}
            {loading && (
              <div className="video-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <VideoCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* ERROR STATE */}
            {!loading && error && (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3>Unable to load videos</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={loadVideos}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && !error && videos.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">▶</div>
                <h3>No videos found</h3>
                <p>Be the first creator to upload a video on Yuniverse!</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onNavigate("upload")}
                >
                  Upload a Video
                </button>
              </div>
            )}

            {/* VIDEO GRID */}
            {!loading && !error && displayVideos.length > 0 && (
              <div className="video-grid">
                {displayVideos.map((video) => {
                  const channelName =
                    video.channelProfile?.channel_name || "Yuniverse Creator";
                  const channelAvatar =
                    video.channelProfile?.channel_avatar_url || null;

                  return (
                    <VideoCard
                      key={video.id}
                      video={video}
                      channelName={channelName}
                      channelAvatar={channelAvatar}
                      onVideoClick={(v) => onNavigate("watch", v)}
                      onChannelClick={(v) =>
                        onNavigate("channel", {
                          v2i_user_id: v.v2i_user_id,
                          channel_name: channelName,
                          channel_avatar_url: channelAvatar,
                        })
                      }
                      onSaveVideo={handleSaveVideo}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <BottomNav activePage="home" onNavigate={onNavigate} />
    </div>
  );
}
