
/* TODO

 - send new notes to top of list

 - check for expired access tokens / change oauth2 provider

 - automatically detect/sync changes from drive while the app is running

 - on first trash file show popover explaining they can undo this action from the Trash folder in Google Drive

 THEN
 - open existing doc (save opened doc id's to chrome.storage) + right click menu for choosing this "Open from Drive"

 - rename note button, close note button (only for opened notes)

 - if not opened/imported or renamed explicitly (store details in chrome storage)
 then use first 5 words or 20 characters as doc title (even if it changes)

 THEN
 - add button to gmail

 - show small image of user last edited by if it was not you and you have not yet seen the changes

 - show photos (with name in popover) of users the file is shared with

 - associate multiple open instances with the gmail tab/account authenticated in

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

            minHeight: 325,  // set minimum height of editor
            maxHeight: 325,  // set maximum height of editor

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

    if(doc)
    {
        var html = $('.summernote').code();
        var text = $('.summernote').text();

        doc.dirty = true;
        doc.contentHTML = html;

        updateDocumentTitleFromText(doc, text);
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

    doc.notesListElementId = e.attr('id');

    e.click(function()
    {
        setActiveDoc(doc);
    });

    e.text(doc.title);

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


    // don't do anything if we're already the active doc
    if($('.summernote').data('editing-doc') == doc)
        return;

    setLastActiveDocument(doc);


    var item = doc.item;
    var content = doc.contentHTML;

    var $item_element = $( doc.notesListElementId );

    $('.summernote').code(content);
    $('.summernote').data('editing-doc', doc);

    if(content.length == 0)
        $('.summernote').summernote({focus:true});

    $('#active-note-status').text('Last change was ' + moment(item.modifiedDate).fromNow());

    $('.notes-list-item').removeClass('active');
    $item_element.addClass('active');


    // set the correct arrow overlay
    var isFirst = background.cache.documents[0] == doc;
    var arrowIcon = isFirst ? "notes-arrow-light-grey.png" : "notes-arrow.png";

    $('.notes-list-item .arrow').remove();
    $item_element.prepend( $("<img class='arrow' src='img/" + arrowIcon + "'/>") );


    // reconfigure the buttons
    $('#trash-button').tooltip('destroy');
    $('#edit-in-drive-button').tooltip('destroy');

    $('#trash-button').unbind().click( function()
    {
        trashDocument(doc);
    });

    $("#edit-in-drive-button-button").unbind().click( function()
    {
        chrome.tabs.create({ url: item.alternateLink });
    });

    $('#trash-button').tooltip();
    $('#edit-in-drive-button').tooltip();


    updateDisplay();
}


function trashDocument(doc)
{
    var $item_element = $( doc.notesListElementId );

    background.gdrive.trashFile(doc.item.id);
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
}


function createDocument(title, content)
{
    title = title || 'New Note';
    content = content || '';

    var doc = {
        item: item_response,
        title: doc.title,
        contentHTML: content,
        requiresInsert: true
    };

    background.cache.documents.push(doc);

    addDocument(doc);
    setActiveDoc(doc);
}


function saveDocument(doc)
{
    if(!doc || !doc.dirty || doc.saving)
        return;

    doc.saving = true;
    doc.dirty = false;

    $('#active-note-status').text('Saving..');


    completed: function(item_response)
    {
        doc.item = item_response;
        doc.saving = false;

        $('#active-note-status').text('All changes saved to Drive');

        // automatically save pending changes once current save has completed
        if(doc.dirty)
            saveDocument(doc);
    }


    if(doc.requiresInsert)
    {
        doc.requiresInsert = false;
        background.gdrive.insertAsHTML(background.cache.folder.id, doc.title, doc.contentHTML, completed);
    }
    else
    {
        background.gdrive.overwriteAsHTML(doc.item.id, doc.title, doc.contentHTML, completed);
    }
}


function hideAll()
{
    $('#auth-section').hide();
    $('#message-section').hide();
    $('#loading-section').hide();
    $('#documents-section').hide();

    $('#notes-list-buttons').hide();
    $('#active-note-footer').hide();
}

function updateDisplay()
{
    hideAll();

    if(!navigator.onLine)
    {
        $('#message-section').show();
        $("#message-content").text("You don't appear to have an internet connection.");
        $('#message-content').center();

        return;
    }

    if(!background.gdrive.accessToken)
    {
        $('#auth-section').show();
        $('#auth-content').center();

        return
    }
    else
    {
        if(background.state == background.StateEnum.CACHING && background.cache.lastUpdated == null)
        {
            $('#loading-section').show();
            $('#loading-content').center();
        }
        else
        {
            if(background.cache.documents.length > 0)
            {
                $('#documents-section').show();

                $('#notes-list-buttons').show();
                $('#active-note-footer').show();
            }
            else
            {
                $('#message-section').show();
                $('#message-content').text("You don't have any notes. Create one using the pencil icon below.");
                $('#message-content').center();

                $('#notes-list-buttons').show();
            }
        }
    }
}


function setLastActiveDocument(doc)
{
    background.lastActiveDocId = doc.item.id;
    chrome.storage.sync.set( {'last-active-doc-id': doc.item.id} );
}


function updateDocumentTitleFromText(doc, text)
{
    var title = extractTitle(text);

    if(title.length == 0)
        title = 'Untitled';

    doc.title = title;

    var $item_element = $( doc.notesListElementId );
    $item_element.text = doc.title;
}


function extractTitle(text)
{
    MAX_TITLE_WORDS = 5;

    var firstLine = text.split('\n')[0];
    var title = firstLine.split(' ').slice(0,MAX_TITLE_WORDS).join(' ');

    return title;
}
