using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace KpiApi.Models
{
    public class Evaluation
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string LecturerId { get; set; } = "";
        public AppUser? Lecturer { get; set; }

        public string? HodId { get; set; }
        public AppUser? Hod { get; set; }

        [Required]
        public int KpiId { get; set; }
        public Kpi? Kpi { get; set; }

        [Range(0, 100)]
        public decimal Score { get; set; }

        [StringLength(1000)]
        public string? Comments { get; set; }

        // ---------- NEW properties to fix CS0117 ----------
        // Status (e.g. "Pending", "Completed")
        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "Pending";

        // When evaluation was done/updated
        public DateTime EvaluatedAt { get; set; } = DateTime.UtcNow;
    }
}
