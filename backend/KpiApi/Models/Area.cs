using System.Text.Json.Serialization;

namespace KpiApi.Models;

public class Area
{
    public int Id { get; set; }
    public string Name { get; set; } = ""; // e.g., Teaching, Research, Service
    public decimal Weight { get; set; } // 0..1 weight applied to sum of KPI scores

    // Optional: which role the area applies to (Dean/HOD/Lecturer)
    public string TargetRole { get; set; } = "";

    // Navigation
    [JsonIgnore]
    public ICollection<Kpi> Kpis { get; set; } = new List<Kpi>();
}
