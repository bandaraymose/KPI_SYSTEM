using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace KpiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class KpiAssignmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public KpiAssignmentsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpPost]
    [Authorize(Roles = "Admin,HOD,Dean")]
    public async Task<IActionResult> AssignKpi([FromBody] CreateKpiAssignmentDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized("User ID not found");

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized("Current user not found");

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);
        if (currentUserRoles == null)
            return Unauthorized("Current user roles not found");

        var targetUser = await _userManager.FindByIdAsync(dto.UserId);
        if (targetUser == null)
            return NotFound("User not found");

        var targetUserRoles = await _userManager.GetRolesAsync(targetUser);
        if (targetUserRoles == null)
            return BadRequest("Target user roles not found");

        // Validate KPI's TargetRole matches target user's role
        var kpi = await _db.Kpis.FindAsync(dto.KpiId);
        if (kpi == null)
            return NotFound("KPI not found");

        if (!string.IsNullOrEmpty(kpi.TargetRole) && !targetUserRoles.Contains(kpi.TargetRole))
            return BadRequest($"KPI with TargetRole '{kpi.TargetRole}' cannot be assigned to a user with roles {string.Join(", ", targetUserRoles)}");

        // HOD permissions
        if (currentUserRoles.Contains("HOD"))
        {
            if (targetUser.Id == currentUserId && targetUserRoles.Contains("HOD"))
            {
                // Dean assigning to HOD → allowed
            }
            else if (targetUserRoles.Contains("Lecturer") && currentUser.DepartmentId == targetUser.DepartmentId)
            {
                // HOD assigning to lecturer in same department → allowed
            }
            else
            {
                return Forbid("HODs can only assign KPIs to lecturers in their department, or be assigned by Dean.");
            }
        }

        // Prevent duplicate assignments
        var existingAssignment = await _db.KpiAssignments
            .FirstOrDefaultAsync(a => a.KpiId == dto.KpiId &&
                                      a.LecturerId == dto.UserId &&
                                      a.AcademicYear == dto.AcademicYear &&
                                      a.Semester == dto.Semester);

        if (existingAssignment != null)
        {
            return BadRequest(new { message = "This KPI is already assigned to the user for this period" });
        }

        var assignment = new KpiAssignment
        {
            KpiId = dto.KpiId,
            LecturerId = dto.UserId,
            AcademicYear = dto.AcademicYear,
            Semester = dto.Semester,
            AssignedAt = DateTime.UtcNow // Assumes AssignedAt is added to KpiAssignment model
        };

        _db.KpiAssignments.Add(assignment);
        await _db.SaveChangesAsync();

        var result = await _db.KpiAssignments
            .Include(a => a.Kpi)
            .Include(a => a.Lecturer)
            .FirstOrDefaultAsync(a => a.Id == assignment.Id);

        return Ok(result);
    }

    [HttpGet("lecturer/{lecturerId}")]
    public async Task<IActionResult> GetByLecturer(string lecturerId)
    {
        var assignments = await _db.KpiAssignments
            .Include(a => a.Kpi)
            .Include(a => a.Lecturer)
            .Where(a => a.LecturerId == lecturerId)
            .OrderBy(a => a.AcademicYear)
            .ThenBy(a => a.Semester)
            .ToListAsync();

        return Ok(assignments);
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMyAssignments()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized("User ID not found");

        var assignments = await _db.KpiAssignments
            .Include(a => a.Kpi)
            .Include(a => a.Lecturer)
            .Where(a => a.LecturerId == currentUserId)
            .OrderBy(a => a.AcademicYear)
            .ThenBy(a => a.Semester)
            .ToListAsync();

        return Ok(assignments);
    }

    [HttpGet("my-kpis")]
    [Authorize]
    public async Task<IActionResult> GetMyKpis()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized("User ID not found");

        var myKpis = await _db.KpiAssignments
            .Include(a => a.Kpi)
            .Where(a => a.LecturerId == currentUserId)
            .Select(a => a.Kpi)
            .Distinct()
            .ToListAsync();

        return Ok(myKpis);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,HOD,Dean")]
    public async Task<IActionResult> GetAll([FromQuery] int? departmentId = null, [FromQuery] string? academicYear = null, [FromQuery] string? semester = null)
    {
        var query = _db.KpiAssignments
            .Include(a => a.Kpi)
            .Include(a => a.Lecturer)
            .ThenInclude(l => l.Department)
            .AsQueryable();

        if (departmentId.HasValue)
        {
            query = query.Where(a => a.Lecturer.DepartmentId == departmentId);
        }

        if (!string.IsNullOrEmpty(academicYear))
        {
            query = query.Where(a => a.AcademicYear == academicYear);
        }

        if (!string.IsNullOrEmpty(semester))
        {
            query = query.Where(a => a.Semester == semester);
        }

        var assignments = await query
            .OrderBy(a => a.AcademicYear)
            .ThenBy(a => a.Semester)
            .ThenBy(a => a.Lecturer.FullName)
            .ToListAsync();

        return Ok(assignments);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,HOD,Dean")]
    public async Task<IActionResult> DeleteAssignment(int id)
    {
        var assignment = await _db.KpiAssignments
            .Include(a => a.Lecturer)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (assignment == null)
            return NotFound();

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized("User ID not found");

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized("Current user not found");

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);
        if (currentUserRoles == null)
            return Unauthorized("Current user roles not found");

        if (currentUserRoles.Contains("HOD"))
        {
            if (assignment.Lecturer.DepartmentId != currentUser.DepartmentId &&
                assignment.LecturerId != currentUserId)
            {
                return Forbid("You can only manage assignments in your department or your own KPIs.");
            }
        }

        _db.KpiAssignments.Remove(assignment);
        await _db.SaveChangesAsync();

        return Ok(new { message = "KPI assignment removed successfully" });
    }
}

// DTOs
public class CreateKpiAssignmentDto
{
    [Required]
    public int KpiId { get; set; }

    [Required]
    public string UserId { get; set; } = "";

    [Required]
    [StringLength(20)]
    public string AcademicYear { get; set; } = "";

    [Required]
    [StringLength(10)]
    public string Semester { get; set; } = "";
}