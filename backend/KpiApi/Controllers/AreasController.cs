using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace KpiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AreasController : ControllerBase
{
    private readonly AppDbContext _db;

    public AreasController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? targetRole = null)
    {
        var query = _db.Areas.AsQueryable();
        if (!string.IsNullOrWhiteSpace(targetRole))
        {
            var tr = targetRole.Trim().ToLower();
            query = query.Where(a => (a.TargetRole ?? "").ToLower() == tr);
        }
        var areas = await query
            .Include(a => a.Kpis)
            .OrderBy(a => a.Name)
            .ToListAsync();
        return Ok(areas);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var area = await _db.Areas.Include(a => a.Kpis).FirstOrDefaultAsync(a => a.Id == id);
        if (area == null) return NotFound();
        return Ok(area);
    }

    [HttpGet("{id}/kpis")]
    public async Task<IActionResult> GetKpisByArea(int id)
    {
        var exists = await _db.Areas.AnyAsync(a => a.Id == id);
        if (!exists) return NotFound();
        var kpis = await _db.Kpis.Where(k => k.AreaId == id).OrderBy(k => k.Title).ToListAsync();
        return Ok(kpis);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> Create([FromBody] CreateAreaDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var area = new Area { Name = dto.Name, Weight = dto.Weight, TargetRole = dto.TargetRole };
        _db.Areas.Add(area);
        await _db.SaveChangesAsync();
        return Ok(area);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAreaDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var area = await _db.Areas.FindAsync(id);
        if (area == null) return NotFound();
        area.Name = dto.Name;
        area.Weight = dto.Weight;
        area.TargetRole = dto.TargetRole;
        await _db.SaveChangesAsync();
        return Ok(area);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> Delete(int id)
    {
        var area = await _db.Areas.FindAsync(id);
        if (area == null) return NotFound();
        var hasKpis = await _db.Kpis.AnyAsync(k => k.AreaId == id);
        if (hasKpis)
        {
            return BadRequest(new { message = "Cannot delete Area that has KPIs" });
        }
        _db.Areas.Remove(area);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Area deleted" });
    }
}

public class CreateAreaDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    [Range(0.01, 1.0)]
    public decimal Weight { get; set; }
    [Required]
    [StringLength(20)]
    public string TargetRole { get; set; } = "";
}

public class UpdateAreaDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    [Range(0.01, 1.0)]
    public decimal Weight { get; set; }
    [Required]
    [StringLength(20)]
    public string TargetRole { get; set; } = "";
}
