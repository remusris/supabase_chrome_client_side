import React from "react";
import "@pages/popup/Popup.css";
import type { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const chromeStorageKeys = {
  supabaseAccessToken: "supabaseAccessToken",
  supabaseRefreshToken: "supabaseRefreshToken",
  supabaseUserData: "supabaseUserData",
  supabaseExpiration: "supabaseExpiration",
};

function IndexOptions() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [expiration, setExpiration] = useState(0);
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  //new useEffect
  /* useEffect(() => {
    chrome.storage.sync.get(
      [
        chromeStorageKeys.supabaseAccessToken,
        chromeStorageKeys.supabaseExpiration,
        chromeStorageKeys.supabaseUserData,
      ],
      (result) => {
        if (result && result[chromeStorageKeys.supabaseAccessToken]) {
          const currentTime = Date.now() / 1000; // convert to seconds
          const timeUntilExpiration =
            result[chromeStorageKeys.supabaseExpiration] - currentTime;

          if (timeUntilExpiration > 0) {
            // Token is not expired, set user data and expiration
            setUser(result[chromeStorageKeys.supabaseUserData]);
            setExpiration(result[chromeStorageKeys.supabaseExpiration]);

            if (timeUntilExpiration < 24 * 60 * 60) {
              // less than 24 hours left
              // Token is about to expire, request a refresh
              chrome.runtime.sendMessage({ action: "refresh" }, (response) => {
                if (response.error) {
                  console.log("Error refreshing token: " + response.error);
                } else {
                  console.log("Token refreshed successfully");
                  console.log("data", response.data);
                  setUser(response.data.user);
                  setExpiration(response.data.session.expires_at);
                }
              });
            }
          } else {
            // Token is expired
            console.log("Session expired");
            // Handle session expiration: redirect to login, show a message, etc.
          }
        }
      }
    );
  }, []); */
  useEffect(() => {
    chrome.storage.sync.get(
      [
        chromeStorageKeys.supabaseAccessToken,
        chromeStorageKeys.supabaseExpiration,
        chromeStorageKeys.supabaseUserData,
      ],
      (result) => {
        if (result && result[chromeStorageKeys.supabaseAccessToken]) {
          const currentTime = Date.now() / 1000; // convert to seconds
          const timeUntilExpiration =
            result[chromeStorageKeys.supabaseExpiration] - currentTime;

          const refreshAndUpdate = () => {
            chrome.runtime.sendMessage({ action: "refresh" }, (response) => {
              if (response.error) {
                console.log("Error refreshing token: " + response.error);
              } else {
                setLoading(false);
                console.log("Token refreshed successfully");
                setUser(response.data.user);
                setExpiration(response.data.session.expires_at);
              }
            });
          };

          if (timeUntilExpiration <= 0) {
            // Token is expired, request a refresh and update user and expiration
            console.log("Session expired, refreshing token");
            refreshAndUpdate();
          } else {
            // Token is not expired, set user data and expiration
            setUser(result[chromeStorageKeys.supabaseUserData]);
            setExpiration(result[chromeStorageKeys.supabaseExpiration]);

            if (timeUntilExpiration < 24 * 60 * 60) {
              // less than 24 hours left, request a refresh and update user and expiration
              console.log("Token is about to expire, refreshing token");
              refreshAndUpdate();
            } else {
              setLoading(false); // Add this line
            }
          }
        } else {
          setLoading(false); // Add this line
        }
      }
    );
  }, []);

  async function handleLogin(username: string, password: string) {
    try {
      // Send a message to the background script to initiate the login
      chrome.runtime.sendMessage(
        { action: "signin", value: { email: username, password: password } },
        (response) => {
          if (response.error) {
            alert("Error with auth: " + response.error.message);
          } else if (response.data?.user) {
            setUser(response.data.user);
            setExpiration(response.data.session.expires_at);
          }
        }
      );
    } catch (error) {
      console.log("error", error);
      alert(error.error_description || error);
    }
  }

  async function handleSignup(username: string, password: string) {
    try {
      // Send a message to the background script to initiate the signup
      chrome.runtime.sendMessage(
        { action: "signup", value: { email: username, password: password } },
        (response) => {
          if (response.error) {
            alert("Error with auth: " + response.error.message);
          } else if (response.data?.user) {
            alert("Signup successful, confirmation mail should be sent soon!");
          }
        }
      );
    } catch (error) {
      console.log("error", error);
      alert(error.error_description || error);
    }
  }

  async function handleSignout() {
    try {
      // Send a message to the background script to initiate the signout
      chrome.runtime.sendMessage(
        { action: "signout", value: null },
        (response) => {
          if (response.error) {
            alert("Error signing out: " + response.error.message);
          } else {
            setUser(null);
            setExpiration(0);
          }
        }
      );
    } catch (error) {
      console.log("error", error);
      alert(error.error_description || error);
    }
  }

  async function handleRefresh() {
    try {
      // Send a message to the background script to refresh the session
      chrome.runtime.sendMessage(
        { action: "refresh", value: null },
        (response) => {
          if (response.error) {
            console.log("Error refreshing token: " + response.error.message);
          } else {
            console.log("Token refreshed successfully");
            setUser(response.data.user);
            setExpiration(response.data.session.expires_at);
          }
        }
      );
    } catch (error) {
      console.log("error", error);
      alert(error.error_description || error);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 16 }}>
      {loading ? (
        <div>Loading...</div>
      ) : user ? (
        <div>
          {user.email} - {user.id}
          <br />
          Token Expiration: {new Date(expiration * 1000).toLocaleString()}
          <button onClick={handleSignout}>Sign out</button>
          <button onClick={handleRefresh}>Refresh Token</button>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <label>Email</label>
            <input
              type="text"
              placeholder="Your Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                handleSignup(username, password);
              }}
            >
              Sign up
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                handleLogin(username, password);
              }}
            >
              Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default IndexOptions;

//another example of older useEffect code

//older useEffect code
/* useEffect(() => {
  chrome.storage.sync.get([
    chromeStorageKeys.supabaseAccessToken, 
    chromeStorageKeys.supabaseExpiration, 
    chromeStorageKeys.supabaseUserData], 
    (result) => {
      if (result && result[chromeStorageKeys.supabaseAccessToken]) {
        const currentTime = Date.now() / 1000; // convert to seconds
        if (result[chromeStorageKeys.supabaseExpiration] > currentTime) {
          // Token is not expired, set user data and expiration
          setUser(result[chromeStorageKeys.supabaseUserData]);
          setExpiration(result[chromeStorageKeys.supabaseExpiration]);
        } else {
          // Token is expired
          console.log("Session expired");
          // Handle session expiration: redirect to login, show a message, etc.
        }
      }
    }
  );
}, []); */

/* return (
  <div style={{ display: "flex", flexDirection: "column", padding: 16 }}>
    {user && (
      <div>
        {user.email} - {user.id}
        <br />
        Token Expiration: {new Date(expiration * 1000).toLocaleString()}
        <button onClick={handleSignout}>Sign out</button>
        <button onClick={handleRefresh}>Refresh Token</button>
      </div>
    )}
    {!user && (
      <div>
        <div className="mb-4">
          <label>Email</label>
          <input
            type="text"
            placeholder="Your Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label>Password</label>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              handleSignup(username, password);
            }}
          >
            Sign up
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              handleLogin(username, password);
            }}
          >
            Login
          </button>
        </div>
      </div>
    )}
  </div>
); */
