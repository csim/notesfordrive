
function stringify(params)
{
    if(!params || params.length === 0)
        return null;

    var b, c = [];
    for (b in params) c.push(encodeURIComponent(b) + "=" + encodeURIComponent(params[b]));
    return c.join("&")
}

function GDrive(selector)
{
    this.lastResponse = null;

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
}

GDrive.prototype.auth = function(options, opt_callback_success, opt_callback_failure)
{
    try
    {
        console.log('Authorising..');

        chrome.identity.getAuthToken(options, function(token)
        {
            if(token)
            {
                console.log('Recieved token');

                this.accessToken = token;
                opt_callback_success && opt_callback_success();
            }
            else
            {
                console.log('Error receivng token');

                this.accessToken = null;
                opt_callback_failure && opt_callback_failure();
            }
        }.bind(this));
    }
    catch(e)
    {
        console.log(e);
    }
}

GDrive.prototype.removeCachedAuthToken = function(opt_callback)
{
    if(this.accessToken)
    {
        var accessToken = this.accessToken;
        this.accessToken = null;

        // remove token from the token cache
        chrome.identity.removeCachedAuthToken({
            token: accessToken
        }, function() {
            opt_callback && opt_callback();
        });
    }
    else
    {
        opt_callback && opt_callback();
    }
}

GDrive.prototype.revokeAuthToken = function(opt_callback)
{
    if(this.accessToken)
    {
        // make a request to revoke token
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
            this.accessToken);
        xhr.send();
        this.removeCachedAuthToken(opt_callback);
    }
}

GDrive.prototype.download = function(url, success_callback, error_callback)
{
    console.log(url);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);

    xhr.setRequestHeader('Authorization', 'Bearer ' + this.accessToken);

    xhr.onload = function(e)
    {
        success_callback(xhr.responseText, xhr, this);
    }.bind(this);

    xhr.onerror = function(e)
    {
        console.log(this, this.status, this.response, this.getAllResponseHeaders());
        error_callback(xhr, this);
    };

    xhr.send();
}


GDrive.prototype.upload = function(method, url, opt_data, opt_headers, success_callback, error_callback)
{
    console.log(url);

    var data = opt_data || null;
    var headers = opt_headers || {};

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    xhr.setRequestHeader('Authorization', 'Bearer ' + this.accessToken);

    for(var key in headers)
        xhr.setRequestHeader(key, headers[key]);

    xhr.onload = function(e)
    {
        console.log(xhr.response);

        this.lastResponse = JSON.parse(xhr.responseText)
        success_callback(this.lastResponse, xhr, this);
    }.bind(this);

    xhr.onerror = function(e)
    {
        console.log(this, this.status, this.response, this.getAllResponseHeaders());
        error_callback(xhr, this);
    };

    xhr.send(data);
}


GDrive.prototype.jsonRequest = function(method, url, success_callback, error_callback, opt_data, opt_headers)
{
    console.log(method + ' ' + url);

    var data = opt_data || null;
    var headers = opt_headers || {};

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    // include common headers (auth and version) and add rest.
    xhr.setRequestHeader('Authorization', 'Bearer ' + this.accessToken);

    if(data && data.length) {
        xhr.setRequestHeader('Content-Type', 'application/json');
    }

    for(var key in headers)
        xhr.setRequestHeader(key, headers[key]);

    xhr.onload = function(e)
    {
        console.log(xhr.response);

        this.lastResponse = JSON.parse(xhr.responseText);

        if(success_callback)
            success_callback(this.lastResponse, xhr, this);

    }.bind(this);

    xhr.onerror = function(e)
    {
        console.log(this, this.status, this.response, this.getAllResponseHeaders());

        if(error_callback)
            error_callback(xhr, this);
    };

    xhr.send(data);
}

GDrive.prototype.filesRequest = function(method, id, fragment, parameters, success_callback, error_callback, opt_data, opt_headers)
{
    var url = this.DRIVE_FILES_URI;

    if(id)
        url += '/' + id;

    if(fragment)
        url += fragment;

    if(parameters)
        url += '?' + stringify(parameters);

    this.jsonRequest(method, url, success_callback, error_callback, opt_data, opt_headers);
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
    var url = this.DRIVE_URI + '/about';
    this.jsonRequest('GET', url, success_callback, error_callback);
}


GDrive.prototype.overwriteAsHTML = function(fileId, title, utf8content, success_callback, error_callback)
{
    var details = {
        insert: false,
        mimeType: 'text/html',
        fileId: fileId,
        title: title
    };

    this.uploadUTF8(details, utf8content, success_callback, error_callback);
}


GDrive.prototype.insertAsHTML = function(parentId, title, utf8content, success_callback, error_callback)
{
    var details = {
        insert: true,
        mimeType: 'text/html',
        parentId: parentId,
        title: title
    }

    this.uploadUTF8(details, utf8content, success_callback, error_callback);
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

    url += '?' + stringify(queryParameters);

    var headers = {
        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    };

    var method = details.insert ? 'POST' : 'PUT';
    this.upload(method, url, multipartRequestBody, headers, success_callback, error_callback);
}


GDrive.prototype.createFolder = function(title, parentId, success_callback, error_callback)
{
    var metadata = {
        'title': title,
        'parents': [{id: parentId}],
        'mimeType': this.DRIVE_FOLDER_MIME_TYPE
    };

    var url = this.DRIVE_FILES_URI;

    this.jsonRequest('POST', url, success_callback, error_callback, JSON.stringify(metadata));
}
