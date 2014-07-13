
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
    gdrive.auth({interactive: false}, onAuthenticated);
});


chrome.runtime.onConnect.addListener(function(port_connected)
{
    // when the popup is displayed allow interactive reauthentication on 401's
    if(port_connected.name == 'popup')
    {
        gdrive.setAllowInteractiveReauth(true);

        port_connected.onDisconnect.addListener(function(port_disconnected)
        {
            removeEmptyDocuments();
            gdrive.setAllowInteractiveReauth(false);
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

    console.log('updating cache..');

    var completed_wrapper = function(changesMade)
    {
        cache.lastChecked = new Date();
        state = StateEnum.IDLE;

        if(changesMade)
        {
            console.log('updateCache completed_wrapper changes made');
            chrome.runtime.sendMessage({'cacheUpdated': cache.lastUpdated});
        }
        else
        {
            console.log('updateCache completed_wrapper no changes');

            // edge case for when folder created during a different session or on a different machine
            if(!cache.lastUpdated)
            {
                console.log('updateCache completed_wrapper initialCacheUpdateComplete');

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
            cacheDocs(completed_wrapper);
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
            debug_printDocs(cache.documents, 'cache.documents');
            debug_printDocs(cachingDocuments, 'cachingDocuments');

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
                            doc.contentHTML = responseData;
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
