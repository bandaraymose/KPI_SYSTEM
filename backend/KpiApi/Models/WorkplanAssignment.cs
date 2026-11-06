using System.ComponentModel.DataAnnotations;

namespace KpiApi.Models;

public class WorkplanAssignment
{
    public int Id { get; set; }
    
    // Standard workplan being assigned
    public int StandardWorkplanId { get; set; }
    public StandardWorkplan StandardWorkplan { get; set; } = null!;
    
    // User receiving the assignment
    [Required]
    public string AssigneeId { get; set; } = "";
    public AppUser Assignee { get; set; } = null!;
    
    // User who made the assignment
    [Required]
    public string AssignedById { get; set; } = "";
    public AppUser AssignedBy { get; set; } = null!;
    
    // Assignment status
    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Assigned"; // "Assigned", "InProgress", "Completed", "Reviewed"
    
    // Tracking
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    
    // Feedback and notes
    public string? AssignmentNotes { get; set; }
    public string? CompletionNotes { get; set; }
    public string? ReviewFeedback { get; set; }
    
    // Progress tracking
    public int Progress { get; set; } = 0; // 0-100 percentage
    
    public bool IsActive { get; set; } = true;
}