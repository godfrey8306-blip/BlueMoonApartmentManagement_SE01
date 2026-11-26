using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace BlueMoon.API.Migrations
{
    /// <inheritdoc />
    public partial class ScaleSearchFeesPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FeeCharges_FeeCollectionId",
                table: "FeeCharges");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "HouseholdId",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SearchName",
                table: "Residents",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "DueDate",
                table: "FeeCollections",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // Backfill: hạn nộp đợt thu = ngày cuối tháng; khoản phải thu chưa có hạn lấy hạn của đợt
            migrationBuilder.Sql("""
                UPDATE "FeeCollections"
                SET "DueDate" = ((make_date("Year", "Month", 1) + interval '1 month' - interval '1 day')::timestamp AT TIME ZONE 'UTC');
                UPDATE "FeeCharges" c
                SET "DueDate" = f."DueDate"
                FROM "FeeCollections" f
                WHERE c."FeeCollectionId" = f."Id" AND c."DueDate" IS NULL;
                UPDATE "Users" SET "CreatedAt" = now() WHERE "CreatedAt" < '0002-01-01';
                """);

            migrationBuilder.CreateTable(
                name: "FeeNotices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FeeCollectionId = table.Column<int>(type: "integer", nullable: false),
                    ApartmentId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OutstandingAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Message = table.Column<string>(type: "text", nullable: true),
                    IssuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IssuedByUserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeeNotices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeeNotices_Apartments_ApartmentId",
                        column: x => x.ApartmentId,
                        principalTable: "Apartments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FeeNotices_FeeCollections_FeeCollectionId",
                        column: x => x.FeeCollectionId,
                        principalTable: "FeeCollections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FeeNotices_Users_IssuedByUserId",
                        column: x => x.IssuedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RecipientUserId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Severity = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Link = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_RecipientUserId",
                        column: x => x.RecipientUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_HouseholdId",
                table: "Users",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_Residents_IdentityNumber",
                table: "Residents",
                column: "IdentityNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Residents_IdentityNumber_trgm",
                table: "Residents",
                column: "IdentityNumber")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Residents_PhoneNumber_trgm",
                table: "Residents",
                column: "PhoneNumber")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Residents_SearchName_trgm",
                table: "Residents",
                column: "SearchName")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Residents_Status",
                table: "Residents",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaymentDate",
                table: "Payments",
                column: "PaymentDate");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ReceiptNumber_trgm",
                table: "Payments",
                column: "ReceiptNumber")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Households_HouseholdCode_trgm",
                table: "Households",
                column: "HouseholdCode")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_FeeCharges_DueDate",
                table: "FeeCharges",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_FeeCharges_FeeCollectionId_ApartmentId_FeeCategoryId",
                table: "FeeCharges",
                columns: new[] { "FeeCollectionId", "ApartmentId", "FeeCategoryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeeCharges_Status",
                table: "FeeCharges",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Apartments_ApartmentCode_trgm",
                table: "Apartments",
                column: "ApartmentCode")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Apartments_Building",
                table: "Apartments",
                column: "Building");

            migrationBuilder.CreateIndex(
                name: "IX_FeeNotices_ApartmentId",
                table: "FeeNotices",
                column: "ApartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_FeeNotices_FeeCollectionId_ApartmentId_Type",
                table: "FeeNotices",
                columns: new[] { "FeeCollectionId", "ApartmentId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_FeeNotices_IssuedByUserId",
                table: "FeeNotices",
                column: "IssuedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_RecipientUserId_ReadAt_CreatedAt",
                table: "Notifications",
                columns: new[] { "RecipientUserId", "ReadAt", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Households_HouseholdId",
                table: "Users",
                column: "HouseholdId",
                principalTable: "Households",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Households_HouseholdId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "FeeNotices");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Users_HouseholdId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Residents_IdentityNumber",
                table: "Residents");

            migrationBuilder.DropIndex(
                name: "IX_Residents_IdentityNumber_trgm",
                table: "Residents");

            migrationBuilder.DropIndex(
                name: "IX_Residents_PhoneNumber_trgm",
                table: "Residents");

            migrationBuilder.DropIndex(
                name: "IX_Residents_SearchName_trgm",
                table: "Residents");

            migrationBuilder.DropIndex(
                name: "IX_Residents_Status",
                table: "Residents");

            migrationBuilder.DropIndex(
                name: "IX_Payments_PaymentDate",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ReceiptNumber_trgm",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Households_HouseholdCode_trgm",
                table: "Households");

            migrationBuilder.DropIndex(
                name: "IX_FeeCharges_DueDate",
                table: "FeeCharges");

            migrationBuilder.DropIndex(
                name: "IX_FeeCharges_FeeCollectionId_ApartmentId_FeeCategoryId",
                table: "FeeCharges");

            migrationBuilder.DropIndex(
                name: "IX_FeeCharges_Status",
                table: "FeeCharges");

            migrationBuilder.DropIndex(
                name: "IX_Apartments_ApartmentCode_trgm",
                table: "Apartments");

            migrationBuilder.DropIndex(
                name: "IX_Apartments_Building",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "HouseholdId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SearchName",
                table: "Residents");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "FeeCollections");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.CreateIndex(
                name: "IX_FeeCharges_FeeCollectionId",
                table: "FeeCharges",
                column: "FeeCollectionId");
        }
    }
}
