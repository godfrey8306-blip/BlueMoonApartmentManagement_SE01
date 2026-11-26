namespace BlueMoon.API.Infrastructure;

/// <summary>
/// Thời gian theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
/// Các trường ngày (DueDate, DateOfBirth…) được lưu là 00:00 UTC của ngày theo lịch VN,
/// nên "hôm nay" cũng được biểu diễn theo cùng quy ước để so sánh.
/// </summary>
public static class VnClock
{
    private static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    /// <summary>Ngày hôm nay theo giờ VN, dạng 00:00 UTC (Kind=Utc).</summary>
    public static DateTime Today => DateTime.SpecifyKind((DateTime.UtcNow + Offset).Date, DateTimeKind.Utc);

    /// <summary>Ngày theo lịch VN của một thời điểm UTC, dạng 00:00 UTC.</summary>
    public static DateTime DateOf(DateTime utc) =>
        DateTime.SpecifyKind((DateTime.SpecifyKind(utc, DateTimeKind.Utc) + Offset).Date, DateTimeKind.Utc);

    /// <summary>Chuẩn hóa một ngày nhập vào (bỏ phần giờ) thành 00:00 UTC.</summary>
    public static DateTime AsDate(DateTime value) => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);

    /// <summary>Ngày cuối cùng của tháng (00:00 UTC).</summary>
    public static DateTime EndOfMonth(int year, int month) =>
        DateTime.SpecifyKind(new DateTime(year, month, DateTime.DaysInMonth(year, month)), DateTimeKind.Utc);

    /// <summary>Khoản có hạn nộp `due` bị quá hạn nếu hôm nay (VN) đã sau ngày hạn.</summary>
    public static bool IsOverdue(DateTime? due, decimal outstanding) =>
        outstanding > 0m && due.HasValue && AsDate(due.Value) < Today;

    public static int DaysOverdue(DateTime? due, decimal outstanding) =>
        IsOverdue(due, outstanding) ? (Today - AsDate(due!.Value)).Days : 0;
}
