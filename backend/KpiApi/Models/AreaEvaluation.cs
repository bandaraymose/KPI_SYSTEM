using System.ComponentModel.DataAnnotations;

namespace KpiApi.Models;

public class AreaEvaluation
{
    public int Id { get; set; }

    [Required]
    public string LecturerId { get; set; } = "";
    public AppUser? Lecturer { get; set; }

    public string? HodId { get; set; }
    public AppUser? Hod { get; set; }

    [Required]
    public int AreaId { get; set; }
    public Area? Area { get; set; }

    // Sum of item scores (0-5) * Area.Weight
    public decimal TotalScore { get; set; }

    [StringLength(1000)]
    public string? Comments { get; set; }

    // Indicates this AreaEvaluation was created by the subject (self-evaluation)
    public bool IsSelfEvaluation { get; set; } = false;

    public DateTime EvaluatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<AreaEvaluationItem> Items { get; set; } = new List<AreaEvaluationItem>();
}
