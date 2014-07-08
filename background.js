
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

var cache =
{
    folder: null,
    documents: []
};


document.addEventListener("DOMContentLoaded", function()
{
    loadState();

    gdrive = new GDrive();
    gdrive.auth({interactive: false}, onAuthenticated);
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
    chrome.runtime.sendMessage({'cachingState': state});

    var completed_wrapper = function()
    {
        cache.lastUpdated = new Date();

        state = StateEnum.IDLE;
        chrome.runtime.sendMessage({'cachingState': state});

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
                    doc.item = item
                    doc.title = item.title;

                    gdrive.download(item.exportLinks['text/html'], function(responseData)
                    {
                        doc.contentHTML = responseData;
                        doc.hasDownloaded = true;

                        // check caching has completed
                        if( haveAllDownloaded(cachingDocuments) )
                        {
                            cache.documents = cachingDocuments;

                            if(completed)
                                completed();
                        }
                    })
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
