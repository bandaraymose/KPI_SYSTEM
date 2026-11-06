using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KpiApi.Migrations
{
    /// <inheritdoc />
    public partial class AddStandardWorkplanAndAssignmentModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Departments_DepartmentId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_Evaluations_AspNetUsers_HodId",
                table: "Evaluations");

            migrationBuilder.DropForeignKey(
                name: "FK_Evaluations_Kpis_KpiId",
                table: "Evaluations");

            migrationBuilder.DropForeignKey(
                name: "FK_Kpis_AspNetUsers_CreatedByHodId",
                table: "Kpis");

            migrationBuilder.DropForeignKey(
                name: "FK_Kpis_Departments_DepartmentId",
                table: "Kpis");

            migrationBuilder.DropIndex(
                name: "IX_Kpis_DepartmentId",
                table: "Kpis");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "Kpis");

            migrationBuilder.AlterColumn<decimal>(
                name: "Weight",
                table: "Kpis",
                type: "decimal(5,4)",
                precision: 5,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");

            migrationBuilder.AlterColumn<string>(
                name: "Semester",
                table: "KpiAssignments",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "AcademicYear",
                table: "KpiAssignments",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<decimal>(
                name: "Score",
                table: "Evaluations",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");

            migrationBuilder.AlterColumn<string>(
                name: "HodId",
                table: "Evaluations",
                type: "varchar(255)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Comments",
                table: "Evaluations",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Evaluations",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Departments",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StandardWorkplans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AcademicYear = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Semester = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TargetRole = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TeachingActivities = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ResearchActivities = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ServiceActivities = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AdministrativeActivities = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ProfessionalDevelopment = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Objectives = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExpectedOutcomes = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedById = table.Column<string>(type: "varchar(255)", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StandardWorkplans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StandardWorkplans_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "WorkplanAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    StandardWorkplanId = table.Column<int>(type: "int", nullable: false),
                    AssigneeId = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AssignedById = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AssignedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    AssignmentNotes = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CompletionNotes = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReviewFeedback = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Progress = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkplanAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkplanAssignments_AspNetUsers_AssignedById",
                        column: x => x.AssignedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkplanAssignments_AspNetUsers_AssigneeId",
                        column: x => x.AssigneeId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkplanAssignments_StandardWorkplans_StandardWorkplanId",
                        column: x => x.StandardWorkplanId,
                        principalTable: "StandardWorkplans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Workplans_SubmittedAt",
                table: "Workplans",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_KpiAssignments_KpiId_LecturerId_AcademicYear_Semester",
                table: "KpiAssignments",
                columns: new[] { "KpiId", "LecturerId", "AcademicYear", "Semester" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_EvaluatedAt",
                table: "Evaluations",
                column: "EvaluatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_Name",
                table: "Departments",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StandardWorkplans_AcademicYear_Semester",
                table: "StandardWorkplans",
                columns: new[] { "AcademicYear", "Semester" });

            migrationBuilder.CreateIndex(
                name: "IX_StandardWorkplans_CreatedById",
                table: "StandardWorkplans",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_StandardWorkplans_TargetRole",
                table: "StandardWorkplans",
                column: "TargetRole");

            migrationBuilder.CreateIndex(
                name: "IX_WorkplanAssignments_AssignedAt",
                table: "WorkplanAssignments",
                column: "AssignedAt");

            migrationBuilder.CreateIndex(
                name: "IX_WorkplanAssignments_AssignedById",
                table: "WorkplanAssignments",
                column: "AssignedById");

            migrationBuilder.CreateIndex(
                name: "IX_WorkplanAssignments_AssigneeId",
                table: "WorkplanAssignments",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkplanAssignments_StandardWorkplanId_AssigneeId",
                table: "WorkplanAssignments",
                columns: new[] { "StandardWorkplanId", "AssigneeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkplanAssignments_Status",
                table: "WorkplanAssignments",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Departments_DepartmentId",
                table: "AspNetUsers",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Evaluations_AspNetUsers_HodId",
                table: "Evaluations",
                column: "HodId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Evaluations_Kpis_KpiId",
                table: "Evaluations",
                column: "KpiId",
                principalTable: "Kpis",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Kpis_AspNetUsers_CreatedByHodId",
                table: "Kpis",
                column: "CreatedByHodId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Departments_DepartmentId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_Evaluations_AspNetUsers_HodId",
                table: "Evaluations");

            migrationBuilder.DropForeignKey(
                name: "FK_Evaluations_Kpis_KpiId",
                table: "Evaluations");

            migrationBuilder.DropForeignKey(
                name: "FK_Kpis_AspNetUsers_CreatedByHodId",
                table: "Kpis");

            migrationBuilder.DropTable(
                name: "WorkplanAssignments");

            migrationBuilder.DropTable(
                name: "StandardWorkplans");

            migrationBuilder.DropIndex(
                name: "IX_Workplans_SubmittedAt",
                table: "Workplans");

            migrationBuilder.DropIndex(
                name: "IX_KpiAssignments_KpiId_LecturerId_AcademicYear_Semester",
                table: "KpiAssignments");

            migrationBuilder.DropIndex(
                name: "IX_Evaluations_EvaluatedAt",
                table: "Evaluations");

            migrationBuilder.DropIndex(
                name: "IX_Departments_Name",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Evaluations");

            migrationBuilder.AlterColumn<decimal>(
                name: "Weight",
                table: "Kpis",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,4)",
                oldPrecision: 5,
                oldScale: 4);

            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "Kpis",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Semester",
                table: "KpiAssignments",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "AcademicYear",
                table: "KpiAssignments",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<decimal>(
                name: "Score",
                table: "Evaluations",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,2)",
                oldPrecision: 5,
                oldScale: 2);

            migrationBuilder.UpdateData(
                table: "Evaluations",
                keyColumn: "HodId",
                keyValue: null,
                column: "HodId",
                value: "");

            migrationBuilder.AlterColumn<string>(
                name: "HodId",
                table: "Evaluations",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Comments",
                table: "Evaluations",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(1000)",
                oldMaxLength: 1000,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Departments",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Kpis_DepartmentId",
                table: "Kpis",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Departments_DepartmentId",
                table: "AspNetUsers",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Evaluations_AspNetUsers_HodId",
                table: "Evaluations",
                column: "HodId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Evaluations_Kpis_KpiId",
                table: "Evaluations",
                column: "KpiId",
                principalTable: "Kpis",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Kpis_AspNetUsers_CreatedByHodId",
                table: "Kpis",
                column: "CreatedByHodId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Kpis_Departments_DepartmentId",
                table: "Kpis",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id");
        }
    }
}
