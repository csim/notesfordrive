
var MAX_DOCS = 100;
var DEFAULT_FOLDER_NAME = 'Notes';

var StateEnum =
{
    IDLE: 1,
    CACHING: 2
};
var state = StateEnum.IDLE;

var gdrive = null;
var lastActiveDocId = null;
var cacheUpdateTimer = null;

var cache =
{
    folder: null,
    documents: []
};


document.addEventListener("DOMContentLoaded", function()
{
    gdrive = new GDrive();

    gdrive.setupOAuth(
    {
        client_id: '747134525486-5ocg32qs9hcvpl0e28991qm1n7v91415.apps.googleusercontent.com',
        client_secret: 'DuJnObwE3UiVdHEJ98URNvft',
        api_scope: 'https://www.googleapis.com/auth/drive.file'
    });

    loadState();
    gdrive.auth({interactive:false}, onAuthenticated);

    // automatically update the cache every 10 minutes
    var updateCacheFn = function()
    {
        if(gdrive.oauth.hasAccessToken())
            updateCache();
    };

    cacheUpdateTimer = setInterval(updateCacheFn, 1000*60*10);
});


chrome.runtime.onConnect.addListener(function(port_connected)
{
    // disallow interactive reauthentication on 401's only during background cache updates
    if(port_connected.name == 'popup')
    {
        gdrive.setAllowInteractiveReauth(true);

        port_connected.onDisconnect.addListener(function(port_disconnected)
        {
            gdrive.setAllowInteractiveReauth(false);

            removeEmptyDocuments();
            storeOrder(cache.documents);
        });
    }
});


function loadState()
{
    LAST_ACTIVE_DOC_ID = 'last-active-doc-id';

    chrome.storage.sync.get(LAST_ACTIVE_DOC_ID, function(result)
    {
        lastActiveDocId = result[ LAST_ACTIVE_DOC_ID ];
    });
}


function onAuthenticated()
{
    updateCache();
}


function updateCache(completed)
{
    if(state == StateEnum.CACHING)
        return;

    state = StateEnum.CACHING;

    var completed_wrapper = function(changesMade)
    {
        cache.lastChecked = new Date();
        state = StateEnum.IDLE;

        if(changesMade)
        {
            chrome.runtime.sendMessage({'cacheUpdated': cache.lastUpdated});
        }
        else
        {
            // edge case for when folder created during a different session or on a different machine
            if(!cache.lastUpdated)
            {
                chrome.runtime.sendMessage({'initialCacheUpdateComplete': true});
            }
        }

        if(completed)
            completed();
    };

    if(!cache.folder)
    {
        getFolder(DEFAULT_FOLDER_NAME, function(folder)
        {
            cache.folder = folder;
            cacheDocs( function() {
                completed_wrapper(true); // first time opening (or creating) folder this session - force changesMade=true
            });
        });
    }
    else
    {
        cacheDocs(completed_wrapper);
    }
}


function getFolder(name, completed)
{
    var success = function(response)
    {
        if( response.items && response.items.length > 0)
        {
            completed( response.items[0] );
        }
        else
        {
            setupDocumentsFolder(name, completed);
        }
    };

    var error = function(xhr)
    {
        setupDocumentsFolder(name, completed);
    };

    var query =
    {
        name: name,
        inParent: 'root',
        onlyFolders: true
    };

    gdrive.searchFileByName(query, success, error);
}


function setupDocumentsFolder(name, completed)
{
    gdrive.createFolder(name, 'root', function(response)
    {
        cache.lastUpdated = new Date();

        if(completed)
            completed(response);
    })
}


function cacheDocs(completed)
{
    cachingDocuments = [];

    var finaliseCacheDocs = function()
    {
        var changesMade = containsChanges(cache.documents, cachingDocuments);

        if(changesMade)
        {
            restoreOrder(cachingDocuments);

            cache.documents = cachingDocuments;
            cache.lastUpdated = new Date();
        }

        if(completed)
            completed(changesMade);
    };

    var checkComplete = function()
    {
        // check caching has completed
        if( haveAllDownloaded(cachingDocuments) )
        {
            finaliseCacheDocs();
        }
    };

    gdrive.listChildrenDocs(cache.folder.id, MAX_DOCS, function(children_response)
    {
        if(children_response && children_response.items && children_response.items.length)
        {
            children_response.items.forEach( function(child, index)
            {
                var doc =
                {
                    item: null,
                    contentHTML: '',
                    hasDownloaded: false
                };

                cachingDocuments.push(doc);
            });

            children_response.items.forEach( function(child, index)
            {
                gdrive.getFile(child.id, function(item)
                {
                    var doc = cachingDocuments[index];
                    doc.item = item;
                    doc.title = item.title;
                    doc.cursorPos = item.cursorPos;

                    var cachedDoc = matchDocumentById(doc.item.id, cache.documents);
                    var requiresDownload = true;

                    if(cachedDoc && cachedDoc.item.version == doc.item.version)
                    {
                        requiresDownload = false;

                        doc.title = cachedDoc.title;
                        doc.contentHTML = cachedDoc.contentHTML;
                        doc.hasDownloaded = true;
                    }

                    if(requiresDownload)
                    {
                        gdrive.download(item.exportLinks['text/html'], function(responseData)
                        {
                            var cleaned = cleanGoogleDocHTML(responseData);

                            doc.contentHTML = "<style type=\"text/css\" scoped>" + cleaned.css + "</style>" + cleaned.html;
                            doc.hasDownloaded = true;

                            checkComplete();
                        });
                    }
                    else
                    {
                        checkComplete();
                    }
                });
            });
        }
        else
        {
            finaliseCacheDocs();
        }
    });
}

function matchDocumentById(itemId, list)
{
    for(var i = 0; i < list.length; ++i)
    {
        var listDoc = list[i];

        if(listDoc.item && listDoc.item.id == itemId)
        {
            return listDoc;
        }
    }

    return null;
}

function containsChanges(docListA, docListB)
{
    // first clean the lists to remove notes that have not yet been synced to the server
    var cleanListA = removeUnsynced(docListA);
    var cleanListB = removeUnsynced(docListB);

    if(!cleanListA && !cleanListB)
      return false;

    if(!cleanListA || !cleanListB)
      return true;

    if(cleanListA.length != cleanListB.length)
      return true;

    // test to see if every doc is contained in each list and modified dates are not different
    for(var i = 0; i < cleanListA.length; ++i)
    {
        var docA = cleanListA[i];
        var docB = matchDocumentById( docA.item.id, cleanListB );

        if(!docB)
            return true;

        if(docA.item.version != docB.item.version)
            return true;
    }

    return false;
}

function removeUnsynced(docList)
{
    var cleanList = [];

    for(var i = 0; i < docList.length; ++i)
    {
        var doc = docList[i];

        if(!doc.requiresInsert)
            cleanList.push(doc);
    }

    return cleanList;
}

function removeEmptyDocuments()
{
    var keep = [];

    for(var i = 0; i < cache.documents.length; ++i)
    {
        var doc = cache.documents[i];

        if(doc.contentHTML)
            keep.push(doc);
    }

    cache.documents = keep;
}

function haveAllDownloaded(docs)
{
    for(var i = 0; i < docs.length; i++)
    {
        var doc = docs[i];

        if(!doc.hasDownloaded)
            return false;
    }
    return true;
}


function storeOrder(docs)
{
    if(!docs)
        return;

    var identifiers = [];

    for(var i = 0; i < docs.length; i++)
    {
        var doc = docs[i];

        if(doc.item)
            identifiers.push(doc.item.id);
    }

    chrome.storage.sync.set( {'document-order':identifiers} );
}


function restoreOrder(docs)
{
    if(!docs || !docs.length)
        return;

    chrome.storage.sync.get('document-order', function(result)
    {
        var identifiers = result['document-order'];

        if(!identifiers || !identifiers.length)
            return;

        for(var i = 0, to = 0; i < identifiers.length && i < docs.length; i++)
        {
            var docId = identifiers[i];
            var index = indexOfDocumentWithId(docs, docId);

            if(index >= 0)
            {
                docs.move(index, to++);
            }
        }
    })
}


function indexOfDocumentWithId(docList, docId)
{
    for(var i = 0; i < docList.length; i++)
    {
        var doc = docList[i];

        if(doc.item && doc.item.id == docId)
            return i;
    }

    return -1;
}


Array.prototype.move = function(from, to)
{
    if(from != to)
        this.splice(to, 0, this.splice(from, 1)[0]);
};


function debug_printDocs(docsList, name)
{
    console.log(name + ':');

    if(!docsList || docsList.length == 0)
    {
        console.log('- is empty');
        return;
    }

    for(var i = 0; i < docsList.length; ++i)
    {
        var doc = docsList[i];
        console.log('- ' + doc.item.title + ' - ' + doc.item.version + ' - ' + doc.item.id);
    }
}


function saveDocument(doc, callback_started, callback_completed)
{
    if(!doc || !doc.dirty || doc.saving)
        return;

    doc.saving = true;
    doc.dirty = false;

    if(callback_started)
        callback_started();

    var success = function(item_response)
    {
        doc.item = item_response;
        doc.saving = false;

        cache.lastUpdated = new Date();

        // update the list item element id (ie. for the case when the doc required insertion and had a guid)
        doc.$notesListElement.attr('id', doc.item.id);

        if(callback_completed)
            callback_completed();

        // automatically save pending changes once current save has completed
        if(doc.dirty)
            saveDocument(doc, callback_started, callback_completed);
    };

    if(doc.requiresInsert)
    {
        doc.requiresInsert = false;
        gdrive.insertAsHTML(cache.folder.id, doc.title, doc.contentHTML, success);
    }
    else
    {
        gdrive.overwriteAsHTML(doc.item.id, doc.title, doc.contentHTML, success);
    }
}


function cleanGoogleDocHTML(html)
{
    var bodyContent = contentOfFirstTag('body', html);
    var styleContent = contentOfFirstTag('style', html);

    // remove empty span's and replace empty p's (including those with classes) with a line break
    // convert p's to div's for better contenteditable element support
    bodyContent = bodyContent
        .replace(/<span><\/span>/g, '')
        .replace(/<span class=\"([\w\s]*)\"><\/span>/g, '')
        .replace(/<p><\/p>/g, '<div><br/></div>')
        .replace(/<p class=\"([\w\s]*)\"><\/p>/g, '<div><br/></div>')
        .replace(/<p/g, '<div')
        .replace(/<\/p>/g, '</div>');

   // replace headings with bold spans
    bodyContent = bodyContent
        .replace(/<h1/g, '<b')
        .replace(/<\/h1>/g, '</b>')
        .replace(/<h2/g, '<b')
        .replace(/<\/h2>/g, '</b>')
        .replace(/<h3/g, '<b')
        .replace(/<\/h3>/g, '</b>')
        .replace(/<h4/g, '<b')
        .replace(/<\/h4>/g, '</b>')
        .replace(/<h5/g, '<b')
        .replace(/<\/h5>/g, '</b>')
        .replace(/<h6/g, '<b')
        .replace(/<\/h6>/g, '</b>');

    var $content = $('<div>' + bodyContent + '</div>');

    // remove classes that we don't use and may get in our way (ie. everything that does not start with a 'c')
    $content.find('*').each(function()
    {
        var $elem = $(this);
        var classes = this.className.split(/\s+/);

        $.each(classes, function(i, c)
        {
            if(c.length > 0 && c.indexOf('c') !== 0)
            {
                $elem.removeClass(c);
            }
        });
    });

    // remove all selectors that dont start with '.c' from style content
    var cssParser = new IceburgCSS(styleContent);

    cssParser.ruleSets = cssParser.ruleSets.filter( function(ruleSet)
    {
        return ruleSet.selector.startsWith(".c");
    });

    // remove all properties except those we explicitly allow (eg. line-height will really mess us up)
    var allowProperties = ["color", "background-color", "font-style", "font-weight"];

    cssParser.ruleSets.forEach( function(ruleSet)
    {
        ruleSet.declarations = ruleSet.declarations.filter( function(decl)
        {
            return allowProperties.indexOf( decl.property ) > -1;
        })
    });


    return {
        css: cssParser.cssText(),
        html: $content.html()
    }
}
