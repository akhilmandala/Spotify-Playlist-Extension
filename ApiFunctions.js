var ApiFunctions = {

    authorization_token: 'Bearer ',
    real_url: "https://us-central1-spotify-playlist-extension.cloudfunctions.net/authentication/",

    //Resets the extension.
    initializeBaseState: function initializeBaseState() {
        chrome.storage.local.set({ logged_in: false }, function () { });
        chrome.storage.local.set({ gotPlaylists: 0 }, function () { });
        chrome.storage.local.set({ target_playlist_name: "not chosen" }, function () { });
        chrome.storage.local.set({ target_playlist_id: "null" }, function () { });
        chrome.storage.local.set({ refresh_token: "" }, function () { });
        chrome.storage.local.set({ playlists: [] }, function () { });
        chrome.alarms.clearAll(function () { });
        chrome.browserAction.setPopup({ popup: 'popup_login.html' });
    },

    //Retrieves the authorization token from the server
    retrieveAuthorizationFromServer: function retrieveAuthorizationFromServer() {
        return new Promise(resolve => {
            chrome.identity.launchWebAuthFlow({ url: real_url + 'login', interactive: true }, function (redirectUrl) {
                var params = new URLSearchParams(redirectUrl);
                chrome.storage.local.set({ refresh_token: params.get('refresh') }, function () { });
                authorization_token = "Bearer " + params.get('authorization');
                resolve("SUCCESS");
            })
        })
    },

    //Refreshes the user authorization token using their refresh token.
    refreshToken: function refreshToken() {
        return new Promise(resolve => {
            console.log("OLD TOKEN: " + authorization_token);
            chrome.storage.local.get(['refresh_token'], function (storageObj) {
                let xhr = new XMLHttpRequest();
                xhr.open('GET', real_url + 'refresh?refresh=' + storageObj.refresh_token)
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
    },

    //Retrieves the user's playlists and returns it as an array.
    retrieveUserPlaylists: function retrieveUserPlaylists() {
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
    },

    //After retrieving the user playlists from spotify, this populates the extension page.
    populatePlaylistArray: function populatePlaylistArray() {
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
    },

    //Skips the current song.
    skipSong: function skipSong() {
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
    },

    previousSong: function previousSong() {
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
    },

    restartSong: function restartSong() {
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
    },
    /*
    KNOWN ERRORS:
    - WHEN USER IS IN PRIVATE SESSION, RECEIVES 204 - EMPTY PAYLOAD - MAKE SURE TO ACCOUNT FOR THIS
    */

    //Retrieves the user's currently played song.
    retrieveCurrentlyPlayedSong: function retrieveCurrentlyPlayedSong() {
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
    },

    //Adds the currently listened to song to a target playlist.
    addSongToPlaylist: async function addSongToPlaylist(targetID) {
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
    },

    //Play/Pause the current song
    playPause: async function playPause() {
        var is_playing = await isPlaying();
        if (is_playing) {
            await pauseSong();
        } else {
            await playSong();
        }
    },

    //Checks playback state
    isPlaying: function isPlaying() {
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
    }, 

    //Play/Pause "Play" helper method
    playSong: function playSong() {
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
    },

    //Play/Pause "Pause" helper method
    pauseSong: function pauseSong() {
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
    },

    sendBannerToUser: async function sendBannerToUser() {
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
    },

    retrievePlaybackInformation: function retrievePlaybackInformation() {
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
    },

    return: {
        initializeBaseState: initializeBaseState,
        retrieveAuthorizationFromServer: retrieveAuthorizationFromServer,
        refreshToken: refreshToken,
        retrieveUserPlaylists, retrieveUserPlaylists,
        populatePlaylistArray, populatePlaylistArray,
        skipSong: skipSong,
        previousSong: previousSong,
        restartSong: restartSong,
        retrieveCurrentlyPlayedSong, retrieveCurrentlyPlayedSong,
        addSongToPlaylist: addSongToPlaylist,
        playPause: playPause,
        isPlaying: isPlaying,
        playSong: playSong,
        pauseSong: pauseSong,
        sendBannerToUser: sendBannerToUser,
        retrievePlaybackInformation: retrieveCurrentlyPlayedSong
    }
}