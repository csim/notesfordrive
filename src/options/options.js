
var background = chrome.extension.getBackgroundPage();


document.addEventListener('DOMContentLoaded', function()
{
    $('#sign-out-button').click( function()
    {
        background.gdrive.revokeAuthToken( updateDisplay );
    });

    window.setTimeout(function()
    {
        updateDisplay();
    }, 1);
});


function updateDisplay()
{
    var hasAccessToken = background.gdrive.oauth.hasAccessToken();

    $('#sign-out-button').prop('disabled', !hasAccessToken);

    if(hasAccessToken)
    {
        background.gdrive.about( function(response)
        {
            $('#signed-in-as').text('You are signed in as ' + response.user.emailAddress);
            $('#signed-in-as').fadeIn();
        })
    }
    else
    {
        $('#signed-in-as').hide();
    }
}