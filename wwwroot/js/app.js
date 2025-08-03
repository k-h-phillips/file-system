import { FileExplorer } from "./components/fileExplorer.js";

// Render the folder on initial load and any time the URL is changed.
window.addEventListener("DOMContentLoaded", FileExplorer.renderFolder);
window.addEventListener("popstate", FileExplorer.renderFolder);

// Configure event listeners for file explorer and search.
document.getElementById("download").onclick = FileExplorer.downloadFile;
document.getElementById("upload").onclick = FileExplorer.handleUploadClick;
document.getElementById("fileInput").onchange = FileExplorer.uploadFile;
document.getElementById("delete").onclick = FileExplorer.deleteFile;
document.getElementById("rename").onclick = FileExplorer.handleRenameClick;
document.getElementById("copy").onclick = FileExplorer.addItemToClipboard.bind(this, FileExplorer.copyItem);
document.getElementById("cut").onclick = FileExplorer.addItemToClipboard.bind(this, FileExplorer.moveItem);
document.getElementById("paste").onclick = FileExplorer.pasteItem;
document.getElementById("newFolder").onclick = FileExplorer.newFolder;
document.getElementById("homeLink").onclick = async () => {
    history.replaceState(null, "", "/");
    await FileExplorer.renderFolder()
}
document.getElementById("desktopIcon").onclick = () => { document.getElementById("homeLink").click() };
const debouncedSearch = FileExplorer.debounce(FileExplorer.search, 500);
document.getElementById("searchBar").addEventListener("input", debouncedSearch);