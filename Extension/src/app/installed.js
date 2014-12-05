
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse)
{
    if(request.authenticationSucceeded)
    {
        $('#welcome-title').text('You have signed into Google Drive');
        $('#welcome-message').text('Click the toolbar icon above to start writing notes');

        $("#welcome-image").fadeTo(200, 0.1, function() {
          $(this).load(function() { $(this).fadeTo(200, 1); });
          $(this).attr('src', '/src/app/img/install-checkmark.png');
        });
    }
});
