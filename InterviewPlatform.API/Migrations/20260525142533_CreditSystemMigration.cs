using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InterviewPlatform.API.Migrations
{
    /// <inheritdoc />
    public partial class CreditSystemMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Plan",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PlanExpiresAt",
                table: "Users");

            migrationBuilder.RenameColumn(
                name: "PlanId",
                table: "Payments",
                newName: "PackId");

            migrationBuilder.AddColumn<int>(
                name: "BasicCreditsBalance",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PremiumCreditsBalance",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BasicCreditsAdded",
                table: "Payments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PremiumCreditsAdded",
                table: "Payments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CreditsConsumed",
                table: "InterviewSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "InterviewMode",
                table: "InterviewSessions",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BasicCreditsBalance",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PremiumCreditsBalance",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BasicCreditsAdded",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "PremiumCreditsAdded",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "CreditsConsumed",
                table: "InterviewSessions");

            migrationBuilder.DropColumn(
                name: "InterviewMode",
                table: "InterviewSessions");

            migrationBuilder.RenameColumn(
                name: "PackId",
                table: "Payments",
                newName: "PlanId");

            migrationBuilder.AddColumn<string>(
                name: "Plan",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PlanExpiresAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
