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

async function getKeyFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

async function setKeyInStorage(
  keyValuePairs: Record<string, any>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(keyValuePairs, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function removeKeysFromStorage(keys: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function handleMessage(
  { action, value }: Message,
  response: ResponseCallback
) {
  if (action === "signin") {
    console.log("requesting auth");
    const { data, error } = await supabase.auth.signInWithPassword(value);
    console.log("token expiration", data.session.expires_at);
    if (data) {
      await setKeyInStorage({
        [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
        [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
        [chromeStorageKeys.supabaseUserData]: data.user,
        [chromeStorageKeys.supabaseExpiration]: data.session.expires_at,
      });
      console.log("User data stored in chrome.storage.sync");
      response({ data, error });
    } else {
      response({ data: null, error: "No active session" });
    }
  } else if (action === "signup") {
    const { data, error } = await supabase.auth.signUp(value);
    if (data) {
      await setKeyInStorage({
        [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
        [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
        [chromeStorageKeys.supabaseUserData]: data.user,
        [chromeStorageKeys.supabaseExpiration]: data.session.expires_at,
      });
      console.log("User data stored in chrome.storage.sync");
      response({ message: "Successfully signed up!", data: data });
    } else {
      response({ data: null, error: error?.message || "Signup failed" });
    }
  } else if (action === "signout") {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      await removeKeysFromStorage([
        chromeStorageKeys.supabaseAccessToken,
        chromeStorageKeys.supabaseRefreshToken,
        chromeStorageKeys.supabaseUserData,
        chromeStorageKeys.supabaseExpiration,
      ]);
      console.log("User data removed from chrome.storage.sync");
      response({ message: "Successfully signed out!" });
    } else {
      response({ error: error?.message || "Signout failed" });
    }
  } else if (action === "refresh") {
    const refreshToken = (await getKeyFromStorage(
      chromeStorageKeys.supabaseRefreshToken
    )) as string;
    if (refreshToken) {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (data) {
        await setKeyInStorage({
          [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
          [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
          [chromeStorageKeys.supabaseUserData]: data.user,
          [chromeStorageKeys.supabaseExpiration]: data.session.expires_at,
        });

        console.log("User data refreshed in chrome.storage.sync");
        response({ data: data });
      } else {
        response({ data: null, error: "Refresh failed" });
      }
    } else {
      response({ data: null, error: "No refresh token available" });
    }
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

  try {
    const supabaseAccessToken = await getKeyFromStorage(
      chromeStorageKeys.supabaseAccessToken
    );

    if (!supabaseAccessToken) {
      console.error("No Supabase access token found");
      return;
    }

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
});

/* chrome.storage.sync.get(
  chromeStorageKeys.supabaseAccessToken,
  async (result) => {
    const accessToken = result[chromeStorageKeys.supabaseAccessToken];
    console.log("refresh token to input", accessToken);
  }
); */
