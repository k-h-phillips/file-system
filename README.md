# File System :file_folder:
## Problem Assignment :pencil:
### Objective 🎯:
Create a web service API and a JavaScript SPA app that allows users to query the contents of a directory on the server.

### Requirements :clipboard:
* Web API that allows querying folders and directories
* SPA using JavaScript
* Configurable server side home directory
* App should be deep-linkable on the client side, state of the UI should be kept in the URL
* Solution builds in Visual Studo 2022 or newer
* Allow upload and download of files from the browser
* Show file and folder counts and sizes for the current view

### Bonus Requirements :star:
* Delete, move, and copy files and folders
* Entire component contained in a dialog widget that is triggered via a button
* High performance

### Constraints :no_entry_sign:
* All UI work should be client side with JavaScript, no HTML should be rendered server side
* No third party plugins, keep framework usage to a minimum (Knockout, jQuery and jQueryUI are OK but not required)

## Solution ✔️
### Features :sparkles:
* SPA JavaScript front end with no reloading
* .NET Web API to handle file system requests from the front end
* Folder contents view displays file/folder name, size (# items for folders, size for files), file type, and last modified date
* Search view shows full path to file/folder
* File upload, automatic name collision resolving
* File download
* Rename files and folders, confirmation dialog on naming collisions
* Delete files and folders, confirmation dialog
* Copy/cut/paste files, confirmation dialog on naming collisions
* Create a new folder, automatic name collision resolving
* Search nested directories for files and folders matching a pattern
    * Search triggered by input

### Design decisions :brain:
1. **Catch-all API routes**. Any request to the web API needs to specify the location of the file or folder corresponding to the request. Catch-all routes allow the API to handle all these requests with a single endpoint, where the entire path is passed as a single string parameter. This also works well with the state of the UI being held in the client side URL, because the file locations can simply be parsed from the URL and sent to the server.
1. **Re-usable UI components**. The UI is relatively simple, but having reusable components for file and folder rows provides a huge reduction in code and would make it easy to tweak the layout if future changes are required.
1. **Separation of concerns**. On the client side, all of the API logic is concentrated in `js/api/fileSystemApi.js` and all UI logic is in `js/components`. The communication with the web API is abstracted away from the UI components, which would lead to better maintainability and readability.
1. **Server-sent events (SSE) for search**. Search should be as performant as possible, and there could be a large number of nested directories to search through. Instead of sending an API request to perform the search and return the results all at once, the JavaScript client creates an `EventSource` object which manages the connection with the server and listens for messages from the server. The C# Web API uses `IAsyncEnumerable` and `FlushAsync` to generate and yield search results one by one as they become available. A `CancellationToken` is also available to the client so that the search can be cancelled at any time if the user decides to search something else or end the searc.
1. **Server side models**. Though C# provides `File` and `Directory` classes, the codebase provides its own `File` and `Folder` classes to cut down on the amount of data being passed from server to client and to more tightly control the interface. It also allows for more customization in the information being provided about each file system item. For example, the item count for each folder is provided, but that is not a value readily available in the C# `Directory` class.

### Running the solution :rocket:
1. Open the project in Visual Studio Code or Visual Studio.
1. Set the `FileSystem` > `Home` configuration variable in `appsettings.Development.json` to the folder that should be considered the home folder.
1. Run the project.
1. In the browser, browse, search, and manipulate the files. Then examine the files on the server to verify functionality.

## Potential enhancements :heavy_plus_sign:
The scope of the project was limited, but if more time were available, here are some items that could improve functionality, usabilitiy, and codebase management.
* Features 
    * Batch upload, download, move, delete
    * Allow copy/paste of folders instead of just files (currently only cut/paste supported)
    * Keyboard copy/cut/paste/delete
    * Create file
    * Allow drag/drop for file/folder moves
* UI
    * Accessibility (keyboard navigation, screen reader help, etc.)
    * Better loading indicators
    * Built in back/forward navigation rather than using the browser's 
    * Toast messages to indicate succesful operations
* Codebase
    * Automated tests
    * Error handling (more specific than just 500 errors)
