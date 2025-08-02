namespace TestProject
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();

            var app = builder.Build();

            app.UseHttpsRedirection();

            // Serve static files from the SPA's root path.
            app.UseStaticFiles();
            app.MapFallbackToFile("index.html");

            // Custom middleware to handle missing static routes.
            // Missing static routes are handled as if the user was trying to navigate to a file rather
            // than a folder on the file system.
            app.Use(async (context, next) =>
            {
                await next();
                
                // If the response is 404 and it's not an API request, redirect one directory up.
                if (context.Response.StatusCode == 404 && 
                    !context.Request.Path.StartsWithSegments("/filesystem"))
                {
                    string fullPath = context.Request.Path.Value ?? string.Empty;
                    int lastSlash = Math.Max(fullPath.LastIndexOf('\\'), fullPath.LastIndexOf('/'));
                    string redirectPath = fullPath[..lastSlash];
                    context.Response.Redirect(string.IsNullOrEmpty(redirectPath) ? "/" : redirectPath);
                }
            });

            // Map attribute routed controllers.
            app.MapControllers();

            app.Run();
        }
    }
}