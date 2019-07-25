chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.set({ logged_in: false }, function (innerObj) { })
  chrome.storage.local.set({ gotPlaylists: 0 }, function () { });
  chrome.storage.local.set({target_playlist_name: "not chosen"}, function(){});
  chrome.storage.local.set({target_playlist_id: "null"}, function () { });
})

chrome.storage.local.get(['logged_in'], function(data) {
  if (data.logged_in) {
    chrome.browserAction.setPopup({popup: 'popup.html'});
  } else {
    chrome.browserAction.setPopup({popup: 'popup_login.html'});
  }
});

var client_id = 'REDACTED';
var client_secret = 'REDACTED';
var redirect_uri = 'REDACTED';
var scope = 'user-modify-playback-state user-read-private user-read-email playlist-modify-public playlist-modify-private user-read-currently-playing user-read-playback-state';
var authentication_url = 'https://accounts.spotify.com/authorize' + '?client_id=' + client_id + '&response_type=code' + '&redirect_uri=' + redirect_uri + '&scope=' + scope;
var authorization_token = 'Bearer ';

function makeXhrPostRequest(code, grantType, refreshToken) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.spotify.com/api/token', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.onload = function () {
      resolve(xhr.response);
    }

    let requestBody = (refreshToken) ? 'grant_type=' + grantType + '&refresh_token=' + refreshToken + '&client_id=' + client_id + '&client_secret=' + client_secret : 'grant_type=' + grantType + '&code=' + code + '&redirect_uri=' + redirect_uri + '&client_id=' + client_id + '&client_secret=' + client_secret
    xhr.send(requestBody);
  })
}

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
      resolve(return_array);
    }

    xhr.send();
  })
}

function populatePlaylistArray() {
  //begin populating playlist array
  return new Promise(resolve => {
    chrome.storage.local.get(['gotPlaylists'], async function (response) {
      if (response.gotPlaylists == 0) {
        console.log('populating array')
        playlist_json_data = await retrieveUserPlaylists();
        console.log(playlist_json_data);
        chrome.storage.local.set({ playlists: playlist_json_data }, function () {
          chrome.storage.local.set({ gotPlaylists: 1 }, function () {
            console.log('retrieved information.')
          });
        })
  
        chrome.storage.local.get(['playlists'], function (response) {
          console.log("stored array: " + response)
        })
      }
    })
  })
}

function retrieveCurrentlyPlayedSong() {
  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', "https://api.spotify.com/v1/me/player/currently-playing", true);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = function () {
      var currently_listening = JSON.parse(xhr.response);
      var song_details = currently_listening.item;
      var uri = song_details.uri;
      console.log("NAME: " + song_details.name);
      console.log("URI: " + song_details.uri)
      var form = 'uris=' + song_details.uri;
      resolve(form);
    }
    xhr.send();
  })
}

async function addSongToPlaylist(targetID) {
  var song = await retrieveCurrentlyPlayedSong();

  return new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', "https://api.spotify.com/v1/playlists/" + targetID + "/tracks?" + song);
    xhr.setRequestHeader("Authorization", authorization_token);
    xhr.onload = function () {
      console.log(xhr.response);
    }
    xhr.send();
    resolve('Successfully sent.');
  })
}

chrome.runtime.onMessage.addListener(
  async function (request, sender, sendResponse) {
    if (request.message == 'launchOauth') {
      console.log('initiating flow.')
      chrome.identity.launchWebAuthFlow({
        url: authentication_url,
        interactive: true
      },
        async function (redirectUrl) {
          console.log(redirectUrl);
          var code = redirectUrl.substring(redirectUrl.indexOf('=') + 1);
          var response_text = await makeXhrPostRequest(code, 'authorization_code')
          response_text = JSON.parse(response_text);
          authorization_token += response_text.access_token;
          console.log(authorization_token);
          chrome.storage.local.set({logged_in: true}, function(){});
          chrome.browserAction.setPopup({popup: 'popup.html'});
          await populatePlaylistArray();
        }
      )
    } else if (request.message == 'addSong') {
      await addSongToPlaylist(request.id);
    }
  }
)

chrome.commands.onCommand.addListener(async function(command){
  if(command == "add_current_song"){
    chrome.storage.local.get(['target_playlist_id'], async function(response){
      await addSongToPlaylist(response.target_playlist_id);
    })
  }
})