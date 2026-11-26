using BlueMoon.API.Infrastructure;

namespace BlueMoon.API.DTOs;

// ── Thống kê mở rộng ─────────────────────────────────────────

public sealed class RevenueBucketDto
{
    /// <summary>VD: "2026-11", "2026-Q4", "2026".</summary>
    public string Period { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public int PaymentCount { get; init; }
    public IReadOnlyCollection<RevenueByCategoryDto> Categories { get; init; } = [];
}

public sealed class RevenueByCategoryDto
{
    public int FeeCategoryId { get; init; }
    public string FeeCategoryName { get; init; } = string.Empty;
    public decimal Amount { get; init; }
}

public sealed class RevenueReportDto
{
    public string GroupBy { get; init; } = "month";
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    public decimal TotalAmount { get; init; }
    public int PaymentCount { get; init; }
    public IReadOnlyCollection<RevenueBucketDto> Buckets { get; init; } = [];
}

public sealed class AgingBucketDto
{
    public string Key { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public int ChargeCount { get; init; }
    public int ApartmentCount { get; init; }
    public decimal Amount { get; init; }
}

public sealed class OverdueApartmentDto
{
    public int ApartmentId { get; init; }
    public string ApartmentCode { get; init; } = string.Empty;
    public string Building { get; init; } = string.Empty;
    public string? HouseholdCode { get; init; }
    public string? HeadOfHousehold { get; init; }
    public string? PhoneNumber { get; init; }
    public int ChargeCount { get; init; }
    public decimal OverdueAmount { get; init; }
    public int MaxDaysOverdue { get; init; }
    public DateTime? LastReminderAt { get; init; }
}

public sealed class AgingReportDto
{
    public decimal TotalOutstanding { get; init; }
    public decimal OverdueAmount { get; init; }
    public int OverdueApartmentCount { get; init; }
    public IReadOnlyCollection<AgingBucketDto> Buckets { get; init; } = [];
    public IReadOnlyCollection<OverdueApartmentDto> Apartments { get; init; } = [];
}

// ── Tìm kiếm toàn cục & lookup ───────────────────────────────

public sealed class LookupItemDto
{
    public int Id { get; init; }
    public string Label { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int? ApartmentId { get; init; }
    public int? HouseholdId { get; init; }
}

public sealed class GlobalSearchItemDto
{
    /// <summary>apartment | household | resident | payment</summary>
    public string Type { get; init; } = string.Empty;
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Subtitle { get; init; }
    public string Link { get; init; } = string.Empty;
}

// ── Thông báo ────────────────────────────────────────────────

public sealed class NotificationDto
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Severity { get; init; } = "info";
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? Link { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ReadAt { get; init; }
    public bool IsRead => ReadAt.HasValue;
}

public sealed class StaffAlertsDto
{
    public int OverdueChargeCount { get; init; }
    public decimal OverdueAmount { get; init; }
    public int OverdueApartmentCount { get; init; }
    public int DueSoonChargeCount { get; init; }
    public decimal DueSoonAmount { get; init; }
    public IReadOnlyCollection<AlertCollectionDto> OpenCollectionsWithoutNotice { get; init; } = [];
    public IReadOnlyCollection<AlertCollectionDto> OpenCollectionsPastDue { get; init; } = [];
}

public sealed class AlertCollectionDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public DateTime DueDate { get; init; }
    public int ChargeCount { get; init; }
    public decimal OutstandingAmount { get; init; }
}

// ── Giấy báo phí ─────────────────────────────────────────────

public sealed class IssueNoticesRequestDto
{
    public string? Message { get; set; }

    /// <summary>true → phát hành lại cả cho căn đã có giấy báo.</summary>
    public bool Reissue { get; set; }
}

public sealed class FeeNoticeDto
{
    public int Id { get; init; }
    public string Type { get; init; } = "Notice";
    public int FeeCollectionId { get; init; }
    public string FeeCollectionName { get; init; } = string.Empty;
    public int Month { get; init; }
    public int Year { get; init; }
    public int ApartmentId { get; init; }
    public string ApartmentCode { get; init; } = string.Empty;
    public string Building { get; init; } = string.Empty;
    public string? HouseholdCode { get; init; }
    public string? HeadOfHousehold { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal OutstandingAmount { get; init; }
    public DateTime DueDate { get; init; }
    public string? Message { get; init; }
    public DateTime IssuedAt { get; init; }
    public string IssuedByUsername { get; init; } = string.Empty;
    public IReadOnlyCollection<FeeNoticeLineDto> Lines { get; init; } = [];
    public bool IsOverdue => VnClock.IsOverdue(DueDate, OutstandingAmount);
}

public sealed class FeeNoticeLineDto
{
    public string FeeCategoryName { get; init; } = string.Empty;
    public string Unit { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Amount { get; init; }
    public decimal PaidAmount { get; init; }
}

public sealed class IssueResultDto
{
    public int NoticeCount { get; init; }
    public int SkippedCount { get; init; }
    public int NotifiedAccountCount { get; init; }
    public decimal TotalAmount { get; init; }
}

// ── Cổng cư dân ──────────────────────────────────────────────

public sealed class PortalSummaryDto
{
    public int HouseholdId { get; init; }
    public string HouseholdCode { get; init; } = string.Empty;
    public int ApartmentId { get; init; }
    public string ApartmentCode { get; init; } = string.Empty;
    public string Building { get; init; } = string.Empty;
    public decimal OutstandingAmount { get; init; }
    public decimal OverdueAmount { get; init; }
    public int OverdueChargeCount { get; init; }
    public int UnpaidChargeCount { get; init; }
    public DateTime? NextDueDate { get; init; }
    public decimal NextDueAmount { get; init; }
    public decimal PaidThisYear { get; init; }
    public int UnreadNotificationCount { get; init; }
}

public sealed class PortalHouseholdDto
{
    public int Id { get; init; }
    public string HouseholdCode { get; init; } = string.Empty;
    public string ApartmentCode { get; init; } = string.Empty;
    public string Building { get; init; } = string.Empty;
    public int Floor { get; init; }
    public decimal Area { get; init; }
    public DateTime CreatedAt { get; init; }
    public IReadOnlyCollection<PortalMemberDto> Members { get; init; } = [];
}

public sealed class PortalMemberDto
{
    public int Id { get; init; }
    public string FullName { get; init; } = string.Empty;
    public DateTime? DateOfBirth { get; init; }
    public string Gender { get; init; } = string.Empty;
    public string Relationship { get; init; } = string.Empty;
    public bool IsHouseholdHead { get; init; }
    public string Status { get; init; } = string.Empty;
}
