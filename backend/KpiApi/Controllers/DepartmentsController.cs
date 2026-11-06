using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace KpiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public DepartmentsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var departments = await _db.Departments
            .Include(d => d.Users)
            .ToListAsync();

        var result = new List<object>();

        foreach (var dept in departments)
        {
            var lecturerCount = 0;
            var hodCount = 0;

            foreach (var user in dept.Users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                if (roles.Contains("Lecturer")) lecturerCount++;
                if (roles.Contains("HOD")) hodCount++;
            }

            // dashboard wants lecturers + avg score per dept
            var evaluations = await _db.Evaluations
                .Include(e => e.Lecturer)
                .Where(e => e.Lecturer.DepartmentId == dept.Id)
                .ToListAsync();

            result.Add(new
            {
                dept.Id,
                dept.Name,
                UserCount = dept.Users.Count,
                LecturerCount = lecturerCount,
                HodCount = hodCount,
                AvgScore = evaluations.Any() ? evaluations.Average(e => e.Score) : 0
            });
        }

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
            return NotFound();

        var usersWithRoles = new List<object>();
        foreach (var user in department.Users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            usersWithRoles.Add(new
            {
                user.Id,
                user.FullName,
                user.Email,
                Roles = roles
            });
        }

        return Ok(new
        {
            department.Id,
            department.Name,
            Users = usersWithRoles
        });
    }

    [HttpGet("{id}/hods")]
    public async Task<IActionResult> GetHods(int id)
    {
        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
            return NotFound();

        var hods = new List<object>();
        foreach (var user in department.Users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains("HOD"))
            {
                hods.Add(new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.DepartmentId,
                    Department = department.Name
                });
            }
        }

        return Ok(hods);
    }

    [HttpGet("{id}/lecturers")]
    public async Task<IActionResult> GetLecturers(int id)
    {
        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
            return NotFound();

        var lecturers = new List<object>();
        foreach (var user in department.Users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains("Lecturer"))
            {
                lecturers.Add(new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.DepartmentId,
                    Department = department.Name
                });
            }
        }

        return Ok(lecturers);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Create([FromBody] CreateDepartmentDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var exists = await _db.Departments
            .AnyAsync(d => d.Name.ToLower() == dto.Name.ToLower());

        if (exists)
            return BadRequest(new { message = "Department already exists" });

        var department = new Department { Name = dto.Name };
        _db.Departments.Add(department);
        await _db.SaveChangesAsync();

        return Ok(department);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDepartmentDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var department = await _db.Departments.FindAsync(id);
        if (department == null)
            return NotFound();

        var exists = await _db.Departments
            .AnyAsync(d => d.Id != id && d.Name.ToLower() == dto.Name.ToLower());

        if (exists)
            return BadRequest(new { message = "Another department with this name already exists" });

        department.Name = dto.Name;
        await _db.SaveChangesAsync();

        return Ok(department);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Delete(int id)
    {
        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
            return NotFound();

        if (department.Users.Any())
            return BadRequest(new { message = "Cannot delete department with users" });

        _db.Departments.Remove(department);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Department deleted successfully" });
    }
}

// DTOs
public class CreateDepartmentDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";
}

public class UpdateDepartmentDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";
}
