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
import cuid from "cuid";
import { v4 as uuidv4 } from "uuid";

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

/* chrome.history.onVisited.addListener(async function (historyItem) {
  console.log("historyItem inside");

  const SUPABASE_URL_ =
    "https://xmduxigoopgpitwcmbud.supabase.co/rest/v1/url_uploader";

  try {
    const supabaseAccessToken = await getKeyFromStorage(
      chromeStorageKeys.supabaseAccessToken
    );

    if (!supabaseAccessToken) {
      console.error("No Supabase access token found");
      return;
    }

    const response = await fetch(SUPABASE_URL_, {
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
}); */

chrome.history.onVisited.addListener(async function (historyItem) {
  console.log("historyItem inside");

  const SUPABASE_URL_ =
    "https://xmduxigoopgpitwcmbud.supabase.co/rest/v1/url_uploader";

  try {
    const supabaseAccessToken = await getKeyFromStorage(
      chromeStorageKeys.supabaseAccessToken
    );

    if (!supabaseAccessToken) {
      console.error("No Supabase access token found");
      return;
    }

    const randomId = uuidv4();

    const response = await fetch(SUPABASE_URL_, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${supabaseAccessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ url: historyItem.url, id: randomId }),
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

// delete this
/* chrome.history.onVisited.addListener(async function (historyItem) {
  console.log("historyItem inside");

  const SUPABASE_URL_ =
    "https://xmduxigoopgpitwcmbud.supabase.co/rest/v1/url_uploader";

  try {
    const supabaseAccessToken = await getKeyFromStorage(
      chromeStorageKeys.supabaseAccessToken
    );

    if (!supabaseAccessToken) {
      console.error("No Supabase access token found");
      return;
    }

    const ID_COLUMN = "id";
    const URL_COLUMN = "url";

    const idValue = uuidv4();
    console.log("idValue", idValue);
    const urlValue = historyItem.url;

    const payload = {
      [ID_COLUMN]: idValue,
      [URL_COLUMN]: urlValue,
    };

    const response = await fetch(SUPABASE_URL_, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${supabaseAccessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
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
 */
// chrome.history.onVisited.addListener(function (historyItem) {
//   // isActiveSessionChecker(historyItem)
//   objectToPush.push(Object.assign(historyItem, { type: "historyItem" }));
//   // objectToPush2.push(Object.assign(historyItem, {type: "historyItem"}))
//   historyItemList.push(Object.assign(historyItem, { type: "historyItem" }));
//   console.log("marker - historyItemList", historyItemList);
//   count = count + 1;
//   console.log("1");

//   //query tab with new URL
//   chrome.tabs.query(
//     { url: historyItem.url },
//     //query the tabItem
//     function (tab) {
//       if (tab[0] != undefined) {
//         objectToPush.push(Object.assign(tab[0], { type: "tabItem" }));
//         // objectToPush2.push(Object.assign(tab[0], {type: "tabItem"}))
//         tabItemList.push(Object.assign(tab[0], { type: "tabItem" }));
//         console.log("2");
//         console.log("tabWindowId check event listener", tab[0].windowId);
//         console.log("tabId check event listener", tab[0].id);
//         //tab.length query
//         if (tab[0].windowId != undefined) {
//           chrome.tabs.query({ windowId: tab[0].windowId }, function (tab) {
//             // objectToPush.push(Object.assign({tabLength: tab.length}, {type: "windowTabLength"}))
//             for (var i = 0, ie = objectToPush.length; i < ie; i++) {
//               if (objectToPush[i].type == "tabItem") {
//                 Object.assign(objectToPush[i], { tabLength: tab.length });
//                 // Object.assign(objectToPush2[i], {tabLength: tab.length})
//                 //this could be added to the main doc instead
//               }
//             }
//             console.log("tabLength", tab.length);
//             console.log("3");
//           });
//         }
//       }

//       //query the active tab
//       chrome.tabs.query(
//         { active: true, lastFocusedWindow: true },
//         function (tab) {
//           console.log("activeTab was queried");
//           if (tab[0] != undefined) {
//             objectToPush.push(Object.assign(tab[0], { type: "activeTabItem" }));
//             activeTabItemList.push(
//               Object.assign(tab[0], { type: "activeTabItem" })
//             );
//             console.log("4");
//             console.log("activeTabId check event listener", tab[0].id);
//             console.log(
//               "activeTabWindowId check event listener",
//               tab[0].windowId
//             );
//           }
//         }
//       );
//     }
//   );

//   //get visitItem data
//   chrome.history.getVisits({ url: historyItem.url }, function (visitItem) {
//     for (var i = 0, ie = visitItem.length; i < ie; i++) {
//       if (
//         visitItem[i].visitTime >= historyItem.lastVisitTime &&
//         visitItem[i].id == historyItem.id
//       ) {
//         objectToPush.push(Object.assign(visitItem[i], { type: "visitItem" }));
//         // objectToPush2.push(Object.assign(visitItem[i], {type: "visitItem"}))
//         visitItemList.push(Object.assign(visitItem[i], { type: "visitItem" }));
//         visitItemList.push({ marker: "indicator" });
//         console.log(visitItemList);
//         console.log("5");
//       }
//     }

//     console.log("6");

//     if (objectToPush.length != 0) {
//       // massConsoleLogger();
//       console.log("count", count);
//       // objectToPush2.push({marker: "indicator"})
//       firebaseUploaderV5(objectToPush);
//       // console.log("second ObjectToPush2", objectToPush2)
//       console.log("7");
//     }
//   });
// });

//list instantiations
let objectToPush = [];
let historyItemList = [];
let tabItemList = [];
let visitItemList = [];
let activeTabItemList = [];

//other
let count = 0;

// async function firebaseUploaderV5(objectToPush) {
//   /* userUID = await getKeyFromLocalStorage("userUID")
//   const usersRefCollection = collection(db, "users")
//   const getUserDoc = doc(usersRefCollection, userUID)
//   const rawBrowsingHistoryCollection = collection(
//     getUserDoc,
//     "Raw Browsing History"
//   ) */

//   const tempHistoryItemList = [];
//   const tempVisitItemList = [];
//   const tempTabItemList = [];
//   const tempActiveTabItemList = [];

//   let historyObjectDocRef;
//   let historyObjectDocId;
//   let tabFaviconUrl;
//   let activeTabId;
//   let tabId;

//   let historyItemUrl;

//   function massConsoleLogger2() {
//     console.log("activeTabId", activeTabId);
//     console.log("tabId", tabId);
//     console.log("tabFaviconUrl", tabFaviconUrl);
//     console.log("historyItemUrl", historyItemUrl);
//   }

//   // console.log("tempActiveTabItemList[0].id 1", tempActiveTabItemList[0].id)
//   // console.log("tempTabItemList[0].id 1", tempTabItemList[0].id)

//   objectToPush.map((obj) => {
//     if (obj.type === "historyItem") {
//       tempHistoryItemList.push(obj);
//     } else if (obj.type === "visitItem") {
//       tempVisitItemList.push(obj);
//     } else if (obj.type === "tabItem") {
//       tempTabItemList.push(obj);
//     } else if (obj.type === "activeTabItem") {
//       tempActiveTabItemList.push(obj);
//     }
//   });

//   tabFaviconUrl = null;
//   let linkTransition = null;
//   let node = null;
//   let timeToExport;

//   console.log("tempActiveTabList", tempActiveTabItemList);
//   console.log("tempActiveTabItemList[0].id 2", tempActiveTabItemList[0].id);
//   console.log("tempTabItemList[0].id 2", tempTabItemList[0].id);

//   function createDocData(linkTransition, node) {
//     if (tempActiveTabItemList[0].id != tempTabItemList[0].id) {
//       console.log("newTab inscriber");
//       linkTransition = "newTab";
//     }

//     if (
//       typeof tempTabItemList[0].favIconUrl === "string" &&
//       tempTabItemList[0].favIconUrl != ""
//     ) {
//       console.log("typeChecker for favIcon");
//       // node = { id: null, img: tempTabItemList[0].favIconUrl };
//       tabFaviconUrl = tempTabItemList[0].favIconUrl;
//       console.log("first node function", node);
//     }

//     if (
//       tempTabItemList[0].favIconUrl == "" ||
//       tempTabItemList[0].favIconUrl == null ||
//       tempTabItemList[0].favIconUrl == undefined
//     ) {
//       console.log("undefined checker for favIconUrl");
//       // node = {id: null, img: getFaviconUrl(tempHistoryItemList[0].url)}
//       tabFaviconUrl = getFaviconUrl(tempHistoryItemList[0].url);
//       console.log("second Node function", node);
//     }

//     timeToExport = Date.now();
//     return {
//       time: timeToExport,
//       count: count,
//       transitionType: tempVisitItemList[0].transition,
//       linkTransition: linkTransition,
//       node: null,
//       link: null,
//       activeTabId: tempActiveTabItemList[0].id,
//       activeTabWindowId: tempActiveTabItemList[0].windowId,
//       tabId: tempTabItemList[0].id,
//       tabStatus: tempTabItemList[0].status,
//       tabWindowId: tempTabItemList[0].windowId,
//       url: tempHistoryItemList[0].url,
//       title: tempHistoryItemList[0].title,
//       tabFaviconUrl: tabFaviconUrl,
//       activeSession: activeSession,
//     };
//   }

//   addDoc(rawBrowsingHistoryCollection, createDocData(linkTransition, node))
//     .then((docRef) => {
//       console.log("1");
//       historyObjectDocId = docRef.id;
//       historyObjectDocRef = doc(
//         rawBrowsingHistoryCollection,
//         historyObjectDocId
//       );

//       getDoc(historyObjectDocRef).then((docSnap) => {
//         console.log("before First Update", docSnap.data());
//         let data = docSnap.data();
//         let favIconUrl = data.tabFaviconUrl;

//         updateDoc(historyObjectDocRef, {
//           node: { id: historyObjectDocId, img: favIconUrl },
//         });
//       });

//       console.log("historyObjectDocId in the addDoc", historyObjectDocId);
//       console.log("2");
//       objectToPush.splice(0, objectToPush.length);
//       console.log("3");
//     })
//     .then(() => {
//       reactForceGraphV5(
//         rawBrowsingHistoryCollection,
//         timeToExport,
//         historyObjectDocId,
//         historyObjectDocRef
//       );
//     });
// }
