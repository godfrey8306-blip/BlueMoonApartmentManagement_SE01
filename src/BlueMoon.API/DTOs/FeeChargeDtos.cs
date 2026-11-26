using BlueMoon.API.Infrastructure;
using System.ComponentModel.DataAnnotations;

namespace BlueMoon.API.DTOs;

public sealed class FeeChargeCreateDto
{
    [Range(1, int.MaxValue)]
    public int FeeCollectionId { get; set; }

    [Range(1, int.MaxValue)]
    public int ApartmentId { get; set; }

    [Range(1, int.MaxValue)]
    public int FeeCategoryId { get; set; }

    [Range(typeof(decimal), "0.01", "1000000000000", ParseLimitsInInvariantCulture = true)]
    public decimal Quantity { get; set; }

    public DateTime? DueDate { get; set; }
}

public sealed class FeeChargeUpdateDto
{
    [Range(typeof(decimal), "0.01", "1000000000000", ParseLimitsInInvariantCulture = true)]
    public decimal Quantity { get; set; }

    public DateTime? DueDate { get; set; }
}

public sealed class FeeChargeResponseDto
{
    public int Id { get; init; }
    public int FeeCollectionId { get; init; }
    public string FeeCollectionName { get; init; } = string.Empty;
    public int FeeCollectionMonth { get; init; }
    public int FeeCollectionYear { get; init; }
    public string FeeCollectionStatus { get; init; } = string.Empty;
    public int ApartmentId { get; init; }
    public string ApartmentCode { get; init; } = string.Empty;
    public string ApartmentBuilding { get; init; } = string.Empty;
    public int FeeCategoryId { get; init; }
    public string FeeCategoryName { get; init; } = string.Empty;
    public string FeeCategoryUnit { get; init; } = string.Empty;
    public string CalculationMethod { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public decimal OutstandingAmount { get; init; }
    public DateTime? DueDate { get; init; }
    public string Status { get; init; } = string.Empty;

    public bool IsOverdue => VnClock.IsOverdue(DueDate, OutstandingAmount);
    public int DaysOverdue => VnClock.DaysOverdue(DueDate, OutstandingAmount);

    /// <summary>Còn nợ và đến hạn trong 7 ngày tới.</summary>
    public bool IsDueSoon => OutstandingAmount > 0m && DueDate.HasValue &&
                             VnClock.AsDate(DueDate.Value) >= VnClock.Today &&
                             VnClock.AsDate(DueDate.Value) <= VnClock.Today.AddDays(7);
}

public sealed class FeeChargeDebtSummaryDto
{
    public int ApartmentId { get; init; }
    public string ApartmentCode { get; init; } = string.Empty;
    public int? FeeCollectionId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public decimal OutstandingAmount { get; init; }
    public int ChargeCount { get; init; }
    public IReadOnlyCollection<FeeChargeResponseDto> Charges { get; init; } = [];
}

public sealed class FeeChargeGenerateDto
{
    [Range(1, int.MaxValue)]
    public int FeeCollectionId { get; set; }

    [Range(1, int.MaxValue)]
    public int FeeCategoryId { get; set; }

    /// <summary>auto: theo cách tính của khoản thu (PerArea → diện tích, PerResident → số nhân khẩu, khác → 1); fixed: dùng FixedQuantity.</summary>
    [RegularExpression("^(auto|fixed)$")]
    public string Mode { get; set; } = "auto";

    [Range(typeof(decimal), "0.01", "1000000000000", ParseLimitsInInvariantCulture = true)]
    public decimal? FixedQuantity { get; set; }

    /// <summary>Chỉ căn hộ đang có hộ gia đình hoạt động.</summary>
    public bool OnlyOccupied { get; set; } = true;

    /// <summary>Hạn nộp riêng; bỏ trống → hạn của đợt thu.</summary>
    public DateTime? DueDate { get; set; }

    /// <summary>true → chỉ tính toán, không ghi.</summary>
    public bool Preview { get; set; }
}

public sealed class FeeChargeGenerateRowDto
{
    public int ApartmentId { get; init; }
    public string ApartmentCode { get; init; } = string.Empty;
    public string Building { get; init; } = string.Empty;
    public string? HouseholdCode { get; init; }
    public string? HeadOfHousehold { get; init; }
    public decimal Quantity { get; init; }
    public decimal Amount { get; init; }
    public bool Exists { get; init; }
}

public sealed class FeeChargeGenerateResultDto
{
    public bool Preview { get; init; }
    public int ApartmentCount { get; init; }
    public int ExistingCount { get; init; }
    public int CreatedCount { get; init; }
    public decimal TotalAmount { get; init; }
    public DateTime DueDate { get; init; }
    public IReadOnlyCollection<FeeChargeGenerateRowDto> Rows { get; init; } = [];
}

public sealed class ReminderRequestDto
{
    /// <summary>Bỏ trống → nhắc tất cả căn hộ đang có khoản quá hạn.</summary>
    public List<int>? ApartmentIds { get; set; }

    [StringLength(1000)]
    public string? Message { get; set; }
}
