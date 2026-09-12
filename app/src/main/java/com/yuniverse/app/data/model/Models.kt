package com.yuniverse.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val v2iId: String,
    val username: String,
    val fullName: String,
    val firstName: String = "",
    val lastName: String = ""
)

@Serializable
data class Video(
    val id: String,
    @SerialName("v2i_user_id") val v2iUserId: String = "",
    val title: String = "",
    val description: String = "",
    @SerialName("video_url") val videoUrl: String = "",
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    val duration: Double = 0.0,
    val width: Int = 1920,
    val height: Int = 1080,
    val views: Long = 0,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
    @SerialName("mux_asset_id") val muxAssetId: String? = null,
    @SerialName("mux_playback_id") val muxPlaybackId: String? = null,
    val status: String = "ready",
    val channelProfile: ChannelProfile? = null
) {
    val playbackUrl: String
        get() = if (!muxPlaybackId.isNullOrEmpty()) {
            "https://stream.mux.com/$muxPlaybackId.m3u8"
        } else {
            videoUrl
        }

    val displayThumbnail: String
        get() = when {
            !thumbnailUrl.isNullOrEmpty() -> thumbnailUrl
            !muxPlaybackId.isNullOrEmpty() -> "https://image.mux.com/$muxPlaybackId/thumbnail.jpg"
            else -> "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80"
        }

    val formattedDuration: String
        get() {
            val totalSeconds = duration.toInt()
            val minutes = totalSeconds / 60
            val seconds = totalSeconds % 60
            return "%d:%02d".format(minutes, seconds)
        }

    val formattedViews: String
        get() = when {
            views >= 1_000_000 -> "%.1fM views".format(views / 1_000_000.0)
            views >= 1_000 -> "%.1fK views".format(views / 1_000.0)
            else -> "$views views"
        }
}

@Serializable
data class ChannelProfile(
    @SerialName("v2i_user_id") val v2iUserId: String,
    @SerialName("channel_name") val channelName: String = "Yuniverse Creator",
    @SerialName("channel_avatar_url") val channelAvatarUrl: String? = null,
    @SerialName("channel_bio") val channelBio: String = "",
    val subscriberCount: Long = 0
)

@Serializable
data class Comment(
    val id: String,
    @SerialName("video_id") val videoId: String,
    @SerialName("user_id") val userId: String,
    @SerialName("user_name") val userName: String,
    @SerialName("user_avatar") val userAvatar: String? = null,
    val content: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class Playlist(
    val id: String,
    val name: String,
    val description: String = "",
    @SerialName("cover_url") val coverUrl: String? = null,
    @SerialName("video_count") val videoCount: Int = 0,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("user_id") val userId: String = ""
)

@Serializable
data class DeviceInfo(
    val deviceId: String,
    val deviceName: String,
    val deviceType: String,
    val browser: String,
    val userAgent: String
)

data class UserSettings(
    val autoplay: Boolean = true,
    val dataSaver: Boolean = false,
    val notifications: Boolean = true,
    val newSubscribers: Boolean = true,
    val comments: Boolean = true,
    val likes: Boolean = true,
    val recommendations: Boolean = true,
    val publicChannel: Boolean = true,
    val showSubscriptions: Boolean = true,
    val showLikedVideos: Boolean = false,
    val darkMode: Boolean = true
)
