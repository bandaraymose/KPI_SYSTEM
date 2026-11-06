using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KpiApi.Migrations.Manual
{
    /// <inheritdoc />
    public partial class AddIsSelfEvaluationToAreaEvaluations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSelfEvaluation",
                table: "AreaEvaluations",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSelfEvaluation",
                table: "AreaEvaluations");
        }
    }
}
