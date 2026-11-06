using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KpiApi.Migrations.Temp
{
    /// <inheritdoc />
    public partial class AddAssignedAtToKpiAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkplanAssignments_AspNetUsers_AssigneeId",
                table: "WorkplanAssignments");

            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedAt",
                table: "KpiAssignments",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddForeignKey(
                name: "FK_WorkplanAssignments_AspNetUsers_AssigneeId",
                table: "WorkplanAssignments",
                column: "AssigneeId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkplanAssignments_AspNetUsers_AssigneeId",
                table: "WorkplanAssignments");

            migrationBuilder.DropColumn(
                name: "AssignedAt",
                table: "KpiAssignments");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkplanAssignments_AspNetUsers_AssigneeId",
                table: "WorkplanAssignments",
                column: "AssigneeId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
