using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using KpiApi.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace KpiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(UserManager<AppUser> userManager, SignInManager<AppUser> signInManager, IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();
        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            fullName = user.FullName,
            title = user.Title,
            departmentId = user.DepartmentId,
            roles
        });
    }

    [HttpPut("me/email")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> UpdateEmail([FromBody] UpdateEmailModel model)
    {
        if (string.IsNullOrWhiteSpace(model.NewEmail) || string.IsNullOrWhiteSpace(model.CurrentPassword))
            return BadRequest(new { message = "New email and current password are required" });

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        // Verify password
        var passwordOk = await _userManager.CheckPasswordAsync(user, model.CurrentPassword);
        if (!passwordOk) return BadRequest(new { message = "Current password is incorrect" });

        user.Email = model.NewEmail;
        user.UserName = model.NewEmail;
        user.NormalizedEmail = _userManager.NormalizeEmail(model.NewEmail);
        user.NormalizedUserName = _userManager.NormalizeName(model.NewEmail);

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });

        return Ok(new { message = "Email updated successfully" });
    }

    [HttpPut("me/password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordModel model)
    {
        if (string.IsNullOrWhiteSpace(model.CurrentPassword) || string.IsNullOrWhiteSpace(model.NewPassword))
            return BadRequest(new { message = "Current and new password are required" });

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });

        return Ok(new { message = "Password changed successfully" });
    }

    [HttpPost("login")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginModel model)
    {
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null)
            return BadRequest(new { message = "Invalid email or password" });

        var result = await _signInManager.CheckPasswordSignInAsync(user, model.Password, false);
        if (!result.Succeeded)
            return BadRequest(new { message = "Invalid email or password" });

        var token = await GenerateJwtToken(user);
        var roles = await _userManager.GetRolesAsync(user);

        return Ok(new
        {
            token,
            user = new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                title = user.Title,
                departmentId = user.DepartmentId,
                roles
            }
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterModel model)
    {
        // Who is making this request?
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null)
            return Unauthorized(new { message = "Not authenticated" });

        var currentRoles = await _userManager.GetRolesAsync(currentUser);

        // 🔹 HOD: can only create Lecturers in their own department
        if (currentRoles.Contains("HOD"))
        {
            model.DepartmentId = currentUser.DepartmentId; // force dept

            var user = new AppUser
            {
                UserName = model.Email,
                Email = model.Email,
                FullName = model.FullName,
                Title = model.Title,
                PhoneNumber = model.Phone,
                DepartmentId = currentUser.DepartmentId
            };

            var result = await _userManager.CreateAsync(user, model.Password);
            if (!result.Succeeded)
                return BadRequest(new { errors = result.Errors });

            await _userManager.AddToRoleAsync(user, "Lecturer");

            return Ok(new { message = "Lecturer registered successfully by HOD" });
        }

        // 🔹 Admin: can assign any roles & departments
        if (currentRoles.Contains("Admin"))
        {
            var user = new AppUser
            {
                UserName = model.Email,
                Email = model.Email,
                FullName = model.FullName,
                Title = model.Title,
                PhoneNumber = model.Phone,
                DepartmentId = model.DepartmentId
            };

            var result = await _userManager.CreateAsync(user, model.Password);
            if (!result.Succeeded)
                return BadRequest(new { errors = result.Errors });

            if (model.Roles != null && model.Roles.Any())
            {
                foreach (var role in model.Roles)
                    await _userManager.AddToRoleAsync(user, role);
            }
            else
            {
                await _userManager.AddToRoleAsync(user, "Lecturer");
            }

            return Ok(new { message = "User registered successfully by Admin" });
        }

        // 🔹 Everyone else → no access
        return Forbid();
    }

    // Public self-service signup. Always assigns Lecturer role.
    [HttpPost("signup")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public async Task<IActionResult> Signup([FromBody] SignupModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password) || string.IsNullOrWhiteSpace(model.FullName))
        {
            return BadRequest(new { message = "Full name, Email and Password are required" });
        }

        if (model.Password != model.ConfirmPassword)
        {
            return BadRequest(new { message = "Passwords do not match" });
        }

        if (model.DepartmentId == null)
        {
            return BadRequest(new { message = "Department is required" });
        }

        var existing = await _userManager.FindByEmailAsync(model.Email);
        if (existing != null)
            return BadRequest(new { message = "An account with this email already exists" });

        var user = new AppUser
        {
            UserName = model.Email,
            Email = model.Email,
            FullName = model.FullName,
            Title = string.IsNullOrWhiteSpace(model.Title) ? null : model.Title,
            PhoneNumber = string.IsNullOrWhiteSpace(model.Phone) ? null : model.Phone,
            DepartmentId = model.DepartmentId
        };

        var createResult = await _userManager.CreateAsync(user, model.Password);
        if (!createResult.Succeeded)
            return BadRequest(new { errors = createResult.Errors });

        await _userManager.AddToRoleAsync(user, "Lecturer");

        // Optionally, auto-login after signup
        var token = await GenerateJwtToken(user);
        var roles = await _userManager.GetRolesAsync(user);

        return Ok(new
        {
            message = "Account created successfully",
            token,
            user = new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                title = user.Title,
                departmentId = user.DepartmentId,
                roles
            }
        });
    }

    private async Task<string> GenerateJwtToken(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.FullName)
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.Now.AddMinutes(Convert.ToDouble(_config["Jwt:ExpireMinutes"]));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// DTOs for requests
public class LoginModel
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public class RegisterModel
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? Title { get; set; }
    public string? Phone { get; set; }
    public int? DepartmentId { get; set; }
    public List<string>? Roles { get; set; }   // now supports Admin role assignment
}

public class SignupModel
{
    public string? Title { get; set; } // "Mr.", "Mrs.", "Dr.", "Prof.", "Ms." or null
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string Password { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
    public int? DepartmentId { get; set; }
}

public class UpdateEmailModel
{
    public string NewEmail { get; set; } = "";
    public string CurrentPassword { get; set; } = "";
}

public class ChangePasswordModel
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}
