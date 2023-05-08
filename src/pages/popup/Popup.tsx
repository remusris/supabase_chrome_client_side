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

  const [title, setTitle] = useState("");
  const [method, setMethod] = useState("");
  const [rating, setRating] = useState("");
  const [formError, setFormError] = useState("");

  //tutorial code
  const [fetchError, setFetchError] = useState(null);
  const [smoothies, setSmoothies] = useState(null);

  const [topics, setTopics] = useState(null);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const [smoothiesLoading, setSmoothiesLoading] = useState(true);

  useEffect(() => {
    // Send a message to the background script to fetch smoothies
    chrome.runtime.sendMessage({ action: "fetchSmoothies" }, (response) => {
      if (response.error) {
        setFetchError("Could not fetch the smoothies");
        setSmoothies(null);
        console.log(response.error);
      } else {
        setSmoothies(response.data);
        console.log("smoothie data", response.data);
        setFetchError(null);
      }
      setSmoothiesLoading(false);
    });
  }, []);

  useEffect(() => {
    // Send a message to the background script to fetch topics
    chrome.runtime.sendMessage({ action: "fetchTopics" }, (response) => {
      if (response.error) {
        setFetchError("Could not fetch the topics");
        setTopics(null); // Assuming you have a state for topics
        console.log(response.error);
      } else {
        setTopics(response.data);
        console.log("topics data", response.data);
        setFetchError(null);
      }
      setTopicsLoading(false); // Assuming you have a state for topicsLoading
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title || !method || !rating) {
      setFormError("All fields must be filled in.");
      return;
    }

    const ratingAsNumber = Number(rating);
    if (isNaN(ratingAsNumber)) {
      setFormError("Rating must be a number.");
      return;
    }

    // Send a message to the background script to add a smoothie
    chrome.runtime.sendMessage(
      { action: "addSmoothie", value: { title, method, rating } },
      (response) => {
        if (response.error) {
          setFormError("Error adding smoothie: " + response.error.message);
        } else {
          setTitle("");
          setMethod("");
          setRating("");
          setFormError("");
          // Refresh smoothies
          chrome.runtime.sendMessage(
            { action: "fetchSmoothies" },
            (response) => {
              if (response.error) {
                setFetchError("Could not fetch the smoothies");
                setSmoothies(null);
              } else {
                setSmoothies(response.data);
                setFetchError(null);
              }
              setSmoothiesLoading(false); // Add this line
            }
          );
        }
      }
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 16 }}>
      {loading ? (
        <div>Loading...</div>
      ) : user ? (
        <>
          <div>
            {user.email} - {user.id}
            <br />
            Token Expiration: {new Date(expiration * 1000).toLocaleString()}
            <button onClick={handleSignout}>Sign out</button>
            <button onClick={handleRefresh}>Refresh Token</button>
          </div>
          {smoothiesLoading ? (
            <div>Loading smoothies...</div>
          ) : smoothies ? (
            <div>
              <h3>Smoothies:</h3>
              <ul>
                {smoothies.map((smoothie: any) => (
                  <li key={smoothie.id}>
                    {smoothie.title} - {smoothie.method} - {smoothie.rating}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>{fetchError ? fetchError : "No smoothies found"}</div>
          )}
          {topicsLoading ? (
            <div>Loading topics...</div>
          ) : topics ? (
            <div>
              <h3>Topics:</h3>
              <ul>
                {topics.map((topic: any) => (
                  <li key={topic.id}>
                    {topic.title} - {topic.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>{fetchError ? fetchError : "No topics found"}</div>
          )}
          <div>
            <h3>Add a new smoothie:</h3>
            <form onSubmit={handleSubmit}>
              <label>Title:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <br />
              <label>Method:</label>
              <input
                type="text"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
              <br />
              <label>Rating:</label>
              <input
                type="text"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
              <br />
              <button type="submit">Add Smoothie</button>
            </form>
            {formError && <div>{formError}</div>}
          </div>
        </>
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
