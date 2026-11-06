using System.ComponentModel.DataAnnotations;

namespace KpiApi.Models;

public class StandardWorkplan
{
    public int Id { get; set; }
    
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
    public string TargetRole { get; set; } = ""; // "Dean", "HOD", "Lecturer"
    
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
    
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    public string? CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    
    public ICollection<WorkplanAssignment> WorkplanAssignments { get; set; } = new List<WorkplanAssignment>();
}