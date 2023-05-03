import React from "react";
import "@pages/popup/Popup.css";
import type { User } from "@supabase/supabase-js"
import { useState, useEffect } from "react"

const chromeStorageKeys = {
  supabaseAccessToken: "supabaseAccessToken",
  supabaseRefreshToken: "supabaseRefreshToken",
  supabaseUserData: "supabaseUserData",
  supabaseExpiration: "supabaseExpiration"
}

function IndexOptions() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [expiration, setExpiration] = useState(0)
  const [user, setUser] = useState<User>(null)

  //new useEffect
  useEffect(() => {
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
      chrome.runtime.sendMessage({ action: "signout", value: null }, (response) => {
        if (response.error) {
          alert("Error signing out: " + response.error.message);
        } else {
          setUser(null);
          setExpiration(0);
        }
      });
    } catch (error) {
      console.log("error", error);
      alert(error.error_description || error);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 16 }}>
      {user && (
        <div>
          {user.email} - {user.id}
          <br />
          Token Expiration: {new Date(expiration * 1000).toLocaleString()}
          <button onClick={handleSignout}>Sign out</button>
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
  );

}

export default IndexOptions