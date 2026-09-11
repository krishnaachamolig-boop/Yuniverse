import React, { useEffect, useRef, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";

export default function EditChannel({ user, onNavigate }) {
  const currentUserId =
    user?.authUser?.id ||
    user?.id ||
    user?.profile?.id ||
    null;

  const fileInputRef = useRef(null);

  const [channel, setChannel] = useState(null);

  const [channelName, setChannelName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadChannel() {
      if (!currentUserId) {
        setError("V2i ID missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data, error: channelError } =
          await yuniverseSupabase
            .from("channel_profiles")
            .select(`
              id,
              v2i_user_id,
              channel_name,
              channel_avatar_url,
              channel_bio,
              created_at,
              updated_at
            `)
            .eq("v2i_user_id", currentUserId)
            .maybeSingle();

        if (channelError) {
          throw channelError;
        }

        if (data) {
          setChannel(data);
          setChannelName(data.channel_name || "");
          setBio(data.channel_bio || "");
          setAvatarUrl(data.channel_avatar_url || "");
        } else {
          setChannelName("");
          setBio("");
          setAvatarUrl("");
        }
      } catch (err) {
        console.error(
          "Load Yuniverse channel error:",
          err
        );

        setError(
          err?.message ||
            "Channel load nahi ho paaya."
        );
      } finally {
        setLoading(false);
      }
    }

    loadChannel();
  }, [currentUserId]);

  function openAvatarPicker() {
    if (uploadingAvatar) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || !currentUserId) {
      return;
    }

    setUploadingAvatar(true);
    setError("");
    setSuccess("");

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error(
          "Sirf image file upload karo."
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          "Profile photo maximum 5MB ki ho sakti hai."
        );
      }

      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const filePath =
        `${currentUserId}/${Date.now()}.${extension}`;

      const { error: uploadError } =
        await yuniverseSupabase.storage
          .from("yuniverse-channel-avatars")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } =
        yuniverseSupabase.storage
          .from("yuniverse-channel-avatars")
          .getPublicUrl(filePath);

      const publicUrl =
        publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error(
          "Profile photo URL generate nahi hua."
        );
      }

      setAvatarUrl(publicUrl);

      /*
       * Agar channel already exist karta hai,
       * DP immediately database mein update karo.
       */
      if (channel?.id) {
        const { data, error: updateError } =
          await yuniverseSupabase
            .from("channel_profiles")
            .update({
              channel_avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", channel.id)
            .select()
            .maybeSingle();

        if (updateError) {
          throw updateError;
        }

        setChannel(data || channel);
      }

      setSuccess(
        "Profile photo updated successfully."
      );
    } catch (err) {
      console.error(
        "Yuniverse avatar upload error:",
        err
      );

      setError(
        err?.message ||
          "Profile photo upload nahi ho paayi."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!currentUserId || saving) {
      return;
    }

    const cleanName = channelName.trim();
    const cleanBio = bio.trim();

    if (!cleanName) {
      setError("Channel name empty nahi ho sakta.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        v2i_user_id: currentUserId,
        channel_name: cleanName,
        channel_avatar_url: avatarUrl || null,
        channel_bio: cleanBio,
        updated_at: new Date().toISOString(),
      };

      let data;
      let saveError;

      if (channel?.id) {
        const result =
          await yuniverseSupabase
            .from("channel_profiles")
            .update(payload)
            .eq("id", channel.id)
            .select()
            .maybeSingle();

        data = result.data;
        saveError = result.error;
      } else {
        const result =
          await yuniverseSupabase
            .from("channel_profiles")
            .insert({
              ...payload,
              created_at: new Date().toISOString(),
            })
            .select()
            .maybeSingle();

        data = result.data;
        saveError = result.error;
      }

      if (saveError) {
        throw saveError;
      }

      setChannel(data || {
        ...payload,
        id: channel?.id || null,
      });

      setChannelName(
        data?.channel_name || cleanName
      );

      setBio(
        data?.channel_bio || cleanBio
      );

      setAvatarUrl(
        data?.channel_avatar_url ||
          avatarUrl ||
          ""
      );

      setSuccess(
        "Channel updated successfully."
      );

      setTimeout(() => {
        onNavigate("channel", {
          id: currentUserId,
          v2i_user_id: currentUserId,
          user_id: currentUserId,

          name:
            data?.channel_name ||
            cleanName,

          username: undefined,

          v2i_id: user?.v2iId,

          avatar_url:
            data?.channel_avatar_url ||
            avatarUrl ||
            undefined,

          bio:
            data?.channel_bio ||
            cleanBio,
        });
      }, 700);
    } catch (err) {
      console.error(
        "Save Yuniverse channel error:",
        err
      );

      setError(
        err?.message ||
          "Channel update nahi ho paaya."
      );
    } finally {
      setSaving(false);
    }
  }

  function openChannel() {
    onNavigate("channel", {
      id: currentUserId,
      v2i_user_id: currentUserId,
      user_id: currentUserId,

      name:
        channelName ||
        "Yuniverse Creator",

      username: undefined,

      v2i_id: user?.v2iId,

      avatar_url:
        avatarUrl ||
        undefined,

      bio:
        bio ||
        "",
    });
  }

  if (loading) {
    return (
      <div className="app-page">
        <header className="top-header">
          <button
            className="back-button"
            onClick={() => onNavigate("profile")}
          >
            ←
          </button>

          <h2>Edit channel</h2>

          <div />
        </header>

        <main className="page-content">
          <div className="channel-loading">
            <div className="channel-loading-avatar" />
            <div className="channel-loading-line large" />
            <div className="channel-loading-line" />

            <p>
              Loading channel...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !channel) {
    return (
      <div className="app-page">
        <header className="top-header">
          <button
            className="back-button"
            onClick={() => onNavigate("profile")}
          >
            ←
          </button>

          <h2>Edit channel</h2>

          <div />
        </header>

        <main className="page-content">
          <div className="empty-state">
            <div className="empty-icon">
              ⚠️
            </div>

            <h3>
              Channel load nahi hua
            </h3>

            <p>{error}</p>

            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  const displayName =
    channelName ||
    "Yuniverse Creator";

  return (
    <div className="app-page">
      <header className="top-header">
        <button
          className="back-button"
          onClick={openChannel}
        >
          ←
        </button>

        <h2>Edit channel</h2>

        <button
          className="header-text-button"
          onClick={openChannel}
        >
          Done
        </button>
      </header>

      <main className="page-content">
        <section className="edit-channel-card">

          {/* =========================
              CHANNEL DP
          ========================== */}

          <div className="edit-channel-avatar-wrap">

            <button
              type="button"
              className="edit-channel-avatar"
              onClick={openAvatarPicker}
              disabled={uploadingAvatar}
              aria-label="Change channel photo"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                />
              ) : (
                <span>
                  {displayName
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}

              <div className="edit-avatar-overlay">
                {uploadingAvatar
                  ? "Uploading..."
                  : "📷"}
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />

            <p className="edit-avatar-hint">
              Channel DP change karne ke liye
              photo par click karo.
            </p>
          </div>

          <form onSubmit={handleSave}>

            <div className="edit-channel-section">

              <h3>
                Channel information
              </h3>

              {/* =========================
                  CHANNEL NAME
              ========================== */}

              <div className="edit-field">
                <label>
                  Channel name
                </label>

                <input
                  type="text"
                  value={channelName}
                  onChange={(event) =>
                    setChannelName(
                      event.target.value
                    )
                  }
                  placeholder="Enter your channel name"
                  maxLength={100}
                />

                <small>
                  Ye naam tum apne hisaab se
                  rakh sakte ho.
                </small>
              </div>

              {/* =========================
                  BIO
              ========================== */}

              <div className="edit-field">
                <label>
                  Channel bio
                </label>

                <textarea
                  value={bio}
                  onChange={(event) =>
                    setBio(
                      event.target.value
                    )
                  }
                  placeholder="Tell viewers about your channel..."
                  rows={6}
                  maxLength={500}
                />

                <small>
                  {bio.length}/500
                </small>
              </div>

            </div>

            {error && (
              <div className="edit-channel-message error">
                {error}
              </div>
            )}

            {success && (
              <div className="edit-channel-message success">
                {success}
              </div>
            )}

            <button
              className="primary-button edit-save-button"
              type="submit"
              disabled={
                saving ||
                uploadingAvatar
              }
            >
              {saving
                ? "Saving..."
                : "Save channel"}
            </button>

          </form>
        </section>
      </main>
    </div>
  );
}