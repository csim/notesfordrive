
/* TODO

 - generate note title

 - instantly create new note then sync/insert to drive only on first save

 - send new notes to top of list

 - check for expired access tokens

 - show photos (with name in popover) of users the file is shared with

 - automatically detect/sync changes from drive while the app is running

 THEN
 - open existing doc (save opened doc id's to chrome.storage) + right click menu for choosing this "Open from Drive"

 - rename note button, close note button (only for opened notes)

 - if not opened/imported or renamed explicitly (store details in chrome storage)
 then use first 5 words or 20 characters as doc title (even if it changes)


 THEN
 - add button to gmail

 - show small image of user last edited by if it was not you and you have not yet seen the changes

 */

var background = chrome.extension.getBackgroundPage();


document.addEventListener("DOMContentLoaded", function()
{
    createSummernote();

    $('#settings-button').unbind().click( function()
    {
        chrome.tabs.create({'url': chrome.extension.getURL("src/options/index.html") } )
    });

    $('#new-button').unbind().click( function()
    {
        createDocument();
    });

    $('#authorize-button').unbind().click( function()
    {
        checkAuth({interactive:true});
    });


    window.setTimeout(function()
    {
        checkAuth({interactive:false});
    }, 1);
});


chrome.runtime.onMessage.addListener( function(request, sender, sendResponse)
{
    if(request.cachingState)
    {
        displayDocs();
    }
});


function createSummernote()
{
    $('.summernote').summernote(
        {
            height: 325,

            minHeight: 325,             // set minimum height of editor
            maxHeight: 325,             // set maximum height of editor

            focus: false,

            toolbar: [
                ['style', ['bold', 'italic', 'underline']],
                ['fontsize', ['fontsize']],
                ['color', ['color']],
                ['para', ['ul', 'ol']]
            ],

            onChange: onDocumentChange
        });

    $('.note-editor').css('border', 'none');
    $('.note-resizebar').css('display', 'none');
}

function onDocumentChange(contents, $editable)
{
    var doc = $('.summernote').data('editing-doc');
    var html = $('.summernote').code();

    if(doc)
    {
        doc.dirty = true;
        doc.contentHTML = html;

        saveDocument(doc);
    }
}


function checkAuth(options)
{
    if(!navigator.onLine)
    {
        updateDisplay();
    }

    if(!background.gdrive.accessToken)
    {
        background.gdrive.auth(options, authenticationSucceeded, authenticationFailed);
    }
    else
    {
        authenticationSucceeded();
    }
}

function authenticationSucceeded()
{
    if(background.cache.folder == null)
    {
        background.updateCache( function()
        {
            displayDocs();
        });
    }
    else
    {
        displayDocs();
    }
}

function authenticationFailed()
{
    updateDisplay();
}


function createDocument(title, content)
{
    title = title || 'New Note';
    content = content || '';

    background.gdrive.insertAsHTML(background.cache.folder.id, title, content, function(item_response)
    {
        var doc = {
            item: item_response,
            contentHTML: content
        };

        background.cache.documents.push(doc);

        addDocument(doc);
        setActiveDoc(doc);
    });
}

function displayDocs()
{
    $("#notes-list").empty();

    if(background.cache.documents.length)
    {
        $.each(background.cache.documents, function (index, doc)
        {
            addDocument(doc);

            var setActive = background.lastActiveDocId === doc.item.id || (background.lastActiveDocId == null && index == 0);

            if (setActive)
                setActiveDoc(doc);
        });
    }

    updateDisplay();
}

function addDocument(doc)
{
    var item = doc.item;

    var e = $("<div class='notes-list-item'/>");
    e.attr('id', 'nli-'+item.id);
    e.data('doc', doc);

    e.click(function()
    {
        setActiveDoc(doc);
    });

    e.text(item.title);

    $("#notes-list").append( e );
}


function setActiveDoc(doc)
{
    // NOTE: if the current active document has pending changes then it will still have
    // a timer running on it that will save the changes

    if(!doc)
    {
        updateDisplay();
        return;
    }

    if($('.summernote').data('editing-doc') == doc)
        return;


    setLastActiveDocument(doc);

    var item = doc.item;
    var content = doc.contentHTML;

    var $item_element = $('#nli-'+item.id);

    $('.summernote').code(content);
    $('.summernote').data('editing-doc', doc);

    if(content.length == 0)
        $('.summernote').summernote({focus:true});

    $('#active-note-status').text('Last change was ' + moment(item.modifiedDate).fromNow());

    $('.notes-list-item').removeClass('active');
    $item_element.addClass('active');

    var isFirst = background.cache.documents[0] == doc;

    //var $first = $('#notes-list').find('.notes-list-item:first');
    //var arrowIcon = $first.attr('id') == $item_element.attr('id') ? "notes-arrow-light-grey.png" : "notes-arrow.png";
    var arrowIcon = isFirst ? "notes-arrow-light-grey.png" : "notes-arrow.png";


    $('.notes-list-item .arrow').remove();
    $item_element.prepend( $("<img class='arrow' src='img/" + arrowIcon + "'/>") );


    $('#trash-button').tooltip('destroy');
    $('#open-drive-button').tooltip('destroy');


    $('#trash-button').unbind().click( function()
    {
        background.gdrive.trashFile(item.id);
        $item_element.remove();

        var documents = background.cache.documents;

        // remove the document from the cache
        var index = documents.indexOf(doc);
        if(index > -1) {
            documents.splice(index, 1);
        }

        // display the next available document
        var nextDoc = null;

        if(documents.length > 0)
        {
            if(index > 0) {
                nextDoc = documents[index - 1];
            }
            else
                nextDoc = documents[index];
        }

        setActiveDoc(nextDoc);
    });

    $("#open-drive-button").unbind().click( function()
    {
        chrome.tabs.create({ url: item.alternateLink });
    });


    $('#trash-button').tooltip();
    $('#open-drive-button').tooltip();

    updateDisplay();
}

function saveDocument(doc)
{
    if(!doc || !doc.dirty || doc.saving)
        return;

    doc.saving = true;
    doc.dirty = false;

    $('#active-note-status').text('Saving..');

    background.gdrive.overwriteAsHTML(doc.item.id, doc.contentHTML, function(item_response)
    {
        doc.item = item_response;
        doc.saving = false;

        $('#active-note-status').text('All changes saved to Drive');

        // automatically save pending changes once current save has completed
        if(doc.dirty)
            saveDocument(doc);
    });
}


function updateDisplay()
{
    if(!navigator.onLine)
    {
        $('#loading-section').hide();
        $('#message-section').hide();
        $('#documents-section').hide();

        $('#message-section').show();
        $("#message-content").text("You don't appear to have an internet connection.");
        $('#message-content').center();

        return;
    }

    if(!background.gdrive.accessToken)
    {
        $('#loading-section').hide();
        $('#message-section').hide();
        $('#documents-section').hide();

        $('#auth-section').show();
        $('#auth-content').center();

        return
    }
    else
    {
        if(background.state == background.StateEnum.CACHING && background.cache.lastUpdated == null)
        {
            $('#loading-section').hide();
            $('#message-section').hide();
            $('#documents-section').hide();

            $('#loading-section').show();
            $('#loading-content').center();
        }
        else
        {
            if(background.cache.documents.length > 0)
            {
                $('#auth-section').hide();
                $('#loading-section').hide();
                $('#message-section').hide();

                $('#notes-list-buttons').show();
                $('#active-note-footer').show();

                $('#documents-section').show();
            }
            else
            {
                $('#auth-section').hide();
                $('#loading-section').hide();
                $('#documents-section').hide();

                $('#notes-list-buttons').hide();
                $('#active-note-footer').hide();

                var createButton = $("<input id='create-first-button' type='button' class='btn' value='Create your first note' />").click(function()
                {
                    createDocument();
                });

                $('#message-section').show();
                $('#message-content').text("You don't have any notes. Create one using the pencil icon below.");
                $('#message-content').center();
            }
        }
    }
}


function setLastActiveDocument(doc)
{
    background.lastActiveDocId = doc.item.id;
    chrome.storage.sync.set( {'last-active-doc-id': doc.item.id} );
}


$.fn.center = function ()
{
    this.css("position","absolute");
    this.css("top", ( this.parent().height() - this.height() ) / 2  + "px");
    this.css("left", ( this.parent().width() - this.width() ) / 2 + "px");
    return this;
}


function extractTitle(text)
{
    MAX_TITLE_WORDS = 5;

    var firstLine = text.split('\n')[0];
    var title = firstLine.split(' ').slice(0,MAX_TITLE_WORDS).join(' ');

    return title;
}