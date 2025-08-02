/**
 * File.js
 * Represents a file in the file explorer.
 * Provides methods to render the file information and format file sizes
 */
import { FileExplorer } from "./fileExplorer.js"

/**
 * A file in the file explorer.
 */
export class File {
    /**
     * Creates a new File instance.
     * @param {object} fileJson - The JSON object representing the file. 
     */
    constructor(fileJson) {
        // Create the HTML element for the file.
        if (!fileJson) {    
            throw new Error("File JSON data is required to create a File instance.");
        }
        this.element = document.createElement("tr");
        this.element.classList.add("file");
        this.element.tabIndex = 0;
        
        // Click or focus to select.
        this.element.onclick = FileExplorer.selectItem.bind(this.element);
        this.element.onfocus = FileExplorer.selectItem.bind(this.element);
        
        // Name.
        const nameElement = document.createElement("td");
        nameElement.innerText = fileJson.name;
        nameElement.title = fileJson.name;
        this.element.appendChild(nameElement);

        // Path.
        const pathElement = document.createElement("td");
        pathElement.classList.add("search");
        pathElement.innerText = fileJson.fullPath;
        pathElement.title = fileJson.fullPath;
        this.element.appendChild(pathElement);
        
        // Size.
        const sizeElement = document.createElement("td");
        sizeElement.classList.add("folderItem");
        let fileSizeFormatted = File.makeBytesValueReadable(fileJson.sizeInBytes)
        sizeElement.innerText= fileSizeFormatted;
        sizeElement.title = fileSizeFormatted;
        this.element.appendChild(sizeElement);

        // Type.
        const typeElement = document.createElement("td");
        typeElement.classList.add("folderItem");
        typeElement.innerText = fileJson.type;
        typeElement.title = fileJson.type;
        this.element.appendChild(typeElement); 

        // Last modified.
        const lastModifiedElement = document.createElement("td");
        lastModifiedElement.classList.add("folderItem");
        lastModifiedElement.classList.add("lastModified")
        let dateString = (new Date(fileJson.lastModified)).toLocaleString()
        lastModifiedElement.innerText = dateString;
        lastModifiedElement.title = dateString;
        this.element.appendChild(lastModifiedElement);
    }

    /**
     * Renders the file as an HTML element.
     * @returns {HTMLElement} - The HTML element representing the file.
     */
    render() {
        return this.element;
    }

    /**
     * Formats a byte value into a human-readable string.
     * @param {int} bytes 
     * @param {int} decimalPlaces 
     * @returns {string} - A human-readable string representing the byte value.
     * @example
     * File.makeBytesValueReadable(1234567, 2); 
     * Returns "1.23 MB"
     */
    static makeBytesValueReadable(bytes, decimalPlaces = 2) {
        if (bytes === 0) return '0 Bytes';

        // A kilobyte is 1024 bytes.
        const base = 1024;

        // Ensure decimal places is a non-negative integer.
        decimalPlaces = decimalPlaces < 0 ? 0 : decimalPlaces;

        // How many times does the base fit into the bytes.
        const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));

        // Normalize the value to the chosen unit.
        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        return parseFloat((bytes / Math.pow(base, unitIndex)).toFixed(decimalPlaces)) + ' ' + units[unitIndex];
    }
}