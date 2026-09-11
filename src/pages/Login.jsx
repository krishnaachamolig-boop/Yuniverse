import React, { useState } from "react";
import { v2iSupabase } from "../lib/v2iSupabase";

export default function Login({ onLogin }) {
  const [v2iId, setV2iId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function cleanV2iId(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "");
  }

  async function handleLogin(event) {
    event.preventDefault();

    setError("");

    const cleanId = cleanV2iId(v2iId);

    if (!cleanId) {
      setError("V2i ID enter karo.");
      return;
    }

    if (!password) {
      setError("Password enter karo.");
      return;
    }

    setLoading(true);

    try {
      // V2i ID ko internal auth identifier me convert karo
      const loginId = `${cleanId}@v2i.com`;

      // ==========================================
      // STEP 1: V2i SUPABASE AUTHENTICATION
      // ==========================================

      const { data: authData, error: authError } =
        await v2iSupabase.auth.signInWithPassword({
          email: loginId,
          password: password,
        });

      if (authError) {
        throw authError;
      }

      const authUser = authData?.user;

      if (!authUser) {
        throw new Error("V2i account nahi mila.");
      }

      // ==========================================
      // STEP 2: V2i PROFILE LOAD
      // ==========================================

      let profile = null;

      const { data: profileData, error: profileError } = await v2iSupabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("V2i profile fetch error:", profileError);
      } else {
        profile = profileData;
      }

      // ==========================================
      // STEP 3: YUNIVERSE USER OBJECT
      // ==========================================

      const userData = {
        id: authUser.id,

        authUser: authUser,

        profile: profile,

        v2iId: profile?.v2i_id || authUser.user_metadata?.v2i_id || loginId,

        username:
          profile?.username || authUser.user_metadata?.username || cleanId,

        fullName:
          profile?.full_name || authUser.user_metadata?.full_name || cleanId,

        firstName:
          profile?.first_name || authUser.user_metadata?.first_name || "",

        lastName: profile?.last_name || authUser.user_metadata?.last_name || "",
      };

      // ==========================================
      // STEP 4: YUNIVERSE LOCAL SESSION
      // ==========================================

      localStorage.setItem("yuniverse_user", JSON.stringify(userData));

      console.log("Yuniverse login successful:", userData);

      // App.jsx ko user bhejo
      onLogin?.(userData);
    } catch (err) {
      console.error("Yuniverse login error:", err);

      setError(err?.message || "V2i ID ya password incorrect hai.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-page login-page">
      <div className="login-card">
        {/* BRAND */}
        <div className="brand-logo">
          <span>Y</span>universe
        </div>

        <p className="brand-subtitle">Your world of video</p>

        <h1>Welcome back</h1>

        <p className="login-description">Login with your V2i ID</p>

        {/* ERROR */}
        {error && <div className="message error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          {/* V2i ID */}
          <div className="form-group">
            <label>V2i ID</label>

            <div className="v2i-input">
              <input
                type="text"
                value={v2iId}
                onChange={(event) => {
                  setV2iId(event.target.value);
                  setError("");
                }}
                placeholder="yourname"
                autoComplete="username"
                disabled={loading}
              />

              <span>@v2i.com</span>
            </div>
          </div>

          {/* PASSWORD */}
          <div className="form-group">
            <label>Password</label>

            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* LOGIN BUTTON */}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* V2i INFO */}
        <div className="login-divider">
          <span>V2i Identity</span>
        </div>

        <p className="login-footer">Don't have a V2i ID?</p>

        <p className="login-note">Create your V2i ID from the V2i app.</p>
      </div>
    </div>
  );
}
