let add_song = document.getElementById('addSong');
let skip = document.getElementById('skip');
let play = document.getElementById('play');
let pause = document.getElementById('pause');
var playlists = document.getElementById('playlistChoice');
var targetName = document.getElementById('targetName');
var playbackControl = document.getElementById('playPause');

chrome.storage.local.get(['playlists'], function (playlist_array) {
    playlist_array.playlists.forEach(element => {
        var option = document.createElement('option');
        option.innerHTML = element.name;
        option.value = element.id;
        playlists.appendChild(option);
    });
})

chrome.storage.local.get(['target_playlist_name'], function(response){
    targetName.innerHTML = "Target playlist: " + response.target_playlist_name;
})

playlists.onchange = function changeTarget(){
    chrome.storage.local.set({target_playlist_id: playlists.value}, function(){
        chrome.storage.local.get(['target_playlist'], function(response){
            console.log("Chosen playlist id: " + response.target_playlist);
            console.log("Chosen playlist name: " + playlists.options[playlists.selectedIndex].text);
        })
    });

    chrome.storage.local.set({target_playlist_name: playlists.options[playlists.selectedIndex].text}, function(){});

    chrome.storage.local.get(['target_playlist_name'], function(response){
        targetName.innerHTML = "Target playlist: " + response.target_playlist_name;
    })
}

add_song.onclick = function addSong() {
    chrome.storage.local.get(['target_playlist_id'], function(response){
        chrome.runtime.sendMessage(
            { message: 'addSong', id: response.target_playlist_id }
        )
    })
}

skip.onclick = function skipSong(){
    chrome.runtime.sendMessage(
        {message: 'skip'}
    )
}

playbackControl.onclick = function playback() {
    chrome.runtime.sendMessage(
        {message: 'playPause'}
    )
}
