using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using KpiApi.Models;

namespace KpiApi.Data;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Kpi> Kpis => Set<Kpi>();
    public DbSet<KpiAssignment> KpiAssignments => Set<KpiAssignment>();
    public DbSet<Workplan> Workplans => Set<Workplan>();
    public DbSet<Evaluation> Evaluations => Set<Evaluation>();
    public DbSet<StandardWorkplan> StandardWorkplans => Set<StandardWorkplan>();
    public DbSet<WorkplanAssignment> WorkplanAssignments => Set<WorkplanAssignment>();
    // New Area entities
    public DbSet<Area> Areas => Set<Area>();
    public DbSet<AreaEvaluation> AreaEvaluations => Set<AreaEvaluation>();
    public DbSet<AreaEvaluationItem> AreaEvaluationItems => Set<AreaEvaluationItem>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // User -> Department
        builder.Entity<AppUser>()
            .HasOne(u => u.Department)
            .WithMany(d => d.Users)
            .HasForeignKey(u => u.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        // Department unique
        builder.Entity<Department>()
            .HasIndex(d => d.Name)
            .IsUnique();

        // KPI relationships
        builder.Entity<Kpi>()
            .HasOne(k => k.CreatedByHod)
            .WithMany()
            .HasForeignKey(k => k.CreatedByHodId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Kpi>()
            .Property(k => k.Weight)
            .HasPrecision(5, 4);

        // New: KPI belongs to Area
        builder.Entity<Kpi>()
            .HasOne(k => k.Area)
            .WithMany(a => a.Kpis)
            .HasForeignKey(k => k.AreaId)
            .OnDelete(DeleteBehavior.SetNull);

        // KPI Assignments
        builder.Entity<KpiAssignment>()
            .HasOne(ka => ka.Kpi)
            .WithMany()
            .HasForeignKey(ka => ka.KpiId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<KpiAssignment>()
            .HasOne(ka => ka.Lecturer)
            .WithMany()
            .HasForeignKey(ka => ka.LecturerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<KpiAssignment>()
            .HasIndex(ka => new { ka.KpiId, ka.LecturerId, ka.AcademicYear, ka.Semester })
            .IsUnique();

        // Evaluation
        builder.Entity<Evaluation>()
            .HasOne(e => e.Lecturer)
            .WithMany()
            .HasForeignKey(e => e.LecturerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Evaluation>()
            .HasOne(e => e.Hod)
            .WithMany()
            .HasForeignKey(e => e.HodId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Evaluation>()
            .HasOne(e => e.Kpi)
            .WithMany()
            .HasForeignKey(e => e.KpiId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Evaluation>()
            .Property(e => e.Score)
            .HasPrecision(5, 2);

        // Areas
        builder.Entity<Area>()
            .Property(a => a.Weight)
            .HasPrecision(5, 4);

        // Area Evaluation
        builder.Entity<AreaEvaluation>()
            .HasOne(ae => ae.Lecturer)
            .WithMany()
            .HasForeignKey(ae => ae.LecturerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<AreaEvaluation>()
            .HasOne(ae => ae.Hod)
            .WithMany()
            .HasForeignKey(ae => ae.HodId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<AreaEvaluation>()
            .HasOne(ae => ae.Area)
            .WithMany()
            .HasForeignKey(ae => ae.AreaId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<AreaEvaluation>()
            .Property(ae => ae.TotalScore)
            .HasPrecision(6, 2);

        builder.Entity<AreaEvaluationItem>()
            .HasOne(item => item.AreaEvaluation)
            .WithMany(ae => ae.Items)
            .HasForeignKey(item => item.AreaEvaluationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<AreaEvaluationItem>()
            .HasOne(item => item.Kpi)
            .WithMany()
            .HasForeignKey(item => item.KpiId)
            .OnDelete(DeleteBehavior.Restrict);

        // Workplan
        builder.Entity<Workplan>()
            .HasOne(w => w.Lecturer)
            .WithMany()
            .HasForeignKey(w => w.LecturerId)
            .OnDelete(DeleteBehavior.Cascade);

        // Standard Workplan
        builder.Entity<StandardWorkplan>()
            .HasOne(sw => sw.CreatedBy)
            .WithMany()
            .HasForeignKey(sw => sw.CreatedById)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<StandardWorkplan>()
            .HasIndex(sw => sw.TargetRole);

        builder.Entity<StandardWorkplan>()
            .HasIndex(sw => new { sw.AcademicYear, sw.Semester });

        // Workplan Assignment
        builder.Entity<WorkplanAssignment>()
            .HasOne(wa => wa.StandardWorkplan)
            .WithMany(sw => sw.WorkplanAssignments)
            .HasForeignKey(wa => wa.StandardWorkplanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<WorkplanAssignment>()
            .HasOne(wa => wa.Assignee)
            .WithMany()
            .HasForeignKey(wa => wa.AssigneeId)
            .OnDelete(DeleteBehavior.Cascade); // <--- Cascade delete for user

        builder.Entity<WorkplanAssignment>()
            .HasOne(wa => wa.AssignedBy)
            .WithMany()
            .HasForeignKey(wa => wa.AssignedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<WorkplanAssignment>()
            .HasIndex(wa => new { wa.StandardWorkplanId, wa.AssigneeId })
            .IsUnique();

        // Add additional indexes
        builder.Entity<KpiAssignment>().HasIndex(ka => ka.LecturerId);
        builder.Entity<KpiAssignment>().HasIndex(ka => ka.KpiId);
        builder.Entity<Evaluation>().HasIndex(e => e.LecturerId);
        builder.Entity<Evaluation>().HasIndex(e => e.EvaluatedAt);
        builder.Entity<AreaEvaluation>().HasIndex(ae => ae.LecturerId);
        builder.Entity<AreaEvaluation>().HasIndex(ae => ae.EvaluatedAt);
        builder.Entity<Workplan>().HasIndex(w => w.LecturerId);
        builder.Entity<Workplan>().HasIndex(w => w.SubmittedAt);
        builder.Entity<WorkplanAssignment>().HasIndex(wa => wa.AssigneeId);
        builder.Entity<WorkplanAssignment>().HasIndex(wa => wa.AssignedById);
        builder.Entity<WorkplanAssignment>().HasIndex(wa => wa.Status);
        builder.Entity<WorkplanAssignment>().HasIndex(wa => wa.AssignedAt);
    }
}

