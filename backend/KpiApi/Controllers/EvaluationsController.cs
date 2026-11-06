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
public class EvaluationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public EvaluationsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpPost]
    [Authorize(Roles = "HOD,Dean")]
    public async Task<IActionResult> Create([FromBody] CreateEvaluationDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized();

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

        var targetUser = await _userManager.FindByIdAsync(dto.LecturerId);
        if (targetUser == null)
            return NotFound("Lecturer not found");

        if (currentUserRoles.Contains("HOD"))
        {
            var targetRoles = await _userManager.GetRolesAsync(targetUser);
            if (!targetRoles.Contains("Lecturer") || currentUser.DepartmentId != targetUser.DepartmentId)
                return Forbid("HODs can only evaluate lecturers in their department");
        }

        var evaluation = new Evaluation
        {
            LecturerId = dto.LecturerId,
            HodId = currentUserId,
            KpiId = dto.KpiId,
            Score = dto.Score,
            Comments = dto.Comments,
            Status = "Completed",
            EvaluatedAt = DateTime.UtcNow
        };

        _db.Evaluations.Add(evaluation);
        await _db.SaveChangesAsync();

        var result = await _db.Evaluations
            .Include(e => e.Lecturer)
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .FirstOrDefaultAsync(e => e.Id == evaluation.Id);

        return Ok(result);
    }

    [HttpGet("lecturer/{lecturerId}")]
    public async Task<IActionResult> GetByLecturer(string lecturerId)
    {
        var evaluations = await _db.Evaluations
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .Where(e => e.LecturerId == lecturerId)
            .OrderByDescending(e => e.EvaluatedAt)
            .ToListAsync();

        return Ok(evaluations);
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyEvaluations()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var evaluations = await _db.Evaluations
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .Where(e => e.LecturerId == currentUserId)
            .OrderByDescending(e => e.EvaluatedAt)
            .ToListAsync();

        return Ok(evaluations);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,HOD,Dean")]
    public async Task<IActionResult> GetAll([FromQuery] int? departmentId = null)
    {
        var query = _db.Evaluations
            .Include(e => e.Lecturer)
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .AsQueryable();

        if (departmentId.HasValue)
            query = query.Where(e => e.Lecturer.DepartmentId == departmentId);

        var evaluations = await query
            .OrderByDescending(e => e.EvaluatedAt)
            .ToListAsync();

        return Ok(evaluations);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "HOD,Dean")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEvaluationDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var evaluation = await _db.Evaluations
            .Include(e => e.Lecturer)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (evaluation == null)
            return NotFound();

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized();

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

        if (evaluation.HodId != currentUserId && !currentUserRoles.Contains("Admin"))
            return Forbid("You can only update evaluations you created");

        evaluation.Score = dto.Score;
        evaluation.Comments = dto.Comments;
        evaluation.EvaluatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var result = await _db.Evaluations
            .Include(e => e.Lecturer)
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .FirstOrDefaultAsync(e => e.Id == id);

        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Delete(int id)
    {
        var evaluation = await _db.Evaluations.FindAsync(id);
        if (evaluation == null)
            return NotFound();

        _db.Evaluations.Remove(evaluation);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Evaluation deleted successfully" });
    }
}

// DTOs used by this controller
public class CreateEvaluationDto
{
    [Required] public string LecturerId { get; set; } = "";
    [Required] public int KpiId { get; set; }
    [Required] [Range(0, 100)] public decimal Score { get; set; }
    [StringLength(1000)] public string? Comments { get; set; }
}

public class UpdateEvaluationDto
{
    [Required] [Range(0, 100)] public decimal Score { get; set; }
    [StringLength(1000)] public string? Comments { get; set; }
}
