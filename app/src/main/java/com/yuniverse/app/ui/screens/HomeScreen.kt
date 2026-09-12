package com.yuniverse.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yuniverse.app.ui.components.CategoryChipsRow
import com.yuniverse.app.ui.components.VideoCard
import com.yuniverse.app.ui.components.YuniverseTopBar
import com.yuniverse.app.ui.theme.DarkBackground
import com.yuniverse.app.ui.theme.DarkSurfaceVariant
import com.yuniverse.app.ui.theme.PrimaryViolet
import com.yuniverse.app.ui.theme.TextSecondary
import com.yuniverse.app.ui.viewmodel.AppViewModel

val categories = listOf("All", "Cosmic", "Tech", "Music", "Gaming", "Science", "Nature")

@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onVideoClick: (String) -> Unit,
    onChannelClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onUploadClick: () -> Unit,
    onProfileClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val videos by viewModel.filteredVideos.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        YuniverseTopBar(
            onSearchClick = onSearchClick,
            onUploadClick = onUploadClick,
            onProfileClick = onProfileClick
        )

        CategoryChipsRow(
            categories = categories,
            selectedCategory = selectedCategory,
            onCategorySelected = { viewModel.onCategorySelected(it) }
        )

        if (isRefreshing) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    color = PrimaryViolet,
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp
                )
            }
        }

        if (videos.isEmpty() && !isRefreshing) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(36.dp))
                            .background(DarkSurfaceVariant),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.VideoLibrary,
                            contentDescription = null,
                            tint = PrimaryViolet,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No videos available yet",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Upload the first landscape video or check back soon",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    IconButton(
                        onClick = { viewModel.refreshVideos() },
                        modifier = Modifier.testTag("refresh_home_button")
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryViolet)
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
                    .testTag("videos_list")
            ) {
                item { Spacer(modifier = Modifier.height(8.dp)) }
                items(videos, key = { it.id }) { video ->
                    VideoCard(
                        video = video,
                        onClick = { onVideoClick(video.id) },
                        onChannelClick = { onChannelClick(video.v2iUserId) }
                    )
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}
