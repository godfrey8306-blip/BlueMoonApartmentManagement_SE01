using System.Text;
using BlueMoon.API;
using BlueMoon.API.Data;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection("Jwt"))
    .Validate(options => !string.IsNullOrWhiteSpace(options.Secret) && options.Secret.Length >= 32,
        "Jwt:Secret must be at least 32 characters long.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.Issuer),
        "Jwt:Issuer is required.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.Audience),
        "Jwt:Audience is required.")
    .Validate(options => options.ExpirationMinutes > 0,
        "Jwt:ExpirationMinutes must be greater than zero.")
    .ValidateOnStart();

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt configuration is missing.");

builder.Services.AddSingleton<PasswordHasher>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret)),
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    ));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ── Tác vụ khởi động ─────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Dữ liệu cũ (trước migration ScaleSearchAndFees) chưa có cột tìm kiếm không dấu
    var missing = await db.Residents.Where(r => r.SearchName == "").ToListAsync();
    if (missing.Count > 0)
    {
        foreach (var r in missing)
            r.SearchName = TextNormalizer.Normalize(r.FullName);
        await db.SaveChangesAsync();
    }

    // dotnet run -- --seed [--reset] [--residents N]
    if (args.Contains("--seed"))
    {
        var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher>();
        var residentsArg = Array.IndexOf(args, "--residents");
        var target = residentsArg >= 0 && residentsArg + 1 < args.Length && int.TryParse(args[residentsArg + 1], out var n) ? n : 260;
        await DevDataSeeder.RunAsync(db, hasher, reset: args.Contains("--reset"), targetResidents: target);
        if (args.Contains("--exit"))
            return;
    }
}

app.Run();



