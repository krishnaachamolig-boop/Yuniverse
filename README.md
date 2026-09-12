# Yuniverse (Android Native)

Yuniverse is a high-fidelity video sharing and streaming application built natively for Android using Kotlin, Jetpack Compose, and Material Design 3.

## Overview
- **UI Architecture:** 100% Jetpack Compose with Material 3 theming, edge-to-edge system bar integration, and fluid reactive state flows.
- **Video Experience:** Dedicated 16:9 landscape video playback surfaces, custom adaptive player controls, and Mux HLS streaming support.
- **Data Persistence:** Local Room database engine caching videos, playlists, watch history, and user preferences with offline resilience.
- **Authentication & Gateway:** Integrated V2i authentication provider with device session tracking and connected application sync.
- **Navigation:** Modern Compose Navigation graph with type-safe routing across Home, Watch, Channel, Search, Upload, Subscriptions, Playlists, Profile, and Settings screens.

## Technical Architecture
- **Language:** Kotlin 1.9
- **UI Framework:** Jetpack Compose + Material 3
- **Local Database:** Room 2.6 (`AppDatabase`, `VideoDao`, `UserDao`, `PlaylistDao`)
- **Networking:** Supabase REST & Auth API client via OkHttp & Kotlinx Serialization
- **Image Loading:** Coil Compose
- **Media Engine:** AndroidX Media3 / ExoPlayer HLS support
- **Design System:** Deep space night canvas (`#090B12`) with vibrant cosmic violet accents (`#7C6CFF`) and custom adaptive launcher icon
