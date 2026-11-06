using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;

namespace KpiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkplansController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public WorkplansController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpPost]
    [Authorize(Roles = "Lecturer,HOD,Dean")]
    public async Task<IActionResult> Submit([FromBody] System.Text.Json.JsonElement jsonElement)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var jsonString = jsonElement.GetRawText();
        
        // Try to deserialize as DetailedWorkplanDto first
        try
        {
            var detailedDto = System.Text.Json.JsonSerializer.Deserialize<DetailedWorkplanDto>(jsonString!, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (detailedDto != null && !string.IsNullOrEmpty(detailedDto.AcademicYear))
            {
                // Handle detailed workplan format
                var content = $"Academic Year: {detailedDto.AcademicYear}\n" +
                             $"Semester: {detailedDto.Semester}\n\n" +
                             $"Teaching Activities:\n{detailedDto.TeachingActivities}\n\n" +
                             $"Research Activities:\n{detailedDto.ResearchActivities}\n\n" +
                             $"Service Activities:\n{detailedDto.ServiceActivities}\n\n" +
                             $"Administrative Activities:\n{detailedDto.AdministrativeActivities}\n\n" +
                             $"Professional Development:\n{detailedDto.ProfessionalDevelopment}\n\n" +
                             $"Key Objectives:\n{detailedDto.Objectives}\n\n" +
                             $"Expected Outcomes:\n{detailedDto.ExpectedOutcomes}";

                var (periodStart, periodEnd) = GetPeriodDates(detailedDto.AcademicYear, detailedDto.Semester);

                var workplan = new Workplan
                {
                    LecturerId = currentUserId,
                    PeriodStart = periodStart,
                    PeriodEnd = periodEnd,
                    Content = content,
                    SubmittedAt = DateTime.UtcNow
                };

                _db.Workplans.Add(workplan);
                await _db.SaveChangesAsync();

                var result = await _db.Workplans
                    .Include(w => w.Lecturer)
                    .ThenInclude(l => l.Department)
                    .FirstOrDefaultAsync(w => w.Id == workplan.Id);

                return Ok(result);
            }
        }
        catch
        {
            // Fall through to simple format handling
        }
        
        // Try simple CreateWorkplanDto format
        try
        {
            var dto = System.Text.Json.JsonSerializer.Deserialize<CreateWorkplanDto>(jsonString!, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (dto != null)
            {
                if (dto.PeriodEnd <= dto.PeriodStart)
                    return BadRequest(new { message = "Period end date must be after start date" });

                var workplan = new Workplan
                {
                    LecturerId = currentUserId,
                    PeriodStart = dto.PeriodStart,
                    PeriodEnd = dto.PeriodEnd,
                    Content = dto.Content,
                    SubmittedAt = DateTime.UtcNow
                };

                _db.Workplans.Add(workplan);
                await _db.SaveChangesAsync();

                var result = await _db.Workplans
                    .Include(w => w.Lecturer)
                    .ThenInclude(l => l.Department)
                    .FirstOrDefaultAsync(w => w.Id == workplan.Id);

                return Ok(result);
            }
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Invalid workplan format", error = ex.Message });
        }
        
        return BadRequest(new { message = "Unable to parse workplan data" });
    }

    [HttpGet("lecturer/{lecturerId}")]
    public async Task<IActionResult> GetByLecturer(string lecturerId)
    {
        var workplans = await _db.Workplans
            .Include(w => w.Lecturer)
            .ThenInclude(l => l.Department)
            .Where(w => w.LecturerId == lecturerId)
            .OrderByDescending(w => w.SubmittedAt)
            .ToListAsync();

        return Ok(workplans);
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyWorkplans()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var workplans = await _db.Workplans
            .Include(w => w.Lecturer)
            .ThenInclude(l => l.Department)
            .Where(w => w.LecturerId == currentUserId)
            .OrderByDescending(w => w.SubmittedAt)
            .ToListAsync();

        return Ok(workplans);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,HOD,Dean")]
    public async Task<IActionResult> GetAll([FromQuery] int? departmentId = null)
    {
        var query = _db.Workplans
            .Include(w => w.Lecturer)
            .ThenInclude(l => l.Department)
            .AsQueryable();

        if (departmentId.HasValue)
        {
            query = query.Where(w => w.Lecturer.DepartmentId == departmentId);
        }

        var workplans = await query
            .OrderByDescending(w => w.SubmittedAt)
            .ToListAsync();

        return Ok(workplans);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Lecturer,HOD,Dean")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var workplan = await _db.Workplans.FindAsync(id);
        if (workplan == null)
            return NotFound();

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        // Only creator (lecturer) can update
        if (workplan.LecturerId != currentUserId)
            return Forbid("You can only update your own workplans");

        if (dto.PeriodEnd <= dto.PeriodStart)
            return BadRequest(new { message = "Period end date must be after start date" });

        workplan.PeriodStart = dto.PeriodStart;
        workplan.PeriodEnd = dto.PeriodEnd;
        workplan.Content = dto.Content;
        workplan.SubmittedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var result = await _db.Workplans
            .Include(w => w.Lecturer)
            .ThenInclude(l => l.Department)
            .FirstOrDefaultAsync(w => w.Id == id);

        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Delete(int id)
    {
        var workplan = await _db.Workplans.FindAsync(id);
        if (workplan == null)
            return NotFound();

        _db.Workplans.Remove(workplan);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Workplan deleted successfully" });
    }

    [HttpGet("for-review")]
    [Authorize(Roles = "Dean")]
    public async Task<IActionResult> GetWorkplansForReview()
    {
        // Get workplans submitted by HODs for Dean review
        var hodUserIds = (await _userManager.GetUsersInRoleAsync("HOD")).Select(u => u.Id).ToList();
        
        var workplans = await _db.Workplans
            .Include(w => w.Lecturer)
            .ThenInclude(l => l.Department)
            .Where(w => hodUserIds.Contains(w.LecturerId))
            .OrderByDescending(w => w.SubmittedAt)
            .Select(w => new {
                id = w.Id,
                title = $"Workplan {w.Id}",
                description = w.Content.Substring(0, Math.Min(200, w.Content.Length)) + "...",
                submittedBy = w.Lecturer!.FullName,
                department = w.Lecturer!.Department!.Name,
                status = "Pending", // Default status - you can add a Status field to Workplan model
                submittedDate = w.SubmittedAt,
                academicYear = w.PeriodStart.Year.ToString(),
                semester = "1", // You can determine this based on PeriodStart
                objectives = new string[] { "Complete KPI assignments", "Submit evaluations" },
                kpis = new object[] { },
                comments = ""
            })
            .ToListAsync();

        return Ok(workplans);
    }

    [HttpPut("{id}/review")]
    [Authorize(Roles = "Dean")]
    public async Task<IActionResult> ReviewWorkplan(int id, [FromBody] ReviewWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var workplan = await _db.Workplans.FindAsync(id);
        if (workplan == null)
            return NotFound();

        // Add review data (you might want to add these fields to the Workplan model)
        // For now, we'll just return success
        
        return Ok(new { 
            message = $"Workplan {dto.Status.ToLower()} successfully",
            status = dto.Status,
            comments = dto.Comments
        });
    }

    [HttpPost("submit-to-dean")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> SubmitToDean([FromBody] DetailedWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        // Combine all activities into content
        var content = $"Academic Year: {dto.AcademicYear}\n" +
                     $"Semester: {dto.Semester}\n\n" +
                     $"Teaching Activities:\n{dto.TeachingActivities}\n\n" +
                     $"Research Activities:\n{dto.ResearchActivities}\n\n" +
                     $"Service Activities:\n{dto.ServiceActivities}\n\n" +
                     $"Administrative Activities:\n{dto.AdministrativeActivities}\n\n" +
                     $"Professional Development:\n{dto.ProfessionalDevelopment}\n\n" +
                     $"Key Objectives:\n{dto.Objectives}\n\n" +
                     $"Expected Outcomes:\n{dto.ExpectedOutcomes}";

        // Determine period dates from academic year and semester
        var (periodStart, periodEnd) = GetPeriodDates(dto.AcademicYear, dto.Semester);

        var workplan = new Workplan
        {
            LecturerId = currentUserId,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Content = content,
            SubmittedAt = DateTime.UtcNow
        };

        _db.Workplans.Add(workplan);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Workplan submitted to Dean successfully", workplanId = workplan.Id });
    }

    [HttpPost("submit-to-hod")]
    [Authorize(Roles = "Lecturer")]
    public async Task<IActionResult> SubmitToHOD([FromBody] DetailedWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        // Combine all activities into content
        var content = $"Academic Year: {dto.AcademicYear}\n" +
                     $"Semester: {dto.Semester}\n\n" +
                     $"Teaching Activities:\n{dto.TeachingActivities}\n\n" +
                     $"Research Activities:\n{dto.ResearchActivities}\n\n" +
                     $"Service Activities:\n{dto.ServiceActivities}\n\n" +
                     $"Administrative Activities:\n{dto.AdministrativeActivities}\n\n" +
                     $"Professional Development:\n{dto.ProfessionalDevelopment}\n\n" +
                     $"Key Objectives:\n{dto.Objectives}\n\n" +
                     $"Expected Outcomes:\n{dto.ExpectedOutcomes}";

        // Determine period dates from academic year and semester
        var (periodStart, periodEnd) = GetPeriodDates(dto.AcademicYear, dto.Semester);

        var workplan = new Workplan
        {
            LecturerId = currentUserId,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Content = content,
            SubmittedAt = DateTime.UtcNow
        };

        _db.Workplans.Add(workplan);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Workplan submitted to HOD successfully", workplanId = workplan.Id });
    }

    [HttpPost("submit-to-vc")]
    [Authorize(Roles = "Dean")]
    public Task<IActionResult> SubmitToVC([FromBody] VCSubmissionDto dto)
    {
        if (!ModelState.IsValid)
            return Task.FromResult<IActionResult>(BadRequest(ModelState));

        // Simulate submission to VC - in reality you might create a new record or send an email
        var submissionId = new Random().Next(1000, 9999);
        
        return Task.FromResult<IActionResult>(Ok(new {
            message = "Consolidated workplan submitted to VC successfully",
            submissionId = submissionId,
            title = dto.Title,
            description = dto.Description,
            academicYear = dto.AcademicYear,
            semester = dto.Semester,
            submittedAt = DateTime.UtcNow,
            workplanCount = dto.WorkplanIds?.Length ?? 0
        }));
    }

    private (DateTime periodStart, DateTime periodEnd) GetPeriodDates(string academicYear, string semester)
    {
        // Extract the starting year from academic year (e.g., "2024/2025" -> 2024)
        var yearParts = academicYear.Split('/');
        var startYear = int.Parse(yearParts[0]);
        
        return semester.ToLower() switch
        {
            "first" => (new DateTime(startYear, 9, 1), new DateTime(startYear, 12, 31)),
            "second" => (new DateTime(startYear + 1, 1, 1), new DateTime(startYear + 1, 4, 30)),
            "third" => (new DateTime(startYear + 1, 5, 1), new DateTime(startYear + 1, 8, 31)),
            "academic" => (new DateTime(startYear, 9, 1), new DateTime(startYear + 1, 8, 31)),
            _ => (new DateTime(startYear, 9, 1), new DateTime(startYear + 1, 8, 31))
        };
    }
}

// DTOs
public class CreateWorkplanDto
{
    [Required]
    public DateTime PeriodStart { get; set; }

    [Required]
    public DateTime PeriodEnd { get; set; }

    [Required]
    [StringLength(5000, MinimumLength = 10)]
    public string Content { get; set; } = "";
}

public class DetailedWorkplanDto
{
    [Required]
    public string AcademicYear { get; set; } = "";
    
    [Required]
    public string Semester { get; set; } = "";
    
    [Required]
    public string TeachingActivities { get; set; } = "";
    
    [Required]
    public string ResearchActivities { get; set; } = "";
    
    [Required]
    public string ServiceActivities { get; set; } = "";
    
    public string AdministrativeActivities { get; set; } = "";
    
    [Required]
    public string ProfessionalDevelopment { get; set; } = "";
    
    [Required]
    public string Objectives { get; set; } = "";
    
    [Required]
    public string ExpectedOutcomes { get; set; } = "";
    
    // Optional fields from frontend
    public string? SubmitterId { get; set; }
    public string? SubmitterRole { get; set; }
    public int? DepartmentId { get; set; }
    public string? RecipientType { get; set; }
}

public class UpdateWorkplanDto
{
    [Required]
    public DateTime PeriodStart { get; set; }

    [Required]
    public DateTime PeriodEnd { get; set; }

    [Required]
    [StringLength(5000, MinimumLength = 10)]
    public string Content { get; set; } = "";
}

public class ReviewWorkplanDto
{
    [Required]
    public string Status { get; set; } = "";
    
    public string Comments { get; set; } = "";
    
    public string ReviewedBy { get; set; } = "";
}

public class VCSubmissionDto
{
    [Required]
    public string Title { get; set; } = "";
    
    [Required]
    public string Description { get; set; } = "";
    
    [Required]
    public string AcademicYear { get; set; } = "";
    
    [Required]
    public string Semester { get; set; } = "";
    
    public string SubmittedBy { get; set; } = "";
    
    public int[]? WorkplanIds { get; set; }
}
