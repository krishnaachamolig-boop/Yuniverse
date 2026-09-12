package com.yuniverse.app.data.repository

import com.yuniverse.app.data.local.AppDatabase
import com.yuniverse.app.data.local.LocalPlaylistEntity
import com.yuniverse.app.data.local.UserSessionEntity
import com.yuniverse.app.data.local.VideoEntity
import com.yuniverse.app.data.model.Comment
import com.yuniverse.app.data.model.Playlist
import com.yuniverse.app.data.model.User
import com.yuniverse.app.data.model.UserSettings
import com.yuniverse.app.data.model.Video
import com.yuniverse.app.data.remote.SupabaseClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import java.util.UUID

class YuniverseRepository(
    private val database: AppDatabase,
    private val supabaseClient: SupabaseClient = SupabaseClient()
) {
    private val videoDao = database.videoDao()
    private val userDao = database.userDao()
    private val playlistDao = database.playlistDao()

    private val _userSettings = MutableStateFlow(UserSettings())
    val userSettings = _userSettings.asStateFlow()

    private val _subscribedChannels = MutableStateFlow<Set<String>>(setOf("creator_gemini", "creator_tech"))
    val subscribedChannels = _subscribedChannels.asStateFlow()

    fun getAllVideos(): Flow<List<Video>> {
        return videoDao.getAllVideos().map { entities ->
            entities.map { it.toVideo() }
        }
    }

    fun getLikedVideos(): Flow<List<Video>> {
        return videoDao.getLikedVideos().map { entities ->
            entities.map { it.toVideo() }
        }
    }

    fun getSavedVideos(): Flow<List<Video>> {
        return videoDao.getSavedVideos().map { entities ->
            entities.map { it.toVideo() }
        }
    }

    fun getWatchHistory(): Flow<List<Video>> {
        return videoDao.getWatchHistory().map { entities ->
            entities.map { it.toVideo() }
        }
    }

    fun getVideosByChannel(channelId: String): Flow<List<Video>> {
        return videoDao.getVideosByChannel(channelId).map { entities ->
            entities.map { it.toVideo() }
        }
    }

    fun getCurrentUser(): Flow<User?> {
        return userDao.getCurrentUser().map { entity ->
            entity?.let {
                User(
                    id = it.id,
                    v2iId = it.v2iId,
                    username = it.username,
                    fullName = it.fullName,
                    firstName = it.firstName,
                    lastName = it.lastName
                )
            }
        }
    }

    suspend fun login(v2iId: String, pass: String): Result<User> {
        val result = supabaseClient.login(v2iId, pass)
        result.onSuccess { user ->
            userDao.saveUser(
                UserSessionEntity(
                    id = user.id,
                    v2iId = user.v2iId,
                    username = user.username,
                    fullName = user.fullName,
                    firstName = user.firstName,
                    lastName = user.lastName
                )
            )
        }
        return result
    }

    suspend fun logout() {
        userDao.clearUser()
    }

    suspend fun refreshVideos() {
        val result = supabaseClient.fetchLandscapeVideos()
        result.onSuccess { videos ->
            val entities = videos.map { v ->
                val existing = videoDao.getVideoById(v.id)
                VideoEntity(
                    id = v.id,
                    v2iUserId = v.v2iUserId,
                    title = v.title,
                    description = v.description,
                    videoUrl = v.videoUrl,
                    thumbnailUrl = v.thumbnailUrl,
                    duration = v.duration,
                    width = v.width,
                    height = v.height,
                    views = v.views,
                    createdAt = v.createdAt,
                    updatedAt = v.updatedAt,
                    muxAssetId = v.muxAssetId,
                    muxPlaybackId = v.muxPlaybackId,
                    status = v.status,
                    channelName = v.channelProfile?.channelName ?: "Yuniverse Creator",
                    channelAvatarUrl = v.channelProfile?.channelAvatarUrl,
                    isLiked = existing?.isLiked ?: false,
                    isSaved = existing?.isSaved ?: false,
                    watchHistoryTimestamp = existing?.watchHistoryTimestamp
                )
            }
            videoDao.insertVideos(entities)
        }
    }

    suspend fun getVideoById(videoId: String): Video? {
        return videoDao.getVideoById(videoId)?.toVideo()
    }

    suspend fun toggleLike(videoId: String): Boolean {
        val video = videoDao.getVideoById(videoId) ?: return false
        val newLiked = !video.isLiked
        videoDao.setLiked(videoId, newLiked)
        return newLiked
    }

    suspend fun toggleSave(videoId: String): Boolean {
        val video = videoDao.getVideoById(videoId) ?: return false
        val newSaved = !video.isSaved
        videoDao.setSaved(videoId, newSaved)
        return newSaved
    }

    suspend fun recordWatch(videoId: String) {
        videoDao.markWatched(videoId, System.currentTimeMillis())
        videoDao.incrementViews(videoId)
    }

    fun toggleSubscription(channelId: String) {
        val current = _subscribedChannels.value.toMutableSet()
        if (current.contains(channelId)) {
            current.remove(channelId)
        } else {
            current.add(channelId)
        }
        _subscribedChannels.value = current
    }

    fun isSubscribed(channelId: String): Boolean {
        return _subscribedChannels.value.contains(channelId)
    }

    suspend fun addComment(videoId: String, user: User, content: String): Result<Comment> {
        return supabaseClient.postComment(videoId, user, content)
    }

    fun getAllPlaylists(): Flow<List<Playlist>> {
        return playlistDao.getAllPlaylists().map { list ->
            list.map {
                Playlist(
                    id = it.id,
                    name = it.name,
                    description = it.description,
                    coverUrl = it.coverUrl,
                    videoCount = it.videoCount,
                    createdAt = it.createdAt
                )
            }
        }
    }

    suspend fun createPlaylist(name: String, description: String) {
        val playlist = LocalPlaylistEntity(
            id = UUID.randomUUID().toString(),
            name = name,
            description = description,
            coverUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80",
            videoCount = 0,
            createdAt = "Just now"
        )
        playlistDao.insertPlaylist(playlist)
    }

    suspend fun publishVideo(
        user: User,
        title: String,
        description: String,
        videoUrl: String,
        thumbnailUrl: String
    ): Video {
        val newVideo = VideoEntity(
            id = "vid_${System.currentTimeMillis()}",
            v2iUserId = user.id,
            title = title,
            description = description,
            videoUrl = videoUrl,
            thumbnailUrl = thumbnailUrl,
            duration = 180.0,
            width = 1920,
            height = 1080,
            views = 1L,
            createdAt = "Just now",
            updatedAt = "Just now",
            muxAssetId = null,
            muxPlaybackId = null,
            status = "ready",
            channelName = user.fullName,
            channelAvatarUrl = null
        )
        videoDao.insertVideo(newVideo)
        return newVideo.toVideo()
    }

    fun updateSettings(transform: (UserSettings) -> UserSettings) {
        _userSettings.value = transform(_userSettings.value)
    }
}
