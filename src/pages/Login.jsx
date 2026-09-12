import React, { useState } from "react";
import { v2iSupabase } from "../lib/v2iSupabase";

function getOrCreateDeviceId() {
  const storageKey = "v2i_device_id";

  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId = `${Date.now()}-${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

function getDeviceInfo() {
  const userAgent = navigator.userAgent || "";

  let deviceType = "Desktop";
  let deviceName = "Desktop";
  let browser = "Browser";

  // ==========================================
  // DEVICE
  // ==========================================

  if (/iPhone/i.test(userAgent)) {
    deviceType = "Mobile";
    deviceName = "iPhone";
  } else if (/iPad/i.test(userAgent)) {
    deviceType = "Tablet";
    deviceName = "iPad";
  } else if (/Android/i.test(userAgent)) {
    deviceType = /Mobile/i.test(userAgent)
      ? "Mobile"
      : "Tablet";

    const androidMatch = userAgent.match(
      /Android[^;]*;\s*(?:[a-zA-Z]{2}-[a-zA-Z]{2};\s*)?(?:wv;\s*)?([^;)]+)/
    );

    if (androidMatch?.[1]) {
      const model = androidMatch[1].trim();

      if (
        model &&
        !model.toLowerCase().includes("build") &&
        model.length < 80
      ) {
        deviceName = model;
      } else {
        deviceName = "Android Device";
      }
    } else {
      deviceName = "Android Device";
    }
  } else if (/Windows/i.test(userAgent)) {
    deviceType = "Desktop";
    deviceName = "Windows PC";
  } else if (/Macintosh/i.test(userAgent)) {
    deviceType = "Desktop";
    deviceName = "Mac";
  } else if (/Linux/i.test(userAgent)) {
    deviceType = "Desktop";
    deviceName = "Linux PC";
  }

  // ==========================================
  // BROWSER
  // ==========================================

  if (/Edg/i.test(userAgent)) {
    browser = "Microsoft Edge";
  } else if (/OPR|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/Chrome/i.test(userAgent)) {
    browser = "Google Chrome";
  } else if (/Firefox/i.test(userAgent)) {
    browser = "Firefox";
  } else if (/Safari/i.test(userAgent)) {
    browser = "Safari";
  }

  return {
    deviceId: getOrCreateDeviceId(),
    deviceName,
    deviceType,
    browser,
    userAgent,
  };
}

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
      // ==========================================
      // V2i ID → INTERNAL LOGIN ID
      // ==========================================

      const loginId = `${cleanId}@v2i.com`;

      // ==========================================
      // STEP 1: V2i SUPABASE AUTHENTICATION
      // ==========================================

      const {
        data: authData,
        error: authError,
      } = await v2iSupabase.auth.signInWithPassword({
        email: loginId,
        password: password,
      });

      if (authError) {
        console.error(
          "V2i Auth Error:",
          authError
        );

        throw authError;
      }

      const authUser = authData?.user;

      if (!authUser) {
        throw new Error(
          "V2i account nahi mila."
        );
      }

      // ==========================================
      // STEP 2: V2i PROFILE LOAD
      // ==========================================

      let profile = null;

      const {
        data: profileData,
        error: profileError,
      } = await v2iSupabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "V2i profile fetch error:",
          profileError
        );
      } else {
        profile = profileData;
      }

      // ==========================================
      // STEP 3: V2i USER OBJECT
      // ==========================================

      const userData = {
        id: authUser.id,

        authUser: authUser,

        profile: profile,

        v2iId:
          profile?.v2i_id ||
          authUser.user_metadata?.v2i_id ||
          loginId,

        username:
          profile?.username ||
          authUser.user_metadata?.username ||
          cleanId,

        fullName:
          profile?.full_name ||
          authUser.user_metadata?.full_name ||
          cleanId,

        firstName:
          profile?.first_name ||
          authUser.user_metadata?.first_name ||
          "",

        lastName:
          profile?.last_name ||
          authUser.user_metadata?.last_name ||
          "",
      };

      // ==========================================
      // STEP 4: GET DEVICE INFORMATION
      // ==========================================

      const deviceInfo = getDeviceInfo();

      console.log(
        "Yuniverse device information:",
        deviceInfo
      );

      // ==========================================
      // STEP 5: REGISTER YUNIVERSE
      // IN V2i CONNECTED APPS
      // ==========================================

      const {
        data: existingApp,
        error: existingAppError,
      } = await v2iSupabase
        .from("connected_apps")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("app_name", "Yuniverse")
        .maybeSingle();

      if (existingAppError) {
        console.error(
          "Connected app check error:",
          existingAppError
        );
      }

      // ==========================================
      // APP ALREADY CONNECTED
      // ==========================================

      if (existingApp?.id) {
        const {
          error: updateError,
        } = await v2iSupabase
          .from("connected_apps")
          .update({
            status: "Connected",
            last_used_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", existingApp.id)
          .eq("user_id", authUser.id);

        if (updateError) {
          console.error(
            "Connected app update error:",
            updateError
          );
        }
      }

      // ==========================================
      // FIRST TIME CONNECTION
      // ==========================================

      if (!existingApp?.id) {
        const {
          error: insertError,
        } = await v2iSupabase
          .from("connected_apps")
          .insert({
            user_id: authUser.id,
            app_name: "Yuniverse",
            app_type: "Video Platform",
            app_icon: "Y",
            status: "Connected",
            last_used_at:
              new Date().toISOString(),
            connected_at:
              new Date().toISOString(),
          });

        if (insertError) {
          console.error(
            "Connected app insert error:",
            insertError
          );
        }
      }

      // ==========================================
      // STEP 6: REGISTER DEVICE SESSION
      // ==========================================

      const {
        error: deviceError,
      } = await v2iSupabase
        .from("device_sessions")
        .upsert(
          {
            user_id: authUser.id,

            app_name: "Yuniverse",

            device_id:
              deviceInfo.deviceId,

            device_name:
              deviceInfo.deviceName,

            device_type:
              deviceInfo.deviceType,

            browser:
              deviceInfo.browser,

            user_agent:
              deviceInfo.userAgent,

            last_active_at:
              new Date().toISOString(),

            is_current: true,

            revoked_at: null,
          },
          {
            onConflict:
              "user_id,app_name,device_id",
          }
        );

      if (deviceError) {
        console.error(
          "Device session registration error:",
          deviceError
        );
      }

      // ==========================================
      // STEP 7: LOCAL YUNIVERSE SESSION
      // ==========================================

      localStorage.setItem(
        "yuniverse_user",
        JSON.stringify(userData)
      );

      localStorage.setItem(
        "v2i_current_device_id",
        deviceInfo.deviceId
      );

      console.log(
        "Yuniverse login successful:",
        userData
      );

      console.log(
        "Yuniverse connected with V2i ID successfully."
      );

      // ==========================================
      // STEP 8: SEND USER TO YUNIVERSE
      // ==========================================

      onLogin?.(userData);

    } catch (err) {
      console.error(
        "Yuniverse login error:",
        err
      );

      setError(
        err?.message ||
          "V2i ID ya password incorrect hai."
      );
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

        <p className="brand-subtitle">
          Your world of video
        </p>

        <h1>
          Welcome back
        </h1>

        <p className="login-description">
          Login with your V2i ID
        </p>

        {/* ERROR */}

        {error && (
          <div className="message error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>

          {/* V2i ID */}

          <div className="form-group">

            <label>
              V2i ID
            </label>

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

              <span>
                @v2i.com
              </span>

            </div>

          </div>

          {/* PASSWORD */}

          <div className="form-group">

            <label>
              Password
            </label>

            <div className="password-input">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
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
                onClick={() =>
                  setShowPassword(
                    (previous) => !previous
                  )
                }
                disabled={loading}
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        {/* V2i INFO */}

        <div className="login-divider">
          <span>
            V2i Identity
          </span>
        </div>

        <p className="login-footer">
          Don't have a V2i ID?
        </p>

        <p className="login-note">
          Create your V2i ID from the V2i app.
        </p>

      </div>
    </div>
  );
}