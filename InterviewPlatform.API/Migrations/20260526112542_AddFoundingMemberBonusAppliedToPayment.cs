using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InterviewPlatform.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFoundingMemberBonusAppliedToPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FoundingMemberBonusApplied",
                table: "Payments",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FoundingMemberBonusApplied",
                table: "Payments");
        }
    }
}
