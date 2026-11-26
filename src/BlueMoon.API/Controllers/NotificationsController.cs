using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>Thông báo trong ứng dụng — mọi vai trò, chỉ thấy thông báo của chính mình.</summary>
[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificationDto>>> GetMine(
        [FromQuery] bool? unreadOnly,
        [FromQuery] string? type,
        [FromQuery] PageQuery paging)
    {
        var userId = User.GetUserId();
        if (userId is null)
            return Unauthorized();

        var query = _context.Notifications.AsNoTracking().Where(n => n.RecipientUserId == userId);
        if (unreadOnly == true)
            query = query.Where(n => n.ReadAt == null);
        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(n => n.Type == type.Trim());

        var result = query
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.Id)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Type = n.Type,
                Severity = n.Severity,
                Title = n.Title,
                Message = n.Message,
                Link = n.Link,
                CreatedAt = n.CreatedAt,
                ReadAt = n.ReadAt
            });

        paging.Page ??= 1;
        paging.PageSize ??= 20;
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<object>> UnreadCount()
    {
        var userId = User.GetUserId();
        if (userId is null)
            return Unauthorized();

        var count = await _context.Notifications.CountAsync(n => n.RecipientUserId == userId && n.ReadAt == null);
        return Ok(new { count });
    }

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var userId = User.GetUserId();
        var updated = await _context.Notifications
            .Where(n => n.Id == id && n.RecipientUserId == userId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        return updated == 0 && !await _context.Notifications.AnyAsync(n => n.Id == id && n.RecipientUserId == userId)
            ? NotFound()
            : NoContent();
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<object>> MarkAllRead()
    {
        var userId = User.GetUserId();
        var updated = await _context.Notifications
            .Where(n => n.RecipientUserId == userId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        return Ok(new { updated });
    }

    /// <summary>Cảnh báo tính sẵn cho nhân viên: quá hạn, sắp đến hạn, đợt thu chưa phát hành giấy báo.</summary>
    [Authorize(Roles = Roles.Staff)]
    [HttpGet("alerts")]
    public async Task<ActionResult<StaffAlertsDto>> Alerts()
    {
        var today = VnClock.Today;
        var soon = today.AddDays(7);

        var outstanding = _context.FeeCharges.AsNoTracking()
            .Where(c => c.Amount > c.PaidAmount && c.DueDate != null && c.FeeCollection!.Status != "Cancelled");

        var overdue = await outstanding
            .Where(c => c.DueDate < today)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Amount = g.Sum(c => c.Amount - c.PaidAmount),
                Apartments = g.Select(c => c.ApartmentId).Distinct().Count()
            })
            .FirstOrDefaultAsync();

        var dueSoon = await outstanding
            .Where(c => c.DueDate >= today && c.DueDate <= soon)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Amount = g.Sum(c => c.Amount - c.PaidAmount) })
            .FirstOrDefaultAsync();

        var openCollections = await _context.FeeCollections.AsNoTracking()
            .Where(c => c.Status == "Open")
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.DueDate,
                ChargeCount = c.FeeCharges.Count,
                Outstanding = c.FeeCharges.Sum(f => (decimal?)(f.Amount - f.PaidAmount)) ?? 0m,
                NoticeCount = _context.FeeNotices.Count(n => n.FeeCollectionId == c.Id && n.Type == "Notice")
            })
            .ToListAsync();

        return Ok(new StaffAlertsDto
        {
            OverdueChargeCount = overdue?.Count ?? 0,
            OverdueAmount = overdue?.Amount ?? 0m,
            OverdueApartmentCount = overdue?.Apartments ?? 0,
            DueSoonChargeCount = dueSoon?.Count ?? 0,
            DueSoonAmount = dueSoon?.Amount ?? 0m,
            OpenCollectionsWithoutNotice = openCollections
                .Where(c => c.ChargeCount > 0 && c.NoticeCount == 0)
                .Select(c => new AlertCollectionDto
                {
                    Id = c.Id, Name = c.Name, DueDate = c.DueDate, ChargeCount = c.ChargeCount, OutstandingAmount = c.Outstanding
                })
                .ToList(),
            OpenCollectionsPastDue = openCollections
                .Where(c => c.DueDate < today && c.Outstanding > 0)
                .Select(c => new AlertCollectionDto
                {
                    Id = c.Id, Name = c.Name, DueDate = c.DueDate, ChargeCount = c.ChargeCount, OutstandingAmount = c.Outstanding
                })
                .ToList()
        });
    }
}
