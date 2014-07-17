Notes for Google Drive
=============

A Chrome extension to create and save notes as documents to Google Drive.

*Features*
- Clean and modern UI
- Documents are loaded when the extension starts and are always immediately available
- Documents sync automatically as soon as changes are made (ie. while you type)
- Automatic extraction of title from first line of content
- Documents can be edited in Google Drive, collaborators added and all the usual Google Drive goodness
- drag and drop reordering of documents

*Built on*
- jquery
- jquery-ui
- moment.js
- bootstrap
- Google Drive REST API

*Authentication*
OAuth2 using a modified version of https://github.com/borismus/oauth2-extensions

The Chrome identity API largely makes the need for directly interacting with the OAuth2 API a thing of the past, however it requires users to be logged into their Chrome browser, which may not be ideal when they have both personal and work credentials. Using the OAuth API directly allows users to be logged into whichever Google Docs account they wish.

Borismus' implementation contained a few issues around refresh tokens, was overly complex in the way it handled the redirect calls (content injection scripts etc) and didn't contain callbacks for failed states - these problems have been resolved.
