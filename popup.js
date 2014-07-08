
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

 - simple mode (as an option): only show saving status when saving/saved then disappear after 2 seconds, no settings icon, no
 formatting controls (use air mode)

 THEN
 - add button to gmail

 - show small image of user last edited by if it was not you and you have not yet seen the changes

 - show photos (with name in popover) of users the file is shared with

 - associate multiple open instances with the gmail tab/account authenticated in

 - resizable window

 MISC
 - quill icon

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

        doc.dirty = true;
        doc.contentHTML = html;

        updateDocumentTitle(doc);
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

            if(setActive)
                setActiveDoc(doc);
        });
    }

    updateDisplay();
}


function addDocument(doc)
{
    // we wont have an item if we've got a doc from createDocument and it hasn't yet been saved
    var id = doc.item ? doc.item.id : guid();

    var e = $("<div class='notes-list-item'/>");
    e.attr('id', 'nli-' + id);
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


    var $item_element = $( '#' + doc.notesListElementId );

    $('.summernote').code(doc.contentHTML);
    $('.summernote').data('editing-doc', doc);

    if(doc.contentHTML.length == 0)
        $('.summernote').summernote({focus:true});

    if(doc.item)
    {
        $('#active-note-status').text('Last change was ' + moment(doc.item.modifiedDate).fromNow());
    }
    else
        $('#active-note-status').empty();

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

    $("#edit-in-drive-button").unbind().click( function()
    {
        if(doc.item)
            chrome.tabs.create({ url: doc.item.alternateLink });
    });

    $('#trash-button').tooltip();
    $('#edit-in-drive-button').tooltip();


    updateDisplay();
}


function trashDocument(doc)
{
    var $item_element = $( '#' + doc.notesListElementId );

    if(doc.item)
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
        item: null,
        title: title,
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


    var completed = function(item_response)
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
    if(doc.item)
    {
        background.lastActiveDocId = doc.item.id;
        chrome.storage.sync.set({'last-active-doc-id': doc.item.id});
    }
}


function updateDocumentTitle(doc)
{
    var title = extractTitle(doc.contentHTML);

    if(!title || title.length == 0)
        title = 'Untitled';

    doc.title = title;

    var $item_element = $( '#' + doc.notesListElementId );
    $item_element.text(doc.title);
}


/* Example of HTML returned by Summernote
<title>New Note</title>
<meta content="text/html; charset=UTF-8" http-equiv="content-type">
    <style type="text/css">ol{margin:0;padding:0}.c1{color:#000000;font-size:11pt;font-family:"Arial"}.c3{max-width:468pt;background-color:#ffffff;padding:72pt 72pt 72pt 72pt}.c2{height:11pt}.c0{direction:ltr}.title{padding-top:24pt;line-height:1.0;text-align:left;color:#000000;font-size:36pt;font-family:"Arial";font-weight:bold;padding-bottom:6pt;page-break-after:avoid}.subtitle{padding-top:18pt;line-height:1.0;text-align:left;color:#666666;font-style:italic;font-size:24pt;font-family:"Georgia";padding-bottom:4pt;page-break-after:avoid}li{color:#000000;font-size:11pt;font-family:"Arial"}p{color:#000000;font-size:11pt;margin:0;font-family:"Arial"}h1{padding-top:24pt;line-height:1.0;text-align:left;color:#000000;font-size:24pt;font-family:"Arial";font-weight:bold;padding-bottom:24pt}h2{padding-top:22.4pt;line-height:1.0;text-align:left;color:#000000;font-size:18pt;font-family:"Arial";font-weight:bold;padding-bottom:22.4pt}h3{padding-top:24pt;line-height:1.0;text-align:left;color:#000000;font-size:14pt;font-family:"Arial";font-weight:bold;padding-bottom:24pt}h4{padding-top:25.6pt;line-height:1.0;text-align:left;color:#000000;font-size:12pt;font-family:"Arial";font-weight:bold;padding-bottom:25.6pt}h5{padding-top:25.6pt;line-height:1.0;text-align:left;color:#000000;font-size:9pt;font-family:"Arial";font-weight:bold;padding-bottom:25.6pt}h6{padding-top:36pt;line-height:1.0;text-align:left;color:#000000;font-size:8pt;font-family:"Arial";font-weight:bold;padding-bottom:36pt}
    </style>
    <p class="c0">
        <span class="c1">my new note &lt;b&gt;test&lt;/b&gt;last</span>
    </p>
    <p class="c0 c2">
        secondline<span class="c1"></span>
    </p>
    <p class="c0 c2">
        <span style="font-weight: bold;">bold&nbsp;</span>
    </p>
    <p class="c0 c2">
        <ul><li>dot1</li></ul>
    </p>
*/

function extractTitle(html)
{
    if(!html || html.length == 0)
        return null;

    console.log('extractTitle: ' + html);

    var firstParagraph = contentOfFirstTag('p', html) || html;
    var text = stripTags(firstParagraph);

    text = text.replace(/&lt;/g, '');
    text = text.replace(/&gt;/g, '');
    text = text.replace(/&nbsp;/g, '');

    MAX_TITLE_WORDS = 5;

    var firstLine = text.split('\n')[0];
    var title = firstLine.split(' ').slice(0,MAX_TITLE_WORDS).join(' ');

    return title;
}

function contentOfFirstTag(tag, text, startFromIndex)
{
    var start_open_tag = '<'+tag;
    var start_close_tag = '>';
    var end_tag = '</'+tag+'>';

    var start_open_index = text.indexOf(start_open_tag, startFromIndex);
    var start_close_index = text.indexOf(start_close_tag, start_open_index);
    var end_index = text.indexOf(end_tag, start_close_index);

    return text.substring(start_close_index+start_close_tag.length, end_index);
}

function stripTags(text)
{
    var stripped = text;

    while(true)
    {
        var start_index = stripped.indexOf('<');
        var end_index = stripped.indexOf('>', start_index);

        if(end_index > 0)
            end_index += 1; // ie. '>' character

        if(end_index >= stripped.length)
            end_index = -1;

        if(start_index >= 0) {
            stripped = removeRange(stripped, start_index, end_index);
        }

        if(start_index < 0 || end_index < 0)
            break;
    }

    return stripped;
}


function removeRange(s, start, end)
{
    var result = s.substring(0, start);

    if(end >= 0)
        result += s.substring(end);

    return result;
}


function stripTag(tag, from)
{
    var start_tag = '<'+tag;
    var end_tag = '</'+tag+'>';

    var start_index = from.indexOf(start_tag);
    var end_index = from.indexOf(end_tag);

    if(start_index >= 0 && end_index >= 0)
    {
        return from.substring(0, start_index) + from.substring(end_index + end_tag.length);
    }
    else if(start_index >= 0)
    {
        end_tag = '>';
        end_index = from.indexOf('>', start_index);

        if(end_index)
            return from.substring(0, start_index) + from.substring(end_index + end_tag.length);
    }

    return from;
}
