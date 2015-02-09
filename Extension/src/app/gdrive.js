
function GDrive()
{
    this.googleAuth = null;
    this.allowInteractiveReauth = false;

    this.__defineGetter__('DRIVE_URI', function() {
        return 'https://www.googleapis.com/drive/v2';
    });

    this.__defineGetter__('DRIVE_FILES_URI', function() {
        return 'https://www.googleapis.com/drive/v2/files';
    });

    this.__defineGetter__('DRIVE_UPLOAD_URI', function() {
        return 'https://www.googleapis.com/upload/drive/v2/files';
    });

    this.__defineGetter__('DRIVE_FOLDER_MIME_TYPE', function() {
        return 'application/vnd.google-apps.folder';
    });

    this.__defineGetter__('DEFAULT_CHUNK_SIZE', function() {
        return 1024 * 1024 * 5; // 5MB;
    });

    this.__defineGetter__('oauth', function() {
        return this.googleAuth;
    });
}


GDrive.prototype.setAllowInteractiveReauth = function(allow)
{
    this.allowInteractiveReauth = allow;
}


GDrive.prototype.auth = function(options, opt_callback_authorized, opt_callback_failure)
{
  console.log("in GDrive.prototype.auth");

    try
    {
        var authentication_succeeded = function()
        {
          console.log("in GDrive.prototype.auth authentication_succeeded");

            chrome.runtime.sendMessage( {'authenticationSucceeded': true} );

            if(opt_callback_authorized)
                opt_callback_authorized();

        }.bind(this);

        this.googleAuth.authorize(options, authentication_succeeded, opt_callback_failure);
    }
    catch(e)
    {
        console.log(e);
    }
}


GDrive.prototype.setupOAuth = function(config)
{
    this.googleAuth = new OAuth2('google', config);
}


GDrive.prototype.removeCachedAuthToken = function(opt_callback)
{
    this.googleAuth.clearAccessToken();

    if(opt_callback)
        opt_callback();
}

GDrive.prototype.revokeAuthToken = function(opt_callback)
{
    if( this.googleAuth.hasAccessToken() )
    {
        if(navigator.onLine)
        {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
                this.googleAuth.getAccessToken() );
            xhr.send();
        }

        this.googleAuth.clearAccessToken();
    }

    opt_callback && opt_callback();
}


GDrive.prototype.authenticatedRequest = function(config, success_callback, error_callback, opt_has_retried)
{
    console.log("GDrive.prototype.authenticatedRequest with url: " + config.url);


    var data = config.data || null;
    var headers = config.headers || {};

    var busted = config.url;// + "?cache="+(Math.random()*1000000);

    var xhr = new XMLHttpRequest();
    xhr.open(config.method, busted, true);

    xhr.setRequestHeader('Authorization', 'Bearer ' + this.googleAuth.getAccessToken() );
    //xhr.setRequestHeader("Cache-Control","no-cache,max-age=0");
    //xhr.setRequestHeader("Pragma", "no-cache");

    for(var key in headers)
        xhr.setRequestHeader(key, headers[key]);


    var retry_handler = function(xhr)
    {
      console.log("retry_handler");

        if(!opt_has_retried)
        {
          console.log("retry_handler !has_retried");

            var authentication_succeeded = function()
            {
              console.log("retry_handler authentication_succeeded");

                this.authenticatedRequest(config, success_callback, error_callback, true);

            }.bind(this);

            var authentication_failed = function()
            {
                console.log("retry_handler authentication_failed 1");

                // second attempt - clear the access token and start from scratch
                this.googleAuth.clearAccessToken();

                console.log("retry_handler authentication_failed 2");

                this.auth({interactive:config.allowInteractiveReauth}, authentication_succeeded, function()
                {
                    console.log("retry_handler authentication_failed auth");

                    // no dice - could be a token issue - revoke it and start from scratch
                    this.revokeAccessToken( function()
                    {
                        console.log("retry_handler authentication_failed did revokeAccessToken");

                        if(error_callback)
                            error_callback(xhr);

                        chrome.runtime.sendMessage( {'authenticationFailed': true} );
                    })
                }.bind(this));

            }.bind(this);

            // first attempt - probably an expired access token - try to refresh it
            this.auth({interactive:config.allowInteractiveReauth}, authentication_succeeded, authentication_failed);
        }
        else
        {
          console.log("retry_handler has_retried");

            if(error_callback)
                error_callback(xhr);
        }
    }.bind(this);


    xhr.onload = function(e)
    {
        if(xhr.status == 200)
        {
            if(success_callback)
                success_callback(xhr);
        }
        else if(xhr.status == 401 || xhr.status == 403)
        {
            retry_handler(xhr);
        }
        else
        {
            if(error_callback)
                error_callback(xhr);
        }
    }.bind(this);

    xhr.onerror = function(e)
    {
        console.log('Error:');
        console.log( xhr );
        console.log( e );

        if(error_handler)
            error_handler(xhr);
    };

    if( !this.googleAuth.hasAccessToken() ) // TODO remove this if-else block
    {
      console.log("calling retry_handler");
      retry_handler(xhr);
    }
    else
    xhr.send(data);
}


GDrive.prototype.download = function(url, success_callback, error_callback)
{
    var succeeded = function(xhr)
    {
        if(success_callback)
            success_callback(xhr.responseText);
    };

    var config =
    {
        method: 'GET',
        url: url,
        allowInteractiveReauth: this.allowInteractiveReauth
    };

    this.authenticatedRequest(config, succeeded, error_callback)
}


GDrive.prototype.jsonRequest = function(config, success_callback, error_callback)
{
    config.headers = config.headers || {};

    if(config.data && config.data.length)
    {
        config.headers['Content-Type'] = 'application/json';
    }

    var succeeded = function(xhr)
    {
        var response = JSON.parse(xhr.responseText);

        if(success_callback)
            success_callback(response);
    };

    this.authenticatedRequest(config, succeeded, error_callback);
}


GDrive.prototype.filesRequest = function(method, id, fragment, parameters, success_callback, error_callback)
{
    var url = this.DRIVE_FILES_URI;

    if(id)
        url += '/' + id;

    if(fragment)
        url += fragment;

    if(parameters)
        url += '?' + stringifyUrlParams(parameters);

    var config =
    {
        method: method,
        url: url,
        allowInteractiveReauth: this.allowInteractiveReauth
    };

    this.jsonRequest(config, success_callback, error_callback);
}



GDrive.prototype.trashFile = function(fileId, success_callback, error_callback)
{
    this.filesRequest('POST', fileId, '/trash', null, success_callback, error_callback);
}


GDrive.prototype.listChildrenDocs = function(folderId, maxResults, success_callback, error_callback)
{
    var parameters = {
        q: "mimeType='application/vnd.google-apps.document' and trashed=false",
        maxResults: maxResults
    };

    this.filesRequest('GET', folderId, '/children', parameters, success_callback, error_callback);
}


GDrive.prototype.searchFileByName = function(details, success_callback, error_callback)
{
    var query = "title='" + details.name + "' and trashed=false";

    if(details.inParent)
        query += " and '" + details.inParent + "' in parents";

    if(details.onlyFolders)
        query += " and mimeType='" + this.DRIVE_FOLDER_MIME_TYPE + "'";

    var parameters = {
        q: query
    };

    this.filesRequest('GET', null, null, parameters, success_callback, error_callback);
}


GDrive.prototype.getFile = function(id, success_callback, error_callback)
{
    this.filesRequest('GET', id, null, null, success_callback, error_callback);
}


GDrive.prototype.list = function(success_callback, error_callback)
{
    var parameters = {
        maxResults: 10
    };

    this.filesRequest('GET', null, null, parameters, success_callback, error_callback);
}


GDrive.prototype.about = function(success_callback, error_callback)
{
    var config =
    {
        method: 'GET',
        url: this.DRIVE_URI + '/about',
        allowInteractiveReauth: this.allowInteractiveReauth
    };

    this.jsonRequest(config, success_callback, error_callback);
}


GDrive.prototype.createFolder = function(title, parentId, success_callback, error_callback)
{
    var metadata =
    {
        'title': title,
        'parents': [{id: parentId}],
        'mimeType': this.DRIVE_FOLDER_MIME_TYPE
    };

    var config =
    {
        method: 'POST',
        url: this.DRIVE_FILES_URI,
        data: JSON.stringify(metadata),
        allowInteractiveReauth: this.allowInteractiveReauth
    };

    this.jsonRequest(config, success_callback, error_callback);
}



GDrive.prototype.overwriteAsHTML = function(fileId, title, utf8content, success_callback, error_callback)
{
    var details =
    {
        insert: false,
        mimeType: 'text/html',
        fileId: fileId,
        title: title
    };

    this.uploadUTF8(details, utf8content, success_callback, error_callback);
}

GDrive.prototype.insertAsHTML = function(parentId, title, utf8content, success_callback, error_callback)
{
    var details =
    {
        insert: true,
        mimeType: 'text/html',
        parentId: parentId,
        title: title
    };

    this.uploadUTF8(details, utf8content, success_callback, error_callback);
}

GDrive.prototype.upload = function(method, url, opt_data, opt_headers, success_callback, error_callback)
{
    var config =
    {
        method: method,
        url: url,
        data: opt_data,
        headers: opt_headers,
        allowInteractiveReauth: this.allowInteractiveReauth
    };

    var success_wrapper = function(xhr)
    {
        var item = JSON.parse(xhr.responseText);

        if(success_callback)
            success_callback(item);
    };

    this.authenticatedRequest(config, success_wrapper, error_callback);
}

GDrive.prototype.uploadUTF8 = function(details, utf8content, success_callback, error_callback)
{
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    var contentType = details.mimeType;
    var metadata = {
        'mimeType': contentType
    };

    if(details.title)
        metadata['title'] = details.title;

    if(details.parentId)
        metadata['parents'] = [{id: details.parentId}];

    var multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n' +
        //'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        utf8content +
        close_delim;

    var url = this.DRIVE_UPLOAD_URI;

    if(details.fileId)
        url += '/' + details.fileId;

    var queryParameters = {
        'uploadType': 'multipart',
        'convert': true
    };

    url += '?' + stringifyUrlParams(queryParameters);

    var headers = {
        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    };

    var method = details.insert ? 'POST' : 'PUT';
    this.upload(method, url, multipartRequestBody, headers, success_callback, error_callback);
}


function stringifyUrlParams(params)
{
    if(!params || params.length === 0)
        return null;

    var b, c = [];
    for (b in params) c.push(encodeURIComponent(b) + "=" + encodeURIComponent(params[b]));
    return c.join("&")
}
