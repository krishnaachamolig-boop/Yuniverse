package com.yuniverse.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.yuniverse.app.data.local.AppDatabase
import com.yuniverse.app.data.remote.SupabaseClient
import com.yuniverse.app.data.repository.YuniverseRepository
import com.yuniverse.app.ui.screens.HomeScreen
import com.yuniverse.app.ui.theme.YuniverseTheme
import com.yuniverse.app.ui.viewmodel.AppViewModel
import com.yuniverse.app.ui.viewmodel.AppViewModelFactory

class MainActivity : ComponentActivity() {
    private val database by lazy { AppDatabase.getDatabase(this) }
    private val repository by lazy { YuniverseRepository(database, SupabaseClient()) }
    private val viewModel: AppViewModel by viewModels { AppViewModelFactory(repository) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            YuniverseTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    HomeScreen(
                        viewModel = viewModel,
                        onVideoClick = { /* Watch */ },
                        onChannelClick = { /* Channel */ },
                        onSearchClick = { /* Search */ },
                        onUploadClick = { /* Upload */ },
                        onProfileClick = { /* Profile */ },
                        modifier = Modifier.padding(innerPadding)
                    )
                }
            }
        }
    }
}
