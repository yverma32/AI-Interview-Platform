using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InterviewPlatform.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFoundingMember : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFoundingMember",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsFoundingMember",
                table: "Users");
        }
    }
}
