using BlueMoon.API.Data;
using BlueMoon.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Services;

/// <summary>
/// Tạo thông báo trong ứng dụng. Chỉ thêm vào DbContext (không SaveChanges)
/// để thông báo được lưu cùng transaction với thao tác nghiệp vụ gây ra nó.
/// </summary>
public sealed class NotificationService
{
    private readonly AppDbContext _context;

    public NotificationService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Gửi tới mọi nhân viên (Admin + Kế toán) đang hoạt động, trừ người thực hiện.</summary>
    public async Task NotifyStaffAsync(
        int? actorUserId,
        string type,
        string title,
        string message,
        string? link = null,
        string severity = "info")
    {
        var recipients = await _context.Users
            .Where(u => u.IsActive && (u.Role == Roles.Admin || u.Role == Roles.Accountant))
            .Where(u => actorUserId == null || u.Id != actorUserId)
            .Select(u => u.Id)
            .ToListAsync();

        Add(recipients, actorUserId, type, title, message, link, severity);
    }

    /// <summary>Gửi tới các tài khoản cư dân thuộc hộ đang ở căn hộ <paramref name="apartmentId"/>.</summary>
    public async Task<int> NotifyApartmentAsync(
        int apartmentId,
        int? actorUserId,
        string type,
        string title,
        string message,
        string? link = null,
        string severity = "info")
    {
        var recipients = await ResidentUserIds(apartmentId);
        Add(recipients, actorUserId, type, title, message, link, severity);
        return recipients.Count;
    }

    public Task<List<int>> ResidentUserIds(int apartmentId) =>
        _context.Users
            .Where(u => u.IsActive && u.Role == Roles.Resident && u.Household != null &&
                        u.Household.ApartmentId == apartmentId && u.Household.IsActive)
            .Select(u => u.Id)
            .ToListAsync();

    private void Add(
        IEnumerable<int> recipientIds,
        int? actorUserId,
        string type,
        string title,
        string message,
        string? link,
        string severity)
    {
        var now = DateTime.UtcNow;
        foreach (var id in recipientIds.Distinct())
        {
            _context.Notifications.Add(new Notification
            {
                RecipientUserId = id,
                Type = type,
                Severity = severity,
                Title = Truncate(title, 200),
                Message = Truncate(message, 2000),
                Link = link,
                CreatedAt = now,
                CreatedByUserId = actorUserId
            });
        }
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..(max - 1)] + "…";
}
