namespace KpiApi.Models;

public class Workplan
{
    public int Id { get; set; }
    public string LecturerId { get; set; } = "";
    public AppUser? Lecturer { get; set; }

    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public string Content { get; set; } = ""; // JSON or text
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}