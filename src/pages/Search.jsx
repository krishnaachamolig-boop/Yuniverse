import React, { useEffect, useMemo, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";

const RECENT_SEARCHES_KEY = "yuniverse_recent_searches";

const CATEGORIES = [
  "All",
  "Music",
  "Gaming",
  "Entertainment",
  "Education",
  "News",
  "Sports",
  "Technology",
];

export default function Search({ user, onNavigate }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);

  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("relevant");

  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  // =========================================================
  // RECENT SEARCHES
  // =========================================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);

      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setRecentSearches(parsed);
      }
    } catch (err) {
      console.error("Recent searches load error:", err);
    }
  }, []);

  function saveRecentSearch(value) {
    const clean = value.trim();

    if (!clean) return;

    setRecentSearches((previous) => {
      const filtered = previous.filter(
        (item) => item.toLowerCase() !== clean.toLowerCase()
      );

      const updated = [clean, ...filtered].slice(0, 10);

      localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(updated)
      );

      return updated;
    });
  }

  function removeRecentSearch(value) {
    setRecentSearches((previous) => {
      const updated = previous.filter((item) => item !== value);

      localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(updated)
      );

      return updated;
    });
  }

  function clearRecentSearches() {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  }

  // =========================================================
  // VIDEO FORMATTER
  // =========================================================

  function formatVideos(data) {
    return (data || [])
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
  }

  // =========================================================
  // LOAD CHANNEL PROFILES FOR VIDEOS
  // =========================================================

  async function attachChannelProfiles(videoData) {
    const ownerIds = [
      ...new Set(
        (videoData || [])
          .map((video) => video.v2i_user_id)
          .filter(Boolean)
      ),
    ];

    if (ownerIds.length === 0) {
      return videoData || [];
    }

    try {
      const { data: profiles, error: profileError } =
        await yuniverseSupabase
          .from("channel_profiles")
          .select(
            `
              v2i_user_id,
              channel_name,
              channel_avatar_url,
              channel_bio
            `
          )
          .in("v2i_user_id", ownerIds);

      if (profileError) {
        console.error(
          "Channel profiles fetch error:",
          profileError
        );

        return videoData || [];
      }

      const profileMap = new Map(
        (profiles || []).map((profile) => [
          profile.v2i_user_id,
          profile,
        ])
      );

      return (videoData || []).map((video) => ({
        ...video,
        channelProfile:
          profileMap.get(video.v2i_user_id) || null,
      }));
    } catch (err) {
      console.error("Attach channel profiles error:", err);

      return videoData || [];
    }
  }

  // =========================================================
  // LOAD LATEST VIDEOS
  // =========================================================

  async function loadLatestVideos() {
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
          })
          .limit(100);

      if (fetchError) {
        throw fetchError;
      }

      const formatted = formatVideos(data || []);
      const withChannels = await attachChannelProfiles(formatted);

      setVideos(withChannels);
    } catch (err) {
      console.error("Latest videos error:", err);

      setError(
        err?.message || "Videos load nahi ho paaye."
      );

      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // SEARCH VIDEOS
  // =========================================================

  async function searchVideos(searchTerm) {
    const cleanQuery = searchTerm.trim();

    if (!cleanQuery) {
      await loadLatestVideos();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const escaped = cleanQuery
        .replace(/,/g, " ")
        .replace(/'/g, "''");

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
          .or(
            `title.ilike.%${escaped}%,description.ilike.%${escaped}%`
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(100);

      if (fetchError) {
        throw fetchError;
      }

      const formatted = formatVideos(data || []);
      const withChannels = await attachChannelProfiles(
        formatted
      );

      setVideos(withChannels);
    } catch (err) {
      console.error("Video search error:", err);

      setError(err?.message || "Search failed.");

      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // CHANNEL SEARCH
  //
  // IMPORTANT:
  // Yuniverse channel identity comes ONLY from
  // channel_profiles.
  //
  // V2i is not used for name/DP/username.
  // =========================================================

  async function searchChannels(searchTerm) {
    const cleanQuery = searchTerm.trim();

    setChannelLoading(true);

    try {
      // -------------------------------------------------------
      // STEP 1
      // Find creators who actually have Yuniverse videos.
      // -------------------------------------------------------

      const { data: videoOwners, error: ownersError } =
        await yuniverseSupabase
          .from("videos")
          .select("v2i_user_id")
          .eq("status", "ready")
          .not("v2i_user_id", "is", null);

      if (ownersError) {
        throw ownersError;
      }

      const validOwnerIds = [
        ...new Set(
          (videoOwners || [])
            .map((video) => video.v2i_user_id)
            .filter(Boolean)
        ),
      ];

      if (validOwnerIds.length === 0) {
        setChannels([]);
        return;
      }

      // -------------------------------------------------------
      // STEP 2
      // Get Yuniverse channel profiles.
      // -------------------------------------------------------

      let profileQuery = yuniverseSupabase
        .from("channel_profiles")
        .select(
          `
            id,
            v2i_user_id,
            channel_name,
            channel_avatar_url,
            channel_bio,
            created_at
          `
        )
        .in("v2i_user_id", validOwnerIds);

      if (cleanQuery) {
        const escaped = cleanQuery
          .replace(/'/g, "''")
          .replace(/,/g, " ");

        profileQuery = profileQuery.or(
          `channel_name.ilike.%${escaped}%,channel_bio.ilike.%${escaped}%`
        );
      }

      const {
        data: profiles,
        error: profilesError,
      } = await profileQuery
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (profilesError) {
        throw profilesError;
      }

      // -------------------------------------------------------
      // STEP 3
      // Video counts.
      // -------------------------------------------------------

      const {
        data: creatorVideos,
        error: creatorVideosError,
      } = await yuniverseSupabase
        .from("videos")
        .select("v2i_user_id")
        .eq("status", "ready")
        .not("v2i_user_id", "is", null)
        .in("v2i_user_id", validOwnerIds);

      if (creatorVideosError) {
        throw creatorVideosError;
      }

      const videoCountMap = {};

      (creatorVideos || []).forEach((video) => {
        const ownerId = video.v2i_user_id;

        videoCountMap[ownerId] =
          (videoCountMap[ownerId] || 0) + 1;
      });

      // -------------------------------------------------------
      // STEP 4
      // Format Yuniverse channels.
      // -------------------------------------------------------

      const formattedChannels = (profiles || [])
        .map((profile) => ({
          ...profile,

          yuniverseVideoCount:
            videoCountMap[profile.v2i_user_id] || 0,
        }))
        .filter(
          (profile) => profile.yuniverseVideoCount > 0
        );

      setChannels(formattedChannels);
    } catch (err) {
      console.error("Channel search error:", err);

      setChannels([]);
    } finally {
      setChannelLoading(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadLatestVideos();
    searchChannels("");
  }, []);

  // =========================================================
  // SEARCH SUBMIT
  // =========================================================

  function handleSubmit(event) {
    event.preventDefault();

    const cleanQuery = query.trim();

    if (!cleanQuery) {
      setSubmittedQuery("");
      setShowRecent(false);

      loadLatestVideos();
      searchChannels("");

      return;
    }

    setSubmittedQuery(cleanQuery);
    setShowRecent(false);

    saveRecentSearch(cleanQuery);

    searchVideos(cleanQuery);
    searchChannels(cleanQuery);
  }

  // =========================================================
  // RECENT SEARCH CLICK
  // =========================================================

  function handleRecentSearch(value) {
    setQuery(value);
    setSubmittedQuery(value);
    setShowRecent(false);

    searchVideos(value);
    searchChannels(value);
  }

  // =========================================================
  // CLEAR SEARCH
  // =========================================================

  function clearSearch() {
    setQuery("");
    setSubmittedQuery("");
    setShowRecent(false);

    setActiveCategory("All");
    setSortBy("relevant");

    loadLatestVideos();
    searchChannels("");
  }

  // =========================================================
  // HELPERS
  // =========================================================

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

    return `${views}`;
  }

  function formatTime(dateString) {
    if (!dateString) return "";

    const createdAt = new Date(dateString);
    const now = new Date();

    const difference = Math.floor(
      (now.getTime() - createdAt.getTime()) / 1000
    );

    if (difference < 60) {
      return "just now";
    }

    const minutes = Math.floor(difference / 60);

    if (minutes < 60) {
      return `${minutes} ${
        minutes === 1 ? "minute" : "minutes"
      } ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} ${
        hours === 1 ? "hour" : "hours"
      } ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 30) {
      return `${days} ${
        days === 1 ? "day" : "days"
      } ago`;
    }

    const months = Math.floor(days / 30);

    if (months < 12) {
      return `${months} ${
        months === 1 ? "month" : "months"
      } ago`;
    }

    const years = Math.floor(months / 12);

    return `${years} ${
      years === 1 ? "year" : "years"
    } ago`;
  }

  function getChannelName(video) {
    return (
      video?.channelProfile?.channel_name ||
      "Yuniverse Creator"
    );
  }

  function getChannelAvatar(video) {
    return (
      video?.channelProfile?.channel_avatar_url ||
      null
    );
  }

  function getAvatarLetter(name) {
    return (
      name?.trim()?.charAt(0)?.toUpperCase() || "Y"
    );
  }

  function openVideo(video) {
    onNavigate("watch", video);
  }

  function openChannel(video) {
    if (!video?.v2i_user_id) {
      return;
    }

    const channelProfile =
      video.channelProfile || null;

    onNavigate("channel", {
      id: video.v2i_user_id,
      v2i_user_id: video.v2i_user_id,

      name:
        channelProfile?.channel_name ||
        "Yuniverse Creator",

      username: undefined,

      v2i_id: undefined,

      avatar_url:
        channelProfile?.channel_avatar_url ||
        undefined,

      bio:
        channelProfile?.channel_bio || "",
    });
  }

  function openSearchedChannel(channel) {
    if (!channel?.v2i_user_id) {
      return;
    }

    onNavigate("channel", {
      id: channel.v2i_user_id,
      v2i_user_id: channel.v2i_user_id,

      name:
        channel.channel_name ||
        "Yuniverse Creator",

      username: undefined,

      v2i_id: undefined,

      avatar_url:
        channel.channel_avatar_url ||
        undefined,

      bio:
        channel.channel_bio || "",

      yuniverseVideoCount:
        channel.yuniverseVideoCount || 0,
    });
  }

  // =========================================================
  // FILTER + SORT
  // =========================================================

  const filteredVideos = useMemo(() => {
    let result = [...videos];

    if (activeCategory !== "All") {
      const category =
        activeCategory.toLowerCase();

      result = result.filter((video) => {
        const text =
          `${video.title || ""} ${
            video.description || ""
          }`.toLowerCase();

        return text.includes(category);
      });
    }

    if (sortBy === "latest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
    }

    if (sortBy === "views") {
      result.sort(
        (a, b) =>
          Number(b.views || 0) -
          Number(a.views || 0)
      );
    }

    return result;
  }, [videos, activeCategory, sortBy]);

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="app-page">
      <header className="top-header">
        <button
          className="logo-button"
          onClick={() => onNavigate("home")}
        >
          <span>Y</span>universe
        </button>

        <div className="header-actions">
          <button
            onClick={() => onNavigate("upload")}
            aria-label="Upload"
          >
            ＋
          </button>

          <button
            onClick={() => onNavigate("profile")}
            aria-label="Profile"
          >
            👤
          </button>
        </div>
      </header>

      <main className="page-content">
        <section className="search-page-header">
          <p className="eyebrow">Explore</p>

          <h1>Search Yuniverse</h1>

          <p>
            Videos, creators and everything
            happening in your universe.
          </p>
        </section>

        <section className="search-box-section">
          <form
            className="search-form"
            onSubmit={handleSubmit}
          >
            <div className="search-input-wrapper">
              <span className="search-icon">⌕</span>

              <input
                type="search"
                value={query}
                placeholder="Search videos or creators..."
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowRecent(true);
                }}
                onFocus={() => {
                  if (recentSearches.length > 0) {
                    setShowRecent(true);
                  }
                }}
              />

              {query && (
                <button
                  type="button"
                  className="search-clear-button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <button
              type="submit"
              className="primary-button search-submit"
            >
              Search
            </button>
          </form>

          {showRecent &&
            recentSearches.length > 0 && (
              <div className="recent-searches">
                <div className="recent-header">
                  <strong>
                    Recent searches
                  </strong>

                  <button
                    type="button"
                    onClick={clearRecentSearches}
                  >
                    Clear all
                  </button>
                </div>

                <div className="recent-list">
                  {recentSearches.map((item) => (
                    <div
                      className="recent-search-item"
                      key={item}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleRecentSearch(item)
                        }
                      >
                        <span>🕘</span>
                        <span>{item}</span>
                      </button>

                      <button
                        type="button"
                        className="recent-remove"
                        onClick={() =>
                          removeRecentSearch(item)
                        }
                        aria-label={`Remove ${item}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </section>

        {!submittedQuery && (
          <section className="search-discover-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  Discover
                </p>

                <h2>
                  Latest on Yuniverse
                </h2>
              </div>

              <button
                onClick={loadLatestVideos}
                disabled={loading}
              >
                {loading
                  ? "Loading..."
                  : "Refresh"}
              </button>
            </div>
          </section>
        )}

        {submittedQuery && (
          <section className="search-results-header">
            <p className="eyebrow">
              Search results
            </p>

            <h2>
              Results for{" "}
              <span>
                "{submittedQuery}"
              </span>
            </h2>
          </section>
        )}

        <div className="search-tabs">
          <button
            className={
              activeTab === "all"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("all")
            }
          >
            All
          </button>

          <button
            className={
              activeTab === "videos"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("videos")
            }
          >
            🎬 Videos
          </button>

          <button
            className={
              activeTab === "channels"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("channels")
            }
          >
            👤 Channels
          </button>
        </div>

        {(activeTab === "all" ||
          activeTab === "videos") && (
          <>
            <section className="category-row search-categories">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  className={
                    activeCategory === category
                      ? "category active"
                      : "category"
                  }
                  onClick={() =>
                    setActiveCategory(category)
                  }
                >
                  {category}
                </button>
              ))}
            </section>

            <div className="search-sort-row">
              <span>
                {filteredVideos.length}{" "}
                {filteredVideos.length === 1
                  ? "video"
                  : "videos"}
              </span>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value
                  )
                }
                aria-label="Sort videos"
              >
                <option value="relevant">
                  Relevant
                </option>

                <option value="latest">
                  Latest
                </option>

                <option value="views">
                  Most viewed
                </option>
              </select>
            </div>

            {loading && (
              <div className="empty-state">
                <div className="loading-spinner" />
                <p>
                  Yuniverse videos search ho
                  rahe hain...
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="empty-state">
                <h3>Search failed</h3>

                <p>{error}</p>

                <button
                  className="primary-button"
                  onClick={() =>
                    submittedQuery
                      ? searchVideos(
                          submittedQuery
                        )
                      : loadLatestVideos()
                  }
                >
                  Try again
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              filteredVideos.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    🔎
                  </div>

                  <h3>
                    No videos found
                  </h3>

                  <p>
                    {submittedQuery
                      ? `“${submittedQuery}” ke liye koi video nahi mila.`
                      : "Abhi Yuniverse par koi video available nahi hai."}
                  </p>

                  {submittedQuery && (
                    <button
                      className="primary-button"
                      onClick={clearSearch}
                    >
                      Browse latest videos
                    </button>
                  )}
                </div>
              )}

            {!loading &&
              !error &&
              filteredVideos.length > 0 && (
                <div className="video-grid search-video-grid">
                  {filteredVideos.map(
                    (video) => {
                      const channelName =
                        getChannelName(video);

                      const avatar =
                        getChannelAvatar(
                          video
                        );

                      return (
                        <article
                          className="video-card"
                          key={video.id}
                        >
                          <div
                            className="video-thumbnail"
                            onClick={() =>
                              openVideo(
                                video
                              )
                            }
                          >
                            {video.thumbnailUrl ? (
                              <img
                                src={
                                  video.thumbnailUrl
                                }
                                alt={
                                  video.title
                                }
                                loading="lazy"
                              />
                            ) : (
                              <div className="thumbnail-placeholder">
                                <span>
                                  ▶
                                </span>
                              </div>
                            )}

                            <div className="thumbnail-play">
                              ▶
                            </div>
                          </div>

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
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={
                                    channelName
                                  }
                                />
                              ) : (
                                getAvatarLetter(
                                  channelName
                                )
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
                                )}{" "}
                                views{" • "}
                                {formatTime(
                                  video.created_at
                                )}
                              </small>
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
          </>
        )}

        {(activeTab === "all" ||
          activeTab === "channels") && (
          <section className="channel-search-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  Creators
                </p>

                <h2>
                  {submittedQuery
                    ? "Matching channels"
                    : "Yuniverse Creators"}
                </h2>
              </div>
            </div>

            {channelLoading && (
              <div className="empty-state">
                <div className="loading-spinner" />

                <p>
                  Creators search ho rahe hain...
                </p>
              </div>
            )}

            {!channelLoading &&
              submittedQuery &&
              channels.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    👤
                  </div>

                  <h3>
                    No channels found
                  </h3>

                  <p>
                    Is search ke matching
                    Yuniverse creator nahi
                    mila.
                  </p>
                </div>
              )}

            {!channelLoading &&
              !submittedQuery &&
              channels.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    👤
                  </div>

                  <h3>
                    No creators yet
                  </h3>

                  <p>
                    Jis V2i ID se Yuniverse par
                    video upload hoga, wahi
                    creator yahan appear hoga.
                  </p>
                </div>
              )}

            {!channelLoading &&
              channels.length > 0 && (
                <div className="channel-search-grid">
                  {channels.map((channel) => {
                    const channelName =
                      channel.channel_name ||
                      "Yuniverse Creator";

                    return (
                      <article
                        className="channel-search-card"
                        key={channel.v2i_user_id}
                        onClick={() =>
                          openSearchedChannel(
                            channel
                          )
                        }
                      >
                        <div className="channel-search-avatar">
                          {channel.channel_avatar_url ? (
                            <img
                              src={
                                channel.channel_avatar_url
                              }
                              alt={
                                channelName
                              }
                              loading="lazy"
                            />
                          ) : (
                            <span>
                              {getAvatarLetter(
                                channelName
                              )}
                            </span>
                          )}
                        </div>

                        <div className="channel-search-info">
                          <h3>
                            {channelName}
                          </h3>

                          {channel.channel_bio && (
                            <p className="channel-search-bio">
                              {
                                channel.channel_bio
                              }
                            </p>
                          )}

                          <p>
                            {
                              channel.yuniverseVideoCount
                            }{" "}
                            {channel.yuniverseVideoCount ===
                            1
                              ? "video"
                              : "videos"}
                          </p>
                        </div>

                        <button
                          className="channel-open-button"
                          onClick={(event) => {
                            event.stopPropagation();

                            openSearchedChannel(
                              channel
                            );
                          }}
                        >
                          View channel
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className="nav-item"
          onClick={() =>
            onNavigate("home")
          }
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button className="nav-item active">
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