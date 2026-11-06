using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KpiApi.Migrations.Temp
{
    /// <inheritdoc />
    public partial class fixdash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Target",
                table: "Kpis",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Target",
                table: "Kpis");
        }
    }
}
