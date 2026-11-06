using KpiApi.Data;
using KpiApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using iTextSharp.text;
using iTextSharp.text.pdf;
using OfficeOpenXml;
using System.Text.Json;

namespace KpiApi.Controllers;

// Extension method for title case
public static class StringExtensions
{
    public static string ToTitleCase(this string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        return char.ToUpper(input[0]) + input.Substring(1).ToLower();
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public ReportsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    static ReportsController()
    {
        ExcelPackage.License.SetNonCommercialOrganization("KPI Evaluation System");
    }

    private decimal CalculatePerformanceScore(decimal weight, decimal target, decimal actualScore)
    {
        return weight * target * (actualScore / 100m);
    }

    // New: Area-weighted overall score based on AreaEvaluations
    // For a target user (Lecturer or HOD), find AreaEvaluations in range,
    // take the latest evaluation per Area, then sum TotalScore across Areas.
    private async Task<decimal> CalculateOverallAreaWeightedScore(string targetUserId, DateTime? startDate = null, DateTime? endDate = null)
    {
        var query = _db.AreaEvaluations
            .Include(ae => ae.Area)
            .Where(ae => ae.LecturerId == targetUserId);

        if (startDate.HasValue)
            query = query.Where(ae => ae.EvaluatedAt >= startDate.Value);
        if (endDate.HasValue)
            query = query.Where(ae => ae.EvaluatedAt <= endDate.Value);

        var evals = await query.ToListAsync();
        if (evals.Count == 0) return 0m;

        // Group by Area and pick the latest evaluation per area
        var latestPerArea = evals
            .GroupBy(e => e.AreaId)
            .Select(g => g.OrderByDescending(e => e.EvaluatedAt).First());

        var sum = latestPerArea.Sum(e => e.TotalScore);
        return sum;
    }

    private async Task<decimal> CalculateOverallPerformanceScore(string lecturerId)
    {
        // Backward-compatible method retained, but now delegate to area-weighted logic.
        return await CalculateOverallAreaWeightedScore(lecturerId, null, null);
    }

    private string GetCategory(string? title)
    {
        if (string.IsNullOrEmpty(title)) return "other";

        var lower = title.ToLower();
        if (lower.Contains("teaching")) return "teaching";
        if (lower.Contains("research")) return "research";
        if (lower.Contains("service")) return "service";
        if (lower.Contains("admin") || lower.Contains("professional")) return "professional";
        return "other";
    }

    private decimal CalculateGroupScore(IEnumerable<Evaluation> group)
    {
        decimal totalWeighted = 0;
        decimal totalWeight = 0;

        foreach (var e in group)
        {
            if (e.Kpi != null)
            {
                var ps = CalculatePerformanceScore(e.Kpi.Weight, e.Kpi.Target, e.Score);
                totalWeighted += ps;
                totalWeight += e.Kpi.Weight;
            }
        }

        return totalWeight > 0 ? (totalWeighted / totalWeight) : 0;
    }

    [HttpGet("system")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> GetSystemReport()
    {
        var totalUsers = await _db.Users.CountAsync();
        var totalDepartments = await _db.Departments.CountAsync();
        var totalKpis = await _db.Kpis.CountAsync();
        var totalEvaluations = await _db.Evaluations.CountAsync();
        var totalWorkplans = await _db.Workplans.CountAsync();

        var evaluations = await _db.Evaluations
            .Include(e => e.Kpi)
            .ToListAsync();

        decimal totalWeightedScore = 0;
        decimal totalWeight = 0;
        foreach (var e in evaluations)
        {
            if (e.Kpi != null)
            {
                totalWeightedScore += CalculatePerformanceScore(e.Kpi.Weight, e.Kpi.Target, e.Score);
                totalWeight += e.Kpi.Weight;
            }
        }
        var avgScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;

        return Ok(new
        {
            TotalUsers = totalUsers,
            TotalDepartments = totalDepartments,
            TotalKpis = totalKpis,
            TotalEvaluations = totalEvaluations,
            TotalWorkplans = totalWorkplans,
            AvgScore = avgScore
        });
    }

    [HttpGet("department/{departmentId}")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> GetDepartmentReport(int departmentId)
    {
        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == departmentId);

        if (department == null)
            return NotFound("Department not found");

        var lecturers = new List<object>();
        foreach (var user in department.Users ?? Enumerable.Empty<AppUser>())
        {
            if (user == null) continue;
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains("Lecturer"))
            {
                var evaluations = await _db.Evaluations
                    .Where(e => e.LecturerId == user.Id)
                    .ToListAsync();

                lecturers.Add(new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    AvgScore = evaluations.Any() ? evaluations.Average(e => e.Score) : 0,
                    Evaluations = evaluations
                });
            }
        }

        var deptEvaluations = await _db.Evaluations
            .Where(e => e.Lecturer.DepartmentId == departmentId)
            .ToListAsync();

        var deptKpis = new List<Kpi>();

        return Ok(new
        {
            department.Id,
            department.Name,
            LecturerCount = lecturers.Count,
            AvgDeptScore = deptEvaluations.Any() ? deptEvaluations.Average(e => e.Score) : 0,
            KpiCount = deptKpis.Count,
            Lecturers = lecturers
        });
    }

    [HttpGet("lecturer/{lecturerId}")]
    [Authorize(Roles = "Admin,Dean,HOD,Lecturer")]
    public async Task<IActionResult> GetLecturerReport(string lecturerId)
    {
        var lecturer = await _db.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == lecturerId);

        if (lecturer == null)
            return NotFound("Lecturer not found");

        var evaluations = await _db.Evaluations
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .Where(e => e.LecturerId == lecturerId)
            .OrderByDescending(e => e.EvaluatedAt)
            .ToListAsync();

        var workplans = await _db.Workplans
            .Where(w => w.LecturerId == lecturerId)
            .OrderByDescending(w => w.SubmittedAt)
            .ToListAsync();

        decimal overallScore = await CalculateOverallAreaWeightedScore(lecturerId, null, null);

        return Ok(new
        {
            lecturer.Id,
            lecturer.FullName,
            lecturer.Email,
            Department = lecturer.Department?.Name ?? "Unknown",
            AvgScore = overallScore,
            Evaluations = evaluations,
            Workplans = workplans
        });
    }

    [HttpGet("department")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> GetDepartmentReport([FromQuery] int? departmentId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null)
            return Unauthorized("User Not Found");
        var userRoles = await _userManager.GetRolesAsync(currentUser);
        
        int targetDepartmentId;
        if (userRoles.Contains("HOD") && currentUser.DepartmentId.HasValue)
        {
            targetDepartmentId = currentUser.DepartmentId.Value;
        }
        else if (departmentId.HasValue)
        {
            targetDepartmentId = departmentId.Value;
        }
        else
        {
            return BadRequest("Department ID is required");
        }

        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == targetDepartmentId);

        if (department == null)
            return NotFound("Department not found");

        var evaluationsQuery = _db.Evaluations
            .Include(e => e.Lecturer)
            .Include(e => e.Kpi)
            .Where(e => e.Lecturer.DepartmentId == targetDepartmentId && e.Status == "Completed");

        if (startDate.HasValue)
            evaluationsQuery = evaluationsQuery.Where(e => e.EvaluatedAt >= startDate.Value);
        if (endDate.HasValue)
            evaluationsQuery = evaluationsQuery.Where(e => e.EvaluatedAt <= endDate.Value);

        var evaluations = await evaluationsQuery.ToListAsync();
        var lecturerIds = department.Users.Select(u => u.Id).ToList();
        
        var lecturers = new List<object>();
        var topPerformers = new List<object>();

        decimal deptTotalScore = 0;
        int lecturerCount = 0;

        foreach (var user in department.Users ?? Enumerable.Empty<AppUser>())
        {
            if (user == null) continue;
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains("Lecturer"))
            {
                var userEvaluations = evaluations.Where(e => e.LecturerId == user.Id).ToList();
                var performanceScore = await CalculateOverallAreaWeightedScore(user.Id, startDate, endDate);
                
                lecturers.Add(new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    PerformanceScore = performanceScore,
                    AvgScore = performanceScore, // Consistent
                    EvaluationCount = userEvaluations.Count
                });

                deptTotalScore += performanceScore;
                lecturerCount++;

                if (performanceScore > 0)
                {
                    topPerformers.Add(new
                    {
                        name = user.FullName,
                        department = department.Name,
                        score = Math.Round(performanceScore, 1)
                    });
                }
            }
        }

        topPerformers = topPerformers
            .OrderByDescending(p => ((dynamic)p).score)
            .Take(5)
            .ToList();

        var groupedByCategory = evaluations.GroupBy(e => GetCategory(e.Kpi?.Title));
        var categoryScores = new List<object>();
        foreach (var group in groupedByCategory)
        {
            if (group.Key != "other")
            {
                categoryScores.Add(new { name = group.Key.ToTitleCase(), score = Math.Round(CalculateGroupScore(group), 1) });
            }
        }
        // If no data, add defaults with 0
        var categories = new[] { "Teaching", "Research", "Service", "Professional" };
        foreach (var cat in categories)
        {
            if (!categoryScores.Any(c => ((dynamic)c).name == cat))
            {
                categoryScores.Add(new { name = cat, score = 0 });
            }
        }

        // Trends with weighted scores
        var trendData = new List<object>();
        if (startDate.HasValue && endDate.HasValue)
        {
            // Use monthly trends if custom range
            var current = startDate.Value;
            while (current < endDate.Value)
            {
                var monthEnd = current.AddMonths(1).AddDays(-1);
                if (monthEnd > endDate.Value) monthEnd = endDate.Value;
                var periodEvaluations = evaluations.Where(e => e.EvaluatedAt >= current && e.EvaluatedAt <= monthEnd).ToList();
                var periodScore = CalculateGroupScore(periodEvaluations);
                trendData.Add(new
                {
                    period = current.ToString("MMM yy"),
                    score = Math.Round(periodScore, 1)
                });
                current = current.AddMonths(1);
            }
        }
        else
        {
            // Default quarterly
            var currentYear = DateTime.UtcNow.Year;
            for (int q = 1; q <= 4; q++)
            {
                var quarterStart = new DateTime(currentYear, (q - 1) * 3 + 1, 1);
                var quarterEnd = quarterStart.AddMonths(3).AddDays(-1);
                var periodEvaluations = evaluations.Where(e => e.EvaluatedAt >= quarterStart && e.EvaluatedAt <= quarterEnd).ToList();
                var periodScore = CalculateGroupScore(periodEvaluations);
                trendData.Add(new
                {
                    period = $"Q{q}",
                    score = Math.Round(periodScore, 1)
                });
            }
        }

        return Ok(new
        {
            performance = new
            {
                overall = new
                {
                    totalEvaluations = evaluations.Count,
                    completedEvaluations = evaluations.Count(e => e.Status == "Completed"),
                    avgScore = lecturerCount > 0 ? Math.Round(deptTotalScore / lecturerCount, 1) : 0,
                    pendingEvaluations = evaluations.Count(e => e.Status == "Pending")
                },
                byDepartment = new[] { new { name = department.Name, score = lecturerCount > 0 ? Math.Round(deptTotalScore / lecturerCount, 1) : 0 } },
                byCategory = categoryScores,
                trends = trendData,
                topPerformers = topPerformers
            }
        });
    }

    [HttpGet("my-performance")]
    [Authorize(Roles = "Lecturer")]
    public async Task<IActionResult> GetMyPerformance([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null)
            return Unauthorized("User not found");

        var evaluationsQuery = _db.Evaluations
            .Include(e => e.Kpi)
            .Include(e => e.Hod)
            .Where(e => e.LecturerId == currentUser.Id && e.Status == "Completed");

        if (startDate.HasValue)
            evaluationsQuery = evaluationsQuery.Where(e => e.EvaluatedAt >= startDate.Value);
        if (endDate.HasValue)
            evaluationsQuery = evaluationsQuery.Where(e => e.EvaluatedAt <= endDate.Value);

        var evaluations = await evaluationsQuery.OrderByDescending(e => e.EvaluatedAt).ToListAsync();
        
        var overallScore = await CalculateOverallAreaWeightedScore(currentUser.Id, startDate, endDate);

        var grouped = evaluations.GroupBy(e => GetCategory(e.Kpi?.Title));

        var categoryScores = new
        {
            teaching = CalculateGroupScore(grouped.FirstOrDefault(g => g.Key == "teaching") ?? Enumerable.Empty<Evaluation>()),
            research = CalculateGroupScore(grouped.FirstOrDefault(g => g.Key == "research") ?? Enumerable.Empty<Evaluation>()),
            service = CalculateGroupScore(grouped.FirstOrDefault(g => g.Key == "service") ?? Enumerable.Empty<Evaluation>()),
            professional = CalculateGroupScore(grouped.FirstOrDefault(g => g.Key == "professional") ?? Enumerable.Empty<Evaluation>())
        };

        var evaluationData = evaluations.Take(10).Select(e => new
        {
            evaluator = e.Hod?.FullName ?? "Unknown",
            date = e.EvaluatedAt.ToString("yyyy-MM-dd"),
            score = e.Score,
            feedback = e.Comments ?? "No feedback provided"
        });

        var kpis = await _db.Kpis.Where(k => k.TargetRole == "Lecturer").ToListAsync();
        var kpiProgress = new List<object>();
        
        foreach (var kpi in kpis)
        {
            var kpiEvaluations = evaluations.Where(e => e.KpiId == kpi.Id).ToList();
            var achieved = kpiEvaluations.Any() ? kpiEvaluations.Average(e => e.Score) : 0;
            var target = kpi.Target;
            
            string status;
            if (achieved >= target) status = "exceeds";
            else if (achieved >= target * 0.9m) status = "on-track";
            else if (achieved >= target * 0.7m) status = "attention-needed";
            else status = "at-risk";
            
            kpiProgress.Add(new
            {
                name = kpi.Title,
                target = target,
                achieved = Math.Round(achieved, 1),
                status = status
            });
        }

        return Ok(new
        {
            overallScore = Math.Round(overallScore, 1),
            categoryScores = categoryScores,
            evaluations = evaluationData,
            kpiProgress = kpiProgress,
            debug = new {
                totalEvaluations = evaluations.Count,
                evaluationIds = evaluations.Select(e => e.Id).ToArray(),
                lecturerId = currentUser.Id,
                lecturerName = currentUser.FullName,
                rawEvaluationScores = evaluations.Select(e => e.Score).ToArray(),
                kpiTitles = evaluations.Select(e => e.Kpi?.Title).Distinct().ToArray()
            }
        });
    }

    [HttpGet("comprehensive")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> GetComprehensiveReport([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var evaluationsQuery = _db.Evaluations
            .Include(e => e.Lecturer)
            .ThenInclude(l => l.Department)
            .Include(e => e.Kpi)
            .Where(e => e.Status == "Completed");

        if (startDate.HasValue)
            evaluationsQuery = evaluationsQuery.Where(e => e.EvaluatedAt >= startDate.Value);
        if (endDate.HasValue)
            evaluationsQuery = evaluationsQuery.Where(e => e.EvaluatedAt <= endDate.Value);

        var evaluations = await evaluationsQuery.ToListAsync();
        var departments = await _db.Departments.Include(d => d.Users).ToListAsync();

        var departmentPerformance = new List<object>();
        decimal globalTotalScore = 0;
        int globalLecturerCount = 0;

        foreach (var dept in departments)
        {
            if (dept == null) continue;
            var deptEvals = evaluations.Where(e => e.Lecturer?.DepartmentId == dept.Id).ToList();
            decimal deptScore = 0;
            int deptCount = 0;
            foreach (var user in dept.Users ?? Enumerable.Empty<AppUser>())
            {
                if (user == null) continue;
                var roles = await _userManager.GetRolesAsync(user);
                if (roles.Contains("Lecturer"))
                {
                    var userScore = await CalculateOverallAreaWeightedScore(user.Id, startDate, endDate);
                    deptScore += userScore;
                    deptCount++;
                    globalTotalScore += userScore;
                    globalLecturerCount++;
                }
            }
            var avgDept = deptCount > 0 ? Math.Round(deptScore / deptCount, 1) : 0;
            departmentPerformance.Add(new { name = dept.Name, score = avgDept });
        }

        var groupedByCategory = evaluations.GroupBy(e => GetCategory(e.Kpi?.Title));
        var categoryScores = new List<object>();
        foreach (var group in groupedByCategory)
        {
            if (group.Key != "other")
            {
                categoryScores.Add(new { name = group.Key.ToTitleCase(), score = Math.Round(CalculateGroupScore(group), 1) });
            }
        }
        foreach (var cat in new[] { "Teaching", "Research", "Service", "Administration" })
        {
            if (!categoryScores.Any(c => ((dynamic)c).name == cat))
            {
                categoryScores.Add(new { name = cat, score = 0 });
            }
        }

        var trendData = new List<object>();
        if (startDate.HasValue && endDate.HasValue)
        {
            var current = startDate.Value;
            while (current < endDate.Value)
            {
                var monthEnd = current.AddMonths(1).AddDays(-1);
                if (monthEnd > endDate.Value) monthEnd = endDate.Value;
                var periodEvals = evaluations.Where(e => e.EvaluatedAt >= current && e.EvaluatedAt <= monthEnd).ToList();
                var periodScore = CalculateGroupScore(periodEvals);
                trendData.Add(new { period = current.ToString("MMM yy"), score = Math.Round(periodScore, 1) });
                current = current.AddMonths(1);
            }
        }
        else
        {
            var currentYear = DateTime.UtcNow.Year;
            for (int q = 1; q <= 4; q++)
            {
                var quarterStart = new DateTime(currentYear, (q - 1) * 3 + 1, 1);
                var quarterEnd = quarterStart.AddMonths(3).AddDays(-1);
                var quarterEvals = evaluations.Where(e => e.EvaluatedAt >= quarterStart && e.EvaluatedAt <= quarterEnd).ToList();
                var quarterScore = CalculateGroupScore(quarterEvals);
                trendData.Add(new { period = $"Q{q}", score = Math.Round(quarterScore, 1) });
            }
        }

        var topPerformers = new List<object>();
        var allUsers = departments.SelectMany(d => d.Users ?? Enumerable.Empty<AppUser>()).ToList();
        
        foreach (var user in allUsers)
        {
            if (user == null) continue;
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains("Lecturer"))
            {
                var performanceScore = await CalculateOverallAreaWeightedScore(user.Id, startDate, endDate);
                if (performanceScore > 0)
                {
                    topPerformers.Add(new
                    {
                        name = user.FullName,
                        department = user.Department?.Name ?? "Unknown",
                        score = Math.Round(performanceScore, 1)
                    });
                }
            }
        }

        topPerformers = topPerformers
            .OrderByDescending(p => ((dynamic)p).score)
            .Take(5)
            .ToList();

        return Ok(new
        {
            performance = new
            {
                overall = new
                {
                    totalEvaluations = evaluations.Count,
                    completedEvaluations = evaluations.Count(e => e.Status == "Completed"),
                    avgScore = globalLecturerCount > 0 ? Math.Round(globalTotalScore / globalLecturerCount, 1) : 0,
                    pendingEvaluations = evaluations.Count(e => e.Status == "Pending")
                },
                byDepartment = departmentPerformance,
                byCategory = categoryScores,
                trends = trendData,
                topPerformers = topPerformers
            }
        });
    }

    [HttpGet("my-department-evaluations")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> GetMyDepartmentEvaluations([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser?.DepartmentId == null)
            return BadRequest("User is not associated with a department");

        var department = await _db.Departments
            .Include(d => d.Users)
            .FirstOrDefaultAsync(d => d.Id == currentUser.DepartmentId.Value);

        if (department == null)
            return NotFound("Department not found");

        var evaluationsData = new List<object>();
        
        foreach (var user in department.Users ?? Enumerable.Empty<AppUser>())
        {
            if (user == null) continue;
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains("Lecturer"))
            {
                var evalQuery = _db.Evaluations
                    .Include(e => e.Kpi)
                    .Where(e => e.LecturerId == user.Id);

                if (startDate.HasValue)
                    evalQuery = evalQuery.Where(e => e.EvaluatedAt >= startDate.Value);
                if (endDate.HasValue)
                    evalQuery = evalQuery.Where(e => e.EvaluatedAt <= endDate.Value);

                var latestEvaluation = await evalQuery
                    .OrderByDescending(e => e.EvaluatedAt)
                    .FirstOrDefaultAsync();

                evaluationsData.Add(new
                {
                    id = user.Id,
                    lecturerName = user.FullName,
                    status = latestEvaluation?.Status?.ToLower() ?? "pending",
                    score = latestEvaluation?.Score,
                    date = latestEvaluation?.EvaluatedAt.ToString("yyyy-MM-dd")
                });
            }
        }

        return Ok(evaluationsData);
    }

    // EXPORT ENDPOINTS
    [HttpGet("department/export")]
    [Authorize(Roles = "Admin,Dean,HOD")]
    public async Task<IActionResult> ExportDepartmentReport([FromQuery] string format, [FromQuery] int? departmentId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var reportResult = await GetDepartmentReport(departmentId, startDate, endDate);
            if (reportResult is not OkObjectResult okResult || okResult.Value == null)
                return BadRequest("Failed to generate report data");

            var reportData = okResult.Value;
            string fileName = $"department-report-{DateTime.UtcNow:yyyy-MM-dd}";

            if (format.ToLower() == "pdf")
            {
                var pdfBytes = GeneratePDF(reportData, "Department Report");
                return File(pdfBytes, "application/pdf", $"{fileName}.pdf");
            }
            else if (format.ToLower() == "excel")
            {
                var excelBytes = GenerateExcel(reportData, "Department Report");
                return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileName}.xlsx");
            }
            else
            {
                return BadRequest("Unsupported format. Use 'pdf' or 'excel'");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Export failed: {ex.Message}");
            return BadRequest($"Export failed: {ex.Message}");
        }
    }

    [HttpGet("department/evaluations/export")]
    [Authorize(Roles = "HOD")]
    public async Task<IActionResult> ExportDepartmentEvaluations([FromQuery] string format, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var evaluationsResult = await GetMyDepartmentEvaluations(startDate, endDate);
            if (evaluationsResult is not OkObjectResult okResult || okResult.Value == null)
                return BadRequest("Failed to generate evaluations data");

            var evaluationsData = okResult.Value;
            string fileName = $"department-evaluations-{DateTime.UtcNow:yyyy-MM-dd}";

            if (format.ToLower() == "pdf")
            {
                var pdfBytes = GeneratePDF(evaluationsData, "Department Evaluations");
                return File(pdfBytes, "application/pdf", $"{fileName}.pdf");
            }
            else if (format.ToLower() == "excel")
            {
                var excelBytes = GenerateExcel(evaluationsData, "Department Evaluations");
                return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileName}.xlsx");
            }
            else
            {
                return BadRequest("Unsupported format. Use 'pdf' or 'excel'");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Export failed: {ex.Message}");
            return BadRequest($"Export failed: {ex.Message}");
        }
    }

    [HttpGet("my-performance/export")]
    [Authorize(Roles = "Lecturer")]
    public async Task<IActionResult> ExportMyPerformance([FromQuery] string format, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var performanceResult = await GetMyPerformance(startDate, endDate);
            if (performanceResult is not OkObjectResult okResult || okResult.Value == null)
                return BadRequest("Failed to generate performance data");

            var performanceData = okResult.Value;
            string fileName = $"my-performance-{DateTime.UtcNow:yyyy-MM-dd}";

            if (format.ToLower() == "pdf")
            {
                var pdfBytes = GeneratePDF(performanceData, "My Performance Report");
                return File(pdfBytes, "application/pdf", $"{fileName}.pdf");
            }
            else if (format.ToLower() == "excel")
            {
                var excelBytes = GenerateExcel(performanceData, "My Performance Report");
                return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileName}.xlsx");
            }
            else
            {
                return BadRequest("Unsupported format. Use 'pdf' or 'excel'");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Export failed: {ex.Message}");
            return BadRequest($"Export failed: {ex.Message}");
        }
    }

    [HttpGet("comprehensive/export")]
    [Authorize(Roles = "Admin,Dean")]
    public async Task<IActionResult> ExportComprehensiveReport([FromQuery] string format, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        try
        {
            var comprehensiveResult = await GetComprehensiveReport(startDate, endDate);
            if (comprehensiveResult is not OkObjectResult okResult || okResult.Value == null)
                return BadRequest("Failed to generate comprehensive report data");

            var reportData = okResult.Value;
            string fileName = $"comprehensive-report-{DateTime.UtcNow:yyyy-MM-dd}";

            if (format.ToLower() == "pdf")
            {
                var pdfBytes = GeneratePDF(reportData, "Comprehensive Report");
                return File(pdfBytes, "application/pdf", $"{fileName}.pdf");
            }
            else if (format.ToLower() == "excel")
            {
                var excelBytes = GenerateExcel(reportData, "Comprehensive Report");
                return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileName}.xlsx");
            }
            else
            {
                return BadRequest("Unsupported format. Use 'pdf' or 'excel'");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Export failed: {ex.Message}");
            return BadRequest($"Export failed: {ex.Message}");
        }
    }

    // Helper methods for generating PDF and Excel files
    private byte[] GeneratePDF(object data, string title)
    {
        using (var memoryStream = new MemoryStream())
        {
            var document = new Document(PageSize.A4, 40f, 40f, 40f, 40f);
            var writer = PdfWriter.GetInstance(document, memoryStream);

            document.Open();

            // Header
            var headerTable = new PdfPTable(2) { WidthPercentage = 100 };
            headerTable.SetWidths(new float[] { 70f, 30f });

            var titleCell = new PdfPCell(new Phrase(title, FontFactory.GetFont("Arial", 18, Font.BOLD, BaseColor.DarkGray)))
            {
                Border = Rectangle.NO_BORDER,
                HorizontalAlignment = Element.ALIGN_LEFT,
                VerticalAlignment = Element.ALIGN_MIDDLE,
                PaddingBottom = 10f
            };

            var dateCell = new PdfPCell(new Phrase($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}", FontFactory.GetFont("Arial", 10, Font.NORMAL, BaseColor.Gray)))
            {
                Border = Rectangle.NO_BORDER,
                HorizontalAlignment = Element.ALIGN_RIGHT,
                VerticalAlignment = Element.ALIGN_MIDDLE
            };

            headerTable.AddCell(titleCell);
            headerTable.AddCell(dateCell);
            document.Add(headerTable);

            // Horizontal line
            var line = new Chunk(new iTextSharp.text.pdf.draw.LineSeparator(1f, 100f, BaseColor.LightGray, Element.ALIGN_CENTER, -2));
            document.Add(line);
            document.Add(new Paragraph(" ") { SpacingAfter = 20f });

            // Parse and format data based on report type
            if (data != null)
            {
                var jsonElement = JsonSerializer.SerializeToElement(data);

                if (title.Contains("Department Report") || title.Contains("Comprehensive Report"))
                {
                    AddPerformanceReportContent(document, jsonElement);
                }
                else if (title.Contains("Performance Report"))
                {
                    AddLecturerPerformanceContent(document, jsonElement);
                }
                else if (title.Contains("Evaluations"))
                {
                    AddEvaluationsContent(document, jsonElement);
                }
                else
                {
                    AddGenericContent(document, jsonElement);
                }
            }

            // Footer
            document.Add(new Paragraph(" ") { SpacingBefore = 30f });
            var footerLine = new Chunk(new iTextSharp.text.pdf.draw.LineSeparator(1f, 100f, BaseColor.LightGray, Element.ALIGN_CENTER, -2));
            document.Add(footerLine);

            var footerParagraph = new Paragraph("This report was generated automatically by the KPI Management System",
                FontFactory.GetFont("Arial", 8, Font.ITALIC, BaseColor.Gray))
            {
                Alignment = Element.ALIGN_CENTER,
                SpacingBefore = 10f
            };
            document.Add(footerParagraph);

            document.Close();
            return memoryStream.ToArray();
        }
    }

    private void AddPerformanceReportContent(Document document, JsonElement data)
    {
        if (data.TryGetProperty("performance", out var performance))
        {
            // Overall Performance Section
            document.Add(new Paragraph("Overall Performance Summary", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
            {
                SpacingAfter = 10f
            });

            if (performance.TryGetProperty("overall", out var overall))
            {
                var summaryTable = new PdfPTable(4) { WidthPercentage = 100 };
                summaryTable.SetWidths(new float[] { 25f, 25f, 25f, 25f });

                AddTableHeader(summaryTable, "Total Evaluations");
                AddTableHeader(summaryTable, "Completed");
                AddTableHeader(summaryTable, "Average Score");
                AddTableHeader(summaryTable, "Pending");

                AddTableCell(summaryTable, GetJsonValue(overall, "totalEvaluations"));
                AddTableCell(summaryTable, GetJsonValue(overall, "completedEvaluations"));
                AddTableCell(summaryTable, GetJsonValue(overall, "avgScore") + "%");
                AddTableCell(summaryTable, GetJsonValue(overall, "pendingEvaluations"));

                document.Add(summaryTable);
            }

            document.Add(new Paragraph(" ") { SpacingAfter = 20f });

            // Performance by Department
            if (performance.TryGetProperty("byDepartment", out var byDepartment) && byDepartment.ValueKind == JsonValueKind.Array)
            {
                document.Add(new Paragraph("Performance by Department", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
                {
                    SpacingAfter = 10f
                });

                var deptTable = new PdfPTable(2) { WidthPercentage = 100 };
                deptTable.SetWidths(new float[] { 70f, 30f });

                AddTableHeader(deptTable, "Department");
                AddTableHeader(deptTable, "Score");

                foreach (var dept in byDepartment.EnumerateArray())
                {
                    AddTableCell(deptTable, GetJsonValue(dept, "name"));
                    AddTableCell(deptTable, GetJsonValue(dept, "score") + "%");
                }

                document.Add(deptTable);
                document.Add(new Paragraph(" ") { SpacingAfter = 20f });
            }

            // Top Performers Section
            if (performance.TryGetProperty("topPerformers", out var topPerformers) && topPerformers.ValueKind == JsonValueKind.Array)
            {
                document.Add(new Paragraph("Top Performers", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
                {
                    SpacingAfter = 10f
                });

                var performersTable = new PdfPTable(4) { WidthPercentage = 100 };
                performersTable.SetWidths(new float[] { 10f, 50f, 20f, 20f });

                AddTableHeader(performersTable, "Rank");
                AddTableHeader(performersTable, "Name");
                AddTableHeader(performersTable, "Department");
                AddTableHeader(performersTable, "Score");

                var rank = 1;
                foreach (var performer in topPerformers.EnumerateArray())
                {
                    AddTableCell(performersTable, $"#{rank}");
                    AddTableCell(performersTable, GetJsonValue(performer, "name"));
                    AddTableCell(performersTable, GetJsonValue(performer, "department"));
                    AddTableCell(performersTable, GetJsonValue(performer, "score") + "%");
                    rank++;
                }

                document.Add(performersTable);
                document.Add(new Paragraph(" ") { SpacingAfter = 20f });
            }

            // Category Performance
            if (performance.TryGetProperty("byCategory", out var categories) && categories.ValueKind == JsonValueKind.Array)
            {
                document.Add(new Paragraph("Performance by Category", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
                {
                    SpacingAfter = 10f
                });

                var categoryTable = new PdfPTable(2) { WidthPercentage = 100 };
                categoryTable.SetWidths(new float[] { 70f, 30f });

                AddTableHeader(categoryTable, "Category");
                AddTableHeader(categoryTable, "Average Score");

                foreach (var category in categories.EnumerateArray())
                {
                    AddTableCell(categoryTable, GetJsonValue(category, "name"));
                    AddTableCell(categoryTable, GetJsonValue(category, "score") + "%");
                }

                document.Add(categoryTable);
                document.Add(new Paragraph(" ") { SpacingAfter = 20f });
            }

            // Performance Trends
            if (performance.TryGetProperty("trends", out var trends) && trends.ValueKind == JsonValueKind.Array)
            {
                document.Add(new Paragraph("Performance Trends", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
                {
                    SpacingAfter = 10f
                });

                var trendTable = new PdfPTable(2) { WidthPercentage = 100 };
                trendTable.SetWidths(new float[] { 70f, 30f });

                AddTableHeader(trendTable, "Period");
                AddTableHeader(trendTable, "Score");

                foreach (var trend in trends.EnumerateArray())
                {
                    AddTableCell(trendTable, GetJsonValue(trend, "period"));
                    AddTableCell(trendTable, GetJsonValue(trend, "score") + "%");
                }

                document.Add(trendTable);
            }
        }
    }

    private void AddLecturerPerformanceContent(Document document, JsonElement data)
    {
        // Overall Score
        document.Add(new Paragraph("Performance Overview", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
        {
            SpacingAfter = 10f
        });

        var overallScore = GetJsonValue(data, "overallScore");
        var scoreTable = new PdfPTable(1) { WidthPercentage = 50 };

        var scoreCell = new PdfPCell(new Phrase($"Overall Score: {overallScore}%", FontFactory.GetFont("Arial", 16, Font.BOLD)))
        {
            HorizontalAlignment = Element.ALIGN_CENTER,
            BackgroundColor = BaseColor.LightGray,
            Padding = 15f
        };
        scoreTable.AddCell(scoreCell);
        document.Add(scoreTable);

        // Category Scores
        if (data.TryGetProperty("categoryScores", out var categoryScores))
        {
            document.Add(new Paragraph(" ") { SpacingAfter = 20f });
            document.Add(new Paragraph("Category Performance", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
            {
                SpacingAfter = 10f
            });

            var categoryTable = new PdfPTable(2) { WidthPercentage = 100 };
            categoryTable.SetWidths(new float[] { 70f, 30f });

            AddTableHeader(categoryTable, "Category");
            AddTableHeader(categoryTable, "Score");

            foreach (var property in categoryScores.EnumerateObject())
            {
                AddTableCell(categoryTable, property.Name.ToTitleCase());
                AddTableCell(categoryTable, Math.Round(property.Value.GetDecimal(), 1) + "%");
            }

            document.Add(categoryTable);
        }

        // Recent Evaluations
        if (data.TryGetProperty("evaluations", out var evaluations) && evaluations.ValueKind == JsonValueKind.Array)
        {
            document.Add(new Paragraph(" ") { SpacingAfter = 20f });
            document.Add(new Paragraph("Recent Evaluations", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
            {
                SpacingAfter = 10f
            });

            var evalTable = new PdfPTable(4) { WidthPercentage = 100 };
            evalTable.SetWidths(new float[] { 25f, 20f, 15f, 40f });

            AddTableHeader(evalTable, "Evaluator");
            AddTableHeader(evalTable, "Date");
            AddTableHeader(evalTable, "Score");
            AddTableHeader(evalTable, "Feedback");

            foreach (var evaluation in evaluations.EnumerateArray().Take(10))
            {
                AddTableCell(evalTable, GetJsonValue(evaluation, "evaluator"));
                AddTableCell(evalTable, GetJsonValue(evaluation, "date"));
                AddTableCell(evalTable, GetJsonValue(evaluation, "score") + "%");
                var feedback = GetJsonValue(evaluation, "feedback");
                AddTableCell(evalTable, feedback.Length > 50 ? feedback.Substring(0, 50) + "..." : feedback);
            }

            document.Add(evalTable);
        }
    }

    private void AddEvaluationsContent(Document document, JsonElement data)
    {
        if (data.ValueKind == JsonValueKind.Array)
        {
            document.Add(new Paragraph("Department Evaluations Summary", FontFactory.GetFont("Arial", 14, Font.BOLD, BaseColor.DarkGray))
            {
                SpacingAfter = 10f
            });

            var evalTable = new PdfPTable(4) { WidthPercentage = 100 };
            evalTable.SetWidths(new float[] { 40f, 20f, 20f, 20f });

            AddTableHeader(evalTable, "Lecturer Name");
            AddTableHeader(evalTable, "Status");
            AddTableHeader(evalTable, "Score");
            AddTableHeader(evalTable, "Date");

            foreach (var evaluation in data.EnumerateArray())
            {
                AddTableCell(evalTable, GetJsonValue(evaluation, "lecturerName"));
                AddTableCell(evalTable, GetJsonValue(evaluation, "status").ToTitleCase());
                var score = GetJsonValue(evaluation, "score");
                AddTableCell(evalTable, string.IsNullOrEmpty(score) ? "N/A" : score + "%");
                AddTableCell(evalTable, GetJsonValue(evaluation, "date"));
            }

            document.Add(evalTable);
        }
    }

    private void AddGenericContent(Document document, JsonElement data)
    {
        var jsonString = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
        var paragraph = new Paragraph(jsonString, FontFactory.GetFont("Courier", 8))
        {
            SpacingAfter = 10f
        };
        document.Add(paragraph);
    }

    private void AddTableHeader(PdfPTable table, string text)
    {
        var cell = new PdfPCell(new Phrase(text, FontFactory.GetFont("Arial", 10, Font.BOLD, BaseColor.White)))
        {
            BackgroundColor = new BaseColor(17, 72, 107),
            HorizontalAlignment = Element.ALIGN_CENTER,
            VerticalAlignment = Element.ALIGN_MIDDLE,
            Padding = 8f
        };
        table.AddCell(cell);
    }

    private void AddTableCell(PdfPTable table, string text)
    {
        var cell = new PdfPCell(new Phrase(text, FontFactory.GetFont("Arial", 9)))
        {
            HorizontalAlignment = Element.ALIGN_CENTER,
            VerticalAlignment = Element.ALIGN_MIDDLE,
            Padding = 5f,
            BorderColor = BaseColor.LightGray
        };
        table.AddCell(cell);
    }

    private string GetJsonValue(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var property))
        {
            return property.ValueKind == JsonValueKind.String ? (property.GetString() ?? "N/A") : property.ToString() ?? "N/A";
        }
        return "N/A";
    }

    private byte[] GenerateExcel(object data, string title)
    {
        try
        {
            using (var package = new ExcelPackage())
            {
                var worksheet = package.Workbook.Worksheets.Add("Report");
                
                worksheet.Cells[1, 1].Value = title;
                worksheet.Cells[1, 1].Style.Font.Size = 16;
                worksheet.Cells[1, 1].Style.Font.Bold = true;
                worksheet.Cells[1, 1].Style.Font.Color.SetColor(System.Drawing.Color.DarkBlue);
                
                worksheet.Cells[2, 1].Value = $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC";
                worksheet.Cells[2, 1].Style.Font.Size = 10;
                worksheet.Cells[2, 1].Style.Font.Color.SetColor(System.Drawing.Color.Gray);
                
                var currentRow = 4;
                
                if (data != null)
                {
                    var jsonElement = JsonSerializer.SerializeToElement(data);
                    
                    if (title.Contains("Department Report") || title.Contains("Comprehensive Report"))
                    {
                        currentRow = AddPerformanceDataToExcel(worksheet, jsonElement, currentRow);
                    }
                    else if (title.Contains("Performance Report"))
                    {
                        currentRow = AddLecturerPerformanceToExcel(worksheet, jsonElement, currentRow);
                    }
                    else if (title.Contains("Evaluations"))
                    {
                        currentRow = AddEvaluationsToExcel(worksheet, jsonElement, currentRow);
                    }
                    else
                    {
                        currentRow = AddGenericDataToExcel(worksheet, jsonElement, currentRow);
                    }
                }
                
                for (int col = 1; col <= worksheet.Dimension.End.Column; col++)
                {
                    worksheet.Column(col).AutoFit();
                    if (worksheet.Column(col).Width > 50)
                        worksheet.Column(col).Width = 50;
                }
                
                return package.GetAsByteArray();
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Excel generation error: {ex.Message}");
            throw new InvalidOperationException($"Failed to generate Excel file: {ex.Message}");
        }
    }

    private int AddPerformanceDataToExcel(ExcelWorksheet worksheet, JsonElement data, int startRow)
    {
        var currentRow = startRow;
        
        if (data.TryGetProperty("performance", out var performance))
        {
            worksheet.Cells[currentRow, 1].Value = "Overall Performance Summary";
            worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
            currentRow += 2;
            
            if (performance.TryGetProperty("overall", out var overall))
            {
                worksheet.Cells[currentRow, 1].Value = "Metric";
                worksheet.Cells[currentRow, 2].Value = "Value";
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
                currentRow++;
                
                worksheet.Cells[currentRow, 1].Value = "Total Evaluations";
                worksheet.Cells[currentRow, 2].Value = GetJsonValue(overall, "totalEvaluations");
                currentRow++;
                
                worksheet.Cells[currentRow, 1].Value = "Completed Evaluations";
                worksheet.Cells[currentRow, 2].Value = GetJsonValue(overall, "completedEvaluations");
                currentRow++;
                
                worksheet.Cells[currentRow, 1].Value = "Average Score";
                worksheet.Cells[currentRow, 2].Value = GetJsonValue(overall, "avgScore") + "%";
                currentRow++;
                
                worksheet.Cells[currentRow, 1].Value = "Pending Evaluations";
                worksheet.Cells[currentRow, 2].Value = GetJsonValue(overall, "pendingEvaluations");
                currentRow += 3;
            }
            
            // Performance by Department
            if (performance.TryGetProperty("byDepartment", out var byDepartment) && byDepartment.ValueKind == JsonValueKind.Array)
            {
                worksheet.Cells[currentRow, 1].Value = "Performance by Department";
                worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
                currentRow += 2;

                worksheet.Cells[currentRow, 1].Value = "Department";
                worksheet.Cells[currentRow, 2].Value = "Score";
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
                currentRow++;

                foreach (var dept in byDepartment.EnumerateArray())
                {
                    worksheet.Cells[currentRow, 1].Value = GetJsonValue(dept, "name");
                    worksheet.Cells[currentRow, 2].Value = GetJsonValue(dept, "score") + "%";
                    currentRow++;
                }
                currentRow += 2;
            }
            
            if (performance.TryGetProperty("topPerformers", out var topPerformers) && topPerformers.ValueKind == JsonValueKind.Array)
            {
                worksheet.Cells[currentRow, 1].Value = "Top Performers";
                worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
                currentRow += 2;
                
                worksheet.Cells[currentRow, 1].Value = "Rank";
                worksheet.Cells[currentRow, 2].Value = "Name";
                worksheet.Cells[currentRow, 3].Value = "Department";
                worksheet.Cells[currentRow, 4].Value = "Score";
                worksheet.Cells[currentRow, 1, currentRow, 4].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1, currentRow, 4].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                worksheet.Cells[currentRow, 1, currentRow, 4].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightBlue);
                currentRow++;
                
                var rank = 1;
                foreach (var performer in topPerformers.EnumerateArray())
                {
                    worksheet.Cells[currentRow, 1].Value = rank;
                    worksheet.Cells[currentRow, 2].Value = GetJsonValue(performer, "name");
                    worksheet.Cells[currentRow, 3].Value = GetJsonValue(performer, "department");
                    worksheet.Cells[currentRow, 4].Value = GetJsonValue(performer, "score") + "%";
                    currentRow++;
                    rank++;
                }
                currentRow += 2;
            }
            
            if (performance.TryGetProperty("byCategory", out var categories) && categories.ValueKind == JsonValueKind.Array)
            {
                worksheet.Cells[currentRow, 1].Value = "Performance by Category";
                worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
                currentRow += 2;
                
                worksheet.Cells[currentRow, 1].Value = "Category";
                worksheet.Cells[currentRow, 2].Value = "Score";
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGreen);
                currentRow++;
                
                foreach (var category in categories.EnumerateArray())
                {
                    worksheet.Cells[currentRow, 1].Value = GetJsonValue(category, "name");
                    worksheet.Cells[currentRow, 2].Value = GetJsonValue(category, "score") + "%";
                    currentRow++;
                }
                currentRow += 2;
            }

            if (performance.TryGetProperty("trends", out var trends) && trends.ValueKind == JsonValueKind.Array)
            {
                worksheet.Cells[currentRow, 1].Value = "Performance Trends";
                worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
                currentRow += 2;

                worksheet.Cells[currentRow, 1].Value = "Period";
                worksheet.Cells[currentRow, 2].Value = "Score";
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Font.Bold = true;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
                currentRow++;

                foreach (var trend in trends.EnumerateArray())
                {
                    worksheet.Cells[currentRow, 1].Value = GetJsonValue(trend, "period");
                    worksheet.Cells[currentRow, 2].Value = GetJsonValue(trend, "score") + "%";
                    currentRow++;
                }
            }
        }
        
        return currentRow;
    }

    private int AddLecturerPerformanceToExcel(ExcelWorksheet worksheet, JsonElement data, int startRow)
    {
        var currentRow = startRow;
        
        worksheet.Cells[currentRow, 1].Value = "Overall Performance Score";
        worksheet.Cells[currentRow, 2].Value = GetJsonValue(data, "overallScore") + "%";
        worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
        worksheet.Cells[currentRow, 2].Style.Font.Bold = true;
        worksheet.Cells[currentRow, 2].Style.Font.Size = 16;
        currentRow += 3;
        
        if (data.TryGetProperty("categoryScores", out var categoryScores))
        {
            worksheet.Cells[currentRow, 1].Value = "Category Performance";
            worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
            currentRow += 2;
            
            worksheet.Cells[currentRow, 1].Value = "Category";
            worksheet.Cells[currentRow, 2].Value = "Score";
            worksheet.Cells[currentRow, 1, currentRow, 2].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            worksheet.Cells[currentRow, 1, currentRow, 2].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
            currentRow++;
            
            foreach (var property in categoryScores.EnumerateObject())
            {
                worksheet.Cells[currentRow, 1].Value = property.Name.ToTitleCase();
                worksheet.Cells[currentRow, 2].Value = Math.Round(property.Value.GetDecimal(), 1) + "%";
                currentRow++;
            }
            currentRow += 2;
        }
        
        if (data.TryGetProperty("evaluations", out var evaluations) && evaluations.ValueKind == JsonValueKind.Array)
        {
            worksheet.Cells[currentRow, 1].Value = "Recent Evaluations";
            worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
            currentRow += 2;
            
            worksheet.Cells[currentRow, 1].Value = "Evaluator";
            worksheet.Cells[currentRow, 2].Value = "Date";
            worksheet.Cells[currentRow, 3].Value = "Score";
            worksheet.Cells[currentRow, 4].Value = "Feedback";
            worksheet.Cells[currentRow, 1, currentRow, 4].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1, currentRow, 4].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            worksheet.Cells[currentRow, 1, currentRow, 4].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightBlue);
            currentRow++;
            
            foreach (var evaluation in evaluations.EnumerateArray().Take(10))
            {
                worksheet.Cells[currentRow, 1].Value = GetJsonValue(evaluation, "evaluator");
                worksheet.Cells[currentRow, 2].Value = GetJsonValue(evaluation, "date");
                worksheet.Cells[currentRow, 3].Value = GetJsonValue(evaluation, "score") + "%";
                worksheet.Cells[currentRow, 4].Value = GetJsonValue(evaluation, "feedback");
                currentRow++;
            }
        }
        
        return currentRow;
    }

    private int AddEvaluationsToExcel(ExcelWorksheet worksheet, JsonElement data, int startRow)
    {
        var currentRow = startRow;
        
        if (data.ValueKind == JsonValueKind.Array)
        {
            worksheet.Cells[currentRow, 1].Value = "Department Evaluations";
            worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1].Style.Font.Size = 14;
            currentRow += 2;
            
            worksheet.Cells[currentRow, 1].Value = "Lecturer Name";
            worksheet.Cells[currentRow, 2].Value = "Status";
            worksheet.Cells[currentRow, 3].Value = "Score";
            worksheet.Cells[currentRow, 4].Value = "Date";
            worksheet.Cells[currentRow, 1, currentRow, 4].Style.Font.Bold = true;
            worksheet.Cells[currentRow, 1, currentRow, 4].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            worksheet.Cells[currentRow, 1, currentRow, 4].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.LightGray);
            currentRow++;
            
            foreach (var evaluation in data.EnumerateArray())
            {
                worksheet.Cells[currentRow, 1].Value = GetJsonValue(evaluation, "lecturerName");
                worksheet.Cells[currentRow, 2].Value = GetJsonValue(evaluation, "status").ToTitleCase();
                var score = GetJsonValue(evaluation, "score");
                worksheet.Cells[currentRow, 3].Value = string.IsNullOrEmpty(score) ? "N/A" : score + "%";
                worksheet.Cells[currentRow, 4].Value = GetJsonValue(evaluation, "date");
                currentRow++;
            }
        }
        
        return currentRow;
    }

    private int AddGenericDataToExcel(ExcelWorksheet worksheet, JsonElement data, int startRow)
    {
        var currentRow = startRow;
        var jsonString = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
        
        worksheet.Cells[currentRow, 1].Value = "Raw Data";
        worksheet.Cells[currentRow, 1].Style.Font.Bold = true;
        currentRow += 2;
        
        worksheet.Cells[currentRow, 1].Value = jsonString;
        
        return currentRow + 1;
    }
}