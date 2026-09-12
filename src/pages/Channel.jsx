import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { yuniverseSupabase } from "../lib/yuniverseSupabase";
import BottomNav from "../components/BottomNav";

export default function Channel({
  user,
  channel,
  onNavigate,
}) {
  const channelUserId =
    channel?.v2i_user_id ||
    channel?.user_id ||
    channel?.id ||
    null;

  const currentUserId =
    user?.authUser?.id ||
    user?.id ||
    user?.profile?.id ||
    null;

  const isOwnChannel =
    Boolean(channelUserId) &&
    Boolean(currentUserId) &&
    channelUserId ===
      currentUserId;

  const [profile, setProfile] =
    useState(null);

  const [videos, setVideos] =
    useState([]);

  const [playlists, setPlaylists] =
    useState([]);

  const [
    linkedChannels,
    setLinkedChannels,
  ] = useState([]);

  const [activeTab, setActiveTab] =
    useState("videos");

  const [loading, setLoading] =
    useState(true);

  const [
    channelsLoading,
    setChannelsLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    channelsError,
    setChannelsError,
  ] = useState("");

  const [
    showAddChannel,
    setShowAddChannel,
  ] = useState(false);

  const [
    channelSearch,
    setChannelSearch,
  ] = useState("");

  const [
    searchingChannels,
    setSearchingChannels,
  ] = useState(false);

  const [
    searchResults,
    setSearchResults,
  ] = useState([]);

  const [
    savingChannel,
    setSavingChannel,
  ] = useState(false);

  // =========================================================
  // LOAD YUNIVERSE CHANNEL PROFILE
  // =========================================================

  const loadProfile =
    useCallback(async () => {
      if (!channelUserId) {
        return;
      }

      try {
        const {
          data,
          error: profileError,
        } = await yuniverseSupabase
          .from(
            "channel_profiles"
          )
          .select(
            `
              id,
              v2i_user_id,
              channel_name,
              channel_avatar_url,
              channel_bio,
              created_at,
              updated_at
            `
          )
          .eq(
            "v2i_user_id",
            channelUserId
          )
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        setProfile(data || null);
      } catch (err) {
        console.error(
          "Channel profile error:",
          err
        );

        setProfile(null);
      }
    }, [channelUserId]);

  // =========================================================
  // LOAD VIDEOS
  // =========================================================

  const loadVideos =
    useCallback(async () => {
      if (!channelUserId) {
        return;
      }

      try {
        const {
          data,
          error: videoError,
        } = await yuniverseSupabase
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
          .eq(
            "v2i_user_id",
            channelUserId
          )
          .eq(
            "status",
            "ready"
          )
          .not(
            "mux_playback_id",
            "is",
            null
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

        if (videoError) {
          throw videoError;
        }

        const formatted =
          (data || [])
            .filter(
              (video) => {
                if (
                  !video.width ||
                  !video.height
                ) {
                  return true;
                }

                const width =
                  Number(
                    video.width
                  );

                const height =
                  Number(
                    video.height
                  );

                if (
                  width <=
                  height
                ) {
                  return false;
                }

                const ratio =
                  width /
                  height;

                return (
                  Math.abs(
                    ratio -
                      16 / 9
                  ) <=
                  0.08
                );
              }
            )
            .map(
              (video) => ({
                ...video,

                views: Number(
                  video.views ||
                    0
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
              })
            );

        setVideos(formatted);
      } catch (err) {
        console.error(
          "Channel videos error:",
          err
        );

        setVideos([]);
      }
    }, [channelUserId]);

  // =========================================================
  // LOAD PLAYLISTS
  // =========================================================

  const loadPlaylists =
    useCallback(async () => {
      if (!channelUserId) {
        return;
      }

      try {
        const {
          data: playlistData,
          error: playlistError,
        } = await yuniverseSupabase
          .from("playlists")
          .select(
            `
              id,
              v2i_user_id,
              name,
              description,
              visibility,
              cover_url,
              created_at,
              updated_at
            `
          )
          .eq(
            "v2i_user_id",
            channelUserId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

        if (playlistError) {
          throw playlistError;
        }

        const visiblePlaylists =
          (
            playlistData ||
            []
          ).filter(
            (playlist) => {
              if (
                isOwnChannel
              ) {
                return true;
              }

              return (
                playlist.visibility ===
                "public"
              );
            }
          );

        const playlistsWithVideos =
          await Promise.all(
            visiblePlaylists.map(
              async (
                playlist
              ) => {
                let coverUrl =
                  playlist.cover_url ||
                  null;

                try {
                  const {
                    data:
                      playlistVideos,
                    error:
                      playlistVideosError,
                  } =
                    await yuniverseSupabase
                      .from(
                        "playlist_videos"
                      )
                      .select(
                        `
                          video_id,
                          position
                        `
                      )
                      .eq(
                        "playlist_id",
                        playlist.id
                      )
                      .order(
                        "position",
                        {
                          ascending:
                            true,
                        }
                      )
                      .limit(
                        1
                      );

                  if (
                    !playlistVideosError &&
                    playlistVideos?.length >
                      0
                  ) {
                    const firstVideoId =
                      playlistVideos[0]
                        ?.video_id;

                    if (
                      firstVideoId &&
                      !coverUrl
                    ) {
                      const {
                        data:
                          firstVideo,
                        error:
                          firstVideoError,
                      } =
                        await yuniverseSupabase
                          .from(
                            "videos"
                          )
                          .select(
                            `
                              id,
                              thumbnail_url,
                              mux_playback_id
                            `
                          )
                          .eq(
                            "id",
                            firstVideoId
                          )
                          .maybeSingle();

                      if (
                        !firstVideoError &&
                        firstVideo
                      ) {
                        if (
                          firstVideo.mux_playback_id
                        ) {
                          coverUrl =
                            `https://image.mux.com/${firstVideo.mux_playback_id}/thumbnail.jpg`;
                        } else if (
                          firstVideo.thumbnail_url
                        ) {
                          coverUrl =
                            firstVideo.thumbnail_url;
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.error(
                    "Playlist first video error:",
                    err
                  );
                }

                return {
                  ...playlist,
                  coverUrl,
                };
              }
            )
          );

        setPlaylists(
          playlistsWithVideos
        );
      } catch (err) {
        console.error(
          "Channel playlists error:",
          err
        );

        setPlaylists([]);
      }
    }, [
      channelUserId,
      isOwnChannel,
    ]);

  // =========================================================
  // LOAD LINKED CHANNELS
  //
  // Linked channel identity also comes from
  // Yuniverse channel_profiles.
  // =========================================================

  const loadChannels =
    useCallback(async () => {
      if (!channelUserId) {
        return;
      }

      setChannelsLoading(true);
      setChannelsError("");

      try {
        const {
          data: relations,
          error: relationError,
        } = await yuniverseSupabase
          .from(
            "channel_channels"
          )
          .select(
            `
              id,
              channel_v2i_user_id,
              linked_channel_v2i_user_id,
              position,
              created_at,
              updated_at
            `
          )
          .eq(
            "channel_v2i_user_id",
            channelUserId
          )
          .order(
            "position",
            {
              ascending: true,
            }
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          );

        if (relationError) {
          throw relationError;
        }

        if (
          !relations ||
          relations.length ===
            0
        ) {
          setLinkedChannels(
            []
          );

          return;
        }

        const linkedIds =
          relations
            .map(
              (item) =>
                item.linked_channel_v2i_user_id
            )
            .filter(Boolean);

        if (
          linkedIds.length ===
          0
        ) {
          setLinkedChannels(
            []
          );

          return;
        }

        const {
          data: profilesData,
          error: profilesError,
        } =
          await yuniverseSupabase
            .from(
              "channel_profiles"
            )
            .select(
              `
                id,
                v2i_user_id,
                channel_name,
                channel_avatar_url,
                channel_bio
              `
            )
            .in(
              "v2i_user_id",
              linkedIds
            );

        if (profilesError) {
          throw profilesError;
        }

        const profileMap =
          new Map(
            (
              profilesData ||
              []
            ).map(
              (item) => [
                item.v2i_user_id,
                item,
              ]
            )
          );

        const formatted =
          relations
            .map(
              (relation) => {
                const linkedProfile =
                  profileMap.get(
                    relation.linked_channel_v2i_user_id
                  );

                if (
                  !linkedProfile
                ) {
                  return null;
                }

                return {
                  ...relation,
                  profile:
                    linkedProfile,
                };
              }
            )
            .filter(Boolean);

        setLinkedChannels(
          formatted
        );
      } catch (err) {
        console.error(
          "Linked channels error:",
          err
        );

        setChannelsError(
          err?.message ||
            "Channels load nahi ho paaye."
        );
      } finally {
        setChannelsLoading(
          false
        );
      }
    }, [channelUserId]);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    let mounted = true;

    async function loadEverything() {
      setLoading(true);
      setError("");

      try {
        await Promise.all([
          loadProfile(),
          loadVideos(),
          loadPlaylists(),
          loadChannels(),
        ]);
      } catch (err) {
        console.error(
          "Channel page error:",
          err
        );

        if (mounted) {
          setError(
            err?.message ||
              "Channel data load nahi ho paaya."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadEverything();

    return () => {
      mounted = false;
    };
  }, [
    loadProfile,
    loadVideos,
    loadPlaylists,
    loadChannels,
  ]);

  // =========================================================
  // SEARCH CHANNELS
  //
  // Search only Yuniverse channel_profiles.
  // =========================================================

  async function searchChannels() {
    const term =
      channelSearch.trim();

    if (!term) {
      setSearchResults([]);
      return;
    }

    setSearchingChannels(true);
    setChannelsError("");

    try {
      const safeTerm =
        term
          .replace(
            /[%_]/g,
            ""
          )
          .replace(
            /,/g,
            " "
          )
          .replace(
            /'/g,
            "''"
          )
          .trim();

      if (!safeTerm) {
        setSearchResults([]);
        return;
      }

      const {
        data,
        error: searchError,
      } =
        await yuniverseSupabase
          .from(
            "channel_profiles"
          )
          .select(
            `
              id,
              v2i_user_id,
              channel_name,
              channel_avatar_url,
              channel_bio
            `
          )
          .or(
            `channel_name.ilike.%${safeTerm}%,channel_bio.ilike.%${safeTerm}%`
          )
          .neq(
            "v2i_user_id",
            channelUserId
          )
          .limit(10);

      if (searchError) {
        throw searchError;
      }

      const existingIds =
        new Set(
          linkedChannels.map(
            (item) =>
              item.linked_channel_v2i_user_id
          )
        );

      const filtered =
        (data || []).filter(
          (item) =>
            !existingIds.has(
              item.v2i_user_id
            )
        );

      setSearchResults(
        filtered
      );
    } catch (err) {
      console.error(
        "Channel search error:",
        err
      );

      setSearchResults([]);

      setChannelsError(
        err?.message ||
          "Channel search nahi ho paaya."
      );
    } finally {
      setSearchingChannels(
        false
      );
    }
  }

  // =========================================================
  // ADD CHANNEL
  // =========================================================

  async function addChannel(
    targetProfile
  ) {
    if (
      !targetProfile?.v2i_user_id ||
      !channelUserId
    ) {
      return;
    }

    if (
      targetProfile.v2i_user_id ===
      channelUserId
    ) {
      return;
    }

    const alreadyAdded =
      linkedChannels.some(
        (item) =>
          item.linked_channel_v2i_user_id ===
          targetProfile.v2i_user_id
      );

    if (alreadyAdded) {
      return;
    }

    setSavingChannel(true);
    setChannelsError("");

    try {
      const nextPosition =
        linkedChannels.length;

      const {
        error: insertError,
      } =
        await yuniverseSupabase
          .from(
            "channel_channels"
          )
          .insert({
            channel_v2i_user_id:
              channelUserId,

            linked_channel_v2i_user_id:
              targetProfile.v2i_user_id,

            position:
              nextPosition,
          });

      if (insertError) {
        throw insertError;
      }

      setChannelSearch("");
      setSearchResults([]);
      setShowAddChannel(false);

      await loadChannels();
    } catch (err) {
      console.error(
        "Add channel error:",
        err
      );

      setChannelsError(
        err?.message ||
          "Channel add nahi ho paaya."
      );
    } finally {
      setSavingChannel(
        false
      );
    }
  }

  // =========================================================
  // REMOVE CHANNEL
  // =========================================================

  async function removeChannel(
    relationId
  ) {
    if (
      !relationId ||
      !isOwnChannel
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Kya tum is channel ko apni Channels list se remove karna chahte ho?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const {
        error: deleteError,
      } =
        await yuniverseSupabase
          .from(
            "channel_channels"
          )
          .delete()
          .eq(
            "id",
            relationId
          )
          .eq(
            "channel_v2i_user_id",
            channelUserId
          );

      if (deleteError) {
        throw deleteError;
      }

      await loadChannels();
    } catch (err) {
      console.error(
        "Remove channel error:",
        err
      );

      setChannelsError(
        err?.message ||
          "Channel remove nahi ho paaya."
      );
    }
  }

  // =========================================================
  // MOVE CHANNEL
  // =========================================================

  async function moveChannel(
    index,
    direction
  ) {
    if (!isOwnChannel) {
      return;
    }

    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >=
        linkedChannels.length
    ) {
      return;
    }

    const current =
      linkedChannels[index];

    const target =
      linkedChannels[
        targetIndex
      ];

    try {
      const {
        error: currentError,
      } =
        await yuniverseSupabase
          .from(
            "channel_channels"
          )
          .update({
            position:
              targetIndex,
          })
          .eq(
            "id",
            current.id
          )
          .eq(
            "channel_v2i_user_id",
            channelUserId
          );

      if (currentError) {
        throw currentError;
      }

      const {
        error: targetError,
      } =
        await yuniverseSupabase
          .from(
            "channel_channels"
          )
          .update({
            position:
              index,
          })
          .eq(
            "id",
            target.id
          )
          .eq(
            "channel_v2i_user_id",
            channelUserId
          );

      if (targetError) {
        throw targetError;
      }

      await loadChannels();
    } catch (err) {
      console.error(
        "Move channel error:",
        err
      );

      setChannelsError(
        err?.message ||
          "Channel order update nahi hua."
      );
    }
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  function openVideo(video) {
    onNavigate(
      "watch",
      video
    );
  }

  function openPlaylistPage() {
    onNavigate("playlists", {
      channel_v2i_user_id:
        channelUserId,

      channel_id:
        channelUserId,

      v2i_user_id:
        channelUserId,

      name:
        getChannelName(),

      username: undefined,

      v2i_id: undefined,

      avatar_url:
        profile?.channel_avatar_url ||
        null,

      bio:
        profile?.channel_bio ||
        "",
    });
  }

  function openPlaylist(
    playlist
  ) {
    onNavigate("playlists", {
      playlistId:
        playlist.id,

      id: playlist.id,

      name:
        playlist.name,

      description:
        playlist.description,

      cover_url:
        playlist.cover_url,

      v2i_user_id:
        playlist.v2i_user_id,

      channel_v2i_user_id:
        channelUserId,

      channel_id:
        channelUserId,

      channel_name:
        getChannelName(),

      channel_username:
        undefined,

      channel_v2i_id:
        undefined,

      channel_avatar_url:
        profile?.channel_avatar_url ||
        null,
    });
  }

  function openLinkedChannel(
    item
  ) {
    const target =
      item?.profile;

    if (
      !target?.v2i_user_id
    ) {
      return;
    }

    onNavigate("channel", {
      id:
        target.v2i_user_id,

      v2i_user_id:
        target.v2i_user_id,

      user_id:
        target.v2i_user_id,

      name:
        target.channel_name ||
        "Yuniverse Creator",

      username: undefined,

      v2i_id: undefined,

      avatar_url:
        target.channel_avatar_url ||
        undefined,

      bio:
        target.channel_bio ||
        "",
    });
  }

  // =========================================================
  // HELPERS
  // =========================================================

  function getChannelName() {
    return (
      profile?.channel_name ||
      channel?.name ||
      "Yuniverse Creator"
    );
  }

  function getChannelAvatar() {
    return (
      profile?.channel_avatar_url ||
      channel?.avatar_url ||
      null
    );
  }

  function getChannelBio() {
    return (
      profile?.channel_bio ||
      channel?.bio ||
      ""
    );
  }

  function getAvatarLetter(
    name
  ) {
    return (
      name?.trim()
        ?.charAt(0)
        ?.toUpperCase() ||
      "Y"
    );
  }

  function formatViews(value) {
    const views = Number(
      value || 0
    );

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

  function formatTime(
    dateString
  ) {
    if (!dateString) {
      return "";
    }

    const createdAt =
      new Date(dateString);

    const now = new Date();

    const difference =
      Math.floor(
        (now.getTime() -
          createdAt.getTime()) /
          1000
      );

    if (difference < 60) {
      return "just now";
    }

    const minutes =
      Math.floor(
        difference / 60
      );

    if (minutes < 60) {
      return `${minutes} ${
        minutes === 1
          ? "minute"
          : "minutes"
      } ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours} ${
        hours === 1
          ? "hour"
          : "hours"
      } ago`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days < 30) {
      return `${days} ${
        days === 1
          ? "day"
          : "days"
      } ago`;
    }

    const months =
      Math.floor(
        days / 30
      );

    if (months < 12) {
      return `${months} ${
        months === 1
          ? "month"
          : "months"
      } ago`;
    }

    const years =
      Math.floor(
        months / 12
      );

    return `${years} ${
      years === 1
        ? "year"
        : "years"
    } ago`;
  }

  const totalViews =
    useMemo(() => {
      return videos.reduce(
        (total, video) =>
          total +
          Number(
            video.views || 0
          ),
        0
      );
    }, [videos]);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="channel-page">
        <div className="channel-loading">
          <div className="channel-spinner" />
          Channel load ho raha hai...
        </div>
      </div>
    );
  }

  const channelName =
    getChannelName();

  const channelAvatar =
    getChannelAvatar();

  const channelBio =
    getChannelBio();

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="channel-page">
      {/* TOP HEADER */}
      <header className="top-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="back-button"
            onClick={() => onNavigate("home")}
          >
            ←
          </button>
          <button
            type="button"
            className="logo-button"
            onClick={() => onNavigate("home")}
          >
            <span>Y</span>universe
          </button>
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={() => onNavigate("search")}
            aria-label="Search"
          >
            🔍
          </button>
        </div>
      </header>

      {/* CHANNEL HEADER */}
      <header className="channel-header">
        <div className="channel-header-inner">
          <div className="channel-avatar-large">
            {channelAvatar ? (
              <img
                src={channelAvatar}
                alt={channelName}
              />
            ) : (
              getAvatarLetter(
                channelName
              )
            )}
          </div>

          <div className="channel-header-info">
            <h1>
              {channelName}
            </h1>

            {channelBio && (
              <p className="channel-bio">
                {channelBio}
              </p>
            )}
          </div>

          {isOwnChannel && (
            <button
              type="button"
              className="channel-edit-button"
              onClick={() =>
                onNavigate(
                  "edit-channel",
                  {
                    profile,
                  }
                )
              }
            >
              Edit
            </button>
          )}
        </div>
      </header>

      {/* TABS */}

      <nav className="channel-tabs">
        <button
          type="button"
          className={`channel-tab ${
            activeTab === "videos"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab(
              "videos"
            )
          }
        >
          Videos
        </button>

        <button
          type="button"
          className={`channel-tab ${
            activeTab === "playlist"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveTab(
              "playlist"
            );

            openPlaylistPage();
          }}
        >
          Playlist
        </button>

        <button
          type="button"
          className={`channel-tab ${
            activeTab === "channels"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveTab(
              "channels"
            );

            loadChannels();
          }}
        >
          Channels
        </button>

        <button
          type="button"
          className={`channel-tab ${
            activeTab === "about"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab(
              "about"
            )
          }
        >
          About
        </button>
      </nav>

      {/* CONTENT */}

      <main className="channel-content">
        {error && (
          <div className="channel-error">
            {error}
          </div>
        )}

        {/* VIDEOS */}

        {activeTab ===
          "videos" && (
          <section>
            <div className="channel-section-header">
              <div>
                <h2>
                  Videos
                </h2>

                <p>
                  {videos.length}{" "}
                  videos •{" "}
                  {formatViews(
                    totalViews
                  )}
                </p>
              </div>
            </div>

            {videos.length ===
            0 ? (
              <div className="channel-empty-state">
                <div className="channel-empty-icon">
                  ▶
                </div>

                <h3>
                  Abhi koi video nahi hai
                </h3>

                <p>
                  Is channel par
                  abhi koi video
                  upload nahi hua.
                </p>
              </div>
            ) : (
              <div className="video-grid">
                {videos.map(
                  (video) => (
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
                        <div className="channel-avatar">
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
                            getAvatarLetter(
                              channelName
                            )
                          )}
                        </div>

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
                            type="button"
                            className="video-channel-name"
                            onClick={() =>
                              openChannel()
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
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* PLAYLIST */}

        {activeTab ===
          "playlist" && (
          <section>
            <div className="channel-section-header">
              <div>
                <h2>
                  Playlist
                </h2>

                <p>
                  {playlists.length}{" "}
                  playlists
                </p>
              </div>

              <button
                type="button"
                onClick={
                  openPlaylistPage
                }
              >
                Open Playlist
              </button>
            </div>

            {playlists.length ===
            0 ? (
              <div className="channel-empty-state">
                <div className="channel-empty-icon">
                  ☰
                </div>

                <h3>
                  Abhi koi playlist nahi hai
                </h3>

                <p>
                  Is channel par
                  abhi koi playlist
                  available nahi hai.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    openPlaylistPage
                  }
                >
                  Open Playlist
                </button>
              </div>
            ) : (
              <div className="video-grid">
                {playlists.map(
                  (playlist) => (
                    <article
                      className="video-card"
                      key={
                        playlist.id
                      }
                      onClick={() =>
                        openPlaylist(
                          playlist
                        )
                      }
                    >
                      <div className="video-thumbnail">
                        {playlist.coverUrl ? (
                          <img
                            src={
                              playlist.coverUrl
                            }
                            alt={
                              playlist.name
                            }
                            loading="lazy"
                          />
                        ) : (
                          <div className="thumbnail-placeholder">
                            <span>
                              ☰
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="video-info">
                        <div className="channel-avatar">
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
                            getAvatarLetter(
                              channelName
                            )
                          )}
                        </div>

                        <div className="video-text">
                          <h3>
                            {
                              playlist.name
                            }
                          </h3>

                          <button
                            type="button"
                            className="video-channel-name"
                            onClick={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
                          >
                            {
                              channelName
                            }
                          </button>

                          <small>
                            Playlist
                          </small>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* CHANNELS */}

        {activeTab ===
          "channels" && (
          <section className="channels-tab-content">
            <div className="channels-toolbar">
              <div className="channels-toolbar-title">
                <h2>
                  Channels
                </h2>

                <p>
                  {
                    linkedChannels.length
                  }{" "}
                  {linkedChannels.length ===
                  1
                    ? "linked channel"
                    : "linked channels"}
                </p>
              </div>

              {isOwnChannel && (
                <button
                  type="button"
                  className="add-channel-button"
                  onClick={() => {
                    setShowAddChannel(
                      (value) =>
                        !value
                    );

                    setChannelSearch(
                      ""
                    );

                    setSearchResults(
                      []
                    );

                    setChannelsError(
                      ""
                    );
                  }}
                >
                  {showAddChannel
                    ? "Close"
                    : "+ Add Channel"}
                </button>
              )}
            </div>

            {/* ADD CHANNEL */}

            {isOwnChannel &&
              showAddChannel && (
                <div className="add-channel-panel">
                  <div className="add-channel-search">
                    <input
                      type="text"
                      value={
                        channelSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setChannelSearch(
                          event
                            .target
                            .value
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          searchChannels();
                        }
                      }}
                      placeholder="Search Yuniverse channel by name"
                    />

                    <button
                      type="button"
                      onClick={
                        searchChannels
                      }
                      disabled={
                        searchingChannels ||
                        savingChannel
                      }
                    >
                      {searchingChannels
                        ? "Searching..."
                        : "Search"}
                    </button>
                  </div>

                  {searchResults.length >
                    0 && (
                    <div className="channel-search-results">
                      {searchResults.map(
                        (
                          result
                        ) => {
                          const resultName =
                            result.channel_name ||
                            "Yuniverse Creator";

                          return (
                            <button
                              type="button"
                              className="channel-search-result"
                              key={
                                result.v2i_user_id
                              }
                              onClick={() =>
                                addChannel(
                                  result
                                )
                              }
                              disabled={
                                savingChannel
                              }
                            >
                              <div className="channel-search-avatar">
                                {result.channel_avatar_url ? (
                                  <img
                                    src={
                                      result.channel_avatar_url
                                    }
                                    alt={
                                      resultName
                                    }
                                  />
                                ) : (
                                  getAvatarLetter(
                                    resultName
                                  )
                                )}
                              </div>

                              <div className="channel-search-info">
                                <strong>
                                  {
                                    resultName
                                  }
                                </strong>

                                {result.channel_bio && (
                                  <span>
                                    {
                                      result.channel_bio
                                    }
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {!searchingChannels &&
                    channelSearch.trim() &&
                    searchResults.length ===
                      0 && (
                      <div
                        style={{
                          padding:
                            "16px 4px 2px",
                          color:
                            "#777",
                          fontSize:
                            "13px",
                        }}
                      >
                        Koi Yuniverse
                        channel nahi
                        mila.
                      </div>
                    )}
                </div>
              )}

            {channelsError && (
              <div className="channel-error">
                {channelsError}
              </div>
            )}

            {channelsLoading ? (
              <div className="channel-loading">
                <div className="channel-spinner" />
                Channels load ho rahe hain...
              </div>
            ) : linkedChannels.length ===
              0 ? (
              <div className="channel-empty-state">
                <div className="channel-empty-icon">
                  ◉
                </div>

                <h3>
                  Abhi koi channel nahi hai
                </h3>

                <p>
                  {isOwnChannel
                    ? "Apni Channels list mein channels add karo."
                    : "Is channel ne abhi koi channel add nahi kiya."}
                </p>
              </div>
            ) : (
              <div className="linked-channels-grid">
                {linkedChannels.map(
                  (
                    item,
                    index
                  ) => {
                    const target =
                      item.profile;

                    const targetName =
                      target.channel_name ||
                      "Yuniverse Creator";

                    return (
                      <article
                        className="linked-channel-card"
                        key={
                          item.id
                        }
                      >
                        <div
                          className="linked-channel-main"
                          onClick={() =>
                            openLinkedChannel(
                              item
                            )
                          }
                        >
                          <div className="linked-channel-avatar">
                            {target.channel_avatar_url ? (
                              <img
                                src={
                                  target.channel_avatar_url
                                }
                                alt={
                                  targetName
                                }
                              />
                            ) : (
                              getAvatarLetter(
                                targetName
                              )
                            )}
                          </div>

                          <div className="linked-channel-info">
                            <h3>
                              {
                                targetName
                              }
                            </h3>

                            {target.channel_bio && (
                              <p>
                                {
                                  target.channel_bio
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        {isOwnChannel && (
                          <div className="linked-channel-actions">
                            <button
                              type="button"
                              className="channel-action-button"
                              title="Move up"
                              onClick={() =>
                                moveChannel(
                                  index,
                                  "up"
                                )
                              }
                              disabled={
                                index ===
                                0
                              }
                            >
                              ↑
                            </button>

                            <button
                              type="button"
                              className="channel-action-button"
                              title="Move down"
                              onClick={() =>
                                moveChannel(
                                  index,
                                  "down"
                                )
                              }
                              disabled={
                                index ===
                                linkedChannels.length -
                                  1
                              }
                            >
                              ↓
                            </button>

                            <button
                              type="button"
                              className="channel-action-button remove"
                              title="Remove channel"
                              onClick={() =>
                                removeChannel(
                                  item.id
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {/* ABOUT */}

        {activeTab ===
          "about" && (
          <section className="channel-about">
            <div className="channel-section-header">
              <div>
                <h2>
                  About
                </h2>

                <p>
                  Channel information
                </p>
              </div>
            </div>

            <div className="channel-about-block">
              <h3>
                Description
              </h3>

              <p>
                {channelBio ||
                  "Is channel ke liye abhi koi description available nahi hai."}
              </p>
            </div>

            <div className="channel-about-block">
              <h3>
                Videos
              </h3>

              <p>
                {videos.length}{" "}
                videos
              </p>
            </div>

            <div className="channel-about-block">
              <h3>
                Playlists
              </h3>

              <p>
                {playlists.length}{" "}
                playlists
              </p>
            </div>

            <div className="channel-about-block">
              <h3>
                Channels
              </h3>

              <p>
                {
                  linkedChannels.length
                }{" "}
                linked channels
              </p>
            </div>
          </section>
        )}
      </main>

      {/* BOTTOM NAV */}
      <BottomNav activePage="channel" onNavigate={onNavigate} />
    </div>
  );
}