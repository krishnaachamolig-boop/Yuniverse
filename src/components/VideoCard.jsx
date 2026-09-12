import React, { useState, useRef, useEffect } from "react";

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return null;
  const totalSecs = Math.floor(Number(seconds));
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function formatViews(views) {
  const num = Number(views || 0);
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1).replace(".0", "")}B views`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(".0", "")}M views`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(".0", "")}K views`;
  }
  return `${num} ${num === 1 ? "view" : "views"}`;
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now - date) / 1000);

    if (diffSecs < 60) return "Just now";
    const mins = Math.floor(diffSecs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  } catch {
    return "";
  }
}

export default function VideoCard({
  video,
  channelName = "Yuniverse Creator",
  channelAvatar = null,
  onVideoClick,
  onChannelClick,
  onSaveVideo,
  compact = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen]);

  const durationStr = formatDuration(video?.duration);
  const viewsStr = formatViews(video?.views);
  const timeStr = formatRelativeTime(video?.created_at);

  const thumbUrl =
    video?.thumbnailUrl ||
    video?.thumbnail_url ||
    (video?.mux_playback_id
      ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
      : null);

  const initial = (channelName || "Y").charAt(0).toUpperCase();

  const handleCopyLink = (e) => {
    e.stopPropagation();
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}#watch?v=${video.id}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setMenuOpen(false);
      }, 1500);
    } catch {
      setMenuOpen(false);
    }
  };

  const handleSave = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onSaveVideo?.(video);
  };

  return (
    <article className={`video-card ${compact ? "video-card-compact" : ""}`}>
      {/* THUMBNAIL CONTAINER */}
      <div
        className="video-thumbnail-wrap"
        onClick={() => onVideoClick?.(video)}
        role="button"
        tabIndex={0}
        aria-label={`Watch ${video.title || "video"}`}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={video.title || "Video thumbnail"}
            className="video-thumbnail-img"
            loading="lazy"
          />
        ) : (
          <div className="thumbnail-placeholder">
            <span className="placeholder-icon">▶</span>
          </div>
        )}

        {/* DURATION BADGE */}
        {durationStr && (
          <span className="video-duration-badge">{durationStr}</span>
        )}

        {/* HOVER PLAY OVERLAY */}
        <div className="video-play-overlay">
          <div className="play-overlay-icon">▶</div>
        </div>
      </div>

      {/* VIDEO INFO & METADATA */}
      <div className="video-info-wrap">
        {!compact && (
          <button
            type="button"
            className="video-avatar-btn"
            onClick={(e) => {
              e.stopPropagation();
              onChannelClick?.(video);
            }}
            aria-label={`Open ${channelName} channel`}
          >
            {channelAvatar ? (
              <img
                src={channelAvatar}
                alt={channelName}
                className="video-avatar-img"
              />
            ) : (
              <div className="video-avatar-fallback">{initial}</div>
            )}
          </button>
        )}

        <div className="video-text-content">
          <h3
            className="video-card-title"
            title={video.title}
            onClick={() => onVideoClick?.(video)}
          >
            {video.title || "Untitled video"}
          </h3>

          <div className="video-meta-row">
            <button
              type="button"
              className="video-card-channel"
              onClick={(e) => {
                e.stopPropagation();
                onChannelClick?.(video);
              }}
            >
              {channelName}
            </button>

            <div className="video-card-stats">
              <span>{viewsStr}</span>
              {timeStr && <span className="stat-separator">•</span>}
              {timeStr && <span>{timeStr}</span>}
            </div>
          </div>
        </div>

        {/* THREE DOTS MENU */}
        <div className="video-card-menu-anchor" ref={menuRef}>
          <button
            type="button"
            className="video-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="More options"
          >
            ⋮
          </button>

          {menuOpen && (
            <div className="video-dropdown-menu">
              <button
                type="button"
                className="dropdown-item"
                onClick={handleCopyLink}
              >
                <span>{copied ? "✓" : "🔗"}</span>
                <span>{copied ? "Link Copied!" : "Copy Link"}</span>
              </button>

              {onSaveVideo && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={handleSave}
                >
                  <span>🔖</span>
                  <span>Save to Library</span>
                </button>
              )}

              <button
                type="button"
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onChannelClick?.(video);
                }}
              >
                <span>👤</span>
                <span>Go to Channel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function VideoCardSkeleton({ compact = false }) {
  return (
    <div className={`video-card-skeleton ${compact ? "skeleton-compact" : ""}`}>
      <div className="skeleton-thumb shimmer" />
      <div className="skeleton-details">
        {!compact && <div className="skeleton-avatar shimmer" />}
        <div className="skeleton-lines">
          <div className="skeleton-line skeleton-title shimmer" />
          <div className="skeleton-line skeleton-subtitle shimmer" />
          <div className="skeleton-line skeleton-meta shimmer" />
        </div>
      </div>
    </div>
  );
}
