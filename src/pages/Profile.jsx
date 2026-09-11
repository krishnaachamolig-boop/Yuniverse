import React, { useEffect, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";

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

      playbackUrl:
        video.mux_playback_id
          ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
          : video.video_url || null,
    };
  }

  function isLandscape(video) {
    if (!video?.width || !video?.height) {
      return true;
    }

    const width = Number(video.width);
    const height = Number(video.height);

    if (width <= height) {
      return false;
    }

    const ratio = width / height;

    return Math.abs(ratio - 16 / 9) <= 0.08;
  }

  function formatViews(value) {
    const views = Number(value || 0);

    if (views >= 1000000000) {
      return `${(views / 1000000000)
        .toFixed(1)
        .replace(".0", "")}B`;
    }

    if (views >= 1000000) {
      return `${(views / 1000000)
        .toFixed(1)
        .replace(".0", "")}M`;
    }

    if (views >= 1000) {
      return `${(views / 1000)
        .toFixed(1)
        .replace(".0", "")}K`;
    }

    return views;
  }

  /* =========================================================
     COMMON VIDEO FETCH
     ========================================================= */

  async function fetchVideos(videoIds) {
    if (!videoIds?.length) {
      return [];
    }

    const uniqueIds = [
      ...new Set(videoIds.filter(Boolean)),
    ];

    if (!uniqueIds.length) {
      return [];
    }

    const {
      data: videos,
      error,
    } = await yuniverseSupabase
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
      console.error(
        "Profile videos fetch error:",
        error
      );

      return [];
    }

    return (videos || [])
      .filter(isLandscape)
      .map(formatVideo);
  }

  /* =========================================================
     HISTORY
     
     IMPORTANT:
     Watch.jsx creates records in:
     video_watch_sessions

     The viewer ID is:
     v2i_user_id

     NOT videos.v2i_user_id because that is
     the channel/creator ID.
     ========================================================= */

  async function loadHistory() {
    if (!userId) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);

    try {
      const {
        data,
        error,
      } = await yuniverseSupabase
        .from("video_watch_sessions")
        .select(`
          video_id,
          last_watched_at,
          updated_at,
          created_at
        `)
        .eq("v2i_user_id", userId)
        .order("last_watched_at", {
          ascending: false,
        })
        .limit(50);

      if (error) {
        console.error(
          "History error:",
          error
        );

        setHistoryVideos([]);
        return;
      }

      /*
       * Remove duplicate video IDs while keeping
       * most recently watched order.
       */
      const videoIds = [];

      for (const item of data || []) {
        if (
          item.video_id &&
          !videoIds.includes(item.video_id)
        ) {
          videoIds.push(item.video_id);
        }
      }

      if (!videoIds.length) {
        setHistoryVideos([]);
        return;
      }

      const videos =
        await fetchVideos(videoIds);

      const videoMap = new Map(
        videos.map((video) => [
          video.id,
          video,
        ])
      );

      /*
       * Restore watch-history order.
       */
      const orderedVideos = videoIds
        .map((id) =>
          videoMap.get(id)
        )
        .filter(Boolean);

      setHistoryVideos(
        orderedVideos.slice(0, 4)
      );
    } catch (error) {
      console.error(
        "History loading error:",
        error
      );

      setHistoryVideos([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  /* =========================================================
     LIKED VIDEOS
     ========================================================= */

  async function loadLikedVideos() {
    if (!userId) {
      setLoadingLiked(false);
      return;
    }

    setLoadingLiked(true);

    try {
      const {
        data,
        error,
      } = await yuniverseSupabase
        .from("video_likes")
        .select(`
          video_id,
          created_at
        `)
        .eq("v2i_user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (error) {
        console.error(
          "Liked videos error:",
          error
        );

        setLikedVideos([]);
        return;
      }

      const videoIds = [];

      for (const item of data || []) {
        if (
          item.video_id &&
          !videoIds.includes(item.video_id)
        ) {
          videoIds.push(item.video_id);
        }
      }

      if (!videoIds.length) {
        setLikedVideos([]);
        return;
      }

      const videos =
        await fetchVideos(videoIds);

      const videoMap = new Map(
        videos.map((video) => [
          video.id,
          video,
        ])
      );

      const orderedVideos = videoIds
        .map((id) =>
          videoMap.get(id)
        )
        .filter(Boolean);

      setLikedVideos(
        orderedVideos.slice(0, 4)
      );
    } catch (error) {
      console.error(
        "Liked videos loading error:",
        error
      );

      setLikedVideos([]);
    } finally {
      setLoadingLiked(false);
    }
  }

  /* =========================================================
     SAVED VIDEOS
     ========================================================= */

  async function loadSavedVideos() {
    if (!userId) {
      setLoadingSaved(false);
      return;
    }

    setLoadingSaved(true);

    try {
      const {
        data,
        error,
      } = await yuniverseSupabase
        .from("saved_videos")
        .select(`
          video_id,
          created_at
        `)
        .eq("v2i_user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (error) {
        console.error(
          "Saved videos error:",
          error
        );

        setSavedVideos([]);
        return;
      }

      const videoIds = [];

      for (const item of data || []) {
        if (
          item.video_id &&
          !videoIds.includes(item.video_id)
        ) {
          videoIds.push(item.video_id);
        }
      }

      if (!videoIds.length) {
        setSavedVideos([]);
        return;
      }

      const videos =
        await fetchVideos(videoIds);

      const videoMap = new Map(
        videos.map((video) => [
          video.id,
          video,
        ])
      );

      const orderedVideos = videoIds
        .map((id) =>
          videoMap.get(id)
        )
        .filter(Boolean);

      setSavedVideos(
        orderedVideos.slice(0, 4)
      );
    } catch (error) {
      console.error(
        "Saved videos loading error:",
        error
      );

      setSavedVideos([]);
    } finally {
      setLoadingSaved(false);
    }
  }

  /* =========================================================
     PLAYLISTS
     ========================================================= */

  async function loadPlaylists() {
    if (!userId) {
      setLoadingPlaylists(false);
      return;
    }

    setLoadingPlaylists(true);

    try {
      const {
        data,
        error,
      } = await yuniverseSupabase
        .from("playlists")
        .select(`
          id,
          user_id,
          name,
          description,
          thumbnail_url,
          created_at
        `)
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(20);

      if (error) {
        console.error(
          "Playlists error:",
          error
        );

        setPlaylists([]);
        return;
      }

      setPlaylists(data || []);
    } catch (error) {
      console.error(
        "Playlists loading error:",
        error
      );

      setPlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  }

  /* =========================================================
     LOAD EVERYTHING
     ========================================================= */

  useEffect(() => {
    loadHistory();
    loadLikedVideos();
    loadSavedVideos();
    loadPlaylists();
  }, [userId]);

  /* =========================================================
     OPEN VIDEO
     ========================================================= */

  function openVideo(video) {
    if (!video) return;

    onNavigate("watch", video);
  }

  /* =========================================================
     VIDEO SECTION
     ========================================================= */

  function VideoSection({
    icon,
    title,
    videos,
    loading,
    onViewAll,
  }) {
    return (
      <section className="profile-library-section">
        <div className="profile-library-heading">
          <button
            type="button"
            className="profile-library-title-button"
            onClick={onViewAll}
          >
            <span className="profile-library-title-icon">
              {icon}
            </span>

            <span>{title}</span>
          </button>

          <button
            type="button"
            className="profile-view-all"
            onClick={onViewAll}
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div className="profile-horizontal-videos">
            {[1, 2, 3, 4].map((item) => (
              <div
                className="profile-video-skeleton"
                key={item}
              />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="profile-empty-library">
            <span>{icon}</span>

            <p>
              No {title.toLowerCase()} yet
            </p>
          </div>
        ) : (
          <div className="profile-horizontal-videos">
            {videos.slice(0, 4).map((video) => (
              <article
                className="profile-video-card"
                key={video.id}
                onClick={() =>
                  openVideo(video)
                }
              >
                {/* STRICT 16:9 LANDSCAPE */}
                <div className="profile-video-thumbnail">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={
                        video.title ||
                        "Video thumbnail"
                      }
                      loading="lazy"
                    />
                  ) : (
                    <div className="thumbnail-placeholder">
                      <span>▶</span>
                    </div>
                  )}
                </div>

                <h3 title={video.title}>
                  {video.title}
                </h3>

                <small>
                  {formatViews(video.views)} views
                </small>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  /* =========================================================
     PLAYLIST SECTION
     ========================================================= */

  function PlaylistSection() {
    return (
      <section className="profile-library-section">
        <div className="profile-library-heading">
          <button
            type="button"
            className="profile-library-title-button"
            onClick={() =>
              onNavigate("playlists")
            }
          >
            <span className="profile-library-title-icon">
              📚
            </span>

            <span>Playlists</span>
          </button>

          <button
            type="button"
            className="profile-view-all"
            onClick={() =>
              onNavigate("playlists")
            }
          >
            View all →
          </button>
        </div>

        {loadingPlaylists ? (
          <div className="profile-playlist-row">
            {[1, 2, 3, 4].map((item) => (
              <div
                className="profile-playlist-skeleton"
                key={item}
              />
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <div className="profile-empty-library">
            <span>📚</span>

            <p>No playlists yet</p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                onNavigate("playlists")
              }
            >
              Create playlist
            </button>
          </div>
        ) : (
          <div className="profile-playlist-row">
            {playlists.slice(0, 4).map(
              (playlist) => (
                <article
                  className="profile-playlist-card"
                  key={playlist.id}
                  onClick={() =>
                    onNavigate(
                      "playlists",
                      playlist
                    )
                  }
                >
                  <div className="profile-playlist-thumbnail">
                    {playlist.thumbnail_url ? (
                      <img
                        src={
                          playlist.thumbnail_url
                        }
                        alt={
                          playlist.name ||
                          "Playlist"
                        }
                        loading="lazy"
                      />
                    ) : (
                      <div>📚</div>
                    )}
                  </div>

                  <h3>
                    {playlist.name ||
                      "Untitled playlist"}
                  </h3>

                  <small>
                    Playlist
                  </small>
                </article>
              )
            )}
          </div>
        )}
      </section>
    );
  }

  /* =========================================================
     UI
     ========================================================= */

  return (
    <div className="app-page">

      {/* =====================================================
          TOP HEADER
          UPLOAD BUTTON REMOVED
          SETTINGS BUTTON ADDED
         ===================================================== */}

      <header className="top-header">
        <button
          type="button"
          className="logo-button"
          onClick={() =>
            onNavigate("home")
          }
        >
          <span>Y</span>universe
        </button>

        <div className="header-actions">

          {/* SEARCH */}
          <button
            type="button"
            onClick={() =>
              onNavigate("search")
            }
            aria-label="Search"
            title="Search"
          >
            🔍
          </button>

          {/* SETTINGS */}
          <button
            type="button"
            onClick={() =>
              onNavigate("settings")
            }
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>

        </div>
      </header>

      {/* =====================================================
          PROFILE CONTENT
         ===================================================== */}

<button
  type="button"
  className="profile-channel-button"
  onClick={() =>
    onNavigate("channel", {
      id: userId,
      v2i_user_id: userId,
      name:
        user?.fullName ||
        user?.firstName ||
        user?.username ||
        user?.v2iId ||
        "You",
      username: user?.username,
      v2i_id: user?.v2iId,
      avatar_url: user?.profile?.avatar_url,
    })
  }
>
  <span>👤</span>
  <span>Profile</span>
  <span>→</span>
</button>


      <main className="page-content profile-library-page">

        {/* HISTORY */}
        <VideoSection
          icon="🕐"
          title="History"
          videos={historyVideos}
          loading={loadingHistory}
          onViewAll={() =>
            onNavigate("history")
          }
        />

        {/* LIKED VIDEOS */}
        <VideoSection
          icon="❤️"
          title="Liked videos"
          videos={likedVideos}
          loading={loadingLiked}
          onViewAll={() =>
            onNavigate("liked")
          }
        />

        {/* SAVED VIDEOS */}
        <VideoSection
          icon="🔖"
          title="Saved videos"
          videos={savedVideos}
          loading={loadingSaved}
          onViewAll={() =>
            onNavigate("saved")
          }
        />

        {/* PLAYLISTS */}
        <PlaylistSection />

      </main>

      {/* =====================================================
          BOTTOM NAV
         ===================================================== */}

      <nav className="bottom-nav">

        <button
          type="button"
          className="nav-item"
          onClick={() =>
            onNavigate("home")
          }
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() =>
            onNavigate("search")
          }
        >
          <span>⌕</span>
          <small>Search</small>
        </button>

        <button
          type="button"
          className="nav-item upload-nav"
          onClick={() =>
            onNavigate("upload")
          }
          aria-label="Upload video"
        >
          +
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={() =>
            onNavigate("subscriptions")
          }
        >
          <span>🔔</span>
          <small>Subscribe</small>
        </button>

        <button
          type="button"
          className="nav-item active"
          onClick={() =>
            onNavigate("profile")
          }
        >
          <span>○</span>
          <small>Profile</small>
        </button>

      </nav>
    </div>
  );
}