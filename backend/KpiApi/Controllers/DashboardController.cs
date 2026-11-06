using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace KpiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public DashboardController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var currentUser = await _userManager.FindByIdAsync(currentUserId);
        var roles = await _userManager.GetRolesAsync(currentUser);

        if (roles.Contains("Admin") || roles.Contains("Dean"))
        {
            var totalUsers = await _db.Users.CountAsync();
            var totalDepartments = await _db.Departments.CountAsync();
            var totalKpis = await _db.Kpis.CountAsync();
            var totalEvaluations = await _db.Evaluations.CountAsync();
            var totalWorkplans = await _db.Workplans.CountAsync();
            var avgScore = await _db.Evaluations.AnyAsync()
                ? await _db.Evaluations.AverageAsync(e => e.Score)
                : 0;

            return Ok(new
            {
                Role = roles.First(),
                TotalUsers = totalUsers,
                TotalDepartments = totalDepartments,
                TotalKpis = totalKpis,
                TotalEvaluations = totalEvaluations,
                TotalWorkplans = totalWorkplans,
                AvgScore = avgScore
            });
        }
        else if (roles.Contains("HOD"))
        {
            var deptId = currentUser.DepartmentId ?? 0;
            var lecturers = await _db.Users
                .Where(u => u.DepartmentId == deptId)
                .ToListAsync();

            var evaluations = await _db.Evaluations
                .Where(e => e.Lecturer.DepartmentId == deptId)
                .ToListAsync();

            // KPIs are now global, not department-specific
            var kpis = await _db.Kpis.ToListAsync();

            return Ok(new
            {
                Role = "HOD",
                DepartmentId = deptId,
                LecturerCount = lecturers.Count,
                KpiCount = kpis.Count,
                AvgDeptScore = evaluations.Any() ? evaluations.Average(e => e.Score) : 0
            });
        }
        else if (roles.Contains("Lecturer"))
        {
            var evaluations = await _db.Evaluations
                .Where(e => e.LecturerId == currentUserId)
                .ToListAsync();

            var workplans = await _db.Workplans
                .Where(w => w.LecturerId == currentUserId)
                .ToListAsync();

            var kpis = await _db.KpiAssignments
                .Where(a => a.LecturerId == currentUserId)
                .Select(a => a.Kpi)
                .ToListAsync();

            return Ok(new
            {
                Role = "Lecturer",
                KpiCount = kpis.Count,
                WorkplanCount = workplans.Count,
                AvgScore = evaluations.Any() ? evaluations.Average(e => e.Score) : 0
            });
        }

        return Forbid("Unauthorized role");
    }
    // --- Added for frontend dashboard compatibility ---
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var totalUsers = await _db.Users.CountAsync();
            var totalLecturers = await _db.Users
                .Join(_db.UserRoles, u => u.Id, ur => ur.UserId, (u, ur) => new { u, ur })
                .Join(_db.Roles, x => x.ur.RoleId, r => r.Id, (x, r) => new { x.u, r })
                .Where(x => x.r.Name == "Lecturer")
                .CountAsync();
            var totalDepartments = await _db.Departments.CountAsync();
            var completedEvaluations = await _db.Evaluations.CountAsync();
            
            return Ok(new {
                totalUsers = totalUsers,
                totalLecturers = totalLecturers,
                totalDepartments = totalDepartments,
                completedEvaluations = completedEvaluations,
                pendingEvaluations = 0, // TODO: implement pending logic
                systemHealth = "Online"
            });
        }
        catch (Exception ex)
        {
            // Fallback to static data if database queries fail
            return Ok(new {
                totalUsers = 0,
                totalLecturers = 0,
                totalDepartments = 0,
                completedEvaluations = 0,
                pendingEvaluations = 0,
                systemHealth = "Error"
            });
        }
    }

    [HttpGet("recent-activity")]
    public async Task<IActionResult> GetRecentActivity()
    {
        try
        {
            // Get recent evaluations, workplan submissions, and user registrations
            var recentEvaluations = await _db.Evaluations
                .Include(e => e.Lecturer)
                .Include(e => e.Kpi)
                .OrderByDescending(e => e.EvaluatedAt)
                .Take(5)
                .Select(e => new {
                    id = e.Id,
                    action = $"{e.Lecturer!.FullName} completed {e.Kpi!.Title} evaluation",
                    time = e.EvaluatedAt.ToString("yyyy-MM-dd HH:mm"),
                    type = "complete"
                })
                .ToListAsync();

            var recentWorkplans = await _db.Workplans
                .Include(w => w.Lecturer)
                .OrderByDescending(w => w.SubmittedAt)
                .Take(3)
                .Select(w => new {
                    id = w.Id,
                    action = $"{w.Lecturer!.FullName} submitted workplan",
                    time = w.SubmittedAt.ToString("yyyy-MM-dd HH:mm"),
                    type = "submit"
                })
                .ToListAsync();

            var recentUsers = await _db.Users
                .OrderByDescending(u => u.Id) // Use Id as proxy for creation order
                .Take(2)
                .Select(u => new {
                    id = u.Id,
                    action = $"User registered: {u.FullName}",
                    time = DateTime.Now.AddHours(-1).ToString("yyyy-MM-dd HH:mm"), // Placeholder time
                    type = "create"
                })
                .ToListAsync();

            // Combine and sort all activities
            var allActivities = recentEvaluations.Cast<object>()
                .Concat(recentWorkplans.Cast<object>())
                .Concat(recentUsers.Cast<object>())
                .Take(10)
                .ToArray();

            return Ok(allActivities);
        }
        catch (Exception)
        {
            // Fallback to basic activity if there's an error
            return Ok(new[] {
                new { id = 1, action = "System operational", time = DateTime.Now.ToString("yyyy-MM-dd HH:mm"), type = "update" }
            });
        }
    }

    [HttpGet("performance")]
    public async Task<IActionResult> GetPerformanceData()
    {
        try
        {
            // Get performance data by KPI categories
            var kpiPerformance = await _db.Kpis
                .GroupJoin(_db.Evaluations, 
                    kpi => kpi.Id, 
                    eval => eval.KpiId, 
                    (kpi, evaluations) => new {
                        name = kpi.Title,
                        value = evaluations.Any() ? (int)evaluations.Average(e => e.Score) : 0
                    })
                .Where(x => x.value > 0)
                .ToListAsync();

            if (!kpiPerformance.Any())
            {
                // Fallback data if no evaluations exist
                return Ok(new[] {
                    new { name = "Teaching", value = 0 },
                    new { name = "Research", value = 0 },
                    new { name = "Service", value = 0 },
                    new { name = "Administration", value = 0 }
                });
            }

            return Ok(kpiPerformance);
        }
        catch (Exception)
        {
            // Fallback data in case of error
            return Ok(new[] {
                new { name = "System", value = 85 }
            });
        }
    }

  [HttpGet("department-data")]
public async Task<IActionResult> GetDepartmentData()
{
    try
    {
        // Get the Lecturer role ID
        var lecturerRoleId = await _db.Roles
            .Where(r => r.Name == "Lecturer")
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        var departmentData = await _db.Departments
            .Select(d => new {
                id = d.Id,
                name = d.Name,
                // Count only lecturers (users with Lecturer role)
                lecturers = _db.Users
                    .Count(u => u.DepartmentId == d.Id && 
                               _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == lecturerRoleId)),
                // Count KPI assignments for lecturers only
                activeKPIs = _db.KpiAssignments
                    .Count(ka => _db.Users
                        .Where(u => u.DepartmentId == d.Id && 
                                   _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == lecturerRoleId))
                        .Select(u => u.Id)
                        .Contains(ka.LecturerId)),
                // Count evaluations for lecturers only
                completedEvaluations = _db.Evaluations
                    .Count(e => _db.Users
                        .Where(u => u.DepartmentId == d.Id && 
                                   _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == lecturerRoleId))
                        .Select(u => u.Id)
                        .Contains(e.LecturerId) && e.Status == "Completed"),
                // Count pending evaluations for lecturers only
                pendingReviews = _db.Evaluations
                    .Count(e => _db.Users
                        .Where(u => u.DepartmentId == d.Id && 
                                   _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == lecturerRoleId))
                        .Select(u => u.Id)
                        .Contains(e.LecturerId) && e.Status == "pending"),
                // Performance data for lecturers only
                performance = _db.Users
                    .Where(u => u.DepartmentId == d.Id && 
                               _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == lecturerRoleId))
                    .Select(u => new {
                        name = u.FullName,
                        score = _db.Evaluations
                            .Where(e => e.LecturerId == u.Id)
                            .Average(e => (int?)e.Score) ?? 0
                    })
                    .ToList()
            })
            .ToListAsync();

        if (!departmentData.Any())
        {
            return Ok(new[] {
                new {
                    id = 0,
                    name = "No Departments",
                    lecturers = 0,
                    activeKPIs = 0,
                    completedEvaluations = 0,
                    pendingReviews = 0,
                    performance = new object[0]
                }
            });
        }

        return Ok(departmentData);
    }
    catch (Exception ex)
    {
        // Log the exception
        return StatusCode(500, new { error = "Internal server error", details = ex.Message });
    }
}    // --- End added endpoints ---
}
