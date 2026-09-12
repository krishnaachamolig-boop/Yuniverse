package com.yuniverse.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.yuniverse.app.data.model.ChannelProfile
import com.yuniverse.app.data.model.Video

@Entity(tableName = "videos")
data class VideoEntity(
    @PrimaryKey val id: String,
    val v2iUserId: String,
    val title: String,
    val description: String,
    val videoUrl: String,
    val thumbnailUrl: String?,
    val duration: Double,
    val width: Int,
    val height: Int,
    val views: Long,
    val createdAt: String,
    val updatedAt: String,
    val muxAssetId: String?,
    val muxPlaybackId: String?,
    val status: String,
    val channelName: String?,
    val channelAvatarUrl: String?,
    val isLiked: Boolean = false,
    val isSaved: Boolean = false,
    val watchHistoryTimestamp: Long? = null
) {
    fun toVideo(): Video = Video(
        id = id,
        v2iUserId = v2iUserId,
        title = title,
        description = description,
        videoUrl = videoUrl,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        width = width,
        height = height,
        views = views,
        createdAt = createdAt,
        updatedAt = updatedAt,
        muxAssetId = muxAssetId,
        muxPlaybackId = muxPlaybackId,
        status = status,
        channelProfile = if (!channelName.isNullOrEmpty()) {
            ChannelProfile(
                v2iUserId = v2iUserId,
                channelName = channelName,
                channelAvatarUrl = channelAvatarUrl
            )
        } else null
    )
}

@Entity(tableName = "user_session")
data class UserSessionEntity(
    @PrimaryKey val id: String,
    val v2iId: String,
    val username: String,
    val fullName: String,
    val firstName: String,
    val lastName: String,
    val token: String? = null
)

@Entity(tableName = "playlists")
data class LocalPlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String,
    val coverUrl: String?,
    val videoCount: Int,
    val createdAt: String
)
