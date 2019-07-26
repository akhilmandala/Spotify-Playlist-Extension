let login = document.getElementById('login');
let continueButton = document.getElementById('continue');

continueButton.setAttribute('disabled', true);

login.onclick = async function handler() {
    chrome.runtime.sendMessage(
        { message: 'launchOauth' }
    )

    continueButton.removeAttribute('disabled');
}