import React, { useEffect, useMemo, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import VideoCard, { VideoCardSkeleton } from "../components/VideoCard";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 10);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function removeRecentSearch(value) {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== value);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function clearRecentSearches() {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  }

  function formatVideos(data) {
    return (data || [])
      .filter((video) => {
        const width = Number(video.width || 0);
        const height = Number(video.height || 0);
        if (!width || !height) return true;
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
  }

  async function attachChannelProfiles(videoList) {
    if (!videoList.length) return [];
    const ownerIds = [...new Set(videoList.map((v) => v.v2i_user_id).filter(Boolean))];
    if (!ownerIds.length) return videoList;

    try {
      const { data: profiles, error: pErr } = await yuniverseSupabase
        .from("channel_profiles")
        .select("v2i_user_id, channel_name, channel_avatar_url, channel_bio")
        .in("v2i_user_id", ownerIds);

      if (pErr) throw pErr;

      const profileMap = new Map();
      (profiles || []).forEach((p) => profileMap.set(p.v2i_user_id, p));

      return videoList.map((v) => ({
        ...v,
        channelProfile: profileMap.get(v.v2i_user_id) || null,
        channelName: profileMap.get(v.v2i_user_id)?.channel_name || "Yuniverse Creator",
        channelAvatar: profileMap.get(v.v2i_user_id)?.channel_avatar_url || null,
      }));
    } catch {
      return videoList;
    }
  }

  async function loadLatestVideos() {
    setLoading(true);
    setError("");
    try {
      const { data, error: fErr } = await yuniverseSupabase
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
          updated_at,
          mux_asset_id,
          mux_playback_id,
          status
        `)
        .eq("status", "ready")
        .not("mux_playback_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);

      if (fErr) throw fErr;
      const formatted = formatVideos(data || []);
      const withChannels = await attachChannelProfiles(formatted);
      setVideos(withChannels);
    } catch (err) {
      console.error("Latest videos load error:", err);
      setError(err?.message || "Failed to load discover videos.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  async function searchVideos(searchTerm) {
    const cleanQuery = searchTerm.trim();
    if (!cleanQuery) {
      await loadLatestVideos();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const escaped = cleanQuery.replace(/,/g, " ").replace(/'/g, "''");
      const { data, error: fErr } = await yuniverseSupabase
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
          updated_at,
          mux_asset_id,
          mux_playback_id,
          status
        `)
        .eq("status", "ready")
        .not("mux_playback_id", "is", null)
        .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fErr) throw fErr;
      const formatted = formatVideos(data || []);
      const withChannels = await attachChannelProfiles(formatted);
      setVideos(withChannels);
    } catch (err) {
      console.error("Video search error:", err);
      setError(err?.message || "Search failed.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  async function searchChannels(searchTerm) {
    const cleanQuery = searchTerm.trim();
    setChannelLoading(true);

    try {
      const { data: videoOwners, error: oErr } = await yuniverseSupabase
        .from("videos")
        .select("v2i_user_id")
        .eq("status", "ready")
        .not("v2i_user_id", "is", null);

      if (oErr) throw oErr;
      const validOwnerIds = [...new Set((videoOwners || []).map((v) => v.v2i_user_id).filter(Boolean))];
      if (!validOwnerIds.length) {
        setChannels([]);
        return;
      }

      let profileQuery = yuniverseSupabase
        .from("channel_profiles")
        .select("id, v2i_user_id, channel_name, channel_avatar_url, channel_bio, created_at")
        .in("v2i_user_id", validOwnerIds);

      if (cleanQuery) {
        const escaped = cleanQuery.replace(/'/g, "''").replace(/,/g, " ");
        profileQuery = profileQuery.or(`channel_name.ilike.%${escaped}%,channel_bio.ilike.%${escaped}%`);
      }

      const { data: profiles, error: pErr } = await profileQuery
        .order("created_at", { ascending: false })
        .limit(30);

      if (pErr) throw pErr;

      setChannels(profiles || []);
    } catch (err) {
      console.error("Channel search error:", err);
      setChannels([]);
    } finally {
      setChannelLoading(false);
    }
  }

  useEffect(() => {
    loadLatestVideos();
    searchChannels("");
  }, []);

  function handleSearchSubmit(e) {
    e?.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setSubmittedQuery(clean);
    saveRecentSearch(clean);
    setShowRecent(false);
    searchVideos(clean);
    searchChannels(clean);
  }

  function handleRecentClick(term) {
    setQuery(term);
    setSubmittedQuery(term);
    setShowRecent(false);
    searchVideos(term);
    searchChannels(term);
  }

  function clearSearch() {
    setQuery("");
    setSubmittedQuery("");
    loadLatestVideos();
    searchChannels("");
  }

  const filteredVideos = useMemo(() => {
    let result = [...videos];

    if (activeCategory !== "All") {
      const cat = activeCategory.toLowerCase();
      result = result.filter((v) => {
        const text = `${v.title || ""} ${v.description || ""}`.toLowerCase();
        return text.includes(cat);
      });
    }

    if (sortBy === "latest") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "views") {
      result.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
    }

    return result;
  }, [videos, activeCategory, sortBy]);

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        activePage="search"
        onNavigate={onNavigate}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="app-body">
        <Sidebar
          activePage="search"
          onNavigate={onNavigate}
          collapsed={sidebarCollapsed}
        />

        <main className="app-main">
          <div className="page-content">
            {/* SEARCH INPUT BAR */}
            <div className="search-page-bar">
              <form className="search-page-form" onSubmit={handleSearchSubmit}>
                <div className="search-input-wrap">
                  <span className="search-icon-symbol">🔍</span>
                  <input
                    type="text"
                    className="search-main-input"
                    placeholder="Search videos, creators, topics..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setShowRecent(true);
                    }}
                    onFocus={() => setShowRecent(true)}
                  />
                  {query && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={clearSearch}
                    >
                      ×
                    </button>
                  )}
                </div>
                <button type="submit" className="primary-button compact">
                  Search
                </button>
              </form>

              {/* RECENT SEARCHES DROPDOWN */}
              {showRecent && recentSearches.length > 0 && (
                <div className="recent-searches-box">
                  <div className="recent-header">
                    <span>Recent Searches</span>
                    <button type="button" onClick={clearRecentSearches}>
                      Clear All
                    </button>
                  </div>
                  <div className="recent-chips">
                    {recentSearches.map((term) => (
                      <div key={term} className="recent-chip">
                        <button
                          type="button"
                          className="recent-chip-label"
                          onClick={() => handleRecentClick(term)}
                        >
                          🕒 {term}
                        </button>
                        <button
                          type="button"
                          className="recent-chip-del"
                          onClick={() => removeRecentSearch(term)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SEARCH CATEGORIES */}
            <div className="category-row">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category ${activeCategory === cat ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* TABS (ALL, VIDEOS, CHANNELS) + SORT */}
            <div className="search-controls-row">
              <div className="search-tab-group">
                <button
                  type="button"
                  className={`search-tab-btn ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`search-tab-btn ${activeTab === "videos" ? "active" : ""}`}
                  onClick={() => setActiveTab("videos")}
                >
                  Videos ({filteredVideos.length})
                </button>
                <button
                  type="button"
                  className={`search-tab-btn ${activeTab === "channels" ? "active" : ""}`}
                  onClick={() => setActiveTab("channels")}
                >
                  Channels ({channels.length})
                </button>
              </div>

              <div className="search-sort-group">
                <label>Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="search-sort-select"
                >
                  <option value="relevant">Relevance</option>
                  <option value="latest">Latest</option>
                  <option value="views">Most Viewed</option>
                </select>
              </div>
            </div>

            {/* RESULTS TITLE */}
            <div className="section-heading">
              <h2>
                {submittedQuery
                  ? `Results for "${submittedQuery}"`
                  : "Discover Videos"}
              </h2>
            </div>

            {/* CHANNELS SECTION (if tab is all or channels) */}
            {(activeTab === "all" || activeTab === "channels") &&
              channels.length > 0 && (
                <div className="search-channels-section">
                  <h3 className="section-subtitle">Creators</h3>
                  <div className="search-channels-list">
                    {channels.map((ch) => {
                      const name = ch.channel_name || "Yuniverse Creator";
                      const letter = name.charAt(0).toUpperCase();
                      return (
                        <div
                          key={ch.v2i_user_id}
                          className="channel-result-card"
                          onClick={() =>
                            onNavigate("channel", {
                              v2i_user_id: ch.v2i_user_id,
                              channel_name: name,
                              channel_avatar_url: ch.channel_avatar_url,
                            })
                          }
                        >
                          <div className="channel-result-avatar">
                            {ch.channel_avatar_url ? (
                              <img src={ch.channel_avatar_url} alt={name} />
                            ) : (
                              <span>{letter}</span>
                            )}
                          </div>
                          <div className="channel-result-info">
                            <h4>{name}</h4>
                            {ch.channel_bio && <p>{ch.channel_bio}</p>}
                          </div>
                          <button
                            type="button"
                            className="primary-button compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate("channel", {
                                v2i_user_id: ch.v2i_user_id,
                                channel_name: name,
                                channel_avatar_url: ch.channel_avatar_url,
                              });
                            }}
                          >
                            View Channel
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* VIDEOS SECTION */}
            {(activeTab === "all" || activeTab === "videos") && (
              <>
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
                    <h3>Search error</h3>
                    <p>{error}</p>
                  </div>
                )}

                {!loading && !error && filteredVideos.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>No videos found</h3>
                    <p>
                      {submittedQuery
                        ? `No results matched "${submittedQuery}". Try another keyword!`
                        : "No videos found in this category."}
                    </p>
                  </div>
                )}

                {!loading && !error && filteredVideos.length > 0 && (
                  <div className="video-grid">
                    {filteredVideos.map((video) => (
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
              </>
            )}
          </div>
        </main>
      </div>

      <BottomNav activePage="search" onNavigate={onNavigate} />
    </div>
  );
}
