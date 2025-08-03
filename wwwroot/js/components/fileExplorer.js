import { File } from "./file.js"
import { Folder } from "./folder.js"
import { 
    copyItem, 
    createFolder,
    deleteItem, 
    downloadItem,
    getItems,   
    moveItem,  
    uploadItem, 
    search,
} from "../api/fileSystemApi.js"

/**
 * File explorer body. There is only ever one instance of the file explorer, which is updated dynamically 
 * as the user browses and searches through the file system.
 */
export class FileExplorer {
    /**
     * @typdef {object} Clipboard
     * @property {string} oldPath - The folder item's previous path.
     * @property {string} name - The folder item's name.
     * @property {function} operation - The operation that should be performed on a pasted item.
     */

    /**
     * Clipboard to hold the content for cut/copy operations.
     */
    static Clipboard = null;

    /**
     * EventSource for streaming search results.
     */
    static EventSource = null;

    /**
     * Get the current file system path, which controls the state of the UI.
     * @returns {string} The file system path.
     */
    static getCurrentPath() {
        // Remove trailing slashes.
        return window.location.pathname.replace(/\/$/, '').replace(/\\$/, '');
    }

    /**
     * Toggle the mode of the file explorer.
     * @param {string} mode - The mode to toggle to. Either "search" or "folderItems".
     */
    static activateMode(mode) {
        const table = document.querySelector("table");
        document.getElementById("rename").classList.add("disabled");
        document.getElementById("delete").classList.add("disabled");
        document.getElementById("copy").classList.add("disabled");
        document.getElementById("cut").classList.add("disabled");
        document.getElementById("download").classList.add("disabled");
        document.getElementById("error").classList.add("hidden");
        if (mode === "search") {
            table.classList.remove("folderItems");
            table.classList.add("search");
            document.getElementById("upload").classList.add("disabled");
            document.getElementById("newFolder").classList.add("disabled"); 
            FileExplorer.deselectItem();
        } 
        else {
            table.classList.add("folderItems");
            table.classList.remove("search");
            document.getElementById("loading").classList.add("hidden");
            document.getElementById("upload").classList.remove("disabled");
            document.getElementById("newFolder").classList.remove("disabled"); 
            const searchBar = document.getElementById("searchBar");
            searchBar.value = "";
            const folder = FileExplorer.getCurrentPath().split("/").at(-1);
            searchBar.setAttribute("placeholder", `Search ${folder ? folder : "Documents"}`)
            if (FileExplorer.EventSource) {
                FileExplorer.EventSource.close();
                FileExplorer.EventSource = null;
                document.getElementById("loading").classList.add("hidden");
                console.log('File search cancelled.');
            }
            if (FileExplorer.Clipboard) {
                document.getElementById("paste").classList.remove("disabled");
            }
        }
    }

    /**
     * Build file explorer rows to render.
     * @param {object[]} folderItems - JSON representation of the files and folders at the current directory level.
     * @returns {HTMLElement[]} - An array of HTML elements representing the folder items.
     */
    static renderFolderItems(folderItems) {
        // Get the rows.
        const folderElements = folderItems.map(child => {
            const folderItem = child.type ? new File(child) : new Folder(child);
            return folderItem.render();
        })
        
        // Add the rows to the table.
        const fileExplorerRows = document.querySelector("tbody");
        fileExplorerRows.replaceChildren();
        folderElements.forEach(element => fileExplorerRows.appendChild(element))
    }

    /**
     * Display the contents of the folder at the current URL path.
     */
    static async renderFolder() {
        // Update the breadcrumb trail.
        const folderPath = FileExplorer.getCurrentPath();
        FileExplorer.renderBreadcrumbTrail(folderPath);

        try {
            // Get the folder contents.
            const folderItems = await getItems(folderPath);

            // Display the folder contents.
            FileExplorer.renderFolderItems(folderItems);

            // Activate folder items mode.
            FileExplorer.activateMode("folderItems");
        } catch (error) {
            // Show an error if the folder could not be loaded.
            document.getElementById("error").classList.remove("hidden");
            console.error("Error loading folder: ", error);
        }
    }

    /**
     * Renders a path containing the breadcrumb trail to the current folder.
     * @param {string} path 
     */
    static renderBreadcrumbTrail(path) {
        const folders = path.split("/");
        let pathSoFar = "";
        const breadcrumbContainer = document.getElementById("breadcrumbTrail");
        breadcrumbContainer.replaceChildren();
        folders.forEach(folder => {
            // Create a 'link' for each part of the path.
            const folderLink = document.createElement("div");
            folderLink.classList.add("breadcrumbPart");
            folderLink.innerText = decodeURIComponent(folder);
            breadcrumbContainer.append(folderLink);
            breadcrumbContainer.append(document.createTextNode(" > "));

            // When part of the breadcrumb trail is clicked, navigate to that folder.
            pathSoFar += `${folder}/`;
            folderLink.addEventListener("click", Folder.navigateTo.bind(this, pathSoFar));
        }); 

        // Remove the trailing '>'.
        breadcrumbContainer.lastChild.remove();
    }

    /**
     * Deselect the currently selected item.
     */
    static deselectItem() {
        const selectedItem = document.querySelector(".selected");
        if (selectedItem) {
            selectedItem.classList.remove("selected");
        }
    }

    /**
     * Select a folder item and enable operations.
     * @param {MouseEvent|FocusEvent} event - The event that triggered the selection.
     */
    static selectItem(event) {
        event.preventDefault();
        if (!this) {
            console.error("Error selecting element!");
            return;
        }

        // Deselect currently selected item.
        FileExplorer.deselectItem();

        // Select this item.
        this.classList.add("selected");
        document.getElementById("rename").classList.remove("disabled");
        document.getElementById("delete").classList.remove("disabled");
        document.getElementById("copy").classList.remove("disabled");
        document.getElementById("cut").classList.remove("disabled");
        
        // If this is a file, enable download operation.
        const downloadButton = document.getElementById("download");
        if(this.classList.contains("file")) downloadButton.classList.remove("disabled")
        else downloadButton.classList.add("disabled");
    }

    /**
     * Download the selected file.
     */
    static async downloadFile() {
        const selectedFileRow = document.querySelector(".selected");
        if (!selectedFileRow) {
            console.error("Error downloading file, nothing is selected.");
            return;
        }
        const selectedFileName = selectedFileRow.firstElementChild.innerText;
        const selectedFilePath = selectedFileRow.childNodes[1].innerText;

        try {
            // Download the file.
            const downloadUrl = await downloadItem(selectedFilePath);

            // Create a link for the download.
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = downloadUrl;
            a.download = selectedFileName;
            document.body.appendChild(a);

            // Execute the download.
            a.click();

            // Remove the link.
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error("Error downloading file: ", error);
        }
    }

    /**
     * Handle a click on the upload button.
     */
    static handleUploadClick() {
        // Open the file upload dialog.
        const fileInput = document.getElementById("fileInput")
        fileInput.click();
    }

    /**
     * Upload the file to the server.
     */
    static async uploadFile(event) {
        const selectedFiles = this.files;
        if (selectedFiles.length > 0) {
            try {
                // Upload the file to the server.
                const file = selectedFiles[0];
                const fileName = await uploadItem(file, FileExplorer.getCurrentPath());
                
                // Rather than re-rendering, add the one file to the table.
                // This approach is chosen for performance reasons.
                const fileExtension = file.name.split(".")[1] ? file.name.split(".")[1].toUpperCase() : "File";
                const fileJson = {
                    name: fileName,
                    fullPath: `${FileExplorer.getCurrentPath()}/${fileName}`,
                    type: fileExtension,
                    sizeInBytes: file.size,
                    lastModified: file.lastModifiedDate,
                }
                const newFile = new File(fileJson);
                document.querySelector("tbody").appendChild(newFile.render())
                newFile.element.scrollIntoView();
                newFile.element.click();
            } catch (error) {
                console.error("Error uploading file: ", error);
            }
        }
        event.target.value = null;
    }

    /**
     * Delete the selected file.
     */
    static async deleteFile() {
        const selectedItemRow = document.querySelector(".selected");
        if (!selectedItemRow) {
            console.error("Error deleting file, nothing is selected.");
            return;
        }
        const selectedItemName = selectedItemRow.firstElementChild.innerText;

        // Make the user confirm that they want to delete the item.
        const userConfirmed = confirm(`Are you sure you want to delete "${selectedItemName}"?`);
        if (!userConfirmed) {
            return;
        }

        try {
            // Delete the item.
            const folderPath = FileExplorer.getCurrentPath();
            await deleteItem(`${folderPath}/${selectedItemName}`);

            // Rather than re-rendering, remove the one item from the table.
            // This approach is chosen for performance reasons.
            if (selectedItemRow.previousElementSibling) {
                selectedItemRow.previousElementSibling.click();
            }
            else if (selectedItemRow.nextElementSibling) {
                selectedItemRow.nextElementSibling.click();
            }
            selectedItemRow.remove();
        } catch (error) {
            console.error("Error deleting file: ", error);
        }
    }

    /**
     * Handle a click on the rename button.
     */
    static handleRenameClick() {
        // Replace the file/folder name with an input field for the new name.
        const selectedItemRow = document.querySelector(".selected");
        const selectedItemName = selectedItemRow.firstElementChild.innerText;
        const renameInput = document.createElement("input")
        renameInput.type = "text";
        renameInput.id = "renameInput";
        renameInput.value = selectedItemName;
        selectedItemRow.firstElementChild.innerText = '';
        selectedItemRow.firstElementChild.appendChild(renameInput);
        renameInput.select();

        // Listen for focus out of the input, and rename the file/folder at that point.
        renameInput.addEventListener("blur", FileExplorer.renameItem);
    }
    
    /**
     * Rename the item.
     * @param {BlurEvent} event - The blur event on the rename input.  
     */
    static async renameItem(event) {
        // Get the new name and path.
        const renameInput = event.target;
        const newName = renameInput.value;
        const folderPath = FileExplorer.getCurrentPath();
        const newPath = `${folderPath}/${newName}`;

        // If the old name matches the new name, do nothing.
        const oldPath = document.querySelectorAll("tr.selected td")[1].innerText;
        if (newPath === oldPath) {
            // Remove the rename input and replace with the name.
            renameInput.parentElement.innerText = newName;
            renameInput.remove();
            return;
        }

        try {
            // Rename (move) the file.
            await FileExplorer.moveItem(oldPath, newPath);

            // Re-render.
            await FileExplorer.renderFolder();
        } catch (error) {
            console.error("Error renaming file: ", error);
        }
    }

    /**
     * Move an item from one path to another. If an item with the same name already exists at the target path,
     * the user should be prompted about whether they want to replace that item.
     * @param {string} oldPath - The original path of the item.
     * @param {string} newPath - The new path of the item.
     */
    static async moveItem(oldPath, newPath) {
        try {
            const message = await moveItem(oldPath, newPath);
            if (message.includes("already exists")) {
                const userConfirmedMove = confirm(`"${newPath}" already exists. Replace it?`);
                if (!userConfirmedMove) {
                    return;
                }
                await moveItem(oldPath, newPath, true);
            }
        } catch (error) {
            console.log("Error moving item: ", error);
        }
    }

    /**
     * Copy a file from one path to another. If an item with the same name already exists at the target path,
     * the user should be prompted about whether they want to replace that item.
     * @param {string} oldPath - The original path of the item.
     * @param {string} newPath - The path to copy the item to.
     */
    static async copyItem(oldPath, newPath) {
        try {
            const message = await copyItem(oldPath, newPath);
            if (message.includes("already exists")) {
                const userConfirmedCopy = confirm(`"${newPath}" already exists. Replace it?`);
                if (!userConfirmedCopy) {
                    return;
                }
                await copyItem(oldPath, newPath, true);
            }
        } catch (error) {
            console.error("Error pasting file: ", error);
        }
    }

    /**
     * Adds the selected item to the clipboard, so that it can be pasted somewhere.
     * @param {function} operation - A function to perform on a pasted item.
     */
    static async addItemToClipboard(operation) {
        const selectedItemRow = document.querySelector(".selected");
        if (!selectedItemRow) {
            console.error("Error adding to clipboard. Nothing is selected.");
            return;
        }

        // Add the item to the clipboard.
        const selectedItemName = selectedItemRow.firstElementChild.innerText;
        FileExplorer.Clipboard = {
            oldPath: selectedItemRow.querySelector("td.search").innerText,
            name: selectedItemName,
            operation: operation,
        };

        // Enable pasting if we're not in search mode.
        if (document.querySelector("table").classList.contains("folderItems")) {
            document.getElementById("paste").classList.remove("disabled");
        }
    }

    /**
     * Paste the file on the clipboard to the current location.
     */
    static async pasteItem() {
        const folderPath = FileExplorer.getCurrentPath();
        const newPath = `${folderPath}/${FileExplorer.Clipboard.name}`;
        try {  
            // Execute the pasting operation.
            await FileExplorer.Clipboard.operation(FileExplorer.Clipboard.oldPath, newPath);

            // Re-render.
            await FileExplorer.renderFolder();

            // Select and scroll the pasted item into view.
            const fileElement = Array.from(document.querySelectorAll("td")).filter(element => {
                return element.innerText === FileExplorer.Clipboard.name
            })[0].parentElement;
            fileElement.scrollIntoView();
            fileElement.click();

            // Reset cut/copy/paste.
            FileExplorer.Clipboard = null;
            document.getElementById("paste").classList.add("disabled");
        } catch (error) {
            console.error("Error pasting file: ", error);
        }
    }

    /**
     * Create a new folder at the current location.
     */
    static async newFolder() {
        try {
            const folderPath = `${FileExplorer.getCurrentPath()}/New Folder`;
            const directoryName = await createFolder(folderPath);

            // Add the folder to the file explorer, and begin the renaming process.
            const folderJson = {
                name: directoryName,
                fullPath: `${FileExplorer.getCurrentPath()}/${directoryName}`,
                itemCount: 0,
                lastModified: new Date(),
            }
            const newFolder = new Folder(folderJson);
            document.querySelector("tbody").appendChild(newFolder.render())
            newFolder.element.scrollIntoView();
            newFolder.element.click();
            document.getElementById("rename").click();
        } catch (error) {
            console.error("Error adding new folder: ", error);
        }
    }

    /**
     * Search the current folder recursively for folder items matching the pattern in the search bar,
     * and display the results. 
     * @param {InputEventEvent} event - The input event that triggered the search.
     */
    static async search(event) {
        // If search has been removed, toggle back to the current folder.
        const searchTerm = event.target.value;
        if (!searchTerm) {
            FileExplorer.activateMode("folderItems");
            await FileExplorer.renderFolder();
            return;
        }

        // Stop the current search, if there's a search happening.
        const loadingElement = document.getElementById("loading");
        if (FileExplorer.EventSource) {
            FileExplorer.EventSource.close();
            FileExplorer.EventSource = null;
            loadingElement.classList.add("hidden");
            console.log('File search cancelled.');
        }

        // Display loading.
        FileExplorer.activateMode("search");
        document.querySelector("tbody").replaceChildren();
        loadingElement.classList.remove("hidden");

        try {
            // Get the search results.
            const folderPath = FileExplorer.getCurrentPath()
            FileExplorer.EventSource = await search(folderPath, searchTerm);

            // Listen for search results.
            FileExplorer.EventSource.onmessage = (event) => {
                if (event.data === "[DONE]") {
                    FileExplorer.EventSource.close();
                    loadingElement.classList.add("hidden");

                    if (!document.querySelector("tbody").children.length) {
                        document.getElementById("error").classList.remove("hidden");
                    }
                    return;
                }

                // Add the folder item to the table.
                const fileSystemObject = FileExplorer.convertKeysToCamelCase(JSON.parse(event.data));
                const fileSystemRow = fileSystemObject.type ? new File(fileSystemObject) : new Folder(fileSystemObject); 
                document.querySelector("tbody").append(fileSystemRow.render());
            };

            // Handle errors from the EventSource.
            FileExplorer.EventSource.onerror = (error) => {
                console.error("EventSource failed: ", error);
                FileExplorer.EventSource.close();
            };
        } catch (error) {
            console.error("Error encountered while searching: ", error);
        }
    }

    /**
     * Debounce a function to prevent it from being called too frequently.
     * This is useful for search input to avoid making too many requests.
     * @param {function} func - The function to execute.
     * @param {int} delay - The delay to implement before executing the function.
     * @returns {function} - A debounced function that will execute after the specified delay.
     */
    static debounce(func, delay = 800) {
        let timeoutId;

        // Return a new function that will be called when debounced.
        return function(...args) {
            // Clear exisitng timer.
            clearTimeout(timeoutId);

            // Set a new timer.
            timeoutId = setTimeout(() => {
                // Execute the original function after the delay
                func.apply(this, args);
            }, delay);
        };
    }

    /**
     * Convert the keys in the JSON to camelCase.
     * @param {object} json 
     * @returns {object} The same JSON with the keys converted to camelCase.
     */
    static convertKeysToCamelCase(json) {
        const converted = {};
        for (const [key, value] of Object.entries(json)) {
            const camelKey = key.charAt(0).toLowerCase() + key.slice(1);;
            converted[camelKey] = value;
        }
        return converted;
    }
}