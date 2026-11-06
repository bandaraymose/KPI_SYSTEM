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
public class KpisController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public KpisController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var kpis = await _db.Kpis
            .Include(k => k.CreatedByHod)
            .Include(k => k.Area)
            .OrderBy(k => k.Title)
            .ToListAsync();
        return Ok(kpis);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var kpi = await _db.Kpis
            .Include(k => k.CreatedByHod)
            .Include(k => k.Area)
            .FirstOrDefaultAsync(k => k.Id == id);
        if (kpi == null)
            return NotFound();
        return Ok(kpi);
    }



    [HttpGet("my")]
    public async Task<IActionResult> GetMyKpis()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized();

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

        IQueryable<Kpi> query = _db.Kpis
            .Include(k => k.CreatedByHod)
            .Include(k => k.Area);
            
        // Filter KPIs based on user role
        if (currentUserRoles.Contains("Admin"))
        {
            // Admin can see all KPIs
        }
        else if (currentUserRoles.Contains("Dean"))
        {
            // Dean can only see Dean-specific KPIs
            query = query.Where(k => k.TargetRole == "HOD" || string.IsNullOrEmpty(k.TargetRole));
        }
        else if (currentUserRoles.Contains("HOD"))
        {
            // HOD can only see HOD-specific KPIs
            query = query.Where(k => k.TargetRole == "Lecturer" || string.IsNullOrEmpty(k.TargetRole));
        }
        else if (currentUserRoles.Contains("Lecturer"))
        {
            // Lecturer can only see KPIs assigned to them (existing logic)
            var assignedKpiIds = await _db.KpiAssignments
                .Where(a => a.LecturerId == currentUserId)
                .Select(a => a.KpiId)
                .ToListAsync();
            query = query.Where(k => assignedKpiIds.Contains(k.Id));
        }
        else
        {
            // Unknown role, return empty result
            query = query.Where(k => false);
        }
        var kpis = await query.OrderBy(k => k.Title).ToListAsync();
        return Ok(kpis);
    }

     [HttpGet("my-assign")]
    public async Task<IActionResult> GetMyAssign()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized();

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

        IQueryable<Kpi> query = _db.Kpis
            .Include(k => k.CreatedByHod);
            
        // Filter KPIs based on user role
        if (currentUserRoles.Contains("Admin"))
        {
            // Admin can see all KPIs
        }
        else if (currentUserRoles.Contains("Dean"))
        {
            // Dean can only see Dean-specific KPIs
            query = query.Where(k => k.TargetRole == "HOD" || string.IsNullOrEmpty(k.TargetRole));
        }
        else if (currentUserRoles.Contains("HOD"))
        {
            // HOD can only see HOD-specific KPIs
            query = query.Where(k => k.TargetRole == "Lecturer" || string.IsNullOrEmpty(k.TargetRole));
        }
        else if (currentUserRoles.Contains("Lecturer"))
        {
            // Lecturer can only see KPIs assigned to them (existing logic)
            var assignedKpiIds = await _db.KpiAssignments
                .Where(a => a.LecturerId == currentUserId)
                .Select(a => a.KpiId)
                .ToListAsync();
            query = query.Where(k => assignedKpiIds.Contains(k.Id));
        }
        else
        {
            // Unknown role, return empty result
            query = query.Where(k => false);
        }
        var kpis = await query.OrderBy(k => k.Title).ToListAsync();
        return Ok(kpis);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> Create([FromBody] CreateKpiDto dto)
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

        var kpi = new Kpi
        {
            Title = dto.Title,
            Description = dto.Description,
            Weight = dto.Weight,
            TargetRole = dto.TargetRole,
            CreatedByHodId = currentUserId,
            AreaId = dto.AreaId,
            Target = dto.Target
        };

        _db.Kpis.Add(kpi);
        await _db.SaveChangesAsync();

        var result = await _db.Kpis
            .Include(k => k.CreatedByHod)
            .Include(k => k.Area)
            .FirstOrDefaultAsync(k => k.Id == kpi.Id);

        return Ok(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateKpiDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var kpi = await _db.Kpis.FindAsync(id);
        if (kpi == null)
            return NotFound();

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized();

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

        // HODs can only update KPIs they created
        if (currentUserRoles.Contains("HOD") && kpi.CreatedByHodId != currentUserId)
        {
            return Forbid("You can only update KPIs you created");
        }

        kpi.Title = dto.Title;
        kpi.Description = dto.Description;
        kpi.Weight = dto.Weight;
        kpi.TargetRole = dto.TargetRole;
        kpi.AreaId = dto.AreaId;
        kpi.Target = dto.Target;

        await _db.SaveChangesAsync();

        var result = await _db.Kpis
            .Include(k => k.CreatedByHod)
            .Include(k => k.Area)
            .FirstOrDefaultAsync(k => k.Id == id);

        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> Delete(int id)
    {
        var kpi = await _db.Kpis.FindAsync(id);
        if (kpi == null)
            return NotFound();

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId))
            return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null)
            return Unauthorized();

        var currentUserRoles = await _userManager.GetRolesAsync(currentUser);

        // HODs can only delete KPIs they created
        if (currentUserRoles.Contains("HOD") && kpi.CreatedByHodId != currentUserId)
        {
            return Forbid("You can only delete KPIs you created");
        }

        var hasAssignments = await _db.KpiAssignments.AnyAsync(a => a.KpiId == id);
        if (hasAssignments)
        {
            return BadRequest(new { message = "Cannot delete KPI that has assignments" });
        }

        _db.Kpis.Remove(kpi);
        await _db.SaveChangesAsync();

        return Ok(new { message = "KPI deleted successfully" });
    }
}

// DTOs

public class CreateKpiDto
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = "";

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required]
    [Range(0.01, 1.0, ErrorMessage = "Weight must be between 0.01 and 1.0")]
    public decimal Weight { get; set; }

    [Required]
    [StringLength(20)]
    public string TargetRole { get; set; } = "";

    // New
    public int? AreaId { get; set; }
    [Range(0, 999999)]
    public decimal Target { get; set; }
}

public class UpdateKpiDto
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = "";

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required]
    [Range(0.01, 1.0, ErrorMessage = "Weight must be between 0.01 and 1.0")]
    public decimal Weight { get; set; }

    [Required]
    [StringLength(20)]
    public string TargetRole { get; set; } = "";

    // New
    public int? AreaId { get; set; }
    [Range(0, 999999)]
    public decimal Target { get; set; }
}
