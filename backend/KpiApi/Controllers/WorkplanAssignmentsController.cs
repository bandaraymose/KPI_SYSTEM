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
public class WorkplanAssignmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public WorkplanAssignmentsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // POST: api/workplanassignments/assign-areas
    [HttpPost("assign-areas")]
    [Authorize(Roles = "Dean,HOD")]
    public async Task<IActionResult> AssignKpisByAreas([FromBody] AssignAreasDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        if (dto.AssigneeIds == null || dto.AssigneeIds.Count == 0)
            return BadRequest("At least one assignee is required");
        if (dto.AreaIds == null || dto.AreaIds.Count == 0)
            return BadRequest("At least one area is required");

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var currentUser = await _userManager.FindByIdAsync(currentUserId!);
        var userRoles = await _userManager.GetRolesAsync(currentUser!);
        var currentRole = userRoles.FirstOrDefault();

        // Validate standard workplan (for academic year/semester context)
        var standardWorkplan = await _db.StandardWorkplans.FirstOrDefaultAsync(sw => sw.Id == dto.StandardWorkplanId);
        if (standardWorkplan == null || !standardWorkplan.IsActive)
            return NotFound("Standard workplan not found");

        // Fetch KPIs under the specified areas
        var kpis = await _db.Kpis
            .Where(k => k.AreaId != null && dto.AreaIds.Contains(k.AreaId!.Value))
            .Select(k => new { k.Id, k.AreaId })
            .ToListAsync();

        if (kpis.Count == 0)
            return Ok(new { Assigned = 0, Skipped = 0, Message = "No KPIs found under the selected areas" });

        int created = 0, skipped = 0;

        foreach (var assigneeId in dto.AssigneeIds)
        {
            var assignee = await _userManager.FindByIdAsync(assigneeId);
            if (assignee == null) { continue; }

            // Permissions: Dean->HOD; HOD->Lecturer
            var assigneeRoles = await _userManager.GetRolesAsync(assignee);
            var assigneeRole = assigneeRoles.FirstOrDefault();
            var canAssign = (currentRole, assigneeRole, standardWorkplan.TargetRole) switch
            {
                ("Dean", "HOD", "HOD") => true,
                ("HOD", "Lecturer", "Lecturer") => true,
                _ => false
            };
            if (!canAssign) { continue; }

            // Department guard for HOD assigning to Lecturers
            if (currentRole == "HOD" && currentUser.DepartmentId != assignee.DepartmentId)
            {
                continue;
            }

            foreach (var k in kpis)
            {
                // Skip duplicates silently based on LecturerId + KpiId + AY + Semester
                bool exists = await _db.KpiAssignments.AnyAsync(ka =>
                    ka.KpiId == k.Id &&
                    ka.LecturerId == assigneeId &&
                    ka.AcademicYear == standardWorkplan.AcademicYear &&
                    ka.Semester == standardWorkplan.Semester);
                if (exists) { skipped++; continue; }

                _db.KpiAssignments.Add(new KpiAssignment
                {
                    KpiId = k.Id,
                    LecturerId = assigneeId,
                    AcademicYear = standardWorkplan.AcademicYear,
                    Semester = standardWorkplan.Semester,
                    AssignedAt = DateTime.UtcNow
                });
                created++;
            }
        }

        if (created > 0)
            await _db.SaveChangesAsync();

        return Ok(new { Assigned = created, Skipped = skipped, Message = $"Assigned {created} KPI links; Skipped {skipped}." });
    }

    // GET: api/workplanassignments/my
    [HttpGet("my")]
    public async Task<IActionResult> GetMyAssignments()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var currentUser = await _userManager.FindByIdAsync(currentUserId!);
        var userRoles = await _userManager.GetRolesAsync(currentUser!);
        var currentRole = userRoles.FirstOrDefault();

        var assignments = await _db.WorkplanAssignments
            .Include(wa => wa.StandardWorkplan)
            .Include(wa => wa.AssignedBy)
            .Where(wa => wa.AssigneeId == currentUserId && wa.IsActive)
            .OrderByDescending(wa => wa.AssignedAt)
            .Select(wa => new
            {
                wa.Id,
                wa.Status,
                wa.Progress,
                wa.AssignedAt,
                wa.StartedAt,
                wa.CompletedAt,
                wa.ReviewedAt,
                wa.AssignmentNotes,
                wa.CompletionNotes,
                wa.ReviewFeedback,
                StandardWorkplan = new
                {
                    wa.StandardWorkplan.Id,
                    wa.StandardWorkplan.Title,
                    wa.StandardWorkplan.Description,
                    wa.StandardWorkplan.AcademicYear,
                    wa.StandardWorkplan.Semester,
                    wa.StandardWorkplan.TargetRole,
                    wa.StandardWorkplan.TeachingActivities,
                    wa.StandardWorkplan.ResearchActivities,
                    wa.StandardWorkplan.ServiceActivities,
                    wa.StandardWorkplan.AdministrativeActivities,
                    wa.StandardWorkplan.ProfessionalDevelopment,
                    wa.StandardWorkplan.Objectives,
                    wa.StandardWorkplan.ExpectedOutcomes
                },
                AssignedBy = wa.AssignedBy.FullName
            })
            .ToListAsync();

        // 🔑 Ensure Dean sees their auto-generated workplan
        if (currentRole == "Dean" && !assignments.Any())
        {
            var now = DateTime.Now;
            var startYear = now.Month >= 9 ? now.Year : now.Year - 1;
            var academicYear = $"{startYear}/{startYear + 1}";
            var semester = now.Month switch
            {
                >= 9 or <= 1 => "1", // Sept-Jan
                >= 2 and <= 5 => "2", // Feb-May
                _ => "3" // Summer
            };

            var deanAssignment = await _db.WorkplanAssignments
                .Include(wa => wa.StandardWorkplan)
                .FirstOrDefaultAsync(wa =>
                    wa.AssigneeId == currentUserId &&
                    wa.StandardWorkplan.TargetRole == "Dean" &&
                    wa.StandardWorkplan.AcademicYear == academicYear &&
                    wa.StandardWorkplan.Semester == semester &&
                    wa.IsActive);

            if (deanAssignment != null)
            {
                assignments.Add(new
                {
                    deanAssignment.Id,
                    deanAssignment.Status,
                    deanAssignment.Progress,
                    deanAssignment.AssignedAt,
                    deanAssignment.StartedAt,
                    deanAssignment.CompletedAt,
                    deanAssignment.ReviewedAt,
                    deanAssignment.AssignmentNotes,
                    deanAssignment.CompletionNotes,
                    deanAssignment.ReviewFeedback,
                    StandardWorkplan = new
                    {
                        deanAssignment.StandardWorkplan.Id,
                        deanAssignment.StandardWorkplan.Title,
                        deanAssignment.StandardWorkplan.Description,
                        deanAssignment.StandardWorkplan.AcademicYear,
                        deanAssignment.StandardWorkplan.Semester,
                        deanAssignment.StandardWorkplan.TargetRole,
                        deanAssignment.StandardWorkplan.TeachingActivities,
                        deanAssignment.StandardWorkplan.ResearchActivities,
                        deanAssignment.StandardWorkplan.ServiceActivities,
                        deanAssignment.StandardWorkplan.AdministrativeActivities,
                        deanAssignment.StandardWorkplan.ProfessionalDevelopment,
                        deanAssignment.StandardWorkplan.Objectives,
                        deanAssignment.StandardWorkplan.ExpectedOutcomes
                    },
                    AssignedBy = "System"
                });
            }
        }

    return Ok(assignments);
}

// GET: api/workplanassignments/assigned-by-me
[HttpGet("assigned-by-me")]
[Authorize(Roles = "Dean,HOD")]
public async Task<IActionResult> GetAssignedByMe()
{
    var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var assignments = await _db.WorkplanAssignments
            .Include(wa => wa.StandardWorkplan)
            .Include(wa => wa.Assignee)
                .ThenInclude(a => a.Department)
            .Where(wa => wa.AssignedById == currentUserId && wa.IsActive)
            .OrderByDescending(wa => wa.AssignedAt)
            .Select(wa => new
            {
                wa.Id,
                wa.Status,
                wa.Progress,
                wa.AssignedAt,
                wa.StartedAt,
                wa.CompletedAt,
                wa.ReviewedAt,
                wa.AssignmentNotes,
                wa.CompletionNotes,
                wa.ReviewFeedback,
                StandardWorkplan = new
                {
                    wa.StandardWorkplan.Id,
                    wa.StandardWorkplan.Title,
                    wa.StandardWorkplan.AcademicYear,
                    wa.StandardWorkplan.Semester
                },
                Assignee = new
                {
                    wa.Assignee.Id,
                    wa.Assignee.FullName,
                    wa.Assignee.Email,
                    Department = wa.Assignee.Department != null ? wa.Assignee.Department.Name : null
                }
            })
            .ToListAsync();

        return Ok(assignments);
    }

    // POST: api/workplanassignments/assign
    [HttpPost("assign")]
    [Authorize(Roles = "Dean,HOD")]
    public async Task<IActionResult> AssignWorkplan([FromBody] AssignWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var currentUser = await _userManager.FindByIdAsync(currentUserId!);
        var userRoles = await _userManager.GetRolesAsync(currentUser!);
        var currentRole = userRoles.FirstOrDefault();

        // Verify the standard workplan exists
        var standardWorkplan = await _db.StandardWorkplans.FindAsync(dto.StandardWorkplanId);
        if (standardWorkplan == null || !standardWorkplan.IsActive)
            return StatusCode(404, new { message = "Standard workplan not found" });

        // Verify the assignee exists and has the correct role
        var assignee = await _userManager.FindByIdAsync(dto.AssigneeId);
        if (assignee == null)
            return StatusCode(404, new { message = "Assignee not found" });

        var assigneeRoles = await _userManager.GetRolesAsync(assignee);
        var assigneeRole = assigneeRoles.FirstOrDefault();

        // Validate hierarchy and permissions
        var canAssign = (currentRole, assigneeRole, standardWorkplan.TargetRole) switch
        {
            ("Dean", "HOD", "HOD") => true,
            ("HOD", "Lecturer", "Lecturer") => true,
            _ => false
        };

        if (!canAssign)
            return StatusCode(403, new { message = "You cannot assign this workplan to this user" });

        // For HODs, verify the lecturer is in their department
        if (currentRole == "HOD" && currentUser.DepartmentId != assignee.DepartmentId)
            return StatusCode(403, new { message = "You can only assign workplans to lecturers in your department" });

        // Check if assignment already exists
        var existingAssignment = await _db.WorkplanAssignments
            .FirstOrDefaultAsync(wa => wa.StandardWorkplanId == dto.StandardWorkplanId 
                                    && wa.AssigneeId == dto.AssigneeId 
                                    && wa.IsActive);

        if (existingAssignment != null)
            return StatusCode(409, new { message = "This workplan is already assigned to this user" });

        // Create the assignment
        var assignment = new WorkplanAssignment
        {
            StandardWorkplanId = dto.StandardWorkplanId,
            AssigneeId = dto.AssigneeId,
            AssignedById = currentUserId!,
            AssignmentNotes = dto.AssignmentNotes,
            Status = "Assigned"
        };

        _db.WorkplanAssignments.Add(assignment);
        await _db.SaveChangesAsync();

        // Return the created assignment with details
        var result = new
        {
            id = assignment.Id,
            standardWorkplanId = assignment.StandardWorkplanId,
            assigneeId = assignment.AssigneeId,
            assignedById = assignment.AssignedById,
            assignedAt = assignment.AssignedAt,
            status = assignment.Status,
            assignmentNotes = assignment.AssignmentNotes,
            standardWorkplanTitle = assignment.StandardWorkplan?.Title,
            assigneeFullName = assignment.Assignee?.FullName
        };
        return Ok(result);

    }

    // POST: api/workplanassignments/bulk-assign
    [HttpPost("bulk-assign")]
    [Authorize(Roles = "Dean,HOD")]
    public async Task<IActionResult> BulkAssignWorkplan([FromBody] BulkAssignWorkplanDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var currentUser = await _userManager.FindByIdAsync(currentUserId!);
        var userRoles = await _userManager.GetRolesAsync(currentUser!);
        var currentRole = userRoles.FirstOrDefault();

        // Verify the standard workplan exists
        var standardWorkplan = await _db.StandardWorkplans.FindAsync(dto.StandardWorkplanId);
        if (standardWorkplan == null || !standardWorkplan.IsActive)
            return NotFound("Standard workplan not found");

        var assignments = new List<WorkplanAssignment>();
        var errors = new List<string>();

        foreach (var assigneeId in dto.AssigneeIds)
        {
            // Check if assignment already exists
            var existingAssignment = await _db.WorkplanAssignments
                .FirstOrDefaultAsync(wa => wa.StandardWorkplanId == dto.StandardWorkplanId 
                                        && wa.AssigneeId == assigneeId 
                                        && wa.IsActive);

            if (existingAssignment != null)
            {
                errors.Add($"Workplan already assigned to user {assigneeId}");
                continue;
            }

            // Verify the assignee exists and has the correct role
            var assignee = await _userManager.FindByIdAsync(assigneeId);
            if (assignee == null)
            {
                errors.Add($"User {assigneeId} not found");
                continue;
            }

            var assigneeRoles = await _userManager.GetRolesAsync(assignee);
            var assigneeRole = assigneeRoles.FirstOrDefault();

            // Validate hierarchy and permissions
            var canAssign = (currentRole, assigneeRole, standardWorkplan.TargetRole) switch
            {
                ("Dean", "HOD", "HOD") => true,
                ("HOD", "Lecturer", "Lecturer") => true,
                _ => false
            };

            if (!canAssign)
            {
                errors.Add($"Cannot assign workplan to {assignee.FullName} ({assigneeRole})");
                continue;
            }

            // For HODs, verify the lecturer is in their department
            if (currentRole == "HOD" && currentUser.DepartmentId != assignee.DepartmentId)
            {
                errors.Add($"Cannot assign to {assignee.FullName} - not in your department");
                continue;
            }

            assignments.Add(new WorkplanAssignment
            {
                StandardWorkplanId = dto.StandardWorkplanId,
                AssigneeId = assigneeId,
                AssignedById = currentUserId!,
                AssignmentNotes = dto.AssignmentNotes,
                Status = "Assigned"
            });
        }

        if (assignments.Count > 0)
        {
            _db.WorkplanAssignments.AddRange(assignments);
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            AssignedCount = assignments.Count,
            Errors = errors,
            Message = $"Successfully assigned workplan to {assignments.Count} users"
        });
    }

    // PUT: api/workplanassignments/{id}/status
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var assignment = await _db.WorkplanAssignments
            .Include(wa => wa.Assignee)
            .Include(wa => wa.AssignedBy)
            .FirstOrDefaultAsync(wa => wa.Id == id && wa.IsActive);

        if (assignment == null)
            return NotFound();

        // Check permissions - assignee can update their own status, supervisor can review
        var canUpdate = assignment.AssigneeId == currentUserId || assignment.AssignedById == currentUserId;
        if (!canUpdate)
            return Forbid("You cannot update this assignment");

        // Update status and timestamps
        assignment.Status = dto.Status;
        assignment.Progress = dto.Progress ?? assignment.Progress;

        switch (dto.Status.ToLower())
        {
            case "inprogress":
                if (assignment.StartedAt == null)
                    assignment.StartedAt = DateTime.UtcNow;
                break;
            case "completed":
                if (assignment.CompletedAt == null)
                    assignment.CompletedAt = DateTime.UtcNow;
                assignment.CompletionNotes = dto.Notes;
                break;
            case "reviewed":
                if (assignment.ReviewedAt == null)
                    assignment.ReviewedAt = DateTime.UtcNow;
                assignment.ReviewFeedback = dto.Notes;
                break;
        }

        await _db.SaveChangesAsync();
        return Ok(assignment);
    }

    // DELETE: api/workplanassignments/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Dean,HOD")]
    public async Task<IActionResult> RemoveAssignment(int id)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var assignment = await _db.WorkplanAssignments.FindAsync(id);

        if (assignment == null || !assignment.IsActive)
            return NotFound();

        // Only the person who assigned can remove the assignment
        if (assignment.AssignedById != currentUserId)
            return Forbid("You can only remove assignments you created");

        // Soft delete
        assignment.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Assignment removed successfully" });
    }
}

// DTOs for WorkplanAssignment
public class AssignWorkplanDto
{
    [Required]
    public int StandardWorkplanId { get; set; }

    [Required]
    public string AssigneeId { get; set; } = "";

    public string? AssignmentNotes { get; set; }
}

public class BulkAssignWorkplanDto
{
    [Required]
    public int StandardWorkplanId { get; set; }

    [Required]
    [MinLength(1)]
    public List<string> AssigneeIds { get; set; } = new();

    public string? AssignmentNotes { get; set; }
}

public class UpdateStatusDto
{
    [Required]
    public string Status { get; set; } = "";

    public int? Progress { get; set; }

    public string? Notes { get; set; }
}

public class AssignAreasDto
{
    [Required]
    public int StandardWorkplanId { get; set; }

    [Required]
    [MinLength(1)]
    public List<string> AssigneeIds { get; set; } = new();

    [Required]
    [MinLength(1)]
    public List<int> AreaIds { get; set; } = new();

    public string? AssignmentNotes { get; set; }
}