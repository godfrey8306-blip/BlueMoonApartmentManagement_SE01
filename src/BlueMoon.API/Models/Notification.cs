namespace BlueMoon.API.Models;

/// <summary>
/// Thông báo trong ứng dụng. Mỗi người nhận một dòng (fan-out) để theo dõi đã đọc riêng.
/// </summary>
public class Notification
{
    public int Id { get; set; }
    public int RecipientUserId { get; set; }

    /// <summary>FeeNotice | Reminder | PaymentReceived | FeeCategory | FeeCollection | FeeCharges | Payment | Account | System</summary>
    public string Type { get; set; } = "System";

    /// <summary>info | success | warning | danger</summary>
    public string Severity { get; set; } = "info";

    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;

    /// <summary>Đường dẫn frontend để mở khi bấm vào thông báo.</summary>
    public string? Link { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
    public int? CreatedByUserId { get; set; }

    public User? Recipient { get; set; }
}
