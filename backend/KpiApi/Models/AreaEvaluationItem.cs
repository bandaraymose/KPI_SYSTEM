using System.ComponentModel.DataAnnotations;

namespace KpiApi.Models;

public class AreaEvaluationItem
{
    public int Id { get; set; }

    [Required]
    public int AreaEvaluationId { get; set; }
    public AreaEvaluation? AreaEvaluation { get; set; }

    [Required]
    public int KpiId { get; set; }
    public Kpi? Kpi { get; set; }

    // 0-5 discrete score
    [Range(0,5)]
    public int Score { get; set; }
}
