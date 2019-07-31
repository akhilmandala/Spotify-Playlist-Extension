/*
Some cool ideas:
  - Shortcut/toggle to create a "banner" that displays the currently played song + album cover

Safeguards:
  - Requests / Seconds
  - Duplicate songs
*/

var authorization_token = 'Bearer ';
var real_url = "REDACTED";
var test_url = "REDACTED"

//Functions

//Resets the extension.
function initializeBaseState() {
  chrome.storage.local.set({ logged_in: false }, function () { });
  chrome.storage.local.set({ gotPlaylists: 0 }, function () { });
  chrome.storage.local.set({ target_playlist_name: "not chosen" }, function () { });
  chrome.storage.local.set({ target_playlist_id: "null" }, function () { });
  chrome.storage.local.set({ refresh_token: "" }, function () { });
  chrome.storage.local.set({ playlists: [] }, function () { });
  chrome.alarms.clearAll(function () { });
  chrome.browserAction.setPopup({ popup: 'popup_login.html' });
}

function retrieveAuthorizationFromServer() {
  return new Promise(resolve => {
    chrome.identity.launchWebAuthFlow({ url: test_url + 'login', interactive: true }, function (redirectUrl) {
      var params = new URLSearchParams(redirectUrl);
      chrome.storage.local.set({refresh_token: params.get('refresh')}, function(){});
      authorization_token = "Bearer " + params.get('authorization');
      resolve("SUCCESS");
    })
  })
}

//Refreshes the user authorization token using their refresh token.
function refreshToken() {
  return new Promise(resolve => {
    console.log("OLD TOKEN: " + authorization_token);
    chrome.storage.local.get(['refresh_token'], function (storageObj) {
      let xhr = new XMLHttpRequest();
      xhr.open('GET', test_url + 'refresh?refresh=' + storageObj.refresh_token)
      xhr.onload = function () {
        console.log('REQUESTING REFRESH TOKEN');
        response = JSON.parse(xhr.response);
        console.log('SUCCESSFULLY RETRIEVED NEW ACCESS TOKEN')
        authorization_token = "Bearer " + response.access_token;
        chrome.storage.local.set({ refresh_token: storageObj.refresh_token }, function () { });
        chrome.storage.local.set({ logged_in: true }, function () { });
        return resolve("SUCCESS");
      }
      xhr.onerror = function () {
        reject(Error({
          status: xhr.status,
          statusText: xhr.statusText
        }))
      }
      xhr.send();
    })
  })
}

//Retrieves the user's playlists and returns it as an array.
function retrieveUserPlaylists() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/playlists", true);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status)
      } else {
        var json_data = xhr.response;
        var playlists = JSON.parse(json_data);
        var playlist_collections = playlists.items;
        var return_array = [];

        playlist_collections.forEach(
          playlist => {
            var playlist_name = playlist.name;
            var playlist_id = playlist.id;
            var json_entry = {
              "name": playlist_name,
              "id": playlist_id
            }

            return_array.push(json_entry);
          }
        );
        return resolve(return_array);
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//After retrieving the user playlists from spotify, this populates the extension page.
function populatePlaylistArray() {
  //begin populating playlist array
  return new Promise(resolve => {
    chrome.storage.local.get(['gotPlaylists'], async function (response) {
      if (response.gotPlaylists == 0) {
        console.log('POPULATING ARRAY - AUTHORIZATION SUCCESFULLY RECEIVED')
        playlist_json_data = await retrieveUserPlaylists();
        console.log(playlist_json_data);
        chrome.storage.local.set({ playlists: playlist_json_data }, function () {
          chrome.storage.local.set({ gotPlaylists: 1 }, function () {
            return resolve("SUCCESS")
          });
        })
      }
    })
  })
}

//Skips the current song.
function skipSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.spotify.com/v1/me/player/next');
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status)
      } else {
        return resolve(xhr.status)
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

function previousSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.spotify.com/v1/me/player/previous');
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status)
      } else {
        return resolve(xhr.status)
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

function restartSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', 'https://api.spotify.com/v1/me/player/seek?position_ms=0');
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status)
      } else {
        return resolve(xhr.status)
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}
/*
KNOWN ERRORS:
- WHEN USER IS IN PRIVATE SESSION, RECEIVES 204 - EMPTY PAYLOAD - MAKE SURE TO ACCOUNT FOR THIS
*/

//Retrieves the user's currently played song.
function retrieveCurrentlyPlayedSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/player/currently-playing", true);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = async function () {
      console.log("STATUS: " + xhr.status)
      if (xhr.status == 401 || xhr.status == 400) {
        console.log("ERROR STATUS: " + xhr.status)
        return resolve(xhr.status)
      } else {
        var currently_listening = JSON.parse(xhr.response);
        console.log(currently_listening);
        var song_details = currently_listening.item;
        var uri = song_details.uri;
        console.log("NAME: " + song_details.name);
        console.log("URI: " + song_details.uri)
        var form = 'uris=' + song_details.uri;
        resolve(form);
      }
    }
    xhr.onerror = function () {
      console.log(xhr.response);
    }
    xhr.send();
  })
}

//Adds the currently listened to song to a target playlist.
async function addSongToPlaylist(targetID) {
  var song = await retrieveCurrentlyPlayedSong().catch(err => console.log(err));

  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', "https://api.spotify.com/v1/playlists/" + targetID + "/tracks?" + song);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status)
      } else {
        resolve('SUCCESSFULLY ADDED')
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//Play/Pause the current song
async function playPause() {
  var is_playing = await isPlaying();
  if (is_playing) {
    await pauseSong();
  } else {
    await playSong();
  }
}

//Checks playback state
function isPlaying() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/player");
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status)
      } else {
        if (xhr.response) {
          response = JSON.parse(xhr.response);
          return resolve(response.is_playing);
        } else {
          return resolve(false);
        }
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//Play/Pause "Play" helper method
function playSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', "https://api.spotify.com/v1/me/player/play");
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status);
      } else {
        return resolve('PLAYING')
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//Play/Pause "Pause" helper method
function pauseSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', "https://api.spotify.com/v1/me/player/pause");
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        return resolve(xhr.status)
      } else {
        return resolve('PAUSED')
      }
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

async function sendBannerToUser() {
  //Retrieve album cover + song name + album name + (marker for song time)? Return data as a JSON entry
  await retrievePlaybackInformation().then(async function (result) {
    //Package the data as a chrome.notifications item and send it
    if (result == 401 || result == 400) {
      await refreshToken();
      await sendBannerToUser();
    } else {
      var templateOptions = {
        "type": "basic",
        "title": result.song_name,
        "message": "From " + result.album_name + " by " + result.artists,
        "silent": true,
        "iconUrl": result.album_cover
      }
      chrome.notifications.create("songInfo", templateOptions, function () { });
      chrome.notifications.clear("songInfo", function () { });
    }
  });
}

function retrievePlaybackInformation() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.spotify.com/v1/me/player");
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = async function () {
      if (xhr.status == 401 || xhr.status == 400) {
        resolve(xhr.status);
      } else {
        var response = JSON.parse(xhr.response);

        var album_name = response.item.album.name;
        var song_name = response.item.name;
        var album_imgs = response.item.album.images;
        var album_img = album_imgs[0].url;
        var duration = response.item.duration_ms;
        var progress = response.progress_ms;
        var artists = response.item.artists;
        var main_artist_name = artists[0].name;

        if (artists.length > 1) {
          main_artist_name += " and others."
        }

        let playback_information = {
          album_name: album_name,
          song_name: song_name,
          album_cover: album_img,
          duration: duration,
          progress: progress,
          artists: main_artist_name
        }

        resolve(playback_information);
      }
    }

    xhr.send();
  })
}

//Extension behaviors
chrome.runtime.onInstalled.addListener(function () {
  initializeBaseState();
})

chrome.runtime.onStartup.addListener(async function () {
  console.log('STARTING UP')
  chrome.storage.local.get(['logged_in'], async function (storageObj) {
    if (storageObj.logged_in) {
      var status = await refreshToken().catch(err => console.log(err));
      if (status == "SUCCESS") {
        //Successfully received new access token - user can now continue with normal operations.
        chrome.browserAction.setPopup({ popup: 'popup.html' });
        chrome.alarms.create("getAccess", { periodInMinutes: 59 });
      } else {
        //For whatever reason the token was rejected - re-initialize the program by having the user log-in again.
        console.log("ERROR CODE: " + status);
        initializeBaseState();
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
      await retrieveAuthorizationFromServer();
      chrome.storage.local.set({ logged_in: true }, function () { });
      chrome.alarms.create("getAccess", {periodInMinutes: 59})
      chrome.browserAction.setPopup({ popup: 'popup.html' });
      await populatePlaylistArray().catch(err => console.log(err));
    } else if (request.message == 'addSong') {
      await addSongToPlaylist(request.id).then(async function (result) {
        if (result == 401 || result == 400) {
          console.log("EXECUTING FIX")
          await refreshToken();
          //Needs to be called twice in order to work on the first time when emergency-refreshing a token.
          await addSongToPlaylist();
          await addSongToPlaylist();
        }
      });
    } else if (request.message == 'skip') {
      await skipSong().then(async function (result) {
        if (result == 401 || result == 400) {
          await refreshToken();
          await skipSong();
        }
      });
    } else if (request.message == 'playPause') {
      await playPause().then(async function (result) {
        if (result == 401 || result == 400) {
          await refreshToken();
          await playPause();
        }
      });
    } else if (request.message == 'previous') {
      await previousSong().then(async function (result) {
        if (result == 401 || result == 400) {
          await refreshToken();
          await previousSong();
        }
      });
    } else if (request.message == 'restart') {
      await restartSong().then(async function (result) {
        if (result == 401 || result == 400) {
          await refreshToken();
          await restartSong();
        }
      });
    } else if (request.message == 'invalidate') {
      await sendBannerToUser();
    } else if (request.message == 'refresh') {
      await refreshToken();
    }
  }
)

chrome.alarms.onAlarm.addListener(async function (alarm) {
  if (alarm.name == "getAccess") {
    await refreshToken().catch(err => console.log(err));
  }
})

chrome.commands.onCommand.addListener(async function (command) {
  if (command == "add_current_song") {
    chrome.storage.local.get(['target_playlist_id'], async function (response) {
      await addSongToPlaylist(response.target_playlist_id).then(async function (result) {
        if (result == 401 || result == 400) {
          refreshToken();
          addSongToPlaylist();
        }
      });
    })
  } else if (command == 'skip_song') {
    await skipSong().then(async function (result) {
      if (result == 401 || result == 400) {
        await refreshToken();
        await skipSong();
      }
    });
  } else if (command == 'play_pause') {
    await playPause().then(async function (result) {
      if (result == 401 || result == 400) {
        await refreshToken();
        await playPause();
      }
    });
  } else if (command == 'restart') {
    await restartSong().then(async function (result) {
      if (result == 401 || result == 400) {
        await refreshToken();
        await restartSong();
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
            await refreshToken().then(res => {
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