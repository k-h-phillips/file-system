using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using TestProject.Models;


namespace TestProject.Controllers
{
    // <summary>
    /// Controller for managing file and directory operations.
    /// Provides endpoints for retrieving, moving, deleting, searching, uploading, and downloading files.
    /// </summary>
    /// <remarks>
    /// All paths are relative to the configured home directory.
    /// </remarks>
    [ApiController]
    [Route("[controller]")]
    public class FileSystemController : ControllerBase
    {

        private readonly string _homePath;
        private readonly ILogger<FileSystemController> _logger;

        public FileSystemController(IConfiguration configuration, ILogger<FileSystemController> logger)
        {
            _homePath = configuration["FileSystem:Home"];
            _logger = logger;
        }
        
        /// <summary>
        /// Transforms a relative path to an absolute path based on the configured home directory.
        /// This method ensures that the path is always within the home directory to prevent unauthorized access.
        /// </summary>
        /// <param name="path">Path within the home directory</param>
        /// <returns>Path prepended with the home directory</returns>
        private string PrependHomeToPath(string? path)
        {
            return Path.Combine(_homePath, path ?? string.Empty);
        }

        /// <summary>
        /// Gets the contents of a directory in the file system.
        /// </summary>
        /// <param name="path">The directory path to search in (e.g., "home/Projects")</param>
        /// <returns>A list of File and Directory results</returns>
        /// <response code="200">Directory contents retrieved successfully.</response>
        /// <response code="403">Access denied to the specified path</response>
        /// <response code="404">Path not found</response>
        /// <example>
        /// GET /filesystem/Projects
        /// </example>
        [HttpGet("{**path}")]
        public IActionResult GetDirectoryContents(string? path)
        {
            string? fullPath = PrependHomeToPath(path);
            if (!fullPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!Directory.Exists(fullPath) && !System.IO.File.Exists(fullPath))
            {
                return NotFound("Specified path not found");
            }

            // Get folders first, then files, to mimic standard file explorers.
            List<object> children = new() {};
            IEnumerable<string> folders;
            try
            {
                folders = Directory.EnumerateDirectories(fullPath, "*", SearchOption.TopDirectoryOnly);
            }
            catch (UnauthorizedAccessException)
            {
                _logger.LogWarning("Access denied to folder: {folder}", fullPath);
                return Forbid("Access denied to the specified path");
            }
            foreach (string folder in folders)
            {
                try
                {
                    DirectoryInfo directoryInfo = new(folder);
                    children.Add(new Folder()
                    {
                        Name = directoryInfo.Name,
                        FullPath = Path.GetFullPath(folder)[_homePath.Length..],
                        LastModified = directoryInfo.LastWriteTime,
                        ItemCount = Directory.GetFileSystemEntries(folder).Length,
                    });
                }
                catch (UnauthorizedAccessException)
                {
                    _logger.LogWarning("Access denied to folder: {folder}", folder);
                }
            }

            IEnumerable<string> files = Directory.EnumerateFiles(fullPath, "*", SearchOption.TopDirectoryOnly);
            foreach (string file in files)
            {
                FileInfo fileInfo = new(file);
                string extension = fileInfo.Extension.Length > 0 ? fileInfo.Extension.ToUpper()[1..] : "File";
                children.Add(new Models.File()
                {
                    Name = fileInfo.Name,
                    FullPath = Path.GetFullPath(file)[_homePath.Length..],
                    LastModified = fileInfo.LastWriteTime,
                    SizeInBytes = fileInfo.Length,
                    Type = extension,

                });
            }
            return Ok(children);
        }

        /// <summary>
        /// Uploads a file to the specified path on the server.
        /// </summary>
        /// <param name="file">The file to upload</param>
        /// <param name="path">The directory path to upload the file in (e.g., "home/Projects")</param>
        /// <returns>The name of the file on the server once it is uploaded</returns>
        /// <response code="200">File uploaded successfully.</response>
        /// <response code="403">Access denied to the specified path</response>
        /// <response code="404">Upload path not found</response>
        /// <response code="400">File was empty or null</response>
        /// <response code="500">Internal server error</response>
        /// <example>
        /// POST /filesystem/upload/Projects
        /// </example>
        [HttpPost("upload/{**path}")]
        public async Task<IActionResult> UploadFile(IFormFile file, string? path)
        {
            string fullPath = PrependHomeToPath(path);
            if (!fullPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (string.IsNullOrEmpty(fullPath))
            {
                return NotFound("Upload folder is not found");
            }
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded or file is empty");
            }

            try
            {
                // Define the path where the file will be saved. Account for scenarios 
                // where a file already exists with the same path and name.
                string startingPath = Path.Combine(fullPath, file.FileName);
                string filePath = startingPath;
                int index = 1;
                while (System.IO.File.Exists(filePath))
                {
                    filePath = startingPath + $" ({index})";
                    index++;
                }

                // Upload the file to the server.
                using (FileStream stream = new(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                return Ok(new { new FileInfo(filePath).Name });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Downloads a file from the specified path onto the server.
        /// </summary>
        /// <param name="path">The full path to the file to download (e.g., "home/Projects/test.js")</param>
        /// <returns>A file content result for the downloaded file</returns>
        /// <response code="200">File results</response>
        /// <response code="403">Access denied to the specified path</response>
        /// <response code="404">File path not found</response>
        /// <response code="500">Internal server error</response>
        /// <example>
        /// GET /filesystem/download/Projects/test.js
        /// </example>
        [HttpGet("download/{**path}")]
        public IActionResult DownloadFile(string? path)
        {
            // Check if the file exists.
            string fullPath = PrependHomeToPath(path);
            if (!fullPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound("File not found");
            }

            try
            {
                // Read the file into a byte array.
                byte[] fileBytes = System.IO.File.ReadAllBytes(fullPath);

                // Determine the content type of the file.
                const string DefaultContentType = "application/octet-stream";
                FileExtensionContentTypeProvider provider = new();
                if (!provider.TryGetContentType(fullPath, out string? contentType))
                {
                    contentType = DefaultContentType;
                }

                // Return the file result.
                return File(fileBytes, contentType, Path.GetFileName(fullPath));
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
           
        }

        /// <summary>
        /// Deletes a file or folder from the specified path.
        /// </summary>
        /// <param name="path">The full path to the item to delete (e.g., "home/Projects/test.js")</param>
        /// <response code="204">No content, file deleted successfully</response>
        /// <response code="403">Access denied to the specified path</response>
        /// <response code="404">File path not found</response>
        /// <response code="500">Internal server error</response>
        /// <example>
        /// DELETE /filesystem/Projects/test.js
        /// </example>
        [HttpDelete("{**path}")]
        public IActionResult DeleteItem(string? path)
        {
            string fullPath = PrependHomeToPath(path);
            if (!fullPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!Directory.Exists(fullPath) && !System.IO.File.Exists(fullPath))
            {
                return NotFound("Specified path not found");
            }

            try
            {
                if (Directory.Exists(fullPath))
                {
                    Directory.Delete(fullPath, true);
                }
                else if (System.IO.File.Exists(fullPath))
                {
                    System.IO.File.Delete(fullPath);
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }

        }
        /// <summary>
        /// Body for the move and copy operations.  
        /// Contains the old path, new path, and a force flag.
        /// </summary>
        /// <remarks>
        /// The old path is the current location of the file or directory,
        /// the new path is the desired location,
        /// and the force flag indicates whether to overwrite an existing item at the new path.
        /// </remarks>
        /// <example>
        /// {       
        ///     "OldPath": "Projects/test.js",
        ///     "NewPath": "Projects/test2.js",
        ///     "Force": true
        /// }
        /// </example>
        public class MoveBody
        {
            public string? OldPath { get; set; }
            public string? NewPath { get; set; }
            public bool Force { get; set; } = false;
        }

        /// <summary>
        /// Moves a file system item from one path to another.
        /// </summary>
        /// <param name="moveBody">
        /// Specifications for the move, including the old path, the new path,
        /// and whether or not to forcefully overwrite something at the target destination.
        /// </param>
        /// <returns>
        /// A message indicating whether the move was completed or if further confirmation is required
        /// </returns>
        /// <response code="200">Status message</response>
        /// <response code="403">Access denied to a specified path</response>
        /// <response code="404">Old file path not found</response>
        /// <response code="500">Internal server error</response>
        /// <example>
        /// POST /filesystem/move
        /// </example>
        [HttpPost("move")]
        public IActionResult MoveItem([FromBody] MoveBody moveBody)
        {
            string fullOldPath = PrependHomeToPath(moveBody.OldPath);
            if (!fullOldPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!Directory.Exists(fullOldPath) && !System.IO.File.Exists(fullOldPath))
            {
                return NotFound("Specified old path not found");
            }

            // Check if something exists at the new path.
            string fullNewPath = PrependHomeToPath(moveBody.NewPath);
            if (!fullNewPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!moveBody.Force && (Directory.Exists(fullNewPath) || System.IO.File.Exists(fullNewPath)))
            {
                return Ok(new { Message = $"{moveBody.NewPath} already exists" });
            }

            try
            {
                // Move the item forcefully.
                if (Directory.Exists(fullOldPath))
                {
                    Directory.Move(fullOldPath, fullNewPath);
                }
                else if (System.IO.File.Exists(fullOldPath))
                {
                    System.IO.File.Move(fullOldPath, fullNewPath, moveBody.Force);
                }
                return Ok(new { Message = "Item moved" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Copies a file from one path to another.
        /// </summary>
        /// <param name="moveBody">
        /// Specifications for the copy, including the old path, the new path,
        /// and whether or not to forcefully overwrite something at the target destination.
        /// </param>
        /// <returns>
        /// A message indicating whether the copy was completed or if further confirmation is required.
        /// </returns>
        /// <response code="200">Status message</response>
        /// <response code="403">Access denied to a specified path</response>
        /// <response code="404">Old file path not found</response>
        /// <response code="500">Internal server error</response>
        /// <example>
        /// POST /filesystem/copy
        /// </example>
        [HttpPost("copy")]
        public IActionResult CopyFile([FromBody] MoveBody moveBody)
        {
            string fullOldPath = PrependHomeToPath(moveBody.OldPath);
            if (!fullOldPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!System.IO.File.Exists(fullOldPath))
            {
                return NotFound("Specified old path not found");
            }

            // Check if something exists at the new path.
            string fullNewPath = PrependHomeToPath(moveBody.NewPath);
            if (!fullNewPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (!moveBody.Force && System.IO.File.Exists(fullNewPath))
            {
                return Ok(new { Message = $"{moveBody.NewPath} already exists" });
            }

            try
            {
                // Copy the file forcefully.
                if (System.IO.File.Exists(fullOldPath))
                {
                    System.IO.File.Copy(fullOldPath, fullNewPath, moveBody.Force);
                }
                return Ok(new { Message = "File moved" });

                // Could implement directory copy with more time...
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Creates a new directory at the specified path.
        /// </summary>
        /// <param name="path">The path to the directory to create the new directory in.</param>
        /// <returns>The name of the new directory</returns>
        /// <response code="200">Successfully created directory</response>
        /// <response code="403">Access denied to the specified path</response>
        /// <response code="400">Empty path</response>
        /// <response code="500">Internal server error</response>
        /// <example>
        /// POST /filesystem/copy
        /// </example>
        [HttpPost("create/{**path}")]
        public IActionResult CreateFolder(string? path)
        {
            string fullPath = PrependHomeToPath(path);
            if (!fullPath.StartsWith(_homePath))
            {
                return Forbid("Access denied");
            }
            if (string.IsNullOrEmpty(fullPath))
            {
                return BadRequest("Path not specified");
            }

            try
            {
                // Give the new directory a unique name.
                string modifiedPath = fullPath;
                int index = 1;
                while (Directory.Exists(modifiedPath))
                {
                    modifiedPath = fullPath + $" ({index})";
                    index++;
                }
                DirectoryInfo directory = Directory.CreateDirectory(modifiedPath);
                return Ok(new { directory.Name });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Searches for files and directories matching a search term in the specified path.
        /// </summary>
        /// <param name="path">The path to search in (e.g., "home/Projects")</param>
        /// <param name="searchTerm">The term to search for in file and directory names</param>
        /// <returns>
        /// A stream of results containing matching files and directories.
        /// The results are sent as Server-Sent Events (SSE) to the client.
        /// </returns>
        /// <response code="200">Search results streamed successfully.</response>
        /// <example>
        /// GET /filesystem/search/Projects?searchTerm=test
        /// </example>
        /// <remarks>
        /// This endpoint uses Server-Sent Events (SSE) to stream results back to the client.
        /// The client should handle the SSE connection to receive results in real-time.
        /// The search is case-insensitive and supports wildcard patterns.
        /// For example, searching for "test" will match "test.js", "TestFile.txt", and "mytestfile.docx".
        /// </remarks>
        [HttpGet("search/{**path}")]
        public async Task Search(
            string? path,
            [FromQuery] string searchTerm,
            CancellationToken cancellationToken = default
        )
        {
            // Set up Server-Sent Events response.
            Response.Headers.Add("Content-Type", "text/event-stream");
            Response.Headers.Add("Cache-Control", "no-cache");
            Response.Headers.Add("Connection", "keep-alive");
            Response.Headers.Add("Access-Control-Allow-Origin", "*");
            Response.Headers.Add("Access-Control-Allow-Headers", "Cache-Control");

            string fullSearchPath = PrependHomeToPath(path);
            await foreach (var result in SearchFilesAsync(fullSearchPath, $"*{searchTerm}*", cancellationToken))
            {
                string json = JsonSerializer.Serialize(result);
                await Response.WriteAsync($"data: {json}\n\n", cancellationToken: cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);

                // Check if client disconnected.
                if (cancellationToken.IsCancellationRequested)
                    break;
            }

            // Send completion signal.
            await Response.WriteAsync("data: [DONE]\n\n", cancellationToken: cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        /// <summary>
        /// Searches for files and directories in the specified path that match a given pattern.
        /// This method uses an asynchronous enumerable to yield results as they are found.
        /// </summary>
        /// <param name="searchPath">The path to search in (e.g., "Projects")</param>
        /// <param name="pattern">The pattern to match against file and directory names</param>
        /// <param name="cancellationToken">Cancellation token to stop the search if needed</param>
        /// <returns>
        /// An asynchronous enumerable of objects representing matching files and directories.
        /// Each object contains properties such as Name, FullPath, LastModified, SizeInBytes, and Type.
        /// </returns>
        /// <remarks>
        /// This method performs a recursive search through the specified directory and its subdirectories.
        /// It yields results as they are found, allowing for efficient streaming of search results.
        /// The search is case-insensitive and supports wildcard patterns.
        /// For example, searching for "test" will match "test.js", "TestFile.txt", and "mytestfile.docx".
        /// </remarks>
        private async IAsyncEnumerable<object> SearchFilesAsync(
            string searchPath,
            string pattern,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            if (!Directory.Exists(searchPath))
            {
                yield break;
            }

            // Initialize a queue to enable recursive directory search.
            // Each time a directory is encountered, it is added to the queue so that its contents
            // will be searched later in the algorithm.
            Queue<string> queue = new();
            queue.Enqueue(searchPath);

            // Continue searching until the queue is empty or the client requests a cancellation.
            while (queue.Count > 0 && !cancellationToken.IsCancellationRequested)
            {
                string currentPath = queue.Dequeue();
                await foreach (var result in GetFilesMatchingPattern(currentPath, pattern, cancellationToken))
                {
                    yield return result;
                }
                await foreach (var result in GetFoldersMatchingPattern(currentPath, pattern, queue, cancellationToken))
                {
                    yield return result;
                }
            }
        }

        /// <summary>
        /// Gets files matching a specific pattern in the given directory path.
        /// This method yields results asynchronously to allow for streaming of file data.
        /// </summary>
        /// <param name="searchPath">The directory path to search in (e.g., "home/Projects")</param>
        /// <param name="pattern">The pattern to match against file names</param>
        /// <param name="cancellationToken">Cancellation token to stop the search if needed</param>
        /// <returns>
        /// An asynchronous enumerable of objects representing matching files.
        /// Each object contains properties such as Name, FullPath, LastModified, SizeInBytes, and Type.
        /// </returns>
        private async IAsyncEnumerable<object> GetFilesMatchingPattern(
            string searchPath,
            string pattern,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            IEnumerable<string> files;
            try
            {
                files = Directory.EnumerateFiles(searchPath, pattern);
            } 
            catch (UnauthorizedAccessException)
            {
                _logger.LogWarning("Access denied to folder: {folder}", searchPath);
                yield break;
            }
            catch (DirectoryNotFoundException)
            {
                _logger.LogWarning("Directory not found: {folder}", searchPath);
                yield break;
            }
            foreach (string file in files)
            {
                if (cancellationToken.IsCancellationRequested)
                    yield break;

                FileInfo fileInfo = new(file);
                string extension = fileInfo.Extension.Length > 0 ? fileInfo.Extension.ToUpper()[1..] : "File";
                yield return new Models.File()
                {
                    Name = fileInfo.Name,
                    FullPath = Path.GetFullPath(file)[_homePath.Length..],
                    LastModified = fileInfo.LastWriteTime,
                    SizeInBytes = fileInfo.Length,
                    Type = extension,
                };

                // Small delay to prevent overwhelming the client.
                await Task.Delay(1, cancellationToken);
            }
        }

        /// <summary>
        /// Gets folders matching a specific pattern in the given directory path.
        /// This method yields results asynchronously to allow for streaming of folder data.
        /// </summary>
        /// <param name="directoryPath">The directory path to search in (e.g., "home/Projects")</param>
        /// <param name="pattern">The pattern to match against folder names</param> 
        /// <param name="queue">A queue to hold directories for recursive search</param>
        /// <param name="cancellationToken">Cancellation token to stop the search if needed</param>
        /// <returns>
        /// An asynchronous enumerable of objects representing matching folders.
        /// Each object contains properties such as Name, FullPath, LastModified, and ItemCount
        /// </returns>
        private async IAsyncEnumerable<object> GetFoldersMatchingPattern(
            string directoryPath,
            string pattern,
            Queue<string> queue,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            IEnumerable<string> directories;
            try
            {
                directories = Directory.EnumerateDirectories(directoryPath);
            }
            catch (UnauthorizedAccessException)
            {
                _logger.LogWarning("Access denied to folder: {folder}", directoryPath);
                yield break;
            }
            catch (DirectoryNotFoundException)
            {
                _logger.LogWarning("Directory not found: {folder}", directoryPath);
                yield break;
            }
            foreach (string folder in directories)
            {
                if (cancellationToken.IsCancellationRequested)
                    yield break;

                if (MatchesPattern(Path.GetFileName(folder), pattern))
                {
                    DirectoryInfo directoryInfo = new(folder);
                    int itemCount;
                    try
                    {
                        itemCount = Directory.GetFileSystemEntries(folder).Length;
                    }
                    catch (UnauthorizedAccessException)
                    {
                        _logger.LogWarning("Access denied to folder: {folder}", folder);
                        itemCount = 0;
                    }
                    yield return new
                    {
                        directoryInfo.Name,
                        FullPath = Path.GetFullPath(folder)[_homePath.Length..],
                        LastModified = directoryInfo.LastWriteTime,
                        ItemCount = itemCount,
                    };
                }

                // Add directory to queue for recursive search.
                queue.Enqueue(folder);

                // Small delay to prevent overwhelming the client.
                await Task.Delay(1, cancellationToken);
            }
        }

        /// <summary>
        /// Checks if a file or directory name matches a given pattern.
        /// This method supports wildcard patterns using '*' to match any sequence of characters.
        /// </summary>
        /// <param name="name">The name of the file or directory to check</param>
        /// <param name="pattern">The pattern to match against the name</param>
        /// <returns>
        /// True if the name matches the pattern, false otherwise.
        /// </returns>
        /// <remarks>
        /// This method uses a regular expression to handle wildcard patterns.
        /// If the pattern is '*', it matches any name. 
        /// If the pattern contains '*', it is replaced with '.*' to allow for matching any sequence of characters.
        /// If the pattern is empty or null, it matches any name.
        /// </remarks>
        private static bool MatchesPattern(string name, string pattern)
        {
            if (pattern == "*" || string.IsNullOrEmpty(pattern))
            {
                return true;
            }
                
            if (pattern.Contains('*'))
            {
                Regex regex = new ("^" + Regex.Escape(pattern).Replace("\\*", ".*") + "$", RegexOptions.IgnoreCase);
                return regex.IsMatch(name);
            }

            return name.Contains(pattern, StringComparison.OrdinalIgnoreCase);
        }
    }
}