namespace TestProject.Models
{
    /// <summary>
    /// Represents a file in the file system.
    /// </summary>
    /// <remarks>
    /// This class is used to store information about files, including their name, full path,
    /// last modified date, size in bytes, and type.
    /// </remarks>
    public class File
    {
        public string Name { get; set; } = "";
        public string FullPath { get; set; } = "";
        public DateTime LastModified { get; set; }
        public long SizeInBytes { get; set; }
        public string Type { get; set; } = "";
    }
}