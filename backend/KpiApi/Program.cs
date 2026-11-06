using System.Text;
using System.Text.Json.Serialization;
using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// DbContext
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(cfg.GetConnectionString("Default"),
        ServerVersion.AutoDetect(cfg.GetConnectionString("Default"))));

// Identity - Configure to NOT redirect API calls
builder.Services.AddIdentity<AppUser, IdentityRole>(options =>
{
    // Configure Identity options if needed
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// Configure Identity to NOT redirect unauthorized API requests
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = context =>
    {
        // If this is an API request (contains /api/), return 401 instead of redirect
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = 401;
            return Task.CompletedTask;
        }
        
        // For non-API requests, allow normal redirect
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
    
    options.Events.OnRedirectToAccessDenied = context =>
    {
        // If this is an API request, return 403 instead of redirect
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = 403;
            return Task.CompletedTask;
        }
        
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});

// JWT Authentication - Set as DEFAULT scheme
var jwtKey = Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!);
builder.Services.AddAuthentication(options =>
{
    // Set JWT as the default authentication scheme
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,
        ValidIssuer = cfg["Jwt:Issuer"],
        ValidAudience = cfg["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(jwtKey),
        ClockSkew = TimeSpan.Zero // Optional: reduce clock skew
    };
    
    // Optional: Add events for debugging
    o.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine($"JWT Authentication failed: {context.Exception.Message}");
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            Console.WriteLine("JWT Token validated successfully");
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// CORS
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("frontend", p =>
        p.WithOrigins(cfg.GetSection("AllowedCorsOrigins").Get<string[]>() ?? Array.Empty<string>())
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());
});

// MVC + Swagger
builder.Services.AddControllers().AddJsonOptions(options =>
{
    // Prevent cycles when serializing EF Core entities with navigation properties
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.MaxDepth = 64;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "KPI API", Version = "v1" });
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme."
    };
    c.AddSecurityDefinition("Bearer", scheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement { { scheme, new List<string>() } });
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors("frontend");

// Authentication & Authorization order is important
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Seed database with roles and users
using (var scope = app.Services.CreateScope())
{
    await DbSeeder.SeedRolesAndUsers(scope.ServiceProvider);
}

app.Run();