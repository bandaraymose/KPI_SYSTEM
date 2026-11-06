using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace KpiApi.Models
{
    public class Department
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = "";

        
        public ICollection<AppUser> Users { get; set; } = new HashSet<AppUser>();
    }
}
