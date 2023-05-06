import reloadOnUpdate from "virtual:reload-on-update-in-background-script";

reloadOnUpdate("pages/background");

/**
 * Extension reloading is necessary because the browser automatically caches the css.
 * If you do not use the css of the content script, please delete it.
 */
reloadOnUpdate("pages/content/style.scss");

console.log("background loaded");

type SupabaseClient = ReturnType<typeof createClient>;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xmduxigoopgpitwcmbud.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZHV4aWdvb3BncGl0d2NtYnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODI0NjExMjIsImV4cCI6MTk5ODAzNzEyMn0.L_QutBA50HRPuSSvKwGtIj6L5FjE4GYwuQ3Ujwrehqs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
type Message =
  | {
      action: "getSession" | "signout" | "refresh";
      value: null;
    }
  | {
      action: "signup" | "signin";
      value: {
        email: string;
        password: string;
      };
    }
  | {
      action: "addSmoothie";
      value: {
        title: string;
        method: string;
        rating: number;
      };
    }
  | {
      action: "fetchSmoothies";
      value: null;
    }
  | {
      action: "fetchTopics";
      value: null;
    };

type ResponseCallback = (data: any) => void;

const chromeStorageKeys = {
  supabaseAccessToken: "supabaseAccessToken",
  supabaseRefreshToken: "supabaseRefreshToken",
  supabaseUserData: "supabaseUserData",
  supabaseExpiration: "supabaseExpiration",
};

async function handleMessage(
  { action, value }: Message,
  response: ResponseCallback
) {
  /* const getSupabaseClient = async (): Promise<SupabaseClient> => {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        chromeStorageKeys.supabaseAccessToken,
        (result) => {
          const accessToken = result[chromeStorageKeys.supabaseAccessToken];
          const supabase = createClient(SUPABASE_URL, accessToken);
          resolve(supabase);
        }
      );
    });
  }; */

  if (action === "signin") {
    console.log("requesting auth");
    const { data, error } = await supabase.auth.signInWithPassword(value);
    console.log("token expiration", data.session.expires_at);
    if (data) {
      chrome.storage.sync.set(
        {
          [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
          [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
          [chromeStorageKeys.supabaseUserData]: data.user,
          [chromeStorageKeys.supabaseExpiration]: data.session.expires_at,
        },
        () => {
          console.log("User data stored in chrome.storage.sync");
        }
      );
      response({ data, error });
    } else {
      response({ data: null, error: "No active session" });
    }
  } else if (action === "signup") {
    const { data, error } = await supabase.auth.signUp(value);
    if (data) {
      chrome.storage.sync.set(
        {
          [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
          [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
          [chromeStorageKeys.supabaseUserData]: data.user,
          [chromeStorageKeys.supabaseExpiration]: data.session.expires_at,
        },
        () => {
          console.log("User data stored in chrome.storage.sync");
        }
      );
      response({ message: "Successfully signed up!", data: data });
    } else {
      response({ data: null, error: error?.message || "Signup failed" });
    }
  } else if (action === "signout") {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      // Clear user data from chrome.storage.sync
      chrome.storage.sync.remove(
        [
          chromeStorageKeys.supabaseAccessToken,
          chromeStorageKeys.supabaseRefreshToken,
          chromeStorageKeys.supabaseUserData,
          chromeStorageKeys.supabaseExpiration,
        ],
        () => {
          console.log("User data removed from chrome.storage.sync");
        }
      );
      response({ message: "Successfully signed out!" });
    } else {
      response({ error: error?.message || "Signout failed" });
    }
  } else if (action === "refresh") {
    chrome.storage.sync.get(
      chromeStorageKeys.supabaseRefreshToken,
      async (result) => {
        const refreshToken = result[chromeStorageKeys.supabaseRefreshToken];
        console.log("refresh token to input", refreshToken);
        if (refreshToken) {
          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
          });
          console.log("data from refresh", data);
          if (data) {
            console.log("data fetch", data.session.user);
            chrome.storage.sync.set(
              {
                [chromeStorageKeys.supabaseAccessToken]:
                  data.session.access_token,
                [chromeStorageKeys.supabaseRefreshToken]:
                  data.session.refresh_token,
                [chromeStorageKeys.supabaseUserData]: data.user,
                [chromeStorageKeys.supabaseExpiration]: data.session.expires_at,
              },
              () => {
                console.log("User data refreshed in chrome.storage.sync");
              }
            );
            response({ data: data });
          } else {
            response({ data: null, error: "Refresh failed" });
          }
        } else {
          response({ data: null, error: "No refresh token available" });
        }
      }
    );
  } else if (action === "fetchSmoothies") {
    const { data, error } = await supabase.from("smoothies").select();

    if (error) {
      response({
        data: null,
        error: error.message || "Fetching smoothies failed",
      });
    } else {
      response({ data, error: null });
    }
  } else if (action === "addSmoothie") {
    try {
      const { title, method, rating } = value;
      const { data, error } = await supabase
        .from("smoothies")
        .insert([{ title, method, rating }]);
      if (error) {
        response({ error: error.message, data: null });
      } else {
        response({ error: null, data: data });
      }
    } catch (error) {
      response({ error: error.message, data: null });
    }
  } else if (action === "fetchTopics") {
    const { data, error } = await supabase.from("topics").select();

    if (error) {
      response({
        data: null,
        error: error.message || "Fetching topics failed",
      });
    } else {
      response({ data, error: null });
    }
  }
}

//@ts-ignore
chrome.runtime.onMessage.addListener((msg, sender, response) => {
  handleMessage(msg, response);
  return true;
});

// this failed super hard
/* chrome.history.onVisited.addListener(async function (historyItem) {
  console.log("historyItem inside");
  const { error } = await supabase
    .from("url_uploader")
    .insert([{ url: historyItem.url }]);

  if (error) {
    console.log("error", error);
  }
});
 */

chrome.history.onVisited.addListener(async function (historyItem) {
  console.log("historyItem inside");

  const SUPABASE_URL =
    "https://xmduxigoopgpitwcmbud.supabase.co/rest/v1/url_uploader";

  try {
    // Get the supabaseAccessToken from chrome.storage.sync
    chrome.storage.sync.get(
      chromeStorageKeys.supabaseAccessToken,
      async (result) => {
        const supabaseAccessToken =
          result[chromeStorageKeys.supabaseAccessToken];
        console.log("supabaseAccessToken", supabaseAccessToken);
        console.log("historyItem inside 2");

        if (!supabaseAccessToken) {
          console.error("No Supabase access token found");
          return;
        }

        try {
          const response = await fetch(SUPABASE_URL, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${supabaseAccessToken}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ url: historyItem.url }),
          });

          if (!response.ok) {
            const errorResponse = await response.json();
            console.error("Error response:", errorResponse);
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          console.log("URL uploaded successfully:", historyItem.url);
        } catch (error) {
          console.error("Error uploading URL:", error.message);
        }
      }
    );
  } catch (error) {
    console.error("Error fetching Supabase access token:", error.message);
  }
});

/* chrome.storage.sync.get(
  chromeStorageKeys.supabaseAccessToken,
  async (result) => {
    const accessToken = result[chromeStorageKeys.supabaseAccessToken];
    console.log("refresh token to input", accessToken);
  }
); */
