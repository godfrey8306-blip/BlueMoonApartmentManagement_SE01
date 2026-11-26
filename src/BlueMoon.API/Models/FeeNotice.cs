namespace BlueMoon.API.Models;

/// <summary>
/// Giấy báo thu phí (PBI-012) hoặc giấy nhắc nợ gửi tới một căn hộ cho một đợt thu.
/// Lưu lại số tiền và hạn nộp tại thời điểm phát hành.
/// </summary>
public class FeeNotice
{
    public int Id { get; set; }
    public int FeeCollectionId { get; set; }
    public int ApartmentId { get; set; }

    /// <summary>Notice (giấy báo phí) | Reminder (nhắc nợ quá hạn)</summary>
    public string Type { get; set; } = "Notice";

    public decimal TotalAmount { get; set; }
    public decimal OutstandingAmount { get; set; }
    public DateTime DueDate { get; set; }
    public string? Message { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public int IssuedByUserId { get; set; }

    public FeeCollection? FeeCollection { get; set; }
    public Apartment? Apartment { get; set; }
}
