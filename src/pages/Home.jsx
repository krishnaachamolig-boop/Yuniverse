import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import { yuniverseSupabase } from "../lib/yuniverseSupabase";

export default function Home({ user, onNavigate }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } =
        await yuniverseSupabase
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
          .order("created_at", {
            ascending: false,
          });

      if (fetchError) {
        throw fetchError;
      }

      const landscapeVideos = (data || [])
        .filter((video) => {
          if (!video.width || !video.height) {
            return true;
          }

          const width = Number(video.width);
          const height = Number(video.height);

          if (width <= height) {
            return false;
          }

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

      // =======================================================
      // LOAD YUNIVERSE CHANNEL PROFILES
      // =======================================================

      const ownerIds = [
        ...new Set(
          landscapeVideos
            .map(
              (video) =>
                video.v2i_user_id
            )
            .filter(Boolean)
        ),
      ];

      let profileMap = new Map();

      if (ownerIds.length > 0) {
        const {
          data: channelProfiles,
          error: profileError,
        } = await yuniverseSupabase
          .from("channel_profiles")
          .select(
            `
              v2i_user_id,
              channel_name,
              channel_avatar_url,
              channel_bio
            `
          )
          .in(
            "v2i_user_id",
            ownerIds
          );

        if (profileError) {
          console.error(
            "Home channel profiles error:",
            profileError
          );
        } else {
          profileMap = new Map(
            (channelProfiles || []).map(
              (profile) => [
                profile.v2i_user_id,
                profile,
              ]
            )
          );
        }
      }

      const formattedVideos =
        landscapeVideos.map(
          (video) => ({
            ...video,

            channelProfile:
              profileMap.get(
                video.v2i_user_id
              ) || null,
          })
        );

      console.log(
        "Yuniverse Home videos:",
        formattedVideos.map(
          (video) => ({
            id: video.id,
            title: video.title,
            v2i_user_id:
              video.v2i_user_id,
            channel_name:
              video.channelProfile
                ?.channel_name ||
              "Yuniverse Creator",
            has_avatar:
              Boolean(
                video.channelProfile
                  ?.channel_avatar_url
              ),
            views: video.views,
          })
        )
      );

      setVideos(formattedVideos);
    } catch (err) {
      console.error(
        "Yuniverse videos fetch error:",
        err
      );

      setError(
        err?.message ||
          "Videos load nahi ho paaye."
      );
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

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleWindowFocus
      );
    };
  }, [loadVideos]);

  function formatViews(value) {
    const views = Number(value || 0);

    if (views >= 1000000000) {
      return `${(views / 1000000000)
        .toFixed(1)
        .replace(".0", "")}B views`;
    }

    if (views >= 1000000) {
      return `${(views / 1000000)
        .toFixed(1)
        .replace(".0", "")}M views`;
    }

    if (views >= 1000) {
      return `${(views / 1000)
        .toFixed(1)
        .replace(".0", "")}K views`;
    }

    return `${views} views`;
  }

  function formatTime(dateString) {
    if (!dateString) {
      return "";
    }

    const createdAt = new Date(
      dateString
    );

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

  function getChannelName(video) {
    return (
      video?.channelProfile
        ?.channel_name ||
      "Yuniverse Creator"
    );
  }

  function getChannelAvatar(video) {
    return (
      video?.channelProfile
        ?.channel_avatar_url ||
      null
    );
  }

  function getAvatarLetter(name) {
    return (
      name?.trim()
        ?.charAt(0)
        ?.toUpperCase() || "Y"
    );
  }

  function openChannel(video) {
    if (!video?.v2i_user_id) {
      console.error(
        "Channel navigation failed:",
        video
      );

      return;
    }

    const channelProfile =
      video.channelProfile ||
      null;

    onNavigate("channel", {
      id: video.v2i_user_id,

      v2i_user_id:
        video.v2i_user_id,

      name:
        channelProfile?.channel_name ||
        "Yuniverse Creator",

      username: undefined,

      v2i_id: undefined,

      avatar_url:
        channelProfile
          ?.channel_avatar_url ||
        undefined,

      bio:
        channelProfile?.channel_bio ||
        "",
    });
  }

  function openVideo(video) {
    onNavigate("watch", video);
  }

  return (
    <div className="app-page">
      {/* HEADER */}

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
            onClick={() =>
              onNavigate("upload")
            }
            aria-label="Upload"
          >
            ＋
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

      {/* MAIN */}

      <main className="page-content">
       

        {/* CATEGORIES */}

        <div className="category-row">
          <button className="category active">
            All
          </button>

          <button className="category">
            Music
          </button>

          <button className="category">
            Gaming
          </button>

          <button className="category">
            News
          </button>

          <button className="category">
            Education
          </button>
        </div>

        {/* VIDEO SECTION */}

        <section className="video-section">
          <div className="section-heading">
            <h2>
              {videos.length > 0
                ? "Recommended"
                : "Videos"}
            </h2>

            <button
              onClick={loadVideos}
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : "Refresh"}
            </button>
          </div>

          {loading && (
            <div className="empty-state">
              <div className="loading-spinner" />

              <p>
                Yuniverse videos load ho
                rahe hain...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <h3>
                Videos load nahi hue
              </h3>

              <p>{error}</p>

              <button
                className="primary-button"
                onClick={loadVideos}
              >
                Try again
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            videos.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  ▶
                </div>

                <h3>
                  Abhi koi video nahi hai
                </h3>

                <p>
                  Yuniverse par pehla
                  video upload karo.
                </p>

                <button
                  className="primary-button"
                  onClick={() =>
                    onNavigate("upload")
                  }
                >
                  Upload video
                </button>
              </div>
            )}

          {!loading &&
            !error &&
            videos.length > 0 && (
              <div className="video-grid">
                {videos.map((video) => {
                  const channelName =
                    getChannelName(video);

                  const channelAvatar =
                    getChannelAvatar(video);

                  return (
                    <article
                      className="video-card"
                      key={video.id}
                    >
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
                      </div>

                      {/* VIDEO INFO */}

                      <div className="video-info">
                        <button
                          className="channel-avatar channel-avatar-button"
                          onClick={() =>
                            openChannel(
                              video
                            )
                          }
                          aria-label="Open channel"
                        >
                          {channelAvatar ? (
  <img
    src={channelAvatar}
    alt={channelName}
    className="channel-profile-avatar"
  />
) : (
  getAvatarLetter(channelName)
)}
                        </button>

                        <div className="video-text">
                          <h3
                            title={
                              video.title
                            }
                            onClick={() =>
                              openVideo(
                                video
                              )
                            }
                          >
                            {video.title}
                          </h3>

                          <button
                            className="video-channel-name"
                            onClick={() =>
                              openChannel(
                                video
                              )
                            }
                          >
                            {channelName}
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
                  );
                })}
              </div>
            )}
        </section>
      </main>

      {/* BOTTOM NAVIGATION */}

      <nav className="bottom-nav">
        <button
          className="nav-item active"
          onClick={() =>
            onNavigate("home")
          }
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          className="nav-item"
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
          className="nav-item"
          onClick={() =>
            onNavigate("subscriptions")
          }
        >
          <span>🔔</span>
          <small>Subscribe</small>
        </button>

        <button
          className="nav-item"
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