import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Hls from "hls.js";

import { yuniverseSupabase } from "../lib/yuniverseSupabase";

export default function Watch({
  user,
  video,
  onNavigate,
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

  const [channelProfile, setChannelProfile] = useState(null);

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

      if (!savedUser) {
        return null;
      }

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
    video?.video_url ||
    (video?.mux_playback_id
      ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
      : "");

  const thumbnailUrl =
    video?.thumbnail_url ||
    (video?.mux_playback_id
      ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
      : "");

  // =========================================================
  // LOAD EVERYTHING
  // =========================================================

  useEffect(() => {
    if (!video?.id) {
      return;
    }

    loadVideoData();
    startWatchSession();

    return () => {
      updateWatchSession(true);
    };
  }, [video?.id]);

  // =========================================================
  // VIDEO PLAYER
  // =========================================================

  useEffect(() => {
    const videoElement = playerRef.current;

    if (!videoElement || !playbackUrl) {
      return;
    }

    setVideoLoading(true);
    setVideoError("");

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsUrl =
      playbackUrl.includes(".m3u8");

    // -------------------------------------------------------
    // HLS VIDEO
    // -------------------------------------------------------

    if (isHlsUrl) {
      // Safari / browsers with native HLS support
      if (
        videoElement.canPlayType(
          "application/vnd.apple.mpegurl"
        )
      ) {
        videoElement.src = playbackUrl;

        videoElement.load();

        return;
      }

      // Chrome / Firefox / Edge using hls.js
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        });

        hlsRef.current = hls;

        hls.loadSource(playbackUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          setVideoError("");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(
            "HLS playback error:",
            data
          );

          if (!data?.fatal) {
            return;
          }

          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR
          ) {
            console.error(
              "HLS network error. Retrying..."
            );

            try {
              hls.startLoad();
            } catch (error) {
              console.error(error);
            }

            return;
          }

          if (
            data.type === Hls.ErrorTypes.MEDIA_ERROR
          ) {
            console.error(
              "HLS media error. Recovering..."
            );

            try {
              hls.recoverMediaError();
            } catch (error) {
              console.error(error);
            }

            return;
          }

          setVideoLoading(false);

          setVideoError(
            "Video could not be played."
          );

          hls.destroy();
          hlsRef.current = null;
        });

        return;
      }

      setVideoLoading(false);

      setVideoError(
        "This browser does not support HLS video playback."
      );

      return;
    }

    // -------------------------------------------------------
    // NORMAL MP4 / SUPABASE VIDEO
    // -------------------------------------------------------

    videoElement.src = playbackUrl;
    videoElement.load();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (videoElement) {
        videoElement.removeAttribute("src");
        videoElement.load();
      }
    };
  }, [playbackUrl]);

  function handleVideoLoaded() {
    setVideoLoading(false);
    setVideoError("");
  }

  function handleVideoError(event) {
    console.error(
      "Video playback error:",
      event?.currentTarget?.error
    );

    setVideoLoading(false);

    setVideoError(
      "Video could not be loaded or played."
    );
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

  // =========================================================
  // CHANNEL PROFILE
  // =========================================================

  async function loadChannelProfile() {
    if (!video?.v2i_user_id) {
      return;
    }

    try {
      const { data, error } =
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
          .eq(
            "v2i_user_id",
            video.v2i_user_id
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      setChannelProfile(data || null);
    } catch (error) {
      console.error(
        "Channel profile error:",
        error
      );

      setChannelProfile(null);
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
  // LIKE
  // =========================================================

  async function loadLikeStatus() {
    if (!video?.id) {
      return;
    }

    try {
      const {
        count,
        error,
      } = await yuniverseSupabase
        .from("video_likes")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("video_id", video.id);

      if (!error) {
        setLikeCount(count || 0);
      }

      if (!currentUserId) {
        return;
      }

      const { data } =
        await yuniverseSupabase
          .from("video_likes")
          .select("id")
          .eq(
            "video_id",
            video.id
          )
          .eq(
            "v2i_user_id",
            currentUserId
          )
          .maybeSingle();

      setLiked(!!data);
    } catch (error) {
      console.error(
        "Like status error:",
        error
      );
    }
  }

  async function toggleLike() {
    if (
      !currentUserId ||
      !video?.id
    ) {
      return;
    }

    try {
      if (liked) {
        const { error } =
          await yuniverseSupabase
            .from("video_likes")
            .delete()
            .eq(
              "video_id",
              video.id
            )
            .eq(
              "v2i_user_id",
              currentUserId
            );

        if (error) {
          throw error;
        }

        setLiked(false);

        setLikeCount((count) =>
          Math.max(0, count - 1)
        );
      } else {
        const { error } =
          await yuniverseSupabase
            .from("video_likes")
            .insert({
              video_id: video.id,
              v2i_user_id:
                currentUserId,
            });

        if (error) {
          throw error;
        }

        setLiked(true);

        setLikeCount(
          (count) => count + 1
        );
      }
    } catch (error) {
      console.error(
        "Like error:",
        error
      );
    }
  }

  // =========================================================
  // SAVE
  // =========================================================

  async function loadSaveStatus() {
    if (
      !currentUserId ||
      !video?.id
    ) {
      return;
    }

    try {
      const { data } =
        await yuniverseSupabase
          .from("saved_videos")
          .select("id")
          .eq(
            "video_id",
            video.id
          )
          .eq(
            "v2i_user_id",
            currentUserId
          )
          .maybeSingle();

      setSaved(!!data);
    } catch (error) {
      console.error(
        "Save status error:",
        error
      );
    }
  }

  async function toggleSave() {
    if (
      !currentUserId ||
      !video?.id
    ) {
      return;
    }

    try {
      if (saved) {
        const { error } =
          await yuniverseSupabase
            .from("saved_videos")
            .delete()
            .eq(
              "video_id",
              video.id
            )
            .eq(
              "v2i_user_id",
              currentUserId
            );

        if (error) {
          throw error;
        }

        setSaved(false);
      } else {
        const { error } =
          await yuniverseSupabase
            .from("saved_videos")
            .insert({
              video_id: video.id,
              v2i_user_id:
                currentUserId,
            });

        if (error) {
          throw error;
        }

        setSaved(true);
      }
    } catch (error) {
      console.error(
        "Save error:",
        error
      );
    }
  }

  // =========================================================
  // COMMENTS
  // =========================================================

  async function loadComments() {
    if (!video?.id) {
      return;
    }

    setLoadingComments(true);

    try {
      const {
        data,
        error,
        count,
      } = await yuniverseSupabase
        .from("video_comments")
        .select(
          `
            id,
            comment,
            created_at,
            v2i_user_id
          `,
          {
            count: "exact",
          }
        )
        .eq(
          "video_id",
          video.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      setComments(data || []);
      setCommentCount(count || 0);
    } catch (error) {
      console.error(
        "Comments error:",
        error
      );
    } finally {
      setLoadingComments(false);
    }
  }

  async function addComment() {
    const text =
      commentText.trim();

    if (
      !text ||
      !currentUserId ||
      !video?.id
    ) {
      return;
    }

    try {
      const { error } =
        await yuniverseSupabase
          .from("video_comments")
          .insert({
            video_id: video.id,
            v2i_user_id:
              currentUserId,
            comment: text,
          });

      if (error) {
        throw error;
      }

      setCommentText("");

      await loadComments();
    } catch (error) {
      console.error(
        "Comment insert error:",
        error
      );
    }
  }

  // =========================================================
  // SUBSCRIBE
  // =========================================================

  async function loadSubscribeStatus() {
    if (!video?.v2i_user_id) {
      return;
    }

    try {
      const {
        count,
        error,
      } = await yuniverseSupabase
        .from("subscriptions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "channel_v2i_user_id",
          video.v2i_user_id
        );

      if (!error) {
        setSubscriberCount(
          count || 0
        );
      }

      if (!currentUserId) {
        return;
      }

      const { data } =
        await yuniverseSupabase
          .from("subscriptions")
          .select("id")
          .eq(
            "subscriber_v2i_user_id",
            currentUserId
          )
          .eq(
            "channel_v2i_user_id",
            video.v2i_user_id
          )
          .maybeSingle();

      setSubscribed(!!data);
    } catch (error) {
      console.error(
        "Subscribe status error:",
        error
      );
    }
  }

  async function toggleSubscribe() {
    if (
      !currentUserId ||
      !video?.v2i_user_id ||
      currentUserId ===
        video.v2i_user_id
    ) {
      return;
    }

    try {
      if (subscribed) {
        const { error } =
          await yuniverseSupabase
            .from("subscriptions")
            .delete()
            .eq(
              "subscriber_v2i_user_id",
              currentUserId
            )
            .eq(
              "channel_v2i_user_id",
              video.v2i_user_id
            );

        if (error) {
          throw error;
        }

        setSubscribed(false);

        setSubscriberCount(
          (count) =>
            Math.max(
              0,
              count - 1
            )
        );
      } else {
        const { error } =
          await yuniverseSupabase
            .from("subscriptions")
            .insert({
              subscriber_v2i_user_id:
                currentUserId,
              channel_v2i_user_id:
                video.v2i_user_id,
            });

        if (error) {
          throw error;
        }

        setSubscribed(true);

        setSubscriberCount(
          (count) => count + 1
        );
      }
    } catch (error) {
      console.error(
        "Subscribe error:",
        error
      );
    }
  }

  // =========================================================
  // WATCH SESSION
  // =========================================================

  async function startWatchSession() {
    if (
      !video?.id ||
      sessionStartedRef.current
    ) {
      return;
    }

    sessionStartedRef.current = true;

    try {
      await yuniverseSupabase
        .from("video_watch_sessions")
        .insert({
          video_id: video.id,
          v2i_user_id:
            currentUserId || null,
          session_id:
            sessionIdRef.current,
          watched_seconds: 0,
          duration_seconds:
            Number(video.duration) || 0,
          completion_percentage: 0,
          completed: false,
          view_counted: false,
          last_watched_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        });
    } catch (error) {
      console.error(
        "Watch session error:",
        error
      );
    }
  }

  async function updateWatchSession(
    force = false
  ) {
    if (
      !video?.id ||
      !sessionStartedRef.current
    ) {
      return;
    }

    const duration =
      Number(video.duration) || 0;

    const percentage =
      duration > 0
        ? Math.min(
            100,
            (watchSeconds /
              duration) *
              100
          )
        : 0;

    try {
      await yuniverseSupabase
        .from("video_watch_sessions")
        .update({
          watched_seconds:
            watchSeconds,
          duration_seconds:
            duration,
          completion_percentage:
            percentage,
          completed:
            percentage >= 90,
          view_counted:
            viewCounted,
          last_watched_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "video_id",
          video.id
        )
        .eq(
          "session_id",
          sessionIdRef.current
        );
    } catch (error) {
      if (force) {
        console.error(
          "Watch session update error:",
          error
        );
      }
    }
  }

  async function handleTimeUpdate(event) {
    const currentTime =
      event?.target?.currentTime || 0;

    setWatchSeconds(currentTime);

    if (
      !viewCounted &&
      currentTime >= 10 &&
      video?.id
    ) {
      await countView();
    }

    if (
      Math.floor(currentTime) % 5 === 0
    ) {
      updateWatchSession();
    }
  }

  async function countView() {
    if (
      viewCounted ||
      !video?.id
    ) {
      return;
    }

    try {
      const {
        data,
        error: fetchError,
      } = await yuniverseSupabase
        .from("videos")
        .select("views")
        .eq(
          "id",
          video.id
        )
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentViews =
        Number(data?.views || 0);

      const { error } =
        await yuniverseSupabase
          .from("videos")
          .update({
            views:
              currentViews + 1,
          })
          .eq(
            "id",
            video.id
          );

      if (error) {
        throw error;
      }

      setViewCounted(true);
    } catch (error) {
      console.error(
        "View count error:",
        error
      );
    }
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  function openChannel() {
    if (
      !video?.v2i_user_id
    ) {
      return;
    }

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
        channelProfile?.channel_avatar_url ||
        undefined,

      bio:
        channelProfile?.channel_bio ||
        "",
    });
  }

  // =========================================================
  // HELPERS
  // =========================================================

  function formatViews(value) {
    const views = Number(
      value || 0
    );

    if (views >= 1000000) {
      return `${(
        views / 1000000
      )
        .toFixed(1)
        .replace(".0", "")}M`;
    }

    if (views >= 1000) {
      return `${(
        views / 1000
      )
        .toFixed(1)
        .replace(".0", "")}K`;
    }

    return String(views);
  }

  // =========================================================
  // VIDEO NOT FOUND
  // =========================================================

  if (!video) {
    return (
      <div className="watch-page">
        <div className="watch-empty">
          <h2>
            Video not found
          </h2>

          <button
            onClick={() =>
              onNavigate("home")
            }
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const channelName =
    getChannelName();

  const channelAvatar =
    getChannelAvatar();

  return (
    <div className="watch-page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="watch-header">
        <button
          className="watch-back"
          onClick={() =>
            onNavigate("home")
          }
        >
          ←
        </button>

        <button
          className="watch-logo"
          onClick={() =>
            onNavigate("home")
          }
        >
          YUNIVERSE
        </button>
      </header>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <main className="watch-content">
        {/* ===================================================
            VIDEO PLAYER
        =================================================== */}

        <div className="watch-player-wrap">
          {playbackUrl ? (
            <>
              {videoLoading && (
                <div className="watch-video-loading">
                  Loading video...
                </div>
              )}

              {videoError ? (
                <div className="watch-no-video">
                  <div>
                    <strong>
                      Video unavailable
                    </strong>

                    <p>
                      {videoError}
                    </p>
                  </div>
                </div>
              ) : (
                <video
                  ref={playerRef}
                  className="watch-player"
                  controls
                  playsInline
                  preload="metadata"
                  poster={thumbnailUrl || undefined}
                  onLoadedMetadata={
                    handleVideoLoaded
                  }
                  onCanPlay={
                    handleVideoLoaded
                  }
                  onError={
                    handleVideoError
                  }
                  onTimeUpdate={
                    handleTimeUpdate
                  }
                  onPause={() =>
                    updateWatchSession()
                  }
                  onEnded={() => {
                    setWatchSeconds(
                      Number(
                        video.duration
                      ) ||
                        watchSeconds
                    );

                    updateWatchSession(
                      true
                    );
                  }}
                />
              )}
            </>
          ) : (
            <div className="watch-no-video">
              <div>
                <strong>
                  Video unavailable
                </strong>

                <p>
                  No video URL was found.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================
            DETAILS
        =================================================== */}

        <section className="watch-details">
          <h1>
            {video.title}
          </h1>

          <div className="watch-meta">
            <span>
              {formatViews(
                video.views
              )}{" "}
              views
            </span>

            <span>•</span>

            <span>
              {video.created_at
                ? new Date(
                    video.created_at
                  ).toLocaleDateString()
                : ""}
            </span>
          </div>

          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="watch-actions">
            <button
              className={
                liked ? "active" : ""
              }
              onClick={
                toggleLike
              }
            >
              {liked
                ? "❤️"
                : "♡"}{" "}
              {likeCount}
            </button>

            <button
              onClick={
                toggleSave
              }
            >
              {saved
                ? "🔖 Saved"
                : "🔖 Save"}
            </button>

            <button
              onClick={() =>
                document
                  .getElementById(
                    "comments"
                  )
                  ?.scrollIntoView({
                    behavior:
                      "smooth",
                  })
              }
            >
              💬 {commentCount}
            </button>
          </div>

          {/* =================================================
              CHANNEL
          ================================================= */}

          <div className="watch-channel">
            <button
              type="button"
              className="watch-channel-avatar"
              onClick={
                openChannel
              }
              aria-label="Open channel"
            >
              {channelAvatar ? (
                <img
                  src={
                    channelAvatar
                  }
                  alt={
                    channelName
                  }
                />
              ) : (
                channelName
                  .charAt(0)
                  .toUpperCase()
              )}
            </button>

            <div className="watch-channel-info">
              <button
                type="button"
                className="watch-channel-name"
                onClick={
                  openChannel
                }
              >
                {channelName}
              </button>

              <span>
                {subscriberCount}{" "}
                subscribers
              </span>
            </div>

            {currentUserId !==
              video.v2i_user_id && (
              <button
                className={
                  subscribed
                    ? "watch-subscribe subscribed"
                    : "watch-subscribe"
                }
                onClick={
                  toggleSubscribe
                }
              >
                {subscribed
                  ? "Subscribed"
                  : "Subscribe"}
              </button>
            )}
          </div>

          {/* =================================================
              DESCRIPTION
          ================================================= */}

          {video.description && (
            <div className="watch-description">
              {video.description}
            </div>
          )}
        </section>

        {/* ===================================================
            COMMENTS
        =================================================== */}

        <section
          id="comments"
          className="watch-comments"
        >
          <h2>
            Comments{" "}
            {commentCount}
          </h2>

          <div className="comment-form">
            <input
              value={commentText}
              onChange={(event) =>
                setCommentText(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  addComment();
                }
              }}
              placeholder="Add a comment..."
            />

            <button
              onClick={
                addComment
              }
            >
              Comment
            </button>
          </div>

          {loadingComments ? (
            <div className="comments-loading">
              Loading comments...
            </div>
          ) : comments.length ===
            0 ? (
            <div className="comments-empty">
              No comments yet.
            </div>
          ) : (
            <div className="comments-list">
              {comments.map(
                (item) => (
                  <article
                    className="comment-item"
                    key={
                      item.id
                    }
                  >
                    <div className="comment-avatar">
                      👤
                    </div>

                    <div className="comment-body">
                      <div className="comment-user">
                        Yuniverse User
                      </div>

                      <div className="comment-text">
                        {
                          item.comment
                        }
                      </div>

                      <div className="comment-date">
                        {item.created_at
                          ? new Date(
                              item.created_at
                            ).toLocaleDateString()
                          : ""}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}