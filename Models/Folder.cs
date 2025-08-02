namespace TestProject.Models
{
    /// <summary>
    /// Represents a folder in the file system.
    /// </summary>
    /// <remarks>
    /// This class is used to store information about folders, including their name, full path,
    /// last modified date, and the number of items contained within the folder.
    /// </remarks>
    public class Folder
    {
        public string Name { get; set; } = "";
        public string FullPath { get; set; } = "";
        public DateTime LastModified { get; set; }
        public int ItemCount { get; set; }
    }
}