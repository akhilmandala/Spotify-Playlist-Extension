# Spotify-Playlist-Extension

## Description
Curating playlists can be difficult - if you are multitasking and you find that you like the current song, you have to tab out of whatever it is you're doing and manually add the song to a chosen playlist. This extension mitigates that annoyance by bringing playback control *AND* playlist modification directly to your keyboard and browser. Use keyboard shortcuts to play/pause, skip songs, and add your currently played song to a chosen target playlist.

The extension communicates directly with Spotify through its API to retrieve and change data. Authentication is done through a proxy server hosted on Google Cloud using NodeJS and ExpressJS for security pursposes. This extension will work with **ANY** playback source - if you are listening from your phone, laptop, TV, etc. the extension will allow you to easily control playback and modify playlists.

## Shortcuts
- Play/Pause: Alt-Shift-P
- Skip song: Alt-Shift-C
- Restart song: Alt-Shift-D
- Add current song to target playlist: Alt-Shift-X

## Set-up and usage guide
NOTE: Some of these images may be outdated as new functions are added. However, The basic flow of this guide is still the same. 

When installed, a small icon should appear in the **Chrome toolbar**.  
![Toolbar image](/images/markdown_images/toolbar.png)

Click on the icon to access the **login button**.  
![Login image](/images/markdown_images/login.png)

If this is your first time using the extension, or if you have not used it in a while, you will be redirected to a login screen for Spotify. This may take a couple of seconds to load up.  
![Authentication page](/images/markdown_images/authentication.png)

After logging in, the extension is ready to be used.  
![Choose playlist](/images/markdown_images/initial_playlist_choice.png) 

Choose a playlist from the dropdown menu - you will see all your **public playlists**. The ability to add to private and collaborative playlists will come later.  
![Playlist choice](/images/markdown_images/options.png)

The extension will remember your target choice, and whenever trigger the "add song" shortcut or button it will add your currently played song to this playlist.  
![Re-select playlist](/images/markdown_images/chosen_playlist.png)

You may change the target playlist by selecting another option from the options page.  
![Pick another](/images/markdown_images/picked_another.png)

Whenever you open the extension again, the current target playlist will be shown. Click any of the buttons to trigger their respective actions, or change the target playlist to something new.  
![Re-select playlist](/images/markdown_images/default_page.png)
