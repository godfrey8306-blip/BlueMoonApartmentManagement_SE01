namespace BlueMoon.API.Models;

public class FeeCollection
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Month { get; set; }
    public int Year { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedByUserId { get; set; }
    public string Status { get; set; } = "Open";

    /// <summary>Hạn nộp mặc định của đợt (00:00 UTC theo ngày VN). Khoản phải thu không đặt hạn riêng sẽ dùng hạn này.</summary>
    public DateTime DueDate { get; set; }

    public ICollection<FeeCharge> FeeCharges { get; set; } = new List<FeeCharge>();
}