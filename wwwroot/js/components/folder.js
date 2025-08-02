/**
 * Folder.js
 * Represents a folder in the file explorer.
 * Provides methods to render the folder information and navigate to a folder.
 */
import { FileExplorer } from "./fileExplorer.js";

/**
 * A folder in the file explorer.
 */
export class Folder {
    /**
     * Creates a new Folder instance.
     * @param {object} folderJson - The JSON object representing the folder. 
     */
    constructor(folderJson) {
        // Create the HTML element for the folder.
        if (!folderJson) {
            throw new Error("Folder JSON data is required to create a Folder instance.");
        }
        this.element = document.createElement("tr");
        this.element.classList.add("folder");
        this.element.tabIndex = 0; // Make it focusable.

        // Select the folder on click or focus.
        this.element.addEventListener("click", FileExplorer.selectItem.bind(this.element));
        this.element.addEventListener("focus", FileExplorer.selectItem.bind(this.element));

        // Navigate to the folder on double-click.
        this.element.addEventListener("dblclick", Folder.navigateTo.bind(this, folderJson.fullPath), { once: true })

        // Name, links to the folder.
        const nameElement = document.createElement("td");
        nameElement.classList.add("name");
        nameElement.innerText = folderJson.name;
        nameElement.title = folderJson.name;
        this.element.appendChild(nameElement);

        // Full path.
        const pathElement = document.createElement("td");
        pathElement.classList.add("search");
        pathElement.innerText = folderJson.fullPath;
        pathElement.title = folderJson.fullPath;
        this.element.appendChild(pathElement);
    
        // Size.
        const sizeElement = document.createElement("td");
        sizeElement.classList.add("folderItem");
        sizeElement.innerText = `${folderJson.itemCount} items`;
        sizeElement.title = `${folderJson.itemCount} items`;
        this.element.appendChild(sizeElement);

        // Type.
        const typeElement = document.createElement("td");
        typeElement.classList.add("folderItem");
        typeElement.innerText = 'Folder';
        typeElement.title = 'Folder';
        this.element.appendChild(typeElement); 

        // Last modified.
        const lastModifiedElement = document.createElement("td");
        lastModifiedElement.classList.add("folderItem");
        let dateString = (new Date(folderJson.lastModified)).toLocaleString();
        lastModifiedElement.innerText = dateString;
        lastModifiedElement.title = dateString;
        this.element.appendChild(lastModifiedElement);
    }

    /**
     * Renders the folder as an HTML element.
     * @returns {HTMLElement} - The HTML element representing the folder.
     */
    render() {
        return this.element;
    }

    /**
     * Navigates to the folder specified by the path, updates the URL of the browser to indicate location.
     * @param {string} fullPath - The full path of the folder to navigate to.
     */
    static async navigateTo(fullPath) {
        // Navigate to the path. 
        history.pushState(null, "", fullPath);

        // Re-render the file explorer.
        await FileExplorer.renderFolder();
    }
}