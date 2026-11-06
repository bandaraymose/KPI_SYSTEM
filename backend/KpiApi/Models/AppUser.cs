using Microsoft.AspNetCore.Identity;

namespace KpiApi.Models;

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = "";
    public string? Title { get; set; }
    public int? DepartmentId { get; set; }
    public Department? Department { get; set; }
}
