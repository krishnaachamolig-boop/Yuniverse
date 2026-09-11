import React, { useRef, useState } from "react";
import { yuniverseSupabase } from "../lib/yuniverseSupabase";

export default function Upload({ user, onNavigate }) {
  const fileInputRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [videoInfo, setVideoInfo] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // --------------------------------------------------
  // SELECT VIDEO
  // --------------------------------------------------

  function handleFileSelect(event) {
    const file = event.target.files?.[0];

    setError("");
    setMessage("");
    setVideoInfo(null);
    setProgress(0);

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please ek valid video file select karo.");
      return;
    }

    const video = document.createElement("video");

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);

      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!width || !height) {
        setError("Video dimensions read nahi ho paayi.");
        return;
      }

      const ratio = width / height;
      const targetRatio = 16 / 9;

      // Small tolerance for normal 16:9 videos.
      const is16by9 = Math.abs(ratio - targetRatio) <= 0.02;

      if (!is16by9) {
        setError(
          `Yuniverse sirf 16:9 landscape videos accept karta hai. Selected video: ${width}×${height}.`
        );

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        return;
      }

      setVideoFile(file);

      setVideoInfo({
        width,
        height,
        duration: video.duration || 0,
        size: file.size,
      });

      setMessage("Video ready for upload.");
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      setError("Video file read nahi ho paayi.");
    };

    video.src = URL.createObjectURL(file);
  }

  // --------------------------------------------------
  // FORMAT FILE SIZE
  // --------------------------------------------------

  function formatFileSize(bytes) {
    if (!bytes) return "0 MB";

    const mb = bytes / (1024 * 1024);

    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    }

    return `${(mb / 1024).toFixed(2)} GB`;
  }

  // --------------------------------------------------
  // CREATE MUX UPLOAD
  // --------------------------------------------------

  async function createMuxUpload() {
    const { data, error: functionError } =
      await yuniverseSupabase.functions.invoke("mux-upload", {
        body: {
          action: "create_upload",
        },
      });

    if (functionError) {
      throw new Error(
        functionError.message || "Mux upload function call failed."
      );
    }

    if (!data?.success || !data?.uploadUrl) {
      throw new Error(data?.error || "Mux upload URL create nahi hua.");
    }

    return data;
  }

  // --------------------------------------------------
  // UPLOAD FILE DIRECTLY TO MUX
  // --------------------------------------------------

  async function uploadToMux(uploadUrl) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", uploadUrl, true);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        const percentage = Math.round((event.loaded / event.total) * 100);

        setProgress(percentage);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Mux upload failed with status ${xhr.status}.`));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Mux upload ke time network error aaya."));
      };

      xhr.onabort = () => {
        reject(new Error("Mux upload cancelled."));
      };

      xhr.send(videoFile);
    });
  }

  // --------------------------------------------------
  // CHECK MUX PROCESSING STATUS
  // --------------------------------------------------

  async function getMuxUploadStatus(uploadId) {
    const { data, error: functionError } =
      await yuniverseSupabase.functions.invoke("mux-upload", {
        body: {
          action: "upload_status",
          uploadId,
        },
      });

    if (functionError) {
      throw new Error(functionError.message || "Mux status check failed.");
    }

    if (!data?.success) {
      throw new Error(data?.error || "Mux status information nahi mili.");
    }

    return data;
  }

  // --------------------------------------------------
  // WAIT FOR MUX ASSET
  // --------------------------------------------------

  async function waitForMuxAsset(uploadId) {
    const maxAttempts = 60;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await getMuxUploadStatus(uploadId);

      const uploadStatus = result?.upload?.status;

      const asset = result?.asset;

      if (asset?.status === "ready" && asset?.playbackId) {
        return {
          assetId: result.upload.assetId,
          playbackId: asset.playbackId,
          duration: asset.duration || videoInfo?.duration || null,
        };
      }

      if (asset?.status === "errored") {
        throw new Error("Mux video processing failed.");
      }

      setMessage(
        `Mux video process kar raha hai... ${
          uploadStatus || asset?.status || "processing"
        }`
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error(
      "Mux processing mein bahut time lag raha hai. Thodi der baad status check karo."
    );
  }

  // --------------------------------------------------
  // SAVE VIDEO TO YUNIVERSE DATABASE
  // --------------------------------------------------

  async function saveVideoToDatabase({ assetId, playbackId, duration }) {
    const v2iUserId = user?.id || user?.authUser?.id || user?.profile?.id;

    if (!v2iUserId) {
      throw new Error("V2i user ID nahi mili. Please dobara login karo.");
    }

    const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;

    const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;

    const { data, error: dbError } = await yuniverseSupabase
      .from("videos")
      .insert({
        v2i_user_id: v2iUserId,
        title: title.trim(),
        description: description.trim(),
        video_url: playbackUrl,
        thumbnail_url: thumbnailUrl,
        duration: duration || videoInfo?.duration || null,
        width: videoInfo?.width || null,
        height: videoInfo?.height || null,
        mux_asset_id: assetId,
        mux_playback_id: playbackId,
        status: "ready",
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(dbError.message || "Video database mein save nahi hua.");
    }

    return data;
  }

  // --------------------------------------------------
  // MAIN UPLOAD
  // --------------------------------------------------

  async function handleUpload(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setProgress(0);

    if (!videoFile) {
      setError("Pehle video select karo.");
      return;
    }

    if (!title.trim()) {
      setError("Video title enter karo.");
      return;
    }

    if (!user) {
      setError("User session nahi mili. Please login karo.");
      return;
    }

    setUploading(true);

    try {
      // 1. Create Mux Direct Upload
      setMessage("Mux upload prepare kar raha hai...");

      const muxUpload = await createMuxUpload();

      // 2. Upload video directly to Mux
      setMessage("Video Mux par upload ho raha hai...");

      await uploadToMux(muxUpload.uploadUrl);

      setProgress(100);

      // 3. Wait for Mux processing
      setMessage("Video Mux par process ho raha hai...");

      const muxAsset = await waitForMuxAsset(muxUpload.uploadId);

      // 4. Save metadata
      setMessage("Yuniverse mein video publish ho raha hai...");

      await saveVideoToDatabase(muxAsset);

      // 5. Success
      setMessage("🎉 Video successfully uploaded!");

      setVideoFile(null);
      setVideoInfo(null);
      setTitle("");
      setDescription("");
      setProgress(100);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => {
        onNavigate?.("home");
      }, 1500);
    } catch (err) {
      console.error("Yuniverse upload error:", err);

      setError(err?.message || "Video upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app-page upload-page">
      <div className="upload-container">
        <div className="upload-header">
          <button
            type="button"
            onClick={() => onNavigate?.("home")}
            disabled={uploading}
          >
            ← Back
          </button>

          <h1>Upload video</h1>
        </div>

        <form className="upload-card" onSubmit={handleUpload}>
          <div className="upload-video-picker">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploading}
            />

            <p>Select a landscape 16:9 video</p>

            <small>Full-length videos only • No Shorts</small>
          </div>

          {videoInfo && videoFile && (
            <div className="upload-video-info">
              <strong>{videoFile.name}</strong>

              <div>
                {videoInfo.width} × {videoInfo.height}
              </div>

              <div>{formatFileSize(videoInfo.size)}</div>

              <div>16:9 ✓</div>
            </div>
          )}

          <div className="form-group">
            <label>Title</label>

            <input
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
              }}
              placeholder="Enter video title"
              maxLength={150}
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label>Description</label>

            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setError("");
              }}
              placeholder="Tell viewers about your video..."
              rows={6}
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div className="upload-progress">
              <div className="upload-progress-text">
                <span>{message}</span>

                <span>{progress}%</span>
              </div>

              <div className="upload-progress-track">
                <div
                  className="upload-progress-bar"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          )}

          {error && <div className="message error-message">{error}</div>}

          {!uploading && message && (
            <div className="message success-message">{message}</div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={uploading || !videoFile || !title.trim()}
          >
            {uploading ? "Uploading..." : "Publish video"}
          </button>
        </form>
      </div>
    </div>
  );
}
