namespace KpiApi.Models;

public class Kpi
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public decimal Weight { get; set; } // Deprecated: area now carries weight, kept for backward compatibility
    public decimal Target { get; set; } // Target value for this KPI
    
    // New: KPI belongs to an Area
    public int? AreaId { get; set; }
    public Area? Area { get; set; }
    public string TargetRole { get; set; } = ""; // "Dean", "HOD", "Lecturer"
    public string CreatedByHodId { get; set; } = "";
    public AppUser? CreatedByHod { get; set; }
}
