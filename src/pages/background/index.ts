import reloadOnUpdate from "virtual:reload-on-update-in-background-script";

reloadOnUpdate("pages/background");

/**
 * Extension reloading is necessary because the browser automatically caches the css.
 * If you do not use the css of the content script, please delete it.
 */
reloadOnUpdate("pages/content/style.scss");

console.log("background loaded");

import {createClient} from "@supabase/supabase-js"


export const supabase = createClient(
    env.SUPABASE_URL, env.SUPABASE_KEY
)
type Message = {
  action: 'getSession' | 'signout' | 'refresh',
  value: null
} | {
  action: 'signup' | 'signin',
  value: {
    email: string,
    password: string,
  }
}
  
type ResponseCallback = (data: any) => void

const chromeStorageKeys = {
  supabaseAccessToken: "supabaseAccessToken",
  supabaseRefreshToken: "supabaseRefreshToken",
  supabaseUserData: "supabaseUserData",
  supabaseExpiration: "supabaseExpiration"
}

async function handleMessage({ action, value }: Message, response: ResponseCallback) {
    if (action === 'signin') {
        console.log('requesting auth');
        const { data, error } = await supabase.auth.signInWithPassword(value);
        console.log("token expiration", data.session.expires_at)
        if (data) {
          chrome.storage.sync.set({
            [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
            [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
            [chromeStorageKeys.supabaseUserData]: data.user,
            [chromeStorageKeys.supabaseExpiration]: data.session.expires_at
          }, () => {
            console.log("User data stored in chrome.storage.sync");
          });
          response({data, error});
        } else {
          response({data: null, error: 'No active session'});
        }
      } else if (action === 'signup') {
        const { data, error } = await supabase.auth.signUp(value);
        if (data) {
          chrome.storage.sync.set({
            [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
            [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
            [chromeStorageKeys.supabaseUserData]: data.user,
            [chromeStorageKeys.supabaseExpiration]: data.session.expires_at
          }, () => {
            console.log("User data stored in chrome.storage.sync");
          });
          response({message: 'Successfully signed up!', data: data});
        } else {
          response({data: null, error: error?.message || 'Signup failed'});
        }
      } else if (action === 'signout') {
        const { error } = await supabase.auth.signOut();
        if (!error) {
          // Clear user data from chrome.storage.sync
          chrome.storage.sync.remove([
            chromeStorageKeys.supabaseAccessToken,
            chromeStorageKeys.supabaseRefreshToken,
            chromeStorageKeys.supabaseUserData,
            chromeStorageKeys.supabaseExpiration
          ], () => {
            console.log("User data removed from chrome.storage.sync");
          });
          response({ message: 'Successfully signed out!' });
        } else {
          response({ error: error?.message || 'Signout failed' });
        }
      } else if (action === 'refresh') {
        chrome.storage.sync.get(chromeStorageKeys.supabaseRefreshToken, async (result) => {
          const refreshToken = result[chromeStorageKeys.supabaseRefreshToken];
          if (refreshToken) {
            const { data, error } = await supabase.auth.refreshSession(refreshToken);
            if (data) {
              chrome.storage.sync.set({
                [chromeStorageKeys.supabaseAccessToken]: data.session.access_token,
                [chromeStorageKeys.supabaseRefreshToken]: data.session.refresh_token,
                [chromeStorageKeys.supabaseUserData]: data.user,
                [chromeStorageKeys.supabaseExpiration]: data.session.expires_at
              }, () => {
                console.log("User data refreshed in chrome.storage.sync");
              });
              response({ data, error });
            } else {
              response({ data: null, error: 'Refresh failed' });
            }
          } else {
            response({ data: null, error: 'No refresh token available' });
          }
        });
  } 
}

//@ts-ignore
chrome.runtime.onMessage.addListener((msg, sender, response) => {
    handleMessage(msg, response);
    return true;
});