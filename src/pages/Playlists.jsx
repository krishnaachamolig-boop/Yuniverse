import React, {
    useCallback,
    useEffect,
    useState,
  } from "react";
  
  import { yuniverseSupabase } from "../lib/yuniverseSupabase";
  
  export default function Playlists({
    user,
    onNavigate,
  }) {
    const currentUserId =
      user?.id ||
      user?.authUser?.id ||
      user?.profile?.id ||
      null;
  
    const [playlists, setPlaylists] = useState([]);
    const [videos, setVideos] = useState([]);
  
    const [selectedPlaylist, setSelectedPlaylist] =
      useState(null);
  
    const [playlistVideos, setPlaylistVideos] =
      useState([]);
  
    const [loading, setLoading] = useState(true);
    const [playlistLoading, setPlaylistLoading] =
      useState(false);
  
    const [showCreate, setShowCreate] =
      useState(false);
  
    const [showAddVideos, setShowAddVideos] =
      useState(false);
  
    const [editing, setEditing] =
      useState(false);
  
    const [name, setName] = useState("");
    const [description, setDescription] =
      useState("");
  
    const [coverFile, setCoverFile] =
      useState(null);
  
    const [coverPreview, setCoverPreview] =
      useState("");
  
    const [removeCustomCover, setRemoveCustomCover] =
      useState(false);
  
    const [saving, setSaving] =
      useState(false);
  
    const [error, setError] =
      useState("");
  
    const [selectedVideoIds, setSelectedVideoIds] =
      useState([]);
  
    /* =====================================================
       HELPERS
       ===================================================== */
  
    function formatNumber(value) {
      const number = Number(value || 0);
  
      if (number >= 1000000000) {
        return `${(number / 1000000000)
          .toFixed(1)
          .replace(".0", "")}B`;
      }
  
      if (number >= 1000000) {
        return `${(number / 1000000)
          .toFixed(1)
          .replace(".0", "")}M`;
      }
  
      if (number >= 1000) {
        return `${(number / 1000)
          .toFixed(1)
          .replace(".0", "")}K`;
      }
  
      return number.toString();
    }
  
    function getVideoThumbnail(video) {
      if (!video) {
        return null;
      }
  
      return (
        video.thumbnailUrl ||
        video.thumbnail_url ||
        (video.mux_playback_id
          ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
          : null)
      );
    }
  
    function getPlaylistCover(playlist) {
      if (playlist?.cover_url) {
        return playlist.cover_url;
      }
  
      if (playlist?.firstVideoThumbnail) {
        return playlist.firstVideoThumbnail;
      }
  
      return null;
    }
  
    function getFileExtension(file) {
      if (!file?.name) {
        return "jpg";
      }
  
      const extension =
        file.name.split(".").pop()?.toLowerCase();
  
      if (
        extension === "png" ||
        extension === "jpg" ||
        extension === "jpeg" ||
        extension === "webp"
      ) {
        return extension;
      }
  
      return "jpg";
    }
  
    /* =====================================================
       LOAD VIDEOS
       ===================================================== */
  
    const loadVideos = useCallback(async () => {
      if (!currentUserId) {
        return;
      }
  
      try {
        const {
          data,
          error: videosError,
        } = await yuniverseSupabase
          .from("videos")
          .select(`
            id,
            v2i_user_id,
            title,
            description,
            thumbnail_url,
            video_url,
            mux_playback_id,
            duration,
            width,
            height,
            views,
            status,
            created_at
          `)
          .eq("status", "ready")
          .not(
            "mux_playback_id",
            "is",
            null
          )
          .order("created_at", {
            ascending: false,
          });
  
        if (videosError) {
          throw videosError;
        }
  
        const validVideos =
          (data || []).filter((video) => {
            const width = Number(
              video.width || 0
            );
  
            const height = Number(
              video.height || 0
            );
  
            if (!width || !height) {
              return true;
            }
  
            if (width <= height) {
              return false;
            }
  
            const ratio =
              width / height;
  
            return (
              Math.abs(
                ratio - 16 / 9
              ) <= 0.08
            );
          });
  
        setVideos(
          validVideos.map((video) => ({
            ...video,
  
            thumbnailUrl:
              getVideoThumbnail(video),
  
            playbackUrl:
              video.mux_playback_id
                ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
                : video.video_url,
          }))
        );
      } catch (err) {
        console.error(
          "Playlist videos load error:",
          err
        );
      }
    }, [currentUserId]);
  
    /* =====================================================
       LOAD PLAYLISTS
       ===================================================== */
  
    const loadPlaylists =
      useCallback(async () => {
        if (!currentUserId) {
          setError("User ID missing.");
          setLoading(false);
          return;
        }
  
        setLoading(true);
        setError("");
  
        try {
          const {
            data: playlistData,
            error: playlistError,
          } =
            await yuniverseSupabase
              .from("playlists")
              .select(`
                id,
                v2i_user_id,
                name,
                description,
                visibility,
                cover_url,
                created_at,
                updated_at
              `)
              .eq(
                "v2i_user_id",
                currentUserId
              )
              .order("created_at", {
                ascending: false,
              });
  
          if (playlistError) {
            throw playlistError;
          }
  
          const playlistsData =
            playlistData || [];
  
          if (
            playlistsData.length ===
            0
          ) {
            setPlaylists([]);
            return;
          }
  
          const playlistIds =
            playlistsData.map(
              (playlist) =>
                playlist.id
            );
  
          const {
            data: playlistVideoData,
            error:
              playlistVideoError,
          } =
            await yuniverseSupabase
              .from("playlist_videos")
              .select(`
                playlist_id,
                video_id,
                position
              `)
              .in(
                "playlist_id",
                playlistIds
              )
              .order("position", {
                ascending: true,
              });
  
          if (playlistVideoError) {
            console.error(
              "Playlist videos metadata error:",
              playlistVideoError
            );
          }
  
          const videoIds = [
            ...new Set(
              (playlistVideoData || [])
                .map(
                  (item) =>
                    item.video_id
                )
                .filter(Boolean)
            ),
          ];
  
          let videoMap = new Map();
  
          if (videoIds.length > 0) {
            const {
              data: firstVideos,
              error: firstVideosError,
            } =
              await yuniverseSupabase
                .from("videos")
                .select(`
                  id,
                  thumbnail_url,
                  mux_playback_id
                `)
                .in(
                  "id",
                  videoIds
                );
  
            if (firstVideosError) {
              console.error(
                "Playlist thumbnails error:",
                firstVideosError
              );
            } else {
              videoMap =
                new Map(
                  (firstVideos || []).map(
                    (video) => [
                      video.id,
                      video,
                    ]
                  )
                );
            }
          }
  
          const countMap =
            new Map();
  
          const firstVideoMap =
            new Map();
  
          (
            playlistVideoData ||
            []
          ).forEach((item) => {
            countMap.set(
              item.playlist_id,
              (countMap.get(
                item.playlist_id
              ) || 0) + 1
            );
  
            if (
              !firstVideoMap.has(
                item.playlist_id
              )
            ) {
              firstVideoMap.set(
                item.playlist_id,
                item.video_id
              );
            }
          });
  
          const formattedPlaylists =
            playlistsData.map(
              (playlist) => {
                const firstVideoId =
                  firstVideoMap.get(
                    playlist.id
                  );
  
                const firstVideo =
                  firstVideoId
                    ? videoMap.get(
                        firstVideoId
                      )
                    : null;
  
                return {
                  ...playlist,
  
                  videoCount:
                    countMap.get(
                      playlist.id
                    ) || 0,
  
                  firstVideoThumbnail:
                    firstVideo
                      ? getVideoThumbnail(
                          firstVideo
                        )
                      : null,
                };
              }
            );
  
          setPlaylists(
            formattedPlaylists
          );
        } catch (err) {
          console.error(
            "Playlists load error:",
            err
          );
  
          setError(
            err?.message ||
              "Playlists load nahi ho paayi."
          );
        } finally {
          setLoading(false);
        }
      }, [currentUserId]);
  
    useEffect(() => {
      loadPlaylists();
      loadVideos();
    }, [
      loadPlaylists,
      loadVideos,
    ]);
  
    /* =====================================================
       COVER FILE
       ===================================================== */
  
    function handleCoverChange(
      event
    ) {
      const file =
        event.target.files?.[0];
  
      if (!file) {
        return;
      }
  
      if (
        !file.type.startsWith(
          "image/"
        )
      ) {
        alert(
          "Please select an image file."
        );
  
        event.target.value = "";
        return;
      }
  
      if (
        file.size >
        10 * 1024 * 1024
      ) {
        alert(
          "Playlist cover 10MB se chhoti honi chahiye."
        );
  
        event.target.value = "";
        return;
      }
  
      setCoverFile(file);
      setCoverPreview(
        URL.createObjectURL(file)
      );
  
      setRemoveCustomCover(
        false
      );
    }
  
    function clearCoverSelection() {
      setCoverFile(null);
      setCoverPreview("");
    }
  
    /* =====================================================
       CREATE PLAYLIST
       ===================================================== */
  
    async function createPlaylist(
      event
    ) {
      event.preventDefault();
  
      if (
        !currentUserId ||
        !name.trim() ||
        saving
      ) {
        return;
      }
  
      setSaving(true);
      setError("");
  
      try {
        /*
         * First create playlist.
         */
  
        const {
          data: playlist,
          error: playlistError,
        } =
          await yuniverseSupabase
            .from("playlists")
            .insert({
              v2i_user_id:
                currentUserId,
  
              name:
                name.trim(),
  
              description:
                description.trim(),
  
              visibility:
                "public",
  
              cover_url:
                null,
            })
            .select()
            .single();
  
        if (playlistError) {
          throw playlistError;
        }
  
        /*
         * Upload custom cover if user selected one.
         */
  
        let uploadedCoverUrl =
          null;
  
        if (coverFile) {
          const extension =
            getFileExtension(
              coverFile
            );
  
          const filePath =
            `playlist-covers/${currentUserId}/${playlist.id}.${extension}`;
  
          const {
            error:
              coverUploadError,
          } =
            await yuniverseSupabase.storage
              .from(
                "yuniverse-media"
              )
              .upload(
                filePath,
                coverFile,
                {
                  upsert: true,
                  contentType:
                    coverFile.type,
                }
              );
  
          if (
            coverUploadError
          ) {
            throw coverUploadError;
          }
  
          const {
            data:
              publicUrlData,
          } =
            yuniverseSupabase.storage
              .from(
                "yuniverse-media"
              )
              .getPublicUrl(
                filePath
              );
  
          uploadedCoverUrl =
            publicUrlData?.publicUrl ||
            null;
        }
  
        /*
         * Add selected videos.
         */
  
        if (
          selectedVideoIds.length >
          0
        ) {
          const rows =
            selectedVideoIds.map(
              (
                videoId,
                index
              ) => ({
                playlist_id:
                  playlist.id,
  
                video_id:
                  videoId,
  
                position:
                  index,
              })
            );
  
          const {
            error:
              playlistVideoError,
          } =
            await yuniverseSupabase
              .from(
                "playlist_videos"
              )
              .insert(rows);
  
          if (
            playlistVideoError
          ) {
            throw playlistVideoError;
          }
        }
  
        /*
         * If no custom cover was selected,
         * cover_url remains NULL.
         *
         * UI automatically uses first
         * selected video's thumbnail.
         */
  
        if (uploadedCoverUrl) {
          const {
            error:
              coverUpdateError,
          } =
            await yuniverseSupabase
              .from("playlists")
              .update({
                cover_url:
                  uploadedCoverUrl,
  
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                playlist.id
              );
  
          if (
            coverUpdateError
          ) {
            throw coverUpdateError;
          }
        }
  
        /*
         * Reset form.
         */
  
        setName("");
        setDescription("");
  
        clearCoverSelection();
  
        setSelectedVideoIds([]);
  
        setShowCreate(false);
  
        await loadPlaylists();
  
        /*
         * Open newly created playlist.
         */
  
        const firstSelectedVideo =
          selectedVideoIds.length >
          0
            ? videos.find(
                (video) =>
                  video.id ===
                  selectedVideoIds[0]
              )
            : null;
  
        const createdPlaylist = {
          ...playlist,
  
          cover_url:
            uploadedCoverUrl,
  
          videoCount:
            selectedVideoIds.length,
  
          firstVideoThumbnail:
            firstSelectedVideo
              ? getVideoThumbnail(
                  firstSelectedVideo
                )
              : null,
        };
  
        await openPlaylist(
          createdPlaylist
        );
      } catch (err) {
        console.error(
          "Create playlist error:",
          err
        );
  
        setError(
          err?.message ||
            "Playlist create nahi ho paayi."
        );
      } finally {
        setSaving(false);
      }
    }
  
    /* =====================================================
       SELECT VIDEOS
       ===================================================== */
  
    function toggleVideo(
      videoId
    ) {
      setSelectedVideoIds(
        (previous) =>
          previous.includes(
            videoId
          )
            ? previous.filter(
                (id) =>
                  id !==
                  videoId
              )
            : [
                ...previous,
                videoId,
              ]
      );
    }
  
    /* =====================================================
       OPEN PLAYLIST
       ===================================================== */
  
    async function openPlaylist(
      playlist
    ) {
      setSelectedPlaylist(
        playlist
      );
  
      setPlaylistLoading(
        true
      );
  
      setError("");
  
      try {
        const {
          data,
          error:
            playlistVideosError,
        } =
          await yuniverseSupabase
            .from(
              "playlist_videos"
            )
            .select(`
              id,
              playlist_id,
              video_id,
              position,
              added_at
            `)
            .eq(
              "playlist_id",
              playlist.id
            )
            .order(
              "position",
              {
                ascending: true,
              }
            )
            .order(
              "added_at",
              {
                ascending: true,
              }
            );
  
        if (
          playlistVideosError
        ) {
          throw playlistVideosError;
        }
  
        const videoIds =
          (data || []).map(
            (item) =>
              item.video_id
          );
  
        if (
          videoIds.length ===
          0
        ) {
          setPlaylistVideos(
            []
          );
  
          return;
        }
  
        const {
          data: videoData,
          error:
            videoError,
        } =
          await yuniverseSupabase
            .from("videos")
            .select(`
              id,
              v2i_user_id,
              title,
              description,
              thumbnail_url,
              video_url,
              mux_playback_id,
              duration,
              width,
              height,
              views,
              status,
              created_at
            `)
            .in(
              "id",
              videoIds
            )
            .eq(
              "status",
              "ready"
            );
  
        if (videoError) {
          throw videoError;
        }
  
        const videoMap =
          new Map(
            (videoData || []).map(
              (video) => [
                video.id,
                video,
              ]
            )
          );
  
        const merged =
          (data || [])
            .map(
              (item) => {
                const video =
                  videoMap.get(
                    item.video_id
                  );
  
                if (!video) {
                  return null;
                }
  
                return {
                  ...item,
  
                  video: {
                    ...video,
  
                    thumbnailUrl:
                      getVideoThumbnail(
                        video
                      ),
  
                    playbackUrl:
                      video.mux_playback_id
                        ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
                        : video.video_url,
                  },
                };
              }
            )
            .filter(Boolean);
  
        setPlaylistVideos(
          merged
        );
  
        /*
         * If custom cover doesn't exist,
         * update local fallback from first video.
         */
  
        if (
          !playlist.cover_url &&
          merged.length > 0
        ) {
          setSelectedPlaylist(
            (previous) => ({
              ...previous,
  
              firstVideoThumbnail:
                getVideoThumbnail(
                  merged[0].video
                ),
            })
          );
        }
      } catch (err) {
        console.error(
          "Playlist open error:",
          err
        );
  
        setError(
          err?.message ||
            "Playlist load nahi ho paayi."
        );
      } finally {
        setPlaylistLoading(
          false
        );
      }
    }
  
    /* =====================================================
       ADD VIDEOS
       ===================================================== */
  
    async function addVideosToPlaylist() {
      if (
        !selectedPlaylist ||
        selectedVideoIds.length ===
          0
      ) {
        return;
      }
  
      setSaving(true);
      setError("");
  
      try {
        const existingIds =
          playlistVideos.map(
            (item) =>
              item.video_id
          );
  
        const newIds =
          selectedVideoIds.filter(
            (id) =>
              !existingIds.includes(
                id
              )
          );
  
        if (
          newIds.length === 0
        ) {
          setShowAddVideos(
            false
          );
  
          setSelectedVideoIds(
            []
          );
  
          return;
        }
  
        const startPosition =
          playlistVideos.length;
  
        const rows =
          newIds.map(
            (
              videoId,
              index
            ) => ({
              playlist_id:
                selectedPlaylist.id,
  
              video_id:
                videoId,
  
              position:
                startPosition +
                index,
            })
          );
  
        const {
          error: insertError,
        } =
          await yuniverseSupabase
            .from(
              "playlist_videos"
            )
            .insert(rows);
  
        if (insertError) {
          throw insertError;
        }
  
        setShowAddVideos(
          false
        );
  
        setSelectedVideoIds(
          []
        );
  
        await openPlaylist(
          selectedPlaylist
        );
  
        await loadPlaylists();
      } catch (err) {
        console.error(
          "Add playlist videos error:",
          err
        );
  
        setError(
          err?.message ||
            "Videos add nahi ho paaye."
        );
      } finally {
        setSaving(false);
      }
    }
  
    /* =====================================================
       REMOVE VIDEO
       ===================================================== */
  
    async function removeVideo(
      playlistVideoId
    ) {
      const {
        error: deleteError,
      } =
        await yuniverseSupabase
          .from(
            "playlist_videos"
          )
          .delete()
          .eq(
            "id",
            playlistVideoId
          );
  
      if (deleteError) {
        alert(
          deleteError.message
        );
  
        return;
      }
  
      const updated =
        playlistVideos.filter(
          (item) =>
            item.id !==
            playlistVideoId
        );
  
      setPlaylistVideos(
        updated
      );
  
      await saveOrder(
        updated
      );
  
      await loadPlaylists();
  
      /*
       * Refresh selected playlist fallback cover.
       */
  
      const refreshed =
        playlists.find(
          (item) =>
            item.id ===
            selectedPlaylist?.id
        );
  
      if (refreshed) {
        setSelectedPlaylist(
          refreshed
        );
      }
    }
  
    /* =====================================================
       REORDER
       * ===================================================== */
  
    async function moveVideo(
      index,
      direction
    ) {
      const newIndex =
        index + direction;
  
      if (
        newIndex < 0 ||
        newIndex >=
          playlistVideos.length
      ) {
        return;
      }
  
      const updated =
        [...playlistVideos];
  
      const [
        movedVideo,
      ] =
        updated.splice(
          index,
          1
        );
  
      updated.splice(
        newIndex,
        0,
        movedVideo
      );
  
      setPlaylistVideos(
        updated
      );
  
      await saveOrder(
        updated
      );
    }
  
    async function saveOrder(
      items
    ) {
      try {
        for (
          let index = 0;
          index < items.length;
          index++
        ) {
          const item =
            items[index];
  
          const {
            error:
              updateError,
          } =
            await yuniverseSupabase
              .from(
                "playlist_videos"
              )
              .update({
                position:
                  index,
              })
              .eq(
                "id",
                item.id
              );
  
          if (
            updateError
          ) {
            throw updateError;
          }
        }
      } catch (err) {
        console.error(
          "Playlist order error:",
          err
        );
  
        alert(
          "Playlist order save nahi hua."
        );
      }
    }
  
    /* =====================================================
       EDIT PLAYLIST
       ===================================================== */
  
    function startEditing() {
      if (
        !selectedPlaylist
      ) {
        return;
      }
  
      setName(
        selectedPlaylist.name ||
          ""
      );
  
      setDescription(
        selectedPlaylist.description ||
          ""
      );
  
      setCoverFile(
        null
      );
  
      setCoverPreview(
        selectedPlaylist.cover_url ||
          ""
      );
  
      setRemoveCustomCover(
        false
      );
  
      setEditing(
        true
      );
    }
  
    async function savePlaylistDetails(
      event
    ) {
      event.preventDefault();
  
      if (
        !selectedPlaylist ||
        !name.trim() ||
        saving
      ) {
        return;
      }
  
      setSaving(true);
      setError("");
  
      try {
        let newCoverUrl =
          selectedPlaylist.cover_url ||
          null;
  
        /*
         * Remove old custom cover.
         */
  
        if (
          removeCustomCover
        ) {
          newCoverUrl = null;
        }
  
        /*
         * Upload new custom cover.
         */
  
        if (coverFile) {
          const extension =
            getFileExtension(
              coverFile
            );
  
          const filePath =
            `playlist-covers/${currentUserId}/${selectedPlaylist.id}.${extension}`;
  
          const {
            error:
              coverUploadError,
          } =
            await yuniverseSupabase.storage
              .from(
                "yuniverse-media"
              )
              .upload(
                filePath,
                coverFile,
                {
                  upsert: true,
                  contentType:
                    coverFile.type,
                }
              );
  
          if (
            coverUploadError
          ) {
            throw coverUploadError;
          }
  
          const {
            data:
              publicUrlData,
          } =
            yuniverseSupabase.storage
              .from(
                "yuniverse-media"
              )
              .getPublicUrl(
                filePath
              );
  
          newCoverUrl =
            publicUrlData?.publicUrl ||
            null;
        }
  
        const {
          data,
          error:
            updateError,
        } =
          await yuniverseSupabase
            .from("playlists")
            .update({
              name:
                name.trim(),
  
              description:
                description.trim(),
  
              cover_url:
                newCoverUrl,
  
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              selectedPlaylist.id
            )
            .select()
            .single();
  
        if (updateError) {
          throw updateError;
        }
  
        setSelectedPlaylist(
          (previous) => ({
            ...previous,
  
            ...data,
  
            firstVideoThumbnail:
              previous?.firstVideoThumbnail ||
              null,
          })
        );
  
        setEditing(
          false
        );
  
        setCoverFile(
          null
        );
  
        setCoverPreview(
          ""
        );
  
        setRemoveCustomCover(
          false
        );
  
        await loadPlaylists();
      } catch (err) {
        console.error(
          "Playlist update error:",
          err
        );
  
        setError(
          err?.message ||
            "Playlist update nahi hui."
        );
      } finally {
        setSaving(false);
      }
    }
  
    /* =====================================================
       DELETE PLAYLIST
       ===================================================== */
  
    async function deletePlaylist() {
      if (
        !selectedPlaylist
      ) {
        return;
      }
  
      const confirmed =
        window.confirm(
          `Delete "${selectedPlaylist.name}" playlist?`
        );
  
      if (!confirmed) {
        return;
      }
  
      const {
        error: deleteError,
      } =
        await yuniverseSupabase
          .from("playlists")
          .delete()
          .eq(
            "id",
            selectedPlaylist.id
          );
  
      if (deleteError) {
        alert(
          deleteError.message
        );
  
        return;
      }
  
      setSelectedPlaylist(
        null
      );
  
      setPlaylistVideos(
        []
      );
  
      setEditing(
        false
      );
  
      await loadPlaylists();
    }
  
    /* =====================================================
       OPEN VIDEO
       ===================================================== */
  
    function openVideo(
      video
    ) {
      if (!video) {
        return;
      }
  
      onNavigate(
        "watch",
        {
          ...video,
  
          playbackUrl:
            video.mux_playback_id
              ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
              : video.video_url,
  
          thumbnailUrl:
            getVideoThumbnail(
              video
            ),
  
          channel: {
            id:
              video.v2i_user_id,
  
            v2i_user_id:
              video.v2i_user_id,
          },
        }
      );
    }
  
    /* =====================================================
       LOADING
       ===================================================== */
  
    if (loading) {
      return (
        <div className="app-page">
          <header className="top-header">
            <button
              className="back-button"
              onClick={() =>
                onNavigate(
                  "profile"
                )
              }
            >
              ←
            </button>
  
            <h2>
              Playlists
            </h2>
  
            <div />
          </header>
  
          <main className="page-content">
            <div className="empty-state">
              <div className="loading-spinner" />
  
              <p>
                Playlists load ho rahi hain...
              </p>
            </div>
          </main>
        </div>
      );
    }
  
    /* =====================================================
       PLAYLIST DETAIL
       ===================================================== */
  
    if (selectedPlaylist) {
      const detailCover =
        selectedPlaylist.cover_url ||
        selectedPlaylist.firstVideoThumbnail ||
        (playlistVideos.length > 0
          ? getVideoThumbnail(
              playlistVideos[0].video
            )
          : null);
  
      return (
        <div className="app-page">
          <header className="top-header">
            <button
              className="back-button"
              onClick={() => {
                setSelectedPlaylist(
                  null
                );
  
                setPlaylistVideos(
                  []
                );
  
                setEditing(
                  false
                );
  
                setShowAddVideos(
                  false
                );
              }}
            >
              ←
            </button>
  
            <h2>
              {selectedPlaylist.name}
            </h2>
  
            <div className="header-actions">
              <button
                onClick={
                  startEditing
                }
                title="Edit playlist"
              >
                ✏️
              </button>
            </div>
          </header>
  
          <main className="page-content">
            {error && (
              <div className="edit-channel-message error">
                {error}
              </div>
            )}
  
            {editing ? (
              <section className="playlist-create-card">
                <div className="section-heading">
                  <h2>
                    Edit playlist
                  </h2>
  
                  <button
                    onClick={() => {
                      setEditing(
                        false
                      );
  
                      setCoverFile(
                        null
                      );
  
                      setCoverPreview(
                        ""
                      );
                    }}
                  >
                    ✕
                  </button>
                </div>
  
                <form
                  onSubmit={
                    savePlaylistDetails
                  }
                >
                  <div className="edit-field">
                    <label>
                      Playlist name
                    </label>
  
                    <input
                      value={name}
                      onChange={(
                        event
                      ) =>
                        setName(
                          event.target
                            .value
                        )
                      }
                      maxLength={100}
                      required
                    />
                  </div>
  
                  <div className="edit-field">
                    <label>
                      Description
                    </label>
  
                    <textarea
                      value={
                        description
                      }
                      onChange={(
                        event
                      ) =>
                        setDescription(
                          event.target
                            .value
                        )
                      }
                      rows={5}
                      maxLength={500}
                    />
                  </div>
  
                  <div className="edit-field">
                    <label>
                      Playlist cover
                    </label>
  
                    <div className="playlist-cover-upload">
                      <div className="playlist-cover-preview">
                        {coverPreview ? (
                          <img
                            src={
                              coverPreview
                            }
                            alt="Playlist cover"
                          />
                        ) : (
                          <div className="playlist-cover-preview-empty">
                            <span>
                              🖼️
                            </span>
  
                            <small>
                              First video thumbnail
                              will be used
                            </small>
                          </div>
                        )}
                      </div>
  
                      <div className="playlist-cover-upload-controls">
                        <label className="playlist-cover-upload-button">
                          🖼️ Choose new cover
  
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={
                              handleCoverChange
                            }
                          />
                        </label>
  
                        {selectedPlaylist.cover_url &&
                          !coverFile && (
                            <button
                              type="button"
                              className="playlist-cover-remove"
                              onClick={() => {
                                setRemoveCustomCover(
                                  true
                                );
  
                                setCoverFile(
                                  null
                                );
  
                                setCoverPreview(
                                  ""
                                );
                              }}
                            >
                              Remove custom cover
                            </button>
                          )}
  
                        {coverFile && (
                          <button
                            type="button"
                            className="playlist-cover-remove"
                            onClick={
                              clearCoverSelection
                            }
                          >
                            Cancel new cover
                          </button>
                        )}
  
                        <small>
                          Cover optional hai.
                          Remove karne par first
                          video ka thumbnail use hoga.
                        </small>
                      </div>
                    </div>
                  </div>
  
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </form>
              </section>
            ) : (
              <>
                <section className="playlist-detail-header">
                  <div className="playlist-detail-cover">
                    {detailCover ? (
                      <img
                        src={
                          detailCover
                        }
                        alt={
                          selectedPlaylist.name
                        }
                      />
                    ) : (
                      <span>
                        ▶
                      </span>
                    )}
                  </div>
  
                  <div className="playlist-detail-info">
                    <h1>
                      {
                        selectedPlaylist.name
                      }
                    </h1>
  
                    <p>
                      {
                        selectedPlaylist
                          .description ||
                        "No description"
                      }
                    </p>
  
                    <strong>
                      {
                        playlistVideos.length
                      }{" "}
                      videos
                    </strong>
  
                    <div className="playlist-detail-actions">
                      {playlistVideos.length >
                        0 && (
                        <button
                          className="primary-button"
                          onClick={() =>
                            openVideo(
                              playlistVideos[0]
                                .video
                            )
                          }
                        >
                          ▶ Play all
                        </button>
                      )}
  
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setSelectedVideoIds(
                            []
                          );
  
                          setShowAddVideos(
                            true
                          );
                        }}
                      >
                        ＋ Add videos
                      </button>
  
                      <button
                        className="secondary-button danger-button"
                        onClick={
                          deletePlaylist
                        }
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </section>
  
                {showAddVideos && (
                  <section className="playlist-create-card">
                    <div className="section-heading">
                      <h2>
                        Add videos
                      </h2>
  
                      <button
                        onClick={() =>
                          setShowAddVideos(
                            false
                          )
                        }
                      >
                        ✕
                      </button>
                    </div>
  
                    <div className="playlist-select-grid">
                      {videos.map(
                        (video) => {
                          const alreadyAdded =
                            playlistVideos.some(
                              (
                                item
                              ) =>
                                item.video_id ===
                                video.id
                            );
  
                          const selected =
                            selectedVideoIds.includes(
                              video.id
                            );
  
                          return (
                            <button
                              type="button"
                              key={
                                video.id
                              }
                              className={`playlist-select-video ${
                                selected
                                  ? "selected"
                                  : ""
                              } ${
                                alreadyAdded
                                  ? "already-added"
                                  : ""
                              }`}
                              disabled={
                                alreadyAdded
                              }
                              onClick={() =>
                                toggleVideo(
                                  video.id
                                )
                              }
                            >
                              <div className="playlist-select-thumbnail">
                                {getVideoThumbnail(
                                  video
                                ) ? (
                                  <img
                                    src={getVideoThumbnail(
                                      video
                                    )}
                                    alt={
                                      video.title
                                    }
                                  />
                                ) : (
                                  <span>
                                    ▶
                                  </span>
                                )}
                              </div>
  
                              <div>
                                <strong>
                                  {
                                    video.title
                                  }
                                </strong>
  
                                {alreadyAdded ? (
                                  <small>
                                    Already in playlist
                                  </small>
                                ) : (
                                  <small>
                                    {formatNumber(
                                      video.views
                                    )}{" "}
                                    views
                                  </small>
                                )}
                              </div>
  
                              {selected && (
                                <span className="playlist-check">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
  
                    <button
                      className="primary-button"
                      onClick={
                        addVideosToPlaylist
                      }
                      disabled={
                        saving ||
                        selectedVideoIds.length ===
                          0
                      }
                    >
                      {saving
                        ? "Adding..."
                        : `Add ${selectedVideoIds.length} video${
                            selectedVideoIds.length ===
                            1
                              ? ""
                              : "s"
                          }`}
                    </button>
                  </section>
                )}
  
                <section className="playlist-video-section">
                  <div className="section-heading">
                    <h2>
                      Videos
                    </h2>
  
                    <span>
                      {
                        playlistVideos.length
                      }
                    </span>
                  </div>
  
                  {playlistLoading ? (
                    <div className="empty-state">
                      <div className="loading-spinner" />
  
                      <p>
                        Playlist videos load
                        ho rahe hain...
                      </p>
                    </div>
                  ) : playlistVideos.length ===
                    0 ? (
                    <div className="channel-empty">
                      <div className="channel-empty-icon">
                        📁
                      </div>
  
                      <h2>
                        Playlist empty hai
                      </h2>
  
                      <p>
                        Important videos ko
                        is playlist me add karo.
                      </p>
  
                      <button
                        className="channel-upload-button"
                        onClick={() => {
                          setSelectedVideoIds(
                            []
                          );
  
                          setShowAddVideos(
                            true
                          );
                        }}
                      >
                        ＋ Add videos
                      </button>
                    </div>
                  ) : (
                    <div className="playlist-video-list">
                      {playlistVideos.map(
                        (
                          item,
                          index
                        ) => (
                          <article
                            className="playlist-video-row"
                            key={
                              item.id
                            }
                          >
                            <div className="playlist-video-number">
                              {index +
                                1}
                            </div>
  
                            <div
                              className="playlist-row-thumbnail"
                              onClick={() =>
                                openVideo(
                                  item.video
                                )
                              }
                            >
                              {getVideoThumbnail(
                                item.video
                              ) ? (
                                <img
                                  src={getVideoThumbnail(
                                    item.video
                                  )}
                                  alt={
                                    item
                                      .video
                                      .title
                                  }
                                />
                              ) : (
                                <span>
                                  ▶
                                </span>
                              )}
                            </div>
  
                            <div
                              className="playlist-row-info"
                              onClick={() =>
                                openVideo(
                                  item.video
                                )
                              }
                            >
                              <h3>
                                {
                                  item
                                    .video
                                    .title
                                }
                              </h3>
  
                              <p>
                                {formatNumber(
                                  item
                                    .video
                                    .views
                                )}{" "}
                                views
                              </p>
                            </div>
  
                            <div className="playlist-row-actions">
                              <button
                                onClick={() =>
                                  moveVideo(
                                    index,
                                    -1
                                  )
                                }
                                disabled={
                                  index ===
                                  0
                                }
                                title="Move up"
                              >
                                ↑
                              </button>
  
                              <button
                                onClick={() =>
                                  moveVideo(
                                    index,
                                    1
                                  )
                                }
                                disabled={
                                  index ===
                                  playlistVideos.length -
                                    1
                                }
                                title="Move down"
                              >
                                ↓
                              </button>
  
                              <button
                                className="playlist-remove-button"
                                onClick={() =>
                                  removeVideo(
                                    item.id
                                  )
                                }
                                title="Remove video"
                              >
                                🗑
                              </button>
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
  
          <nav className="bottom-nav">
            <button
              className="nav-item"
              onClick={() =>
                onNavigate(
                  "home"
                )
              }
            >
              <span>⌂</span>
              <small>
                Home
              </small>
            </button>
  
            <button
              className="nav-item"
              onClick={() =>
                onNavigate(
                  "search"
                )
              }
            >
              <span>⌕</span>
              <small>
                Search
              </small>
            </button>
  
            <button
              className="nav-item upload-nav"
              onClick={() =>
                onNavigate(
                  "upload"
                )
              }
            >
              +
            </button>
  
            <button
              className="nav-item"
              onClick={() =>
                onNavigate(
                  "subscriptions"
                )
              }
            >
              <span>🔔</span>
              <small>
                Subscribe
              </small>
            </button>
  
            <button
              className="nav-item active"
              onClick={() =>
                onNavigate(
                  "profile"
                )
              }
            >
              <span>○</span>
              <small>
                Profile
              </small>
            </button>
          </nav>
        </div>
      );
    }
  
    /* =====================================================
       PLAYLIST LIST
       ===================================================== */
  
    return (
      <div className="app-page">
        <header className="top-header">
          <button
            className="back-button"
            onClick={() =>
              onNavigate(
                "profile"
              )
            }
          >
            ←
          </button>
  
          <h2>
            Playlists
          </h2>
  
          <button
            className="header-plus-button"
            onClick={() =>
              setShowCreate(
                true
              )
            }
            title="Create playlist"
          >
            +
          </button>
        </header>
  
        <main className="page-content">
          {error && (
            <div className="edit-channel-message error">
              {error}
            </div>
          )}
  
          {showCreate && (
            <section className="playlist-create-card">
              <div className="section-heading">
                <h2>
                  Create playlist
                </h2>
  
                <button
                  onClick={() => {
                    setShowCreate(
                      false
                    );
  
                    setName("");
  
                    setDescription(
                      ""
                    );
  
                    setSelectedVideoIds(
                      []
                    );
  
                    clearCoverSelection();
                  }}
                >
                  ✕
                </button>
              </div>
  
              <form
                onSubmit={
                  createPlaylist
                }
              >
                <div className="edit-field">
                  <label>
                    Playlist name
                  </label>
  
                  <input
                    value={name}
                    onChange={(
                      event
                    ) =>
                      setName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Important Videos"
                    maxLength={100}
                    required
                  />
                </div>
  
                <div className="edit-field">
                  <label>
                    Description
                  </label>
  
                  <textarea
                    value={
                      description
                    }
                    onChange={(
                      event
                    ) =>
                      setDescription(
                        event.target
                          .value
                      )
                    }
                    placeholder="Videos I want to keep together..."
                    rows={4}
                    maxLength={500}
                  />
                </div>
  
                {/* COVER */}
  
                <div className="edit-field">
                  <label>
                    Playlist cover{" "}
                    <span
                      style={{
                        color:
                          "#73798b",
                        fontWeight:
                          "400",
                      }}
                    >
                      (optional)
                    </span>
                  </label>
  
                  <div className="playlist-cover-upload">
                    <div className="playlist-cover-preview">
                      {coverPreview ? (
                        <img
                          src={
                            coverPreview
                          }
                          alt="Playlist cover preview"
                        />
                      ) : (
                        <div className="playlist-cover-preview-empty">
                          <span>
                            🖼️
                          </span>
  
                          <small>
                            First selected video's
                            thumbnail will be used
                          </small>
                        </div>
                      )}
                    </div>
  
                    <div className="playlist-cover-upload-controls">
                      <label className="playlist-cover-upload-button">
                        🖼️ Choose cover
  
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={
                            handleCoverChange
                          }
                        />
                      </label>
  
                      {coverFile && (
                        <button
                          type="button"
                          className="playlist-cover-remove"
                          onClick={
                            clearCoverSelection
                          }
                        >
                          Remove
                        </button>
                      )}
  
                      <small>
                        Cover optional hai.
                        Skip karoge to first
                        selected video ka thumbnail
                        automatically cover banega.
                      </small>
                    </div>
                  </div>
                </div>
  
                {/* VIDEOS */}
  
                <h3 className="playlist-select-heading">
                  Add videos to playlist
                </h3>
  
                {videos.length ===
                0 ? (
                  <div className="playlist-no-videos">
                    <span>
                      📹
                    </span>
  
                    <p>
                      Abhi Yuniverse par
                      koi video available
                      nahi hai.
                    </p>
                  </div>
                ) : (
                  <div className="playlist-select-grid">
                    {videos.map(
                      (video) => {
                        const selected =
                          selectedVideoIds.includes(
                            video.id
                          );
  
                        return (
                          <button
                            type="button"
                            key={
                              video.id
                            }
                            className={`playlist-select-video ${
                              selected
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              toggleVideo(
                                video.id
                              )
                            }
                          >
                            <div className="playlist-select-thumbnail">
                              {getVideoThumbnail(
                                video
                              ) ? (
                                <img
                                  src={getVideoThumbnail(
                                    video
                                  )}
                                  alt={
                                    video.title
                                  }
                                />
                              ) : (
                                <span>
                                  ▶
                                </span>
                              )}
                            </div>
  
                            <div>
                              <strong>
                                {
                                  video.title
                                }
                              </strong>
  
                              <small>
                                {formatNumber(
                                  video.views
                                )}{" "}
                                views
                              </small>
                            </div>
  
                            {selected && (
                              <span className="playlist-check">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
  
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Creating..."
                    : selectedVideoIds.length >
                      0
                    ? `Create playlist • ${selectedVideoIds.length} selected`
                    : "Create playlist"}
                </button>
              </form>
            </section>
          )}
  
          {!showCreate &&
            playlists.length ===
              0 && (
              <div className="channel-empty">
                <div className="channel-empty-icon">
                  📁
                </div>
  
                <h2>
                  No playlists yet
                </h2>
  
                <p>
                  Important videos ko
                  ek jagah collect karne
                  ke liye apni first
                  playlist banao.
                </p>
  
                <button
                  className="channel-upload-button"
                  onClick={() =>
                    setShowCreate(
                      true
                    )
                  }
                >
                  ＋ Create playlist
                </button>
              </div>
            )}
  
          {!showCreate &&
            playlists.length >
              0 && (
              <section>
                <div className="section-heading">
                  <h2>
                    Your playlists
                  </h2>
  
                  <span>
                    {
                      playlists.length
                    }
                  </span>
                </div>
  
                <div className="playlist-grid">
                  {playlists.map(
                    (
                      playlist
                    ) => {
                      const cover =
                        getPlaylistCover(
                          playlist
                        );
  
                      return (
                        <article
                          className="playlist-card"
                          key={
                            playlist.id
                          }
                          onClick={() =>
                            openPlaylist(
                              playlist
                            )
                          }
                        >
                          <div className="playlist-cover">
                            {cover ? (
                              <img
                                src={
                                  cover
                                }
                                alt={
                                  playlist.name
                                }
                              />
                            ) : (
                              <span>
                                ▶
                              </span>
                            )}
  
                            <div className="playlist-cover-count">
                              {
                                playlist.videoCount
                              }{" "}
                              videos
                            </div>
                          </div>
  
                          <div className="playlist-info">
                            <h3>
                              {
                                playlist.name
                              }
                            </h3>
  
                            <p>
                              {
                                playlist.videoCount
                              }{" "}
                              videos
                            </p>
  
                            {playlist.description && (
                              <small>
                                {
                                  playlist.description
                                }
                              </small>
                            )}
                          </div>
  
                          <span className="playlist-open-arrow">
                            →
                          </span>
                        </article>
                      );
                    }
                  )}
                </div>
              </section>
            )}
        </main>
  
        <nav className="bottom-nav">
          <button
            className="nav-item"
            onClick={() =>
              onNavigate(
                "home"
              )
            }
          >
            <span>⌂</span>
            <small>
              Home
            </small>
          </button>
  
          <button
            className="nav-item"
            onClick={() =>
              onNavigate(
                "search"
              )
            }
          >
            <span>⌕</span>
            <small>
              Search
            </small>
          </button>
  
          <button
            className="nav-item upload-nav"
            onClick={() =>
              onNavigate(
                "upload"
              )
            }
          >
            +
          </button>
  
          <button
            className="nav-item"
            onClick={() =>
              onNavigate(
                "subscriptions"
              )
            }
          >
            <span>🔔</span>
            <small>
              Subscribe
            </small>
          </button>
  
          <button
            className="nav-item active"
            onClick={() =>
              onNavigate(
                "profile"
              )
            }
          >
            <span>○</span>
            <small>
              Profile
            </small>
          </button>
        </nav>
      </div>
    );
  }