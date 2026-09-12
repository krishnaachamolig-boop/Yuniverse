package com.yuniverse.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface VideoDao {
    @Query("SELECT * FROM videos ORDER BY createdAt DESC")
    fun getAllVideos(): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE id = :videoId LIMIT 1")
    suspend fun getVideoById(videoId: String): VideoEntity?

    @Query("SELECT * FROM videos WHERE isLiked = 1 ORDER BY updatedAt DESC")
    fun getLikedVideos(): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE isSaved = 1 ORDER BY updatedAt DESC")
    fun getSavedVideos(): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE watchHistoryTimestamp IS NOT NULL ORDER BY watchHistoryTimestamp DESC")
    fun getWatchHistory(): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%'")
    fun searchVideos(query: String): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE v2iUserId = :channelId ORDER BY createdAt DESC")
    fun getVideosByChannel(channelId: String): Flow<List<VideoEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVideos(videos: List<VideoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVideo(video: VideoEntity)

    @Update
    suspend fun updateVideo(video: VideoEntity)

    @Query("UPDATE videos SET isLiked = :liked WHERE id = :videoId")
    suspend fun setLiked(videoId: String, liked: Boolean)

    @Query("UPDATE videos SET isSaved = :saved WHERE id = :videoId")
    suspend fun setSaved(videoId: String, saved: Boolean)

    @Query("UPDATE videos SET watchHistoryTimestamp = :timestamp WHERE id = :videoId")
    suspend fun markWatched(videoId: String, timestamp: Long)

    @Query("UPDATE videos SET views = views + 1 WHERE id = :videoId")
    suspend fun incrementViews(videoId: String)
}

@Dao
interface UserDao {
    @Query("SELECT * FROM user_session LIMIT 1")
    fun getCurrentUser(): Flow<UserSessionEntity?>

    @Query("SELECT * FROM user_session LIMIT 1")
    suspend fun getCurrentUserSync(): UserSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveUser(user: UserSessionEntity)

    @Query("DELETE FROM user_session")
    suspend fun clearUser()
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY createdAt DESC")
    fun getAllPlaylists(): Flow<List<LocalPlaylistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: LocalPlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    suspend fun deletePlaylist(playlistId: String)
}
