package com.yuniverse.app.navigation

sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object Subscriptions : Screen("subscriptions")
    data object Upload : Screen("upload")
    data object Playlists : Screen("playlists")
    data object Profile : Screen("profile")
    data object Search : Screen("search")
    data object Settings : Screen("settings")
    data object EditChannel : Screen("edit_channel")
    data object Login : Screen("login")

    data object Watch : Screen("watch/{videoId}") {
        fun createRoute(videoId: String) = "watch/$videoId"
    }

    data object Channel : Screen("channel/{channelId}") {
        fun createRoute(channelId: String) = "channel/$channelId"
    }
}
