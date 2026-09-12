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

export default function Subscriptions({ user, onNavigate }) {
  const [videos, setVideos] = useState([]);
  const [subscribedProfiles, setSubscribedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentUserId =
    user?.id ||
    user?.authUser?.id ||
    user?.profile?.id ||
    null;

  const loadSubscriptions = useCallback(async () => {
    if (!currentUserId) {
      setError("Please log in to view subscriptions.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Get channel IDs that user subscribed to
      const { data: subs, error: subErr } = await yuniverseSupabase
        .from("channel_subscriptions")
        .select("id, channel_v2i_user_id, created_at")
        .eq("subscriber_v2i_user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (subErr) throw subErr;

      const channelIds = [
        ...new Set((subs || []).map((s) => s.channel_v2i_user_id).filter(Boolean)),
      ];

      if (channelIds.length === 0) {
        setSubscribedProfiles([]);
        setVideos([]);
        setLoading(false);
        return;
      }

      // 2. Fetch channel profiles for these IDs
      const { data: profiles, error: pErr } = await yuniverseSupabase
        .from("channel_profiles")
        .select("v2i_user_id, channel_name, channel_avatar_url, channel_bio")
        .in("v2i_user_id", channelIds);

      const profileMap = new Map();
      if (!pErr && profiles) {
        profiles.forEach((p) => profileMap.set(p.v2i_user_id, p));
        setSubscribedProfiles(profiles);
      }

      // 3. Fetch latest videos from subscribed channels
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
          mux_asset_id,
          mux_playback_id,
          status,
          created_at,
          updated_at
        `)
        .in("v2i_user_id", channelIds)
        .eq("status", "ready")
        .not("mux_playback_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);

      if (vErr) throw vErr;

      const formatted = (videoData || []).map((v) => {
        const p = profileMap.get(v.v2i_user_id);
        return {
          ...v,
          channelName: p?.channel_name || "Yuniverse Creator",
          channelAvatar: p?.channel_avatar_url || null,
          views: Number(v.views || 0),
          playbackUrl: v.mux_playback_id
            ? `https://stream.mux.com/${v.mux_playback_id}.m3u8`
            : v.video_url,
          thumbnailUrl:
            v.thumbnail_url ||
            (v.mux_playback_id
              ? `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg`
              : null),
        };
      });

      setVideos(formatted);
    } catch (err) {
      console.error("Subscriptions loading error:", err);
      setError(err?.message || "Failed to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        activePage="subscriptions"
        onNavigate={onNavigate}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="app-body">
        <Sidebar
          activePage="subscriptions"
          onNavigate={onNavigate}
          collapsed={sidebarCollapsed}
        />

        <main className="app-main">
          <div className="page-content">
            {/* SUBSCRIBED CHANNELS BAR */}
            {subscribedProfiles.length > 0 && (
              <div className="subs-channels-strip">
                {subscribedProfiles.map((p) => {
                  const letter = (p.channel_name || "C").charAt(0).toUpperCase();
                  return (
                    <button
                      key={p.v2i_user_id}
                      type="button"
                      className="sub-channel-bubble"
                      onClick={() =>
                        onNavigate("channel", {
                          v2i_user_id: p.v2i_user_id,
                          channel_name: p.channel_name,
                          channel_avatar_url: p.channel_avatar_url,
                        })
                      }
                      title={p.channel_name}
                    >
                      <div className="sub-avatar-ring">
                        {p.channel_avatar_url ? (
                          <img
                            src={p.channel_avatar_url}
                            alt={p.channel_name}
                            className="sub-avatar-img"
                          />
                        ) : (
                          <div className="sub-avatar-fallback">{letter}</div>
                        )}
                      </div>
                      <span className="sub-channel-label">
                        {p.channel_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* HEADER */}
            <div className="section-heading">
              <h2>Latest from Subscribed Creators</h2>
              <button
                type="button"
                onClick={loadSubscriptions}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {/* LOADING SKELETON */}
            {loading && (
              <div className="video-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <VideoCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* ERROR */}
            {!loading && error && (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3>Unable to load subscriptions</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={loadSubscriptions}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* NO SUBSCRIPTIONS */}
            {!loading && !error && subscribedProfiles.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔔</div>
                <h3>Don't miss new videos</h3>
                <p>
                  Subscribe to your favorite creators to see their latest uploads
                  here!
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onNavigate("home")}
                >
                  Explore Yuniverse Feed
                </button>
              </div>
            )}

            {/* VIDEOS GRID */}
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

            {/* SUBSCRIBED BUT NO READY VIDEOS */}
            {!loading &&
              !error &&
              subscribedProfiles.length > 0 &&
              videos.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🎬</div>
                  <h3>No uploads yet</h3>
                  <p>
                    The channels you subscribed to haven't uploaded new videos
                    recently.
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onNavigate("home")}
                  >
                    Browse Feed
                  </button>
                </div>
              )}
          </div>
        </main>
      </div>

      <BottomNav activePage="subscriptions" onNavigate={onNavigate} />
    </div>
  );
}
