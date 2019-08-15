/*
Some cool ideas:
  - Shortcut/toggle to create a "banner" that displays the currently played song + album cover

Safeguards:
  - Requests / Seconds
  - Duplicate songs
*/

let handler = new ApiFunctions();

//Extension behaviors
chrome.runtime.onInstalled.addListener(function () {
  handler.initializeBaseState();
})

chrome.runtime.onStartup.addListener(async function () {
  console.log('STARTING UP')
  chrome.storage.local.get(['logged_in'], async function (storageObj) {
    if (storageObj.logged_in) {
      var status = await handler.refreshToken().catch(err => console.log(err));
      if (status == "SUCCESS") {
        //Successfully received new access token - user can now continue with normal operations.
        chrome.browserAction.setPopup({ popup: 'popup.html' });
        chrome.alarms.create("getAccess", { periodInMinutes: 59 });
      } else {
        //For whatever reason the token was rejected - re-initialize the program by having the user log-in again.
        console.log("ERROR CODE: " + status);
        handler.initializeBaseState();
      }
    } else {
      console.log('NOT LOGGED IN.')
      chrome.browserAction.setPopup({ popup: 'popup_login.html' });
    }
  })
})

chrome.runtime.onMessage.addListener(
  async function (request, sender, sendResponse) {
    if (request.message == 'launchOauth') {
      console.log('INITIATING AUTHORIZATION FLOW')
      await handler.retrieveAuthorizationFromServer();
      chrome.storage.local.set({ logged_in: true }, function () { });
      chrome.alarms.create("getAccess", {periodInMinutes: 59})
      chrome.browserAction.setPopup({ popup: 'popup.html' });
      await handler.populatePlaylistArray().catch(err => console.log(err));
    } else if (request.message == 'addSong') {
      await handler.addSongToPlaylist(request.id).then(async function (result) {
        if (result == 401 || result == 400) {
          console.log("EXECUTING FIX")
          await handler.refreshToken();
          //Needs to be called twice in order to work on the first time when emergency-refreshing a token.
          await handler.addSongToPlaylist(request.id);
          await handler.addSongToPlaylist(request.id).then(async function(result) {
            //If the refresh token fix doesn't work, then the refresh token is probably deprecated - need to re-initialize the whole app
            if(result == 401) {
              await handler.initializeBaseState();
            }
          });
        }
      });
    } else if (request.message == 'skip') {
      await handler.skipSong().then(async function (result) {
        if (result == 401 || result == 400) {
          await handler.refreshToken();
          await handler.skipSong().then(async function(result) {
            if(result == 401) {
              await handler.initializeBaseState();
            }
          });;
        }
      });
    } else if (request.message == 'playPause') {
      await handler.playPause().then(async function (result) {
        if (result == 401 || result == 400) {
          await handler.refreshToken();
          await handler.playPause().then(async function(result) {
            if(result == 401) {
              await handler.initializeBaseState();
            }
          });;;
        }
      });
    } else if (request.message == 'previous') {
      await handler.previousSong().then(async function (result) {
        if (result == 401 || result == 400) {
          await handler.refreshToken();
          await handler.previousSong().then(async function(result) {
            if(result == 401) {
              await handler.initializeBaseState();
            }
          });;;
        }
      });
    } else if (request.message == 'restart') {
      await handler.restartSong().then(async function (result) {
        if (result == 401 || result == 400) {
          await handler.refreshToken();
          await handler.restartSong().then(async function(result) {
            if(result == 401) {
              await handler.initializeBaseState();
            }
          });;;
        }
      });
    } else if (request.message == 'invalidate') {
      await handler.sendBannerToUser();
    } else if (request.message == 'refresh') {
      await handler.refreshToken().then(async function(result) {
        if(result == 401) {
          await handler.initializeBaseState();
        }
      });;;
    }
  }
)

chrome.alarms.onAlarm.addListener(async function (alarm) {
  if (alarm.name == "getAccess") {
    await handler.refreshToken().catch(err => console.log(err));
  }
})

chrome.commands.onCommand.addListener(async function (command) {
  if (command == "add_current_song") {
    chrome.storage.local.get(['target_playlist_id'], async function (response) {
      await handler.addSongToPlaylist(response.target_playlist_id).then(async function (result) {
        if (result == 401 || result == 400) {
          handler.refreshToken();
          handler.addSongToPlaylist().then(async function(result) {
            if(result == 401) {
              await handler.initializeBaseState();
            }
          });;;
        }
      });
    })
  } else if (command == 'skip_song') {
    await handler.skipSong().then(async function (result) {
      if (result == 401 || result == 400) {
        await handler.refreshToken();
        await handler.skipSong().then(async function(result) {
          if(result == 401) {
            await handler.initializeBaseState();
          }
        });;;
      }
    });
  } else if (command == 'play_pause') {
    await handler.playPause().then(async function (result) {
      if (result == 401 || result == 400) {
        await handler.refreshToken();
        await handler.playPause().then(async function(result) {
          if(result == 401) {
            await handler.initializeBaseState();
          }
        });;;
      }
    });
  } else if (command == 'current_song') {
    await handler.sendBannerToUser().then(async function (result) {
      if (result == 401 || result == 400) {
        await handler.refreshToken();
        await handler.sendBannerToUser().then(async function(result) {
          if(result == 401) {
            await handler.initializeBaseState();
          }
        });;;
      }
    });
  }
})

chrome.idle.setDetectionInterval(1800000)

let time = 0;

chrome.idle.onStateChanged.addListener(
  async function (state) {
    if (state == 'locked') {
      console.log('LOCKED')
      chrome.storage.local.set({ old_state: "locked" }, function () { });
      time = performance.now();
      console.log(time);
    } else {
      console.log(state);
      chrome.storage.local.get(['old_state'], async function (storageObj) {
        if (storageObj.old_state == 'locked') {
          var changeTime = performance.now();
          //check if the changes in time are greater than 50 minutes, if so then refresh the token
          if (Math.abs(changeTime - time) > 3000000) {
            console.log("TRIGGERING TOKEN REFRESH")
            await handler.refreshToken().then(res => {
              chrome.alarms.create("getAccess", { periodInMinutes: 59 });
            });
          } else {
            console.log("NO REFRESH NECESSARY")
          }
        }
      })
    }
  }
)