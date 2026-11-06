using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KpiApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly UserManager<AppUser> _userManager;

        public UsersController(AppDbContext db, UserManager<AppUser> userManager)
        {
            _db = db;
            _userManager = userManager;
        }

        [HttpGet("lecturers")]
        [Authorize(Roles = "Admin,HOD")]
        public async Task<IActionResult> GetLecturers()
        {
            var lecturers = await _userManager.GetUsersInRoleAsync("Lecturer");
            var lecturerList = lecturers.Select(u => new
            {
                id = u.Id,
                fullName = u.FullName,
                email = u.Email,
                departmentId = u.DepartmentId,
                department = u.Department?.Name
            });

            return Ok(lecturerList);
        }

        [HttpGet("hods")]
        [Authorize(Roles = "Admin,Dean")]
        public async Task<IActionResult> GetHODs()
        {
            var hods = await _userManager.GetUsersInRoleAsync("HOD");
            var hodList = hods.Select(u => new
            {
                id = u.Id,
                fullName = u.FullName,
                email = u.Email,
                departmentId = u.DepartmentId,
                department = u.Department?.Name
            });

            return Ok(hodList);
        }

        [HttpGet]
        [Authorize(Roles = "Admin,HOD,Dean")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _db.Users
                .Include(u => u.Department)
                .ToListAsync();

            var result = new List<object>();
            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                result.Add(new
                {
                    id = user.Id,
                    fullName = user.FullName,
                    email = user.Email,
                    departmentId = user.DepartmentId,
                    department = user.Department?.Name,
                    roles
                });
            }

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _db.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
                return NotFound();

            var roles = await _userManager.GetRolesAsync(user);

            return Ok(new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                departmentId = user.DepartmentId,
                department = user.Department?.Name,
                roles
            });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,HOD")]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserModel model)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
                return NotFound();

            // HOD can update only Lecturers in their department
            var currentUser = await _userManager.GetUserAsync(User);
            var currentUserRoles = await _userManager.GetRolesAsync(currentUser);
            if (currentUserRoles.Contains("HOD") && !currentUserRoles.Contains("Admin"))
            {
                if (!await _userManager.IsInRoleAsync(user, "Lecturer") || user.DepartmentId != currentUser.DepartmentId)
                    return Forbid("HOD can only edit Lecturers in their department.");
            }

            user.FullName = model.FullName;
            user.DepartmentId = model.DepartmentId;
            if (model.Title != null)
                user.Title = model.Title;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return BadRequest(result.Errors);

            // Return full, updated payload including roles
            var roles = await _userManager.GetRolesAsync(user);
            await _db.Entry(user).Reference(u => u.Department).LoadAsync();
            return Ok(new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                departmentId = user.DepartmentId,
                department = user.Department?.Name,
                roles
            });
        }

        [HttpPut("{id}/roles")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateUserRoles(string id, [FromBody] UpdateUserRolesModel model)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
                return NotFound();

            var currentRoles = await _userManager.GetRolesAsync(user);
            var targetRoles = model.Roles?.Distinct().ToList() ?? new List<string>();

            // Remove roles that are not in target
            foreach (var role in currentRoles)
            {
                if (!targetRoles.Contains(role))
                {
                    var removeRes = await _userManager.RemoveFromRoleAsync(user, role);
                    if (!removeRes.Succeeded)
                        return BadRequest(removeRes.Errors);
                }
            }

            // Add roles that are missing
            foreach (var role in targetRoles)
            {
                if (!await _userManager.IsInRoleAsync(user, role))
                {
                    var addRes = await _userManager.AddToRoleAsync(user, role);
                    if (!addRes.Succeeded)
                        return BadRequest(addRes.Errors);
                }
            }

            var updatedRoles = await _userManager.GetRolesAsync(user);
            return Ok(new { roles = updatedRoles });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,HOD")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
                return NotFound();

            var currentUser = await _userManager.GetUserAsync(User);
            var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

            // HOD can only delete Lecturers in their department
            if (currentUserRoles.Contains("HOD") && !currentUserRoles.Contains("Admin"))
            {
                var roles = await _userManager.GetRolesAsync(user);
                if (!roles.Contains("Lecturer") || user.DepartmentId != currentUser.DepartmentId)
                    return Forbid("HOD can only delete Lecturers in their department.");
            }

            // Delete dependent workplan assignments first to avoid FK errors
            var assignments = await _db.WorkplanAssignments
                .Where(a => a.AssigneeId == user.Id)
                .ToListAsync();
            _db.WorkplanAssignments.RemoveRange(assignments);

            await _db.SaveChangesAsync();

            // Delete user
            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
                return BadRequest(result.Errors);

            return Ok(new { message = "User deleted successfully" });
        }
    }

    public class UpdateUserModel
    {
        public string FullName { get; set; } = "";
        public int? DepartmentId { get; set; }
        public string? Title { get; set; }
    }

    public class UpdateUserRolesModel
    {
        public List<string> Roles { get; set; } = new();
    }
}
