
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
    loadState();

    gdrive = new GDrive();

    gdrive.setupOAuth(
    {
        client_id: '747134525486-5ocg32qs9hcvpl0e28991qm1n7v91415.apps.googleusercontent.com',
        client_secret: 'DuJnObwE3UiVdHEJ98URNvft',
        api_scope: 'https://www.googleapis.com/auth/drive.file'
    });

    gdrive.auth({interactive: false}, onAuthenticated);

    // automatically update the cache every 15 minutes
    cacheUpdateTimer = setInterval(updateCache, 1000*60*15);
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
            chrome.runtime.sendMessage({'cacheUpdated': cache.lastUpdated});

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
        if(response.items.length > 0)
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
    gdrive.createFolder(name, 'root', completed)
}


function cacheDocs(completed)
{
    cachingDocuments = [];

    var checkComplete = function()
    {
        // check caching has completed
        if( haveAllDownloaded(cachingDocuments) )
        {
            var changesMade = containsChanges(cache.documents, cachingDocuments);

            if(changesMade)
            {
                cache.documents = cachingDocuments;
                cache.lastUpdated = new Date();
            }

            if(completed)
                completed(changesMade);
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
            cache.documents = [];

            if(completed)
                completed();
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
    if(!docListA && !docListB)
      return false;

    if(!docListA || !docListB)
      return true;

    if(docListA.length != docListB.length)
      return true;

    // test to see if every doc is contained in each list and modified dates are not different
    for(var i = 0; i < docListA.length; ++i)
    {
        var docA = docListA[i];
        var docB = matchDocumentById( docA.item.id, docListB );

        if(!docB)
            return true;

        if(docA.item.version != docB.item.version)
            return true;
    }

    return false;
}

function haveAllDownloaded(docs)
{
    for(i = 0; i < docs.length; i++)
    {
        var doc = docs[i];

        if(!doc.hasDownloaded)
            return false;
    }
    return true;
}
