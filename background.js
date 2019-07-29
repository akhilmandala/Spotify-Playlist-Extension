/*
TODO:
- Create an alarm when an access token is received to refresh the access token
  - for safety, refresh the access token every 30 minutes?

New features to add (button + shortcut):
  - Play/Pause functionalities
  - Go back to previous track
  - Engage/disengage shuffle

Some cool ideas:
  - Shortcut/toggle to create a "banner" that displays the currently played song + album cover

Safeguards:
  - Requests / Seconds
  - Duplicate songs
*/

var client_id = "REDACTED";
var client_secret = "REDACTED";
var redirect_uri = "REDACTED";
var scope = 'user-modify-playback-state user-read-private user-read-email playlist-modify-public playlist-modify-private user-read-currently-playing user-read-playback-state';
var authentication_url = 'https://accounts.spotify.com/authorize' + '?client_id=' + client_id + '&response_type=code' + '&redirect_uri=' + redirect_uri + '&scope=' + scope;
var authorization_token = 'Bearer ';

//Functions

//Resets the extension.
function initializeBaseState() {
  chrome.storage.local.set({ logged_in: false }, function () { });
  chrome.storage.local.set({ gotPlaylists: 0 }, function () { });
  chrome.storage.local.set({ target_playlist_name: "not chosen" }, function () { });
  chrome.storage.local.set({ target_playlist_id: "null" }, function () { });
  chrome.storage.local.set({ refresh_token: "" }, function () { });
  chrome.storage.local.set({ playlists: [] }, function () { });
  chrome.alarms.clearAll(function () {});
  chrome.browserAction.setPopup({ popup: 'popup_login.html' });
}

//Sends a post request to spotify to retrieve the authentication token.
function makeXhrPostRequest(code, grantType, refreshToken) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.spotify.com/api/token', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.onload = function () {
      resolve(xhr.response);
    }
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    let requestBody = (refreshToken) ? 'grant_type=' + grantType + '&refresh_token=' + refreshToken + '&client_id=' + client_id + '&client_secret=' + client_secret : 'grant_type=' + grantType + '&code=' + code + '&redirect_uri=' + redirect_uri + '&client_id=' + client_id + '&client_secret=' + client_secret
    xhr.send(requestBody);
  })
}

//Retrieves the user's playlists and returns it as an array.
function retrieveUserPlaylists() {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/playlists", true);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = function () {
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
    xhr.onerror = function () {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//Refreshes the user authorization token using their refresh token.
function refreshToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['refresh_token'], function (storageObj) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://accounts.spotify.com/api/token')
      xhr.setRequestHeader("Authorization", "Basic " + btoa(client_id + ':' + client_secret))
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      var params = "grant_type=refresh_token&refresh_token=" + storageObj.refresh_token;
      xhr.onload = function () {
        console.log('REQUESTING REFRESH TOKEN');
        response = JSON.parse(xhr.response);
        console.log('SUCCESSFULLY RETRIEVED NEW ACCESS TOKEN')
        access_token = "Bearer " + response.access_token;
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
      xhr.send(params);
    })
  })
}

//After retrieving the user playlists from spotify, this populates the extension page.
function populatePlaylistArray() {
  //begin populating playlist array
  return new Promise((resolve, reject) => {
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

/*
KNOWN ERRORS:
- WHEN USER IS IN PRIVATE SESSION, RECEIVES 204 - EMPTY PAYLOAD - MAKE SURE TO ACCOUNT FOR THIS
*/

//Retrieves the user's currently played song.
function retrieveCurrentlyPlayedSong() {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/player/currently-playing", true);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = function () {
      var currently_listening = JSON.parse(xhr.response);
      console.log(currently_listening);
      var song_details = currently_listening.item;
      var uri = song_details.uri;
      console.log("NAME: " + song_details.name);
      console.log("URI: " + song_details.uri)
      var form = 'uris=' + song_details.uri;
      resolve(form);
    }
    xhr.onerror = function () {
      console.log(xhr.response);
    }
    xhr.send();
  })
}

//Skips the current song.
function skipSong() {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.spotify.com/v1/me/player/next');
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = function () {
      return resolve(xhr.status)
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

//Adds the currently listened to song to a target playlist.
async function addSongToPlaylist(targetID) {
  var song = await retrieveCurrentlyPlayedSong().catch(err => console.log(err));

  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', "https://api.spotify.com/v1/playlists/" + targetID + "/tracks?" + song);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = async function () {
      resolve('SUCCESSFULLY ADDED')
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
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/player");
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = function() {
      if(xhr.response) {
        response = JSON.parse(xhr.response);
        return resolve(response.is_playing);
      } else {
        return resolve(false);
      }
    }
    xhr.onerror = function() {
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//Play/Pause "Play" helper method
function playSong(){
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', "https://api.spotify.com/v1/me/player/play");
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = function() {
      return resolve('PLAYING')
    }
    xhr.onerror = function(){
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }
    xhr.send();
  })
}

//Play/Pause "Pause" helper method
function pauseSong(){
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('PUT', "https://api.spotify.com/v1/me/player/pause");
    xhr.setRequestHeader('Authorization', authorization_token);
    xhr.onload = function() {
      return resolve('PLAYING')
    }
    xhr.onerror = function(){
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
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
        chrome.alarms.create("getAccess", {periodInMinutes: 59});
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
      chrome.identity.launchWebAuthFlow({
        url: authentication_url,
        interactive: true
      },
        async function (redirectUrl) {
          var code = redirectUrl.substring(redirectUrl.indexOf('=') + 1);
          var response_text = await makeXhrPostRequest(code, 'authorization_code').catch(err => console.log(err));
          response_text = JSON.parse(response_text);
          authorization_token += response_text.access_token;
          chrome.storage.local.set({ refresh_token: response_text.refresh_token }, function () { });
          chrome.storage.local.set({ logged_in: true }, function () { });
          chrome.alarms.create("getAccess", {periodInMinutes: 59})
          chrome.browserAction.setPopup({ popup: 'popup.html' });
          await populatePlaylistArray().catch(err => console.log(err));
        }
      )
    } else if (request.message == 'addSong') {
      await addSongToPlaylist(request.id).catch(err => console.log(err));
    } else if (request.message == 'skip') {
      await skipSong().catch(err => console.log(err));
    } else if (request.message == 'playPause') {
      await playPause();
    }
  }
)

chrome.alarms.onAlarm.addListener(async function (alarm){
  if(alarm.name == "getAccess"){
    await refreshToken().catch(err => console.log(err));
  }
})

chrome.commands.onCommand.addListener(async function (command) {
  if (command == "add_current_song") {
    chrome.storage.local.get(['target_playlist_id'], async function (response) {
      await addSongToPlaylist(response.target_playlist_id).catch(err => console.log(err));
    })
  } else if (command == 'skip_song') {
    await skipSong().catch(err => console.log(err));
  } else if (command == 'play_pause') {
    await playPause();
  }
})

chrome.idle.setDetectionInterval(1800000)

let time = 0;

chrome.idle.onStateChanged.addListener(
  async function(state){
    if(state == 'locked'){
      console.log('LOCKED')
      chrome.storage.local.set({old_state: "locked"}, function(){});
      time = performance.now();
      console.log(time);
    } else {
      console.log(state);
      chrome.storage.local.get(['old_state'], async function(storageObj){
        if(storageObj.old_state == 'locked'){
          var changeTime = performance.now();
          //check if the changes in time are greater than 50 minutes, if so then refresh the token
          if(changeTime - time > 3000000){
            console.log("TRIGGERING TOKEN REFRESH")
            await refreshToken().then(res => {
              chrome.alarms.create("getAccess", {periodInMinutes: 59});
            });
          } else {
            console.log("NO REFERSH NECESSARY")
          }
        }
      })
    }
  }
)