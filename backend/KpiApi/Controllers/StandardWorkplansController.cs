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
public class StandardWorkplansController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public StandardWorkplansController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // GET: api/standardworkplans
    [HttpGet]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> GetAll([FromQuery] string? targetRole = null, [FromQuery] string? academicYear = null, [FromQuery] string? semester = null)
    {
        var query = _db.StandardWorkplans
            .Include(sw => sw.CreatedBy)
            .Where(sw => sw.IsActive)
            .AsQueryable();

        if (!string.IsNullOrEmpty(targetRole))
            query = query.Where(sw => sw.TargetRole == targetRole);

        if (!string.IsNullOrEmpty(academicYear))
            query = query.Where(sw => sw.AcademicYear == academicYear);

        if (!string.IsNullOrEmpty(semester))
            query = query.Where(sw => sw.Semester == semester);

        var workplans = await query
            .OrderByDescending(sw => sw.CreatedAt)
            .Select(sw => new
            {
                sw.Id,
                sw.Title,
                sw.Description,
                sw.AcademicYear,
                sw.Semester,
                sw.TargetRole,
                sw.CreatedAt,
                CreatedBy = sw.CreatedBy != null ? sw.CreatedBy.FullName : "System",
                AssignmentCount = sw.WorkplanAssignments.Count(wa => wa.IsActive)
            })
            .ToListAsync();

        return Ok(workplans);
    }

    // GET: api/standardworkplans/{id}
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> GetById(int id)
    {
        var workplan = await _db.StandardWorkplans
            .Include(sw => sw.CreatedBy)
            .Include(sw => sw.WorkplanAssignments)
                .ThenInclude(wa => wa.Assignee)
            .FirstOrDefaultAsync(sw => sw.Id == id && sw.IsActive);

        if (workplan == null)
            return NotFound();

        return Ok(workplan);
    }

    // GET: api/standardworkplans/for-assignment
    [HttpGet("for-assignment")]
    [Authorize(Roles = "Dean,HOD")]
    public async Task<IActionResult> GetForAssignment()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var currentUser = await _userManager.FindByIdAsync(currentUserId!);
        var userRoles = await _userManager.GetRolesAsync(currentUser!);
        var currentRole = userRoles.FirstOrDefault();

        // Determine which workplans this user can assign
        string targetRole = currentRole switch
        {
            "Dean" => "HOD",
            "HOD" => "Lecturer",
            _ => throw new UnauthorizedAccessException("User cannot assign workplans")
        };

        var workplans = await _db.StandardWorkplans
            .Where(sw => sw.IsActive && sw.TargetRole == targetRole)
            .OrderBy(sw => sw.AcademicYear)
            .ThenBy(sw => sw.Semester)
            .ThenBy(sw => sw.Title)
            .Select(sw => new
            {
                sw.Id,
                sw.Title,
                sw.Description,
                sw.AcademicYear,
                sw.Semester,
                sw.TargetRole,
                AssignmentCount = sw.WorkplanAssignments.Count(wa => wa.IsActive)
            })
            .ToListAsync();

        return Ok(workplans);
    }

    // POST: api/standardworkplans
    [HttpPost]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Create([FromBody] CreateStandardWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var workplan = new StandardWorkplan
        {
            Title = dto.Title,
            Description = dto.Description,
            AcademicYear = dto.AcademicYear,
            Semester = dto.Semester,
            TargetRole = dto.TargetRole,
            TeachingActivities = dto.TeachingActivities,
            ResearchActivities = dto.ResearchActivities,
            ServiceActivities = dto.ServiceActivities,
            AdministrativeActivities = dto.AdministrativeActivities,
            ProfessionalDevelopment = dto.ProfessionalDevelopment,
            Objectives = dto.Objectives,
            ExpectedOutcomes = dto.ExpectedOutcomes,
            CreatedById = currentUserId
        };

        _db.StandardWorkplans.Add(workplan);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = workplan.Id }, workplan);
    }

    // PUT: api/standardworkplans/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStandardWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var workplan = await _db.StandardWorkplans.FindAsync(id);
        if (workplan == null || !workplan.IsActive)
            return NotFound();

        workplan.Title = dto.Title;
        workplan.Description = dto.Description;
        workplan.AcademicYear = dto.AcademicYear;
        workplan.Semester = dto.Semester;
        workplan.TargetRole = dto.TargetRole;
        workplan.TeachingActivities = dto.TeachingActivities;
        workplan.ResearchActivities = dto.ResearchActivities;
        workplan.ServiceActivities = dto.ServiceActivities;
        workplan.AdministrativeActivities = dto.AdministrativeActivities;
        workplan.ProfessionalDevelopment = dto.ProfessionalDevelopment;
        workplan.Objectives = dto.Objectives;
        workplan.ExpectedOutcomes = dto.ExpectedOutcomes;
        workplan.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(workplan);
    }

    // GET: api/standardworkplans/dean-workplan
    [HttpGet("dean-workplan")]
    [Authorize(Roles = "Dean")]
    public async Task<IActionResult> GetDeanWorkplan([FromQuery] string? academicYear = null, [FromQuery] string? semester = null)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        // If no academic year is specified, use the current academic year
        if (string.IsNullOrEmpty(academicYear))
        {
            var currentDate = DateTime.Now;
            var startYear = currentDate.Month >= 9 ? currentDate.Year : currentDate.Year - 1;
            academicYear = $"{startYear}/{startYear + 1}";
        }
        
        // If no semester is specified, determine current semester
        if (string.IsNullOrEmpty(semester))
        {
            var currentMonth = DateTime.Now.Month;
            semester = currentMonth switch
            {
                >= 9 or <= 1 => "1", // Sept-Jan
                >= 2 and <= 5 => "2", // Feb-May
                _ => "3" // Summer/Special semester
            };
        }
        
        // Look for existing dean workplan for the specified period
        var existingWorkplan = await _db.StandardWorkplans
            .FirstOrDefaultAsync(sw => sw.TargetRole == "Dean" 
                                    && sw.AcademicYear == academicYear 
                                    && sw.Semester == semester 
                                    && sw.IsActive);
        
        if (existingWorkplan != null)
        {
            // Return existing workplan with assignment status for this dean
            var existingAssignment = await _db.WorkplanAssignments
                .FirstOrDefaultAsync(wa => wa.StandardWorkplanId == existingWorkplan.Id 
                                        && wa.AssigneeId == currentUserId 
                                        && wa.IsActive);
            
            return Ok(new
            {
                Workplan = existingWorkplan,
                Assignment = existingAssignment,
                IsAssigned = existingAssignment != null
            });
        }
        
        // Create a new dean workplan for the current period
        var newWorkplan = new StandardWorkplan
        {
            Title = $"Dean Strategic Workplan - {academicYear} Semester {semester}",
            Description = "Strategic leadership and administrative workplan for Dean role covering faculty oversight, academic planning, and institutional development.",
            AcademicYear = academicYear,
            Semester = semester,
            TargetRole = "Dean",
            TeachingActivities = @"• Oversee curriculum development and academic standards across all departments
• Review and approve new program proposals
• Monitor teaching quality and student satisfaction metrics
• Support faculty development in teaching excellence
• Ensure compliance with accreditation requirements",
            ResearchActivities = @"• Develop faculty research strategy and priorities
• Facilitate interdisciplinary research collaborations
• Oversee research funding applications and grant management
• Monitor research output and impact metrics
• Support faculty research development and mentoring",
            ServiceActivities = @"• Lead faculty senate and academic committee meetings
• Represent faculty in university-wide committees
• Participate in academic policy development
• Engage in external academic community service
• Mentor junior faculty in service obligations",
            AdministrativeActivities = @"• Strategic planning and faculty development oversight
• Budget management and resource allocation
• Faculty recruitment, evaluation, and performance management
• Student affairs and academic policy implementation
• Stakeholder engagement and external relations
• Risk management and compliance oversight",
            ProfessionalDevelopment = @"• Attend higher education leadership conferences and workshops
• Participate in dean professional development programs
• Engage in leadership coaching or executive education
• Network with peers from other institutions
• Stay current with trends in higher education management",
            Objectives = @"• Enhance academic excellence and reputation of the faculty
• Improve faculty satisfaction and retention rates
• Strengthen research output and external funding
• Optimize operational efficiency and resource utilization
• Foster innovation in teaching and learning approaches",
            ExpectedOutcomes = @"• Increased faculty research productivity and external funding
• Improved student satisfaction and academic outcomes
• Enhanced faculty engagement and professional development
• Strengthened partnerships with industry and community
• Achievement of strategic goals and key performance indicators",
            CreatedById = "system"
        };
        
        _db.StandardWorkplans.Add(newWorkplan);
        await _db.SaveChangesAsync();
        
        // Auto-assign this workplan to the current dean
        var assignment = new WorkplanAssignment
        {
            StandardWorkplanId = newWorkplan.Id,
            AssigneeId = currentUserId!,
            AssignedById = "system",
            AssignmentNotes = "Auto-assigned dean workplan for the current academic period",
            Status = "Assigned"
        };
        
        _db.WorkplanAssignments.Add(assignment);
        await _db.SaveChangesAsync();
        
        return Ok(new
        {
            Workplan = newWorkplan,
            Assignment = assignment,
            IsAssigned = true,
            IsNewlyCreated = true
        });
    }

    // DELETE: api/standardworkplans/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> Delete(int id)
    {
        var workplan = await _db.StandardWorkplans.FindAsync(id);
        if (workplan == null || !workplan.IsActive)
            return NotFound();

        // Soft delete
        workplan.IsActive = false;
        workplan.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Standard workplan deleted successfully" });
    }
}

// DTOs for StandardWorkplan
public class CreateStandardWorkplanDto
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = "";

    [StringLength(1000)]
    public string Description { get; set; } = "";

    [Required]
    [StringLength(50)]
    public string AcademicYear { get; set; } = "";

    [Required]
    [StringLength(50)]
    public string Semester { get; set; } = "";

    [Required]
    [StringLength(50)]
    public string TargetRole { get; set; } = "";

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
}

public class UpdateStandardWorkplanDto : CreateStandardWorkplanDto
{
    // Same properties as create DTO
}