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
public class AreaEvaluationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public AreaEvaluationsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // POST api/AreaEvaluations
    [HttpPost]
    [Authorize(Roles = "HOD,Dean,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateAreaEvaluationDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId)) return Unauthorized();

        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        if (currentUser == null) return Unauthorized();
        var currentRoles = await _userManager.GetRolesAsync(currentUser);

        var lecturer = await _userManager.FindByIdAsync(dto.LecturerId);
        if (lecturer == null) return NotFound("Lecturer not found");

        if (currentRoles.Contains("HOD"))
        {
            var targetRoles = await _userManager.GetRolesAsync(lecturer);
            if (!targetRoles.Contains("Lecturer") || lecturer.DepartmentId != currentUser.DepartmentId)
                return Forbid("HODs can only evaluate lecturers in their department");
        }

        var area = await _db.Areas.Include(a => a.Kpis).FirstOrDefaultAsync(a => a.Id == dto.AreaId);
        if (area == null) return NotFound("Area not found");

        // Validate scores contain only KPIs belonging to the area and values 0..5
        var kpiIdsInArea = new HashSet<int>(area.Kpis.Select(k => k.Id));
        foreach (var item in dto.Items)
        {
            if (!kpiIdsInArea.Contains(item.KpiId))
                return BadRequest($"KPI {item.KpiId} does not belong to Area {area.Name}");
            if (item.Score < 0 || item.Score > 5)
                return BadRequest("Scores must be between 0 and 5");
        }

        var areaEval = new AreaEvaluation
        {
            LecturerId = dto.LecturerId,
            HodId = currentUserId,
            AreaId = dto.AreaId,
            Comments = dto.Comments,
            EvaluatedAt = DateTime.UtcNow,
            IsSelfEvaluation = false
        };

        // Compute total score = (sum of item scores) * area weight
        var sum = dto.Items.Sum(i => (decimal)i.Score);
        areaEval.TotalScore = sum * area.Weight;

        _db.AreaEvaluations.Add(areaEval);
        await _db.SaveChangesAsync();

        // Save items
        foreach (var item in dto.Items)
        {
            _db.AreaEvaluationItems.Add(new AreaEvaluationItem
            {
                AreaEvaluationId = areaEval.Id,
                KpiId = item.KpiId,
                Score = item.Score
            });
        }
        await _db.SaveChangesAsync();

        var result = await _db.AreaEvaluations
            .Include(ae => ae.Lecturer)
            .Include(ae => ae.Hod)
            .Include(ae => ae.Area)
            .Include(ae => ae.Items)
                .ThenInclude(i => i.Kpi)
            .FirstOrDefaultAsync(ae => ae.Id == areaEval.Id);

        return Ok(result);
    }

    // POST api/AreaEvaluations/self - create a self-evaluation by the current user
    [HttpPost("self")]
    [Authorize(Roles = "Lecturer,HOD,Dean")]
    public async Task<IActionResult> CreateSelf([FromBody] CreateSelfAreaEvaluationDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(currentUserId)) return Unauthorized();

        // Self only: ignore any LecturerId from client
        var me = await _userManager.FindByIdAsync(currentUserId);
        if (me == null) return Unauthorized();

        var roles = await _userManager.GetRolesAsync(me);

        // Validate Area exists and KPIs belong to the Area
        var area = await _db.Areas.Include(a => a.Kpis).FirstOrDefaultAsync(a => a.Id == dto.AreaId);
        if (area == null) return NotFound("Area not found");

        var kpiIdsInArea = new HashSet<int>(area.Kpis.Select(k => k.Id));
        foreach (var item in dto.Items)
        {
            if (!kpiIdsInArea.Contains(item.KpiId))
                return BadRequest($"KPI {item.KpiId} does not belong to Area {area.Name}");
            if (item.Score < 0 || item.Score > 5)
                return BadRequest("Scores must be between 0 and 5");
        }

        // Validate user is allowed to self-evaluate only assigned KPIs
        var myAssignedKpiIds = await _db.KpiAssignments
            .Where(a => a.LecturerId == currentUserId)
            .Select(a => a.KpiId)
            .ToListAsync();
        var myAssignedSet = new HashSet<int>(myAssignedKpiIds);
        foreach (var item in dto.Items)
        {
            if (!myAssignedSet.Contains(item.KpiId))
                return Forbid($"You can only self-evaluate KPIs assigned to you. KPI {item.KpiId} is not assigned.");
        }

        var selfEval = new AreaEvaluation
        {
            LecturerId = currentUserId,
            HodId = null,
            AreaId = dto.AreaId,
            Comments = dto.Comments,
            EvaluatedAt = DateTime.UtcNow,
            IsSelfEvaluation = true
        };

        var sum = dto.Items.Sum(i => (decimal)i.Score);
        selfEval.TotalScore = sum * area.Weight;

        _db.AreaEvaluations.Add(selfEval);
        await _db.SaveChangesAsync();

        foreach (var item in dto.Items)
        {
            _db.AreaEvaluationItems.Add(new AreaEvaluationItem
            {
                AreaEvaluationId = selfEval.Id,
                KpiId = item.KpiId,
                Score = item.Score
            });
        }
        await _db.SaveChangesAsync();

        var result = await _db.AreaEvaluations
            .Include(ae => ae.Lecturer)
            .Include(ae => ae.Area)
            .Include(ae => ae.Items).ThenInclude(i => i.Kpi)
            .FirstOrDefaultAsync(ae => ae.Id == selfEval.Id);

        return Ok(result);
    }

    [HttpGet("lecturer/{lecturerId}")]
    public async Task<IActionResult> GetByLecturer(string lecturerId)
    {
        var data = await _db.AreaEvaluations
            .Include(ae => ae.Area)
            .Include(ae => ae.Items).ThenInclude(i => i.Kpi)
            .Where(ae => ae.LecturerId == lecturerId)
            .OrderByDescending(ae => ae.EvaluatedAt)
            .ToListAsync();
        return Ok(data);
    }

    // GET only self-evaluations for a lecturer
    [HttpGet("lecturer/{lecturerId}/self")]
    public async Task<IActionResult> GetSelfByLecturer(string lecturerId)
    {
        var data = await _db.AreaEvaluations
            .Include(ae => ae.Area)
            .Include(ae => ae.Items).ThenInclude(i => i.Kpi)
            .Where(ae => ae.LecturerId == lecturerId && ae.IsSelfEvaluation)
            .OrderByDescending(ae => ae.EvaluatedAt)
            .ToListAsync();
        return Ok(data);
    }
}

public class CreateAreaEvaluationDto
{
    [Required] public string LecturerId { get; set; } = string.Empty;
    [Required] public int AreaId { get; set; }
    public string? Comments { get; set; }
    [Required] public List<CreateAreaEvaluationItemDto> Items { get; set; } = new();
}

public class CreateAreaEvaluationItemDto
{
    [Required] public int KpiId { get; set; }
    [Range(0,5)] public int Score { get; set; }
}

public class CreateSelfAreaEvaluationDto
{
    [Required] public int AreaId { get; set; }
    public string? Comments { get; set; }
    [Required] public List<CreateAreaEvaluationItemDto> Items { get; set; } = new();
}

