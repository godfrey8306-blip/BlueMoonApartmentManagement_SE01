using System.ComponentModel.DataAnnotations;

namespace BlueMoon.API.DTOs;

public sealed class FeeCollectionCreateDto
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 12)]
    public int Month { get; set; }

    [Range(2000, 2100)]
    public int Year { get; set; }

    /// <summary>Hạn nộp. Bỏ trống → ngày cuối của tháng thu.</summary>
    public DateTime? DueDate { get; set; }
}

public sealed class FeeCollectionUpdateDto
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 12)]
    public int Month { get; set; }

    [Range(2000, 2100)]
    public int Year { get; set; }

    [Required]
    [RegularExpression("^(Open|Closed|Cancelled)$",
        ErrorMessage = "Status must be Open, Closed, or Cancelled.")]
    public string Status { get; set; } = "Open";

    /// <summary>Đổi hạn nộp; các khoản phải thu đang dùng hạn cũ của đợt sẽ được cập nhật theo.</summary>
    public DateTime? DueDate { get; set; }
}

public sealed class FeeCollectionStatusDto
{
    [Required]
    [RegularExpression("^(Open|Closed|Cancelled)$",
        ErrorMessage = "Status must be Open, Closed, or Cancelled.")]
    public string Status { get; set; } = string.Empty;
}

public sealed class FeeCollectionResponseDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int Month { get; init; }
    public int Year { get; init; }
    public DateTime CreatedAt { get; init; }
    public int CreatedByUserId { get; init; }
    public string CreatedByUsername { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime DueDate { get; init; }
    public int ChargeCount { get; init; }
    public int NoticeCount { get; init; }
}
