let login = document.getElementById('login');

login.onclick = async function handler() {
    chrome.runtime.sendMessage(
        { message: 'launchOauth' }
    )
}