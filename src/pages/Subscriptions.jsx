import React, { useCallback, useEffect, useState } from "react";

import { yuniverseSupabase } from "../lib/yuniverseSupabase";

export default function Subscriptions({ user, onNavigate }) {
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUserId =
    user?.id ||
    user?.authUser?.id ||
    user?.profile?.id ||
    null;

  const loadSubscriptions = useCallback(async () => {
    if (!currentUserId) {
      setError("User information is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      /* =====================================================
         1. GET CHANNELS USER SUBSCRIBED TO
      ===================================================== */

      const {
        data: subscriptions,
        error: subscriptionError,
      } = await yuniverseSupabase
        .from("channel_subscriptions")
        .select(`
          id,
          channel_v2i_user_id,
          created_at
        `)
        .eq(
          "subscriber_v2i_user_id",
          currentUserId
        )
        .order("created_at", {
          ascending: false,
        });

      if (subscriptionError) {
        throw subscriptionError;
      }

      const subscribedChannelIds = [
        ...new Set(
          (subscriptions || [])
            .map(
              (item) =>
                item.channel_v2i_user_id
            )
            .filter(Boolean)
        ),
      ];

      setChannels(subscribedChannelIds);

      /* =====================================================
         NO SUBSCRIPTIONS
      ===================================================== */

      if (subscribedChannelIds.length === 0) {
        setVideos([]);
        return;
      }

      /* =====================================================
         2. GET VIDEOS FROM SUBSCRIBED CHANNELS
      ===================================================== */

      const {
        data: videoData,
        error: videoError,
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
          mux_asset_id,
          mux_playback_id,
          status,
          created_at,
          updated_at
        `)
        .in(
          "v2i_user_id",
          subscribedChannelIds
        )
        .eq("status", "ready")
        .not("mux_playback_id", "is", null)
        .order("created_at", {
          ascending: false,
        });

      if (videoError) {
        throw videoError;
      }

      /* =====================================================
         3. ONLY LANDSCAPE 16:9 VIDEOS
      ===================================================== */

      const validVideos = (videoData || [])
        .filter((video) => {
          const width = Number(video.width || 0);
          const height = Number(video.height || 0);

          if (!width || !height) {
            return true;
          }

          if (width <= height) {
            return false;
          }

          const ratio = width / height;

          return (
            Math.abs(ratio - 16 / 9) <=
            0.08
          );
        })
        .map((video) => ({
          ...video,

          views: Number(
            video.views || 0
          ),

          playbackUrl:
            video.mux_playback_id
              ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
              : video.video_url,

          thumbnailUrl:
            video.thumbnail_url ||
            (video.mux_playback_id
              ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
              : null),
        }));

      setVideos(validVideos);
    } catch (err) {
      console.error(
        "Subscriptions loading error:",
        err
      );

      setError(
        err?.message ||
          "Subscriptions load nahi ho paaye."
      );
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  /* =======================================================
     LOAD ON PAGE OPEN
  ======================================================= */

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  /* =======================================================
     HELPERS
  ======================================================= */

  function formatViews(value) {
    const views = Number(value || 0);

    if (views >= 1000000000) {
      return `${(
        views / 1000000000
      )
        .toFixed(1)
        .replace(".0", "")}B views`;
    }

    if (views >= 1000000) {
      return `${(
        views / 1000000
      )
        .toFixed(1)
        .replace(".0", "")}M views`;
    }

    if (views >= 1000) {
      return `${(
        views / 1000
      )
        .toFixed(1)
        .replace(".0", "")}K views`;
    }

    return `${views} views`;
  }

  function formatTime(dateString) {
    if (!dateString) return "";

    const createdAt =
      new Date(dateString);

    const now = new Date();

    const difference = Math.floor(
      (now.getTime() -
        createdAt.getTime()) /
        1000
    );

    if (difference < 60) {
      return "just now";
    }

    const minutes = Math.floor(
      difference / 60
    );

    if (minutes < 60) {
      return `${minutes} ${
        minutes === 1
          ? "minute"
          : "minutes"
      } ago`;
    }

    const hours = Math.floor(
      minutes / 60
    );

    if (hours < 24) {
      return `${hours} ${
        hours === 1
          ? "hour"
          : "hours"
      } ago`;
    }

    const days = Math.floor(
      hours / 24
    );

    if (days < 30) {
      return `${days} ${
        days === 1
          ? "day"
          : "days"
      } ago`;
    }

    const months = Math.floor(
      days / 30
    );

    if (months < 12) {
      return `${months} ${
        months === 1
          ? "month"
          : "months"
      } ago`;
    }

    const years = Math.floor(
      months / 12
    );

    return `${years} ${
      years === 1
        ? "year"
        : "years"
    } ago`;
  }

  function formatDuration(seconds) {
    const value = Number(
      seconds || 0
    );

    if (!value) return "";

    const totalSeconds =
      Math.floor(value);

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const secs =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(
        minutes
      ).padStart(2, "0")}:${String(
        secs
      ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(
      secs
    ).padStart(2, "0")}`;
  }

  function getChannelName(video) {
    if (
      video?.v2i_user_id &&
      video.v2i_user_id ===
        currentUserId
    ) {
      return (
        user?.fullName ||
        user?.firstName ||
        user?.username ||
        "You"
      );
    }

    return "Yuniverse Creator";
  }

  function openVideo(video) {
    onNavigate("watch", {
      ...video,

      playbackUrl:
        video.playbackUrl ||
        (video.mux_playback_id
          ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
          : video.video_url),

      thumbnailUrl:
        video.thumbnailUrl ||
        video.thumbnail_url,

      channel: {
        id: video.v2i_user_id,
        v2i_user_id:
          video.v2i_user_id,
        name: getChannelName(video),
      },
    });
  }

  function openChannel(video) {
    if (!video?.v2i_user_id) {
      return;
    }

    onNavigate("channel", {
      id: video.v2i_user_id,

      v2i_user_id:
        video.v2i_user_id,

      user_id:
        video.v2i_user_id,

      name: getChannelName(video),

      username:
        video.v2i_user_id ===
        currentUserId
          ? user?.username
          : undefined,

      v2i_id:
        video.v2i_user_id ===
        currentUserId
          ? user?.v2iId
          : undefined,

      avatar_url:
        video.v2i_user_id ===
        currentUserId
          ? user?.profile?.avatar_url
          : undefined,
    });
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="app-page">

        <header className="top-header">
          <button
            className="logo-button"
            onClick={() =>
              onNavigate("home")
            }
          >
            <span>Y</span>universe
          </button>

          <div className="header-actions">
            <button
              onClick={loadSubscriptions}
              aria-label="Refresh"
            >
              ↻
            </button>
          </div>
        </header>

        <main className="page-content">

          <section className="welcome-section">
            <div>
              <p className="eyebrow">
                Your feed
              </p>

              <h1>
                Subscriptions
              </h1>

              <p>
                Latest videos from channels
                you subscribe to.
              </p>
            </div>
          </section>

          <div className="empty-state">
            <div className="loading-spinner" />

            <p>
              Subscriptions load ho
              rahe hain...
            </p>
          </div>

        </main>

        <BottomNav
          active="subscriptions"
          onNavigate={onNavigate}
        />

      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <div className="app-page">

        <header className="top-header">
          <button
            className="logo-button"
            onClick={() =>
              onNavigate("home")
            }
          >
            <span>Y</span>universe
          </button>

          <div />
        </header>

        <main className="page-content">

          <div className="empty-state">

            <div className="empty-icon">
              ⚠️
            </div>

            <h3>
              Subscriptions load nahi hue
            </h3>

            <p>{error}</p>

            <button
              className="primary-button"
              onClick={loadSubscriptions}
            >
              Try again
            </button>

          </div>

        </main>

        <BottomNav
          active="subscriptions"
          onNavigate={onNavigate}
        />

      </div>
    );
  }

  /* =======================================================
     MAIN PAGE
  ======================================================= */

  return (
    <div className="app-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="top-header">

        <button
          className="logo-button"
          onClick={() =>
            onNavigate("home")
          }
        >
          <span>Y</span>universe
        </button>

        <div className="header-actions">

          <button
            onClick={() =>
              onNavigate("search")
            }
            aria-label="Search"
          >
            🔍
          </button>

          <button
            onClick={loadSubscriptions}
            aria-label="Refresh"
          >
            ↻
          </button>

          <button
            onClick={() =>
              onNavigate("profile")
            }
            aria-label="Profile"
          >
            👤
          </button>

        </div>

      </header>

      {/* =================================================
          CONTENT
      ================================================= */}

      <main className="page-content">

        <section className="welcome-section">

          <div>

            <p className="eyebrow">
              Your feed
            </p>

            <h1>
              Subscriptions
            </h1>

            <p>
              Latest videos from channels
              you subscribe to.
            </p>

          </div>

        </section>

        {/* ===============================================
            SUBSCRIBED CHANNEL COUNT
        =============================================== */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "24px",
          }}
        >

          <div>
            <strong
              style={{
                fontSize: "18px",
              }}
            >
              {channels.length}
            </strong>{" "}
            subscribed{" "}
            {channels.length === 1
              ? "channel"
              : "channels"}
          </div>

          <button
            onClick={loadSubscriptions}
            disabled={loading}
          >
            Refresh
          </button>

        </div>

        {/* ===============================================
            NO SUBSCRIPTIONS
        =============================================== */}

        {channels.length === 0 && (

          <div className="empty-state">

            <div className="empty-icon">
              🔔
            </div>

            <h3>
              Abhi koi subscription nahi hai
            </h3>

            <p>
              Apne favourite creators ko
              subscribe karo. Unke latest
              videos yahan dikhenge.
            </p>

            <button
              className="primary-button"
              onClick={() =>
                onNavigate("home")
              }
            >
              Discover videos
            </button>

          </div>

        )}

        {/* ===============================================
            SUBSCRIBED BUT NO VIDEOS
        =============================================== */}

        {channels.length > 0 &&
          videos.length === 0 && (

            <div className="empty-state">

              <div className="empty-icon">
                ▶
              </div>

              <h3>
                Abhi naye videos nahi hain
              </h3>

              <p>
                Tumhare subscribed channels
                ne abhi koi ready video upload
                nahi kiya.
              </p>

            </div>

          )}

        {/* ===============================================
            VIDEO GRID
        =============================================== */}

        {videos.length > 0 && (

          <section className="video-section">

            <div className="section-heading">

              <h2>
                Latest videos
              </h2>

            </div>

            <div className="video-grid">

              {videos.map((video) => (

                <article
                  className="video-card"
                  key={video.id}
                >

                  {/* =====================================
                      THUMBNAIL
                  ===================================== */}

                  <div
                    className="video-thumbnail"
                    onClick={() =>
                      openVideo(video)
                    }
                  >

                    {video.thumbnailUrl ? (

                      <img
                        src={
                          video.thumbnailUrl
                        }
                        alt={video.title}
                        loading="lazy"
                      />

                    ) : (

                      <div className="thumbnail-placeholder">
                        <span>▶</span>
                      </div>

                    )}

                    <div className="thumbnail-play">
                      ▶
                    </div>

                    {video.duration && (

                      <span
                        style={{
                          position: "absolute",
                          right: "8px",
                          bottom: "8px",
                          padding: "3px 6px",
                          borderRadius: "4px",
                          background:
                            "rgba(0,0,0,0.8)",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {formatDuration(
                          video.duration
                        )}
                      </span>

                    )}

                  </div>

                  {/* =====================================
                      VIDEO INFO
                  ===================================== */}

                  <div className="video-info">

                    <button
                      className="channel-avatar channel-avatar-button"
                      onClick={() =>
                        openChannel(video)
                      }
                      aria-label="Open channel"
                    >
                      {getChannelName(
                        video
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </button>

                    <div className="video-text">

                      <h3
                        title={video.title}
                        onClick={() =>
                          openVideo(video)
                        }
                      >
                        {video.title}
                      </h3>

                      <button
                        className="video-channel-name"
                        onClick={() =>
                          openChannel(video)
                        }
                      >
                        {getChannelName(
                          video
                        )}
                      </button>

                      <small>
                        {formatViews(
                          video.views
                        )}
                        {" • "}
                        {formatTime(
                          video.created_at
                        )}
                      </small>

                    </div>

                  </div>

                </article>

              ))}

            </div>

          </section>

        )}

      </main>

      {/* =================================================
          BOTTOM NAV
      ================================================= */}

      <BottomNav
        active="subscriptions"
        onNavigate={onNavigate}
      />

    </div>
  );
}

/* =========================================================
   BOTTOM NAVIGATION
========================================================= */

function BottomNav({
  active,
  onNavigate,
}) {
  return (
    <nav className="bottom-nav">

      <button
        className={`nav-item ${
          active === "home"
            ? "active"
            : ""
        }`}
        onClick={() =>
          onNavigate("home")
        }
      >
        <span>⌂</span>
        <small>Home</small>
      </button>

      <button
        className={`nav-item ${
          active === "search"
            ? "active"
            : ""
        }`}
        onClick={() =>
          onNavigate("search")
        }
      >
        <span>⌕</span>
        <small>Search</small>
      </button>

      <button
        className="nav-item upload-nav"
        onClick={() =>
          onNavigate("upload")
        }
        aria-label="Upload video"
      >
        +
      </button>

      <button
        className={`nav-item ${
          active === "subscriptions"
            ? "active"
            : ""
        }`}
        onClick={() =>
          onNavigate("subscriptions")
        }
      >
        <span>🔔</span>
        <small>Subscribe</small>
      </button>

      <button
        className={`nav-item ${
          active === "profile"
            ? "active"
            : ""
        }`}
        onClick={() =>
          onNavigate("profile")
        }
      >
        <span>○</span>
        <small>Profile</small>
      </button>

    </nav>
  );
}