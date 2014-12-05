
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse)
{
    if(request.authenticationSucceeded)
    {
        $('#welcome-title').text('You have signed into Google Drive');
    }
});
