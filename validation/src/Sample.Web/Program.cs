using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Reads the form synchronously, so validation can prove the service banned-API set triggers RS0030.
app.MapPost("/greeting", (HttpRequest request) => $"Hello, {request.Form["name"]}.");

app.Run();
