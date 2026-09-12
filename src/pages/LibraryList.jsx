import React, { useCallback, useEffect, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import VideoCard, { VideoCardSkeleton } from "../components/VideoCard";

export default function LibraryList({ user, type = "history", onNavigate }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const userId =
    user?.authUser?.id ||
    user?.id ||
    user?.profile?.id ||
    null;

  const titles = {
    history: "Watch History",
    liked: "Liked Videos",
    saved: "Saved Videos",
  };

  const icons = {
    history: "🕐",
    liked: "❤️",
    saved: "🔖",
  };

  const pageTitle = titles[type] || "Library";
  const pageIcon = icons[type] || "📁";

  const loadVideos = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    try {
      let videoIds = [];

      if (type === "history") {
        const { data, error: hErr } = await yuniverseSupabase
          .from("video_watch_sessions")
          .select("video_id, last_watched_at")
          .eq("v2i_user_id", userId)
          .order("last_watched_at", { ascending: false })
          .limit(100);

        if (hErr) throw hErr;
        for (const item of data || []) {
          if (item.video_id && !videoIds.includes(item.video_id)) {
            videoIds.push(item.video_id);
          }
        }
      } else if (type === "liked") {
        const { data, error: lErr } = await yuniverseSupabase
          .from("video_likes")
          .select("video_id, created_at")
          .eq("v2i_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (lErr) throw lErr;
        for (const item of data || []) {
          if (item.video_id && !videoIds.includes(item.video_id)) {
            videoIds.push(item.video_id);
          }
        }
      } else if (type === "saved") {
        const { data, error: sErr } = await yuniverseSupabase
          .from("saved_videos")
          .select("video_id, created_at")
          .eq("v2i_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (sErr) throw sErr;
        for (const item of data || []) {
          if (item.video_id && !videoIds.includes(item.video_id)) {
            videoIds.push(item.video_id);
          }
        }
      }

      if (videoIds.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

      const { data: videoData, error: vErr } = await yuniverseSupabase
        .from("videos")
        .select(`
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
          mux_asset_id,
          mux_playback_id,
          status
        `)
        .in("id", videoIds)
        .eq("status", "ready");

      if (vErr) throw vErr;

      const ownerIds = [
        ...new Set((videoData || []).map((v) => v.v2i_user_id).filter(Boolean)),
      ];

      const profileMap = new Map();
      if (ownerIds.length > 0) {
        const { data: profiles } = await yuniverseSupabase
          .from("channel_profiles")
          .select("v2i_user_id, channel_name, channel_avatar_url")
          .in("v2i_user_id", ownerIds);

        (profiles || []).forEach((p) => profileMap.set(p.v2i_user_id, p));
      }

      const formatted = (videoData || []).map((v) => ({
        ...v,
        channelName: profileMap.get(v.v2i_user_id)?.channel_name || "Yuniverse Creator",
        channelAvatar: profileMap.get(v.v2i_user_id)?.channel_avatar_url || null,
        views: Number(v.views || 0),
        playbackUrl: v.mux_playback_id
          ? `https://stream.mux.com/${v.mux_playback_id}.m3u8`
          : v.video_url,
        thumbnailUrl:
          v.thumbnail_url ||
          (v.mux_playback_id
            ? `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg`
            : null),
      }));

      const vMap = new Map(formatted.map((v) => [v.id, v]));
      const ordered = videoIds.map((id) => vMap.get(id)).filter(Boolean);
      setVideos(ordered);
    } catch (err) {
      console.error(`Library load error (${type}):`, err);
      setError(err?.message || "Failed to load videos.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  async function handleClearHistory() {
    if (type !== "history" || !userId) return;
    if (!window.confirm("Clear all watch history?")) return;
    try {
      await yuniverseSupabase
        .from("video_watch_sessions")
        .delete()
        .eq("v2i_user_id", userId);
      setVideos([]);
    } catch (err) {
      console.error("Clear history error:", err);
    }
  }

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        activePage="profile"
        onNavigate={onNavigate}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="app-body">
        <Sidebar
          activePage="profile"
          onNavigate={onNavigate}
          collapsed={sidebarCollapsed}
        />

        <main className="app-main">
          <div className="page-content">
            <div className="section-heading">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  className="back-button"
                  onClick={() => onNavigate("profile")}
                  style={{ width: "36px", height: "36px", borderRadius: "10px" }}
                >
                  ←
                </button>
                <h2>
                  {pageIcon} {pageTitle} ({videos.length})
                </h2>
              </div>

              {type === "history" && videos.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{ color: "var(--color-danger)" }}
                >
                  Clear History
                </button>
              )}
            </div>

            {loading && (
              <div className="video-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <VideoCardSkeleton key={i} />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3>Unable to load</h3>
                <p>{error}</p>
                <button type="button" className="primary-button" onClick={loadVideos}>
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && videos.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">{pageIcon}</div>
                <h3>No videos found</h3>
                <p>You have no {pageTitle.toLowerCase()} yet.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onNavigate("home")}
                >
                  Discover Videos
                </button>
              </div>
            )}

            {!loading && !error && videos.length > 0 && (
              <div className="video-grid">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    channelName={video.channelName}
                    channelAvatar={video.channelAvatar}
                    onVideoClick={(v) => onNavigate("watch", v)}
                    onChannelClick={(v) =>
                      onNavigate("channel", {
                        v2i_user_id: v.v2i_user_id,
                        channel_name: video.channelName,
                        channel_avatar_url: video.channelAvatar,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <BottomNav activePage="profile" onNavigate={onNavigate} />
    </div>
  );
}
