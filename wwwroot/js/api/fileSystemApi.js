/** 
 * @module fileSystemApi
 * @description This module contains functions to interact with the file system API.
 * @requires fetch - For making HTTP requests to the API.
 * @requires FormData - For handling file uploads.
 * @requires URL - For creating object URLs for file downloads.
 * @requires EventSource - For handling server-sent events for search functionality.
 * @exports getItems, deleteItem, moveItem, copyItem, uploadItem, downloadItem, createFolder, search
 */

/**
 * @constant API_ENDPOINT - The base endpoint for the file system API.
 * @type {string}
 * @description Base URL for all file system API requests.
 */ 
const API_ENDPOINT = "/filesystem"

/**
 * Transforms a URL path by removing leading slashes and decoding URI components.
 * @param {string} path 
 * @returns {string} - The transformed path.
 */
export const transformPath = (path) => {
    if (path.charAt(0) === "/") {
        path = path.substring(1);
    }
    return decodeURIComponent(path);
}

/**
 * Gets the file system items in the specified path.
 * @param {string} path - The path to the directory or file. 
 * @returns {Promise<Object[]>} - A promise that resolves to an array of file or folder objects.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const getItems = async (path) => {
    path = transformPath(path);
    const response = await fetch(`${API_ENDPOINT}/${path}`)

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

/**
 * Deletes an item at the specified path.
 * @param {string} path - The path to the item to be deleted.
 * @returns {Promise<number>} - A promise that resolves to the HTTP status code of the delete operation.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const deleteItem = async (path) => {
    path = transformPath(path);
    const response = await fetch(`${API_ENDPOINT}/${path}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.status
}

/**
 * Moves an item from one path to another.
 * @param {string} oldPath - The current path of the item to be moved.
 * @param {string} newPath - The new path where the item should be moved.
 * @param {boolean} force - Whether to force the move operation, potentially overwriting existing items.
 * @returns {string} - A message indicating the result of the move operation.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const moveItem = async (oldPath, newPath, force=false) => {
    const response = await fetch(`${API_ENDPOINT}/move`, {
        method: "POST",
        body: JSON.stringify({
            oldPath: transformPath(oldPath),
            newPath: transformPath(newPath),
            force
        }),
        headers: {
            "Content-Type": "application/json",
        },
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseJson = await response.json();
    return responseJson.message;
}

/**
 * Copies a file from one path to another.
 * @param {string} oldPath - The current path of the file to be copied.
 * @param {string} newPath - The new path where the file should be copied.
 * @param {boolean} force - Whether to force the copy operation, potentially overwriting existing files.
 * @returns {string} - A message indicating the result of the copy operation.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const copyItem = async (oldPath, newPath, force=false) => {
    const response = await fetch(`${API_ENDPOINT}/copy`, {
        method: "POST",
        body: JSON.stringify({
            oldPath: transformPath(oldPath),
            newPath: transformPath(newPath),
            force
        }),
        headers: {
            "Content-Type": "application/json",
        },
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseJson = await response.json();
    return responseJson.message;
}

/**
 * Uploads a file to the specified path.
 * @param {string} file - The file to be uploaded.
 * @param {string} path - The path where the file should be uploaded. 
 * @returns {string} - The name of the uploaded file.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const uploadItem = async (file, path) => {
    path = transformPath(path);
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_ENDPOINT}/upload/${path}`, {
        method: 'POST',
        body: formData,
        // Content-Type is automatically set by FormData.
    });
    
    if (!response.ok) {
        throw new Error(`Upload error! Status: ${response.status}`);
    }

    const responseJson = await response.json();
    return responseJson.name;
}

/**
 * Downloads an item from the specified path.
 * @param {string} path - The path to the item to be downloaded.
 * @returns {string} - A URL for the downloaded file.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const downloadItem = async (path) => {
    path = transformPath(path);
    const response = await fetch(`${API_ENDPOINT}/download/${path}`);

    if (!response.ok) {
        throw new Error(`Download error! Status: ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return url;
}

/**
 * Creates a new folder at the specified path.
 * @param {string} path - The path where the new folder should be created. 
 * @returns {string} - The name of the created folder.
 * @throws {Error} - Throws an error if the HTTP request fails.
 */
export const createFolder = async (path) => {
    path = transformPath(path);
    const response = await fetch(`${API_ENDPOINT}/create/${path}`, {
        method: 'POST'
    })

    if (!response.ok) {
        throw new Error(`Folder creation error! Status: ${response.status}`);
    }

    const responseJson = await response.json()
    return responseJson.name;
}

/**
 * Opens an event stream to return results from a search for files and folders in the specified path
 * that match the search term.
 * @param {string} path - The path to the directory where the search should be performed. 
 * @param {*} searchTerm - The term to search for within the files and folders.
 * @returns {EventSource} - An EventSource object that listens for search results.
 */
export const search = async(path, searchTerm) => {
    const endpoint = path ? 
        `${API_ENDPOINT}/search${path}?searchTerm=${searchTerm}` : 
        `${API_ENDPOINT}/search?searchTerm=${searchTerm}`;
    return new EventSource(endpoint);
}