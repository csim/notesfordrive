
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
    this.googleAuth = null;

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



GDrive.prototype.auth = function(options, opt_callback_authorized, opt_callback_failure)
{
    try
    {
        this.googleAuth.authorize(options, opt_callback_authorized, opt_callback_failure);
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
        // make a request to revoke token
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
            this.googleAuth.getAccessToken() );
        xhr.send();
        this.removeCachedAuthToken(opt_callback);
    }
}

GDrive.prototype.download = function(url, success_callback, error_callback)
{
    //console.log(url);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);

    xhr.setRequestHeader('Authorization', 'Bearer ' + this.googleAuth.getAccessToken() );

    xhr.onload = function(e)
    {
        if(this.status == 200)
        {
            if(success_callback)
                success_callback(xhr.responseText, xhr);
        }
        else
        {
            console.log(xhr, xhr.getAllResponseHeaders());

            if(error_callback)
                error_callback(xhr);
        }
    };

    xhr.onerror = function(e)
    {
        console.log(xhr, xhr.getAllResponseHeaders());

        if(error_callback)
            error_callback(xhr);
    };

    xhr.send();
}


GDrive.prototype.upload = function(method, url, opt_data, opt_headers, success_callback, error_callback)
{
    //console.log(url);

    var data = opt_data || null;
    var headers = opt_headers || {};

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    xhr.setRequestHeader('Authorization', 'Bearer ' + this.googleAuth.getAccessToken() );

    for(var key in headers)
        xhr.setRequestHeader(key, headers[key]);

    xhr.onload = function(e)
    {
        //console.log(xhr.response);

        if(this.status == 200)
        {
            var response = JSON.parse(xhr.responseText);

            if(success_callback)
                success_callback(response, xhr);
        }
        else
        {
            console.log(xhr, xhr.getAllResponseHeaders());

            if(error_callback)
                error_callback(xhr);
        }
    };

    xhr.onerror = function(e)
    {
        console.log(xhr, xhr.getAllResponseHeaders());

        if(error_callback)
            error_callback(xhr);
    };

    xhr.send(data);
}


GDrive.prototype.jsonRequest = function(method, url, success_callback, error_callback, opt_data, opt_headers)
{
    //console.log(method + ' ' + url);

    var data = opt_data || null;
    var headers = opt_headers || {};

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    // include common headers (auth and version) and add rest.
    xhr.setRequestHeader('Authorization', 'Bearer ' + this.googleAuth.getAccessToken() );

    if(data && data.length) {
        xhr.setRequestHeader('Content-Type', 'application/json');
    }

    for(var key in headers)
        xhr.setRequestHeader(key, headers[key]);

    xhr.onload = function(e)
    {
        //console.log(xhr.response);

        if(this.status == 200)
        {
            var response = JSON.parse(xhr.responseText);

            if(success_callback)
                success_callback(response, xhr);
        }
        else
        {
            console.log(xhr, xhr.getAllResponseHeaders());

            if(error_callback)
                error_callback(xhr);
        }
    };

    xhr.onerror = function(e)
    {
        console.log(xhr, xhr.getAllResponseHeaders());

        if(error_callback)
            error_callback(xhr);
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
