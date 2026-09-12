import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Hls from "hls.js";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";
import VideoCard, { formatDuration, formatViews, formatRelativeTime } from "../components/VideoCard";

export default function Watch({
  user,
  video,
  onNavigate,
}) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

  const [channelProfile, setChannelProfile] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const [watchSeconds, setWatchSeconds] = useState(0);
  const [viewCounted, setViewCounted] = useState(false);

  const [videoError, setVideoError] = useState("");
  const [videoLoading, setVideoLoading] = useState(true);

  const playerRef = useRef(null);
  const hlsRef = useRef(null);

  const sessionIdRef = useRef(
    `watch_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`
  );

  const sessionStartedRef = useRef(false);

  const currentUserId = getCurrentUserId();

  function getCurrentUserId() {
    try {
      const savedUser = localStorage.getItem("yuniverse_user");
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      return (
        parsed?.authUser?.id ||
        parsed?.id ||
        parsed?.profile?.id ||
        null
      );
    } catch {
      return null;
    }
  }

  // =========================================================
  // VIDEO URL
  // =========================================================

  const playbackUrl =
    video?.playbackUrl ||
    video?.video_url ||
    (video?.mux_playback_id
      ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
      : "");

  const thumbnailUrl =
    video?.thumbnailUrl ||
    video?.thumbnail_url ||
    (video?.mux_playback_id
      ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
      : "");

  const [retryTrigger, setRetryTrigger] = useState(0);

  function handleRetryPlayback() {
    setVideoError("");
    setVideoLoading(true);
    setRetryTrigger((prev) => prev + 1);
  }

  // =========================================================
  // LOAD EVERYTHING ON VIDEO CHANGE
  // =========================================================

  useEffect(() => {
    if (!video?.id) return;

    window.scrollTo({ top: 0, behavior: "smooth" });
    setDisliked(false);
    loadVideoData();
    loadRelatedVideos();
    startWatchSession();

    return () => {
      updateWatchSession(true);
    };
  }, [video?.id]);

  // =========================================================
  // VIDEO PLAYER SETUP (HLS + HTML5 NATIVE)
  // =========================================================

  useEffect(() => {
    const videoElement = playerRef.current;
    if (!videoElement || !playbackUrl) return;

    setVideoLoading(true);
    setVideoError("");

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn("HLS destroy error:", e);
      }
      hlsRef.current = null;
    }

    const isHlsUrl = playbackUrl.includes(".m3u8");

    if (isHlsUrl) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: false,
          backBufferLength: 90,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 4,
          levelLoadingTimeOut: 15000,
          levelLoadingMaxRetry: 4,
        });

        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          setVideoError("");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn("HLS playback event error:", data);
          if (!data?.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            try {
              hls.startLoad();
              return;
            } catch (error) {
              console.error(error);
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try {
              hls.recoverMediaError();
              return;
            } catch (error) {
              console.error(error);
            }
          }

          setVideoLoading(false);
          setVideoError("Video stream could not be loaded.");
          try {
            hls.destroy();
          } catch (_) {}
          hlsRef.current = null;
        });

        return () => {
          if (hlsRef.current) {
            try {
              hlsRef.current.destroy();
            } catch (_) {}
            hlsRef.current = null;
          }
        };
      }

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = playbackUrl;
        videoElement.load();

        return () => {
          if (videoElement) {
            videoElement.removeAttribute("src");
            videoElement.load();
          }
        };
      }

      setVideoLoading(false);
      setVideoError("This browser does not support HLS video playback.");
      return;
    }

    videoElement.src = playbackUrl;
    videoElement.load();

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.removeAttribute("src");
        videoElement.load();
      }
    };
  }, [playbackUrl, retryTrigger]);

  function handleVideoLoaded() {
    setVideoLoading(false);
    setVideoError("");
  }

  function handleVideoError(event) {
    console.error("Video playback error:", event?.currentTarget?.error);
    setVideoLoading(false);
    setVideoError("Video could not be loaded or played.");
  }

  // =========================================================
  // LOAD VIDEO DATA
  // =========================================================

  async function loadVideoData() {
    await Promise.all([
      loadChannelProfile(),
      loadLikeStatus(),
      loadSaveStatus(),
      loadComments(),
      loadSubscribeStatus(),
    ]);
  }

  async function loadChannelProfile() {
    if (!video?.v2i_user_id) return;

    try {
      const { data, error } = await yuniverseSupabase
        .from("channel_profiles")
        .select("v2i_user_id, channel_name, channel_avatar_url, channel_bio")
        .eq("v2i_user_id", video.v2i_user_id)
        .maybeSingle();

      if (error) throw error;
      setChannelProfile(data || null);
    } catch (error) {
      console.error("Channel profile error:", error);
      setChannelProfile(null);
    }
  }

  async function loadRelatedVideos() {
    if (!video?.id) return;
    setLoadingRelated(true);
    try {
      const { data, error } = await yuniverseSupabase
        .from("videos")
        .select(`
          id,
          v2i_user_id,
          title,
          description,
          video_url,
          thumbnail_url,
          duration,
          views,
          created_at,
          mux_playback_id,
          status
        `)
        .eq("status", "ready")
        .neq("id", video.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const userIds = [...new Set((data || []).map((v) => v.v2i_user_id).filter(Boolean))];
      let pMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await yuniverseSupabase
          .from("channel_profiles")
          .select("v2i_user_id, channel_name, channel_avatar_url")
          .in("v2i_user_id", userIds);

        (profiles || []).forEach((p) => {
          pMap[p.v2i_user_id] = p;
        });
      }

      const formatted = (data || []).map((v) => ({
        ...v,
        channelName: pMap[v.v2i_user_id]?.channel_name || "Yuniverse Creator",
        channelAvatar: pMap[v.v2i_user_id]?.channel_avatar_url || null,
        playbackUrl: v.mux_playback_id
          ? `https://stream.mux.com/${v.mux_playback_id}.m3u8`
          : v.video_url,
        thumbnailUrl:
          v.thumbnail_url ||
          (v.mux_playback_id
            ? `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg`
            : null),
      }));

      setRelatedVideos(formatted);
    } catch (err) {
      console.warn("Related videos fetch error:", err);
    } finally {
      setLoadingRelated(false);
    }
  }

  function getChannelName() {
    return (
      channelProfile?.channel_name ||
      video?.channelProfile?.channel_name ||
      "Yuniverse Creator"
    );
  }

  function getChannelAvatar() {
    return (
      channelProfile?.channel_avatar_url ||
      video?.channelProfile?.channel_avatar_url ||
      null
    );
  }

  // =========================================================
  // LIKES & DISLIKES
  // =========================================================

  async function loadLikeStatus() {
    if (!video?.id) return;
    try {
      const { count, error } = await yuniverseSupabase
        .from("video_likes")
        .select("id", { count: "exact", head: true })
        .eq("video_id", video.id);

      if (!error) {
        setLikeCount(count || 0);
      }

      if (!currentUserId) return;

      const { data } = await yuniverseSupabase
        .from("video_likes")
        .select("id")
        .eq("video_id", video.id)
        .eq("v2i_user_id", currentUserId)
        .maybeSingle();

      setLiked(!!data);
    } catch (error) {
      console.error("Like status error:", error);
    }
  }

  async function toggleLike() {
    if (!currentUserId || !video?.id) return;

    try {
      if (liked) {
        const { error } = await yuniverseSupabase
          .from("video_likes")
          .delete()
          .eq("video_id", video.id)
          .eq("v2i_user_id", currentUserId);

        if (error) throw error;
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await yuniverseSupabase
          .from("video_likes")
          .insert({
            video_id: video.id,
            v2i_user_id: currentUserId,
          });

        if (error) throw error;
        setLiked(true);
        setDisliked(false);
        setLikeCount((c) => c + 1);
      }
    } catch (error) {
      console.error("Like error:", error);
    }
  }

  function toggleDislike() {
    if (disliked) {
      setDisliked(false);
    } else {
      setDisliked(true);
      if (liked) {
        toggleLike();
      }
    }
  }

  // =========================================================
  // SAVE TO LIBRARY
  // =========================================================

  async function loadSaveStatus() {
    if (!currentUserId || !video?.id) return;

    try {
      const { data } = await yuniverseSupabase
        .from("saved_videos")
        .select("id")
        .eq("video_id", video.id)
        .eq("v2i_user_id", currentUserId)
        .maybeSingle();

      setSaved(!!data);
    } catch (error) {
      console.error("Save status error:", error);
    }
  }

  async function toggleSave() {
    if (!currentUserId || !video?.id) return;

    try {
      if (saved) {
        const { error } = await yuniverseSupabase
          .from("saved_videos")
          .delete()
          .eq("video_id", video.id)
          .eq("v2i_user_id", currentUserId);

        if (error) throw error;
        setSaved(false);
      } else {
        const { error } = await yuniverseSupabase
          .from("saved_videos")
          .insert({
            video_id: video.id,
            v2i_user_id: currentUserId,
          });

        if (error) throw error;
        setSaved(true);
      }
    } catch (error) {
      console.error("Save error:", error);
    }
  }

  // =========================================================
  // SHARE
  // =========================================================

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: video?.title || "Yuniverse Video",
          url,
        })
        .catch(() => {});
    } else {
      try {
        navigator.clipboard.writeText(url);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      } catch {
        alert("Video link: " + url);
      }
    }
  }

  // =========================================================
  // COMMENTS
  // =========================================================

  async function loadComments() {
    if (!video?.id) return;
    setLoadingComments(true);

    try {
      const { data, error, count } = await yuniverseSupabase
        .from("video_comments")
        .select(
          `
            id,
            comment,
            created_at,
            v2i_user_id
          `,
          { count: "exact" }
        )
        .eq("video_id", video.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
      setCommentCount(count || 0);
    } catch (error) {
      console.error("Comments error:", error);
    } finally {
      setLoadingComments(false);
    }
  }

  async function addComment() {
    const text = commentText.trim();
    if (!text || !currentUserId || !video?.id) return;

    try {
      const { error } = await yuniverseSupabase
        .from("video_comments")
        .insert({
          video_id: video.id,
          v2i_user_id: currentUserId,
          comment: text,
        });

      if (error) throw error;
      setCommentText("");
      await loadComments();
    } catch (error) {
      console.error("Comment insert error:", error);
    }
  }

  // =========================================================
  // SUBSCRIBE
  // =========================================================

  async function loadSubscribeStatus() {
    if (!video?.v2i_user_id) return;

    try {
      const { count, error } = await yuniverseSupabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("channel_v2i_user_id", video.v2i_user_id);

      if (!error) {
        setSubscriberCount(count || 0);
      }

      if (!currentUserId) return;

      const { data } = await yuniverseSupabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_v2i_user_id", currentUserId)
        .eq("channel_v2i_user_id", video.v2i_user_id)
        .maybeSingle();

      setSubscribed(!!data);
    } catch (error) {
      console.error("Subscribe status error:", error);
    }
  }

  async function toggleSubscribe() {
    if (!currentUserId || !video?.v2i_user_id || currentUserId === video.v2i_user_id) {
      return;
    }

    try {
      if (subscribed) {
        const { error } = await yuniverseSupabase
          .from("subscriptions")
          .delete()
          .eq("subscriber_v2i_user_id", currentUserId)
          .eq("channel_v2i_user_id", video.v2i_user_id);

        if (error) throw error;
        setSubscribed(false);
        setSubscriberCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await yuniverseSupabase
          .from("subscriptions")
          .insert({
            subscriber_v2i_user_id: currentUserId,
            channel_v2i_user_id: video.v2i_user_id,
          });

        if (error) throw error;
        setSubscribed(true);
        setSubscriberCount((c) => c + 1);
      }
    } catch (error) {
      console.error("Subscribe error:", error);
    }
  }

  // =========================================================
  // WATCH SESSIONS & ANALYTICS
  // =========================================================

  async function startWatchSession() {
    if (!video?.id || sessionStartedRef.current) return;
    sessionStartedRef.current = true;

    try {
      await yuniverseSupabase
        .from("video_watch_sessions")
        .insert({
          video_id: video.id,
          v2i_user_id: currentUserId || null,
          session_id: sessionIdRef.current,
          watched_seconds: 0,
          duration_seconds: Number(video.duration) || 0,
          completion_percentage: 0,
          completed: false,
          view_counted: false,
          last_watched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error("Watch session error:", error);
    }
  }

  async function updateWatchSession(force = false) {
    if (!video?.id || !sessionStartedRef.current) return;
    const duration = Number(video.duration) || 0;
    const percentage =
      duration > 0 ? Math.min(100, (watchSeconds / duration) * 100) : 0;

    try {
      await yuniverseSupabase
        .from("video_watch_sessions")
        .update({
          watched_seconds: watchSeconds,
          duration_seconds: duration,
          completion_percentage: percentage,
          completed: percentage >= 90,
          view_counted: viewCounted,
          last_watched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("video_id", video.id)
        .eq("session_id", sessionIdRef.current);
    } catch (error) {
      if (force) {
        console.error("Watch session update error:", error);
      }
    }
  }

  async function handleTimeUpdate(event) {
    const current = Math.floor(event.currentTarget.currentTime || 0);
    setWatchSeconds(current);

    if (!viewCounted && current >= 5 && video?.id) {
      setViewCounted(true);
      try {
        await yuniverseSupabase.rpc("increment_video_views", {
          target_video_id: video.id,
        });
      } catch (err) {
        console.warn("View increment error:", err);
      }
    }
  }

  function openChannel() {
    if (video?.v2i_user_id) {
      onNavigate("channel", {
        v2i_user_id: video.v2i_user_id,
        channel_name: getChannelName(),
        channel_avatar_url: getChannelAvatar(),
      });
    }
  }

  if (!video) {
    return (
      <div className="empty-state" style={{ minHeight: "70vh" }}>
        <div className="empty-icon">▶</div>
        <h3>Video not found</h3>
        <p>The requested video could not be loaded or is unavailable.</p>
        <button
          className="primary-button"
          onClick={() => onNavigate("home")}
        >
          Return to Feed
        </button>
      </div>
    );
  }

  const channelName = getChannelName();
  const channelAvatar = getChannelAvatar();
  const avatarLetter = channelName.charAt(0).toUpperCase();

  return (
    <div className="watch-page-container">
      {/* COPIED TOAST */}
      {copiedToast && (
        <div className="toast-container toast-success">
          <span className="toast-icon">✓</span>
          <span>Link copied to clipboard!</span>
        </div>
      )}

      {/* TOP COMPACT BAR */}
      <header className="top-header">
        <button
          type="button"
          className="back-button"
          onClick={() => onNavigate("home")}
          aria-label="Back to home"
        >
          ←
        </button>
        <button
          type="button"
          className="logo-button"
          onClick={() => onNavigate("home")}
        >
          <span>✦</span> Yuniverse
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="header-icon"
            onClick={handleShare}
            aria-label="Share video"
          >
            🔗
          </button>
        </div>
      </header>

      <div className="watch-layout-grid">
        {/* PRIMARY COLUMN: PLAYER + INFO + COMMENTS */}
        <div className="watch-primary-column">
          {/* VIDEO PLAYER CONTAINER */}
          <div className="watch-player-wrap">
            {playbackUrl ? (
              <>
                {videoLoading && !videoError && (
                  <div className="watch-video-loading">
                    <div className="video-loading-spinner" />
                    <span>Loading player...</span>
                  </div>
                )}

                {videoError && (
                  <div className="watch-no-video">
                    <div>
                      <strong>Playback issue</strong>
                      <p>{videoError}</p>
                      <button
                        type="button"
                        className="retry-video-button"
                        onClick={handleRetryPlayback}
                      >
                        Retry Playback
                      </button>
                    </div>
                  </div>
                )}

                <video
                  ref={playerRef}
                  className="watch-player"
                  controls
                  playsInline
                  webkit-playsinline="true"
                  crossOrigin="anonymous"
                  preload="metadata"
                  poster={thumbnailUrl || undefined}
                  onLoadedMetadata={handleVideoLoaded}
                  onCanPlay={handleVideoLoaded}
                  onError={handleVideoError}
                  onTimeUpdate={handleTimeUpdate}
                  onPause={() => updateWatchSession()}
                  onEnded={() => {
                    setWatchSeconds(Number(video.duration) || watchSeconds);
                    updateWatchSession(true);
                  }}
                />
              </>
            ) : (
              <div className="watch-no-video">
                <div>
                  <strong>Video unavailable</strong>
                  <p>No playable stream found for this video.</p>
                </div>
              </div>
            )}
          </div>

          {/* DETAILS & TITLE PANEL */}
          <div className="watch-details-panel">
            <h1 className="watch-title">{video.title || "Untitled Video"}</h1>

            {/* ACTION BAR */}
            <div className="watch-action-bar">
              {/* CHANNEL CARD */}
              <div className="watch-channel-card">
                <button
                  type="button"
                  className="watch-channel-avatar-btn"
                  onClick={openChannel}
                  aria-label={`Open ${channelName}`}
                >
                  {channelAvatar ? (
                    <img src={channelAvatar} alt={channelName} />
                  ) : (
                    avatarLetter
                  )}
                </button>

                <div className="watch-channel-info">
                  <button
                    type="button"
                    className="watch-channel-name"
                    onClick={openChannel}
                  >
                    {channelName}
                  </button>
                  <span className="watch-channel-subs">
                    {subscriberCount} {subscriberCount === 1 ? "subscriber" : "subscribers"}
                  </span>
                </div>

                {currentUserId !== video.v2i_user_id && (
                  <button
                    type="button"
                    className={`watch-subscribe-btn ${subscribed ? "subscribed" : ""}`}
                    onClick={toggleSubscribe}
                  >
                    {subscribed ? "Subscribed" : "Subscribe"}
                  </button>
                )}
              </div>

              {/* ACTION PILLS GROUP */}
              <div className="watch-actions-group">
                {/* LIKE & DISLIKE GROUP */}
                <div className="segmented-pill-group">
                  <button
                    type="button"
                    className={`pill-action-btn ${liked ? "active" : ""}`}
                    onClick={toggleLike}
                    aria-label="Like video"
                  >
                    <span>{liked ? "❤️" : "🤍"}</span>
                    <span>{likeCount}</span>
                  </button>
                  <div className="pill-divider" />
                  <button
                    type="button"
                    className={`pill-action-btn ${disliked ? "active" : ""}`}
                    onClick={toggleDislike}
                    aria-label="Dislike video"
                  >
                    <span>{disliked ? "👎" : "👍"}</span>
                  </button>
                </div>

                {/* SHARE BUTTON */}
                <button
                  type="button"
                  className="standalone-pill-btn"
                  onClick={handleShare}
                  aria-label="Share video link"
                >
                  <span>🔗</span>
                  <span>Share</span>
                </button>

                {/* SAVE BUTTON */}
                <button
                  type="button"
                  className={`standalone-pill-btn ${saved ? "saved" : ""}`}
                  onClick={toggleSave}
                  aria-label="Save video to library"
                >
                  <span>{saved ? "🔖" : "🏷️"}</span>
                  <span>{saved ? "Saved" : "Save"}</span>
                </button>
              </div>
            </div>

            {/* EXPANDABLE DESCRIPTION BOX */}
            <div
              className="watch-description-box"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            >
              <div className="description-meta-header">
                <span>{formatViews(video.views)}</span>
                <span>•</span>
                <span>
                  {video.created_at
                    ? new Date(video.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Recently uploaded"}
                </span>
              </div>

              {video.description ? (
                <div
                  className={`description-text ${
                    descriptionExpanded ? "" : "clamped"
                  }`}
                >
                  {video.description}
                </div>
              ) : (
                <p className="description-text" style={{ fontStyle: "italic" }}>
                  No description provided for this video.
                </p>
              )}

              <button
                type="button"
                className="description-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setDescriptionExpanded(!descriptionExpanded);
                }}
              >
                {descriptionExpanded ? "Show less" : "Show more"}
              </button>
            </div>

            {/* COMMENTS SECTION */}
            <section className="watch-comments-section" id="comments">
              <div className="comments-header-row">
                <h3>Comments ({commentCount})</h3>
              </div>

              {/* COMMENT INPUT FORM */}
              <div className="comment-input-card">
                <div className="comment-user-avatar">
                  {(user?.username || user?.fullName || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="comment-form-inner">
                  <input
                    type="text"
                    className="comment-text-input"
                    placeholder="Add a friendly comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addComment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="comment-submit-btn"
                    disabled={!commentText.trim()}
                    onClick={addComment}
                  >
                    Post Comment
                  </button>
                </div>
              </div>

              {/* COMMENTS LIST */}
              {loadingComments ? (
                <div className="empty-state" style={{ padding: "24px" }}>
                  <div className="loading-spinner" />
                  <p>Loading conversation...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="empty-state" style={{ padding: "24px" }}>
                  <div className="empty-icon">💬</div>
                  <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
              ) : (
                <div className="comments-list">
                  {comments.map((item) => (
                    <article className="comment-card" key={item.id}>
                      <div className="comment-author-avatar">
                        👤
                      </div>
                      <div className="comment-body">
                        <div className="comment-header">
                          <span className="comment-author-name">
                            Yuniverse Creator
                          </span>
                          <span className="comment-time">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        <p className="comment-content">{item.comment}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* SIDEBAR COLUMN: RELATED / UP NEXT VIDEOS */}
        <aside className="watch-sidebar-column">
          <div className="watch-up-next-feed">
            <h3 className="up-next-title">Up Next</h3>

            {loadingRelated && (
              <div className="video-card-skeleton skeleton-compact" />
            )}

            {!loadingRelated && relatedVideos.length === 0 && (
              <div className="empty-state" style={{ padding: "20px" }}>
                <p>No related videos found right now.</p>
              </div>
            )}

            {!loadingRelated &&
              relatedVideos.map((item) => (
                <VideoCard
                  key={item.id}
                  video={item}
                  channelName={item.channelName}
                  channelAvatar={item.channelAvatar}
                  compact={true}
                  onVideoClick={(v) => onNavigate("watch", v)}
                  onChannelClick={(v) =>
                    onNavigate("channel", {
                      v2i_user_id: v.v2i_user_id,
                      channel_name: item.channelName,
                    })
                  }
                />
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
