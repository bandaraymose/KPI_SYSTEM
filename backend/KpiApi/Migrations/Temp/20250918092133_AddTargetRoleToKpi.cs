using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KpiApi.Migrations.Temp
{
    /// <inheritdoc />
    public partial class AddTargetRoleToKpi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TargetRole",
                table: "Kpis",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TargetRole",
                table: "Kpis");
        }
    }
}
