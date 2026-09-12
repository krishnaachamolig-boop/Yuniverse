import React, { useEffect, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import VideoCard from "../components/VideoCard";

export default function Profile({ user, onNavigate }) {
  const userId =
    user?.authUser?.id ||
    user?.id ||
    user?.profile?.id ||
    null;

  const [historyVideos, setHistoryVideos] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingLiked, setLoadingLiked] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function formatVideo(video) {
    if (!video) return null;
    return {
      ...video,
      views: Number(video.views || 0),
      thumbnailUrl:
        video.thumbnail_url ||
        (video.mux_playback_id
          ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
          : null),
      playbackUrl: video.mux_playback_id
        ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
        : video.video_url || null,
    };
  }

  function isLandscape(video) {
    if (!video?.width || !video?.height) return true;
    const width = Number(video.width);
    const height = Number(video.height);
    if (width <= height) return false;
    const ratio = width / height;
    return Math.abs(ratio - 16 / 9) <= 0.08;
  }

  async function fetchVideos(videoIds) {
    if (!videoIds?.length) return [];
    const uniqueIds = [...new Set(videoIds.filter(Boolean))];
    if (!uniqueIds.length) return [];

    const { data: videos, error } = await yuniverseSupabase
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
      .in("id", uniqueIds)
      .eq("status", "ready");

    if (error) {
      console.error("Profile videos fetch error:", error);
      return [];
    }

    const valid = (videos || []).filter(isLandscape).map(formatVideo);

    // Fetch channel profiles for these videos
    const ownerIds = [...new Set(valid.map((v) => v.v2i_user_id).filter(Boolean))];
    if (ownerIds.length > 0) {
      const { data: profiles } = await yuniverseSupabase
        .from("channel_profiles")
        .select("v2i_user_id, channel_name, channel_avatar_url")
        .in("v2i_user_id", ownerIds);

      const pMap = new Map();
      (profiles || []).forEach((p) => pMap.set(p.v2i_user_id, p));
      return valid.map((v) => ({
        ...v,
        channelName: pMap.get(v.v2i_user_id)?.channel_name || "Yuniverse Creator",
        channelAvatar: pMap.get(v.v2i_user_id)?.channel_avatar_url || null,
      }));
    }

    return valid;
  }

  async function loadHistory() {
    if (!userId) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const { data, error } = await yuniverseSupabase
        .from("video_watch_sessions")
        .select("video_id, last_watched_at")
        .eq("v2i_user_id", userId)
        .order("last_watched_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const videoIds = [];
      for (const item of data || []) {
        if (item.video_id && !videoIds.includes(item.video_id)) {
          videoIds.push(item.video_id);
        }
      }

      if (!videoIds.length) {
        setHistoryVideos([]);
        return;
      }

      const fetched = await fetchVideos(videoIds);
      const vMap = new Map(fetched.map((v) => [v.id, v]));
      setHistoryVideos(videoIds.map((id) => vMap.get(id)).filter(Boolean).slice(0, 4));
    } catch (err) {
      console.error("History loading error:", err);
      setHistoryVideos([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadLikedVideos() {
    if (!userId) {
      setLoadingLiked(false);
      return;
    }
    setLoadingLiked(true);
    try {
      const { data, error } = await yuniverseSupabase
        .from("video_likes")
        .select("video_id, created_at")
        .eq("v2i_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const videoIds = [];
      for (const item of data || []) {
        if (item.video_id && !videoIds.includes(item.video_id)) {
          videoIds.push(item.video_id);
        }
      }

      if (!videoIds.length) {
        setLikedVideos([]);
        return;
      }

      const fetched = await fetchVideos(videoIds);
      const vMap = new Map(fetched.map((v) => [v.id, v]));
      setLikedVideos(videoIds.map((id) => vMap.get(id)).filter(Boolean).slice(0, 4));
    } catch (err) {
      console.error("Liked videos loading error:", err);
      setLikedVideos([]);
    } finally {
      setLoadingLiked(false);
    }
  }

  async function loadSavedVideos() {
    if (!userId) {
      setLoadingSaved(false);
      return;
    }
    setLoadingSaved(true);
    try {
      const { data, error } = await yuniverseSupabase
        .from("saved_videos")
        .select("video_id, created_at")
        .eq("v2i_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const videoIds = [];
      for (const item of data || []) {
        if (item.video_id && !videoIds.includes(item.video_id)) {
          videoIds.push(item.video_id);
        }
      }

      if (!videoIds.length) {
        setSavedVideos([]);
        return;
      }

      const fetched = await fetchVideos(videoIds);
      const vMap = new Map(fetched.map((v) => [v.id, v]));
      setSavedVideos(videoIds.map((id) => vMap.get(id)).filter(Boolean).slice(0, 4));
    } catch (err) {
      console.error("Saved videos loading error:", err);
      setSavedVideos([]);
    } finally {
      setLoadingSaved(false);
    }
  }

  async function loadPlaylists() {
    if (!userId) {
      setLoadingPlaylists(false);
      return;
    }
    setLoadingPlaylists(true);
    try {
      const { data, error } = await yuniverseSupabase
        .from("playlists")
        .select("id, user_id, name, description, thumbnail_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPlaylists(data || []);
    } catch (err) {
      console.error("Playlists error:", err);
      setPlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  }

  useEffect(() => {
    loadHistory();
    loadLikedVideos();
    loadSavedVideos();
    loadPlaylists();
  }, [userId]);

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    "Yuniverse User";

  const userHandle = user?.username ? `@${user.username}` : user?.v2iId ? `V2i: ${user.v2iId}` : "@user";
  const userAvatar = user?.profile?.avatar_url || null;
  const userInitial = displayName.charAt(0).toUpperCase();

  function SectionBlock({ icon, title, videos, loading, onViewAll }) {
    return (
      <section className="profile-section-card">
        <div className="profile-section-header">
          <div className="section-title-wrap">
            <span className="section-icon">{icon}</span>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="view-all-link"
            onClick={onViewAll}
          >
            View all →
          </button>
        </div>

        {loading && (
          <div className="video-scroll-row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="video-card-skeleton" style={{ width: "260px", flexShrink: 0 }} />
            ))}
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <p>No {title.toLowerCase()} recorded yet.</p>
          </div>
        )}

        {!loading && videos.length > 0 && (
          <div className="video-scroll-row">
            {videos.map((video) => (
              <div key={video.id} style={{ width: "260px", flexShrink: 0 }}>
                <VideoCard
                  video={video}
                  channelName={video.channelName}
                  channelAvatar={video.channelAvatar}
                  onVideoClick={(v) => onNavigate("watch", v)}
                  onChannelClick={(v) =>
                    onNavigate("channel", {
                      v2i_user_id: v.v2i_user_id,
                      channel_name: video.channelName,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    );
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
          <div className="page-content" style={{ maxWidth: "1200px" }}>
            {/* USER PROFILE HERO CARD */}
            <div className="profile-hero-card">
              <div className="profile-hero-avatar">
                {userAvatar ? (
                  <img src={userAvatar} alt={displayName} />
                ) : (
                  userInitial
                )}
              </div>

              <div className="profile-hero-details">
                <h2>{displayName}</h2>
                <span className="profile-hero-handle">{userHandle}</span>

                <div className="profile-hero-actions">
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() =>
                      onNavigate("channel", {
                        id: userId,
                        v2i_user_id: userId,
                        name: displayName,
                        username: user?.username,
                        v2i_id: user?.v2iId,
                        avatar_url: userAvatar,
                      })
                    }
                  >
                    View Your Channel
                  </button>

                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => onNavigate("settings")}
                  >
                    ⚙️ Settings
                  </button>

                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => onNavigate("upload")}
                  >
                    + Upload
                  </button>
                </div>
              </div>
            </div>

            {/* HISTORY SECTION */}
            <SectionBlock
              icon="🕐"
              title="History"
              videos={historyVideos}
              loading={loadingHistory}
              onViewAll={() => onNavigate("history")}
            />

            {/* LIKED VIDEOS */}
            <SectionBlock
              icon="❤️"
              title="Liked Videos"
              videos={likedVideos}
              loading={loadingLiked}
              onViewAll={() => onNavigate("liked")}
            />

            {/* SAVED VIDEOS */}
            <SectionBlock
              icon="🔖"
              title="Saved for Later"
              videos={savedVideos}
              loading={loadingSaved}
              onViewAll={() => onNavigate("saved")}
            />

            {/* PLAYLISTS SECTION */}
            <section className="profile-section-card">
              <div className="profile-section-header">
                <div className="section-title-wrap">
                  <span className="section-icon">📚</span>
                  <h3>Playlists</h3>
                </div>
                <button
                  type="button"
                  className="view-all-link"
                  onClick={() => onNavigate("playlists")}
                >
                  View all →
                </button>
              </div>

              {loadingPlaylists ? (
                <div className="video-scroll-row">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="video-card-skeleton" style={{ width: "220px", flexShrink: 0 }} />
                  ))}
                </div>
              ) : playlists.length === 0 ? (
                <div className="empty-state" style={{ padding: "24px 0" }}>
                  <p>No playlists created yet.</p>
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() => onNavigate("playlists")}
                  >
                    + Create Playlist
                  </button>
                </div>
              ) : (
                <div className="video-scroll-row">
                  {playlists.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="playlist-item-card"
                      onClick={() => onNavigate("playlists", p)}
                      style={{ width: "220px", flexShrink: 0, cursor: "pointer" }}
                    >
                      <div className="playlist-card-thumb">
                        {p.thumbnail_url ? (
                          <img src={p.thumbnail_url} alt={p.name} />
                        ) : (
                          <div className="playlist-card-empty">📚</div>
                        )}
                      </div>
                      <h4>{p.name || "Untitled playlist"}</h4>
                      <small>Playlist</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <BottomNav activePage="profile" onNavigate={onNavigate} />
    </div>
  );
}
