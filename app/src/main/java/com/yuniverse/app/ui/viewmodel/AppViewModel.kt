package com.yuniverse.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.yuniverse.app.data.model.Comment
import com.yuniverse.app.data.model.Playlist
import com.yuniverse.app.data.model.User
import com.yuniverse.app.data.model.UserSettings
import com.yuniverse.app.data.model.Video
import com.yuniverse.app.data.repository.YuniverseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AppViewModel(
    private val repository: YuniverseRepository
) : ViewModel() {

    val currentUser: StateFlow<User?> = repository.getCurrentUser()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val allVideos: StateFlow<List<Video>> = repository.getAllVideos()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val likedVideos: StateFlow<List<Video>> = repository.getLikedVideos()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val savedVideos: StateFlow<List<Video>> = repository.getSavedVideos()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val watchHistory: StateFlow<List<Video>> = repository.getWatchHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val playlists: StateFlow<List<Playlist>> = repository.getAllPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val userSettings: StateFlow<UserSettings> = repository.userSettings

    val subscribedChannels: StateFlow<Set<String>> = repository.subscribedChannels

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    private val _isLoggingIn = MutableStateFlow(false)
    val isLoggingIn: StateFlow<Boolean> = _isLoggingIn.asStateFlow()

    // Filtered videos based on category and query
    val filteredVideos: StateFlow<List<Video>> = combine(
        allVideos,
        _searchQuery,
        _selectedCategory
    ) { videos, query, category ->
        var list = videos
        if (category != "All") {
            list = list.filter {
                it.title.contains(category, ignoreCase = true) ||
                        it.description.contains(category, ignoreCase = true)
            }
        }
        if (query.isNotBlank()) {
            list = list.filter {
                it.title.contains(query, ignoreCase = true) ||
                        it.description.contains(query, ignoreCase = true) ||
                        (it.channelProfile?.channelName?.contains(query, ignoreCase = true) == true)
            }
        }
        list
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        refreshVideos()
    }

    fun refreshVideos() {
        viewModelScope.launch {
            _isRefreshing.value = true
            repository.refreshVideos()
            _isRefreshing.value = false
        }
    }

    fun onSearchQueryChanged(newQuery: String) {
        _searchQuery.value = newQuery
    }

    fun onCategorySelected(category: String) {
        _selectedCategory.value = category
    }

    fun login(v2iId: String, pass: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isLoggingIn.value = true
            _loginError.value = null
            val result = repository.login(v2iId, pass)
            result.onSuccess {
                _isLoggingIn.value = false
                onSuccess()
            }.onFailure { err ->
                _isLoggingIn.value = false
                _loginError.value = err.message ?: "Authentication failed"
            }
        }
    }

    fun logout(onComplete: () -> Unit) {
        viewModelScope.launch {
            repository.logout()
            onComplete()
        }
    }

    fun toggleLike(videoId: String) {
        viewModelScope.launch {
            repository.toggleLike(videoId)
        }
    }

    fun toggleSave(videoId: String) {
        viewModelScope.launch {
            repository.toggleSave(videoId)
        }
    }

    fun recordWatch(videoId: String) {
        viewModelScope.launch {
            repository.recordWatch(videoId)
        }
    }

    fun toggleSubscription(channelId: String) {
        repository.toggleSubscription(channelId)
    }

    fun isSubscribed(channelId: String): Boolean {
        return repository.isSubscribed(channelId)
    }

    fun addComment(videoId: String, content: String, onAdded: (Comment) -> Unit) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            val result = repository.addComment(videoId, user, content)
            result.onSuccess { comment ->
                onAdded(comment)
            }
        }
    }

    fun createPlaylist(name: String, description: String) {
        viewModelScope.launch {
            repository.createPlaylist(name, description)
        }
    }

    fun publishVideo(title: String, description: String, videoUrl: String, thumbnailUrl: String, onDone: () -> Unit) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            repository.publishVideo(user, title, description, videoUrl, thumbnailUrl)
            onDone()
        }
    }

    fun updateSettings(transform: (UserSettings) -> UserSettings) {
        repository.updateSettings(transform)
    }
}

class AppViewModelFactory(private val repository: YuniverseRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AppViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AppViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
