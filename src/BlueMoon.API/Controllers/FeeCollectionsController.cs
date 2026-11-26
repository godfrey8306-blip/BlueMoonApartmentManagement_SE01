using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using BlueMoon.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>Đợt thu theo kỳ (US-006) + phát hành giấy báo phí (PBI-012). Ban quản trị và Kế toán.</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/[controller]")]
public sealed class FeeCollectionsController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["Open", "Closed", "Cancelled"];
    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public FeeCollectionsController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FeeCollectionResponseDto>>> GetAll(
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] string? status)
    {
        var query = _context.FeeCollections.AsNoTracking();
        if (month.HasValue)
            query = query.Where(c => c.Month == month.Value);
        if (year.HasValue)
            query = query.Where(c => c.Year == year.Value);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(c => c.Status == status.Trim());

        return Ok(await Project(query)
            .OrderByDescending(c => c.Year)
            .ThenByDescending(c => c.Month)
            .ThenBy(c => c.Name)
            .ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FeeCollectionResponseDto>> GetById(int id)
    {
        var collection = await Project(_context.FeeCollections.AsNoTracking().Where(c => c.Id == id)).FirstOrDefaultAsync();
        return collection is null ? NotFound() : Ok(collection);
    }

    [HttpPost]
    public async Task<ActionResult<FeeCollectionResponseDto>> Create(FeeCollectionCreateDto dto)
    {
        var creatorId = await GetActiveStaffId();
        if (!creatorId.HasValue)
            return Unauthorized(new { message = "Authenticated active staff user is required." });

        if (await HasDuplicatePeriod(dto.Month, dto.Year))
            return Conflict(new { message = "A fee collection already exists for this month and year." });

        var dueDate = dto.DueDate.HasValue ? VnClock.AsDate(dto.DueDate.Value) : VnClock.EndOfMonth(dto.Year, dto.Month);
        var collection = new FeeCollection
        {
            Name = dto.Name.Trim(),
            Month = dto.Month,
            Year = dto.Year,
            DueDate = dueDate,
            CreatedByUserId = creatorId.Value,
            Status = "Open"
        };

        _context.FeeCollections.Add(collection);
        await _notifications.NotifyStaffAsync(creatorId, "FeeCollection",
            $"Mở đợt thu: {collection.Name}",
            $"{User.Identity?.Name} đã tạo đợt thu {collection.Month:00}/{collection.Year}, hạn nộp {dueDate:dd/MM/yyyy}.",
            "/fee-collections");
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The fee collection could not be saved." });
        }

        var response = await Project(_context.FeeCollections.AsNoTracking().Where(c => c.Id == collection.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = collection.Id }, response);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, FeeCollectionUpdateDto dto)
    {
        var collection = await _context.FeeCollections.FirstOrDefaultAsync(c => c.Id == id);
        if (collection is null)
            return NotFound();

        if (await HasDuplicatePeriod(dto.Month, dto.Year, id))
            return Conflict(new { message = "A fee collection already exists for this month and year." });

        var hasCharges = await _context.FeeCharges.AnyAsync(c => c.FeeCollectionId == id);
        if (hasCharges && (collection.Month != dto.Month || collection.Year != dto.Year))
            return Conflict(new { message = "The period cannot be changed after fee charges have been created." });

        var statusError = await ValidateStatusChange(collection, dto.Status);
        if (statusError is not null)
            return Conflict(new { message = statusError });

        if (dto.DueDate.HasValue)
        {
            var newDue = VnClock.AsDate(dto.DueDate.Value);
            if (newDue != collection.DueDate)
            {
                // Các khoản đang dùng hạn mặc định của đợt sẽ đi theo hạn mới
                var oldDue = collection.DueDate;
                await _context.FeeCharges
                    .Where(c => c.FeeCollectionId == id && c.DueDate == oldDue)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.DueDate, newDue));
                collection.DueDate = newDue;
                await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCollection",
                    $"Đổi hạn nộp: {collection.Name}",
                    $"{User.Identity?.Name} đã đổi hạn nộp từ {oldDue:dd/MM/yyyy} thành {newDue:dd/MM/yyyy}.",
                    "/fee-collections", "warning");
            }
        }

        var oldStatus = collection.Status;
        collection.Name = dto.Name.Trim();
        collection.Month = dto.Month;
        collection.Year = dto.Year;
        collection.Status = dto.Status;
        if (oldStatus != dto.Status)
            await NotifyStatusChange(collection, oldStatus);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The fee collection could not be updated." });
        }

        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, FeeCollectionStatusDto dto)
    {
        var collection = await _context.FeeCollections.FirstOrDefaultAsync(c => c.Id == id);
        if (collection is null)
            return NotFound();

        var statusError = await ValidateStatusChange(collection, dto.Status);
        if (statusError is not null)
            return Conflict(new { message = statusError });

        var oldStatus = collection.Status;
        collection.Status = dto.Status;
        if (oldStatus != dto.Status)
            await NotifyStatusChange(collection, oldStatus);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var collection = await _context.FeeCollections.FirstOrDefaultAsync(c => c.Id == id);
        if (collection is null)
            return NotFound();

        if (await _context.FeeCharges.AnyAsync(c => c.FeeCollectionId == id))
            return Conflict(new { message = "Cannot delete a fee collection referenced by fee charges." });
        if (await _context.FeeNotices.AnyAsync(n => n.FeeCollectionId == id))
            return Conflict(new { message = "Không thể xóa đợt thu đã phát hành giấy báo phí." });

        _context.FeeCollections.Remove(collection);
        await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCollection",
            $"Đã xóa đợt thu: {collection.Name}", $"{User.Identity?.Name} đã xóa đợt thu {collection.Month:00}/{collection.Year}.",
            "/fee-collections", "danger");
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Cannot delete the fee collection because related data exists." });
        }

        return NoContent();
    }

    // ── Giấy báo phí (PBI-012) ───────────────────────────────

    /// <summary>
    /// Phát hành giấy báo phí cho mọi căn hộ có khoản phải thu trong đợt.
    /// Mỗi căn một FeeNotice; tài khoản cư dân của căn nhận thông báo trong cổng cư dân.
    /// </summary>
    [HttpPost("{id:int}/notices")]
    public async Task<ActionResult<IssueResultDto>> IssueNotices(int id, IssueNoticesRequestDto? dto)
    {
        var issuerId = await GetActiveStaffId();
        if (!issuerId.HasValue)
            return Unauthorized();

        var collection = await _context.FeeCollections.FirstOrDefaultAsync(c => c.Id == id);
        if (collection is null)
            return NotFound(new { message = "Fee collection not found." });
        if (collection.Status == "Cancelled")
            return Conflict(new { message = "Đợt thu đã hủy, không thể phát hành giấy báo." });

        var perApartment = await _context.FeeCharges
            .Where(c => c.FeeCollectionId == id)
            .GroupBy(c => c.ApartmentId)
            .Select(g => new
            {
                ApartmentId = g.Key,
                Total = g.Sum(c => c.Amount),
                Outstanding = g.Sum(c => c.Amount - c.PaidAmount),
                DueDate = g.Max(c => c.DueDate)
            })
            .ToListAsync();
        if (perApartment.Count == 0)
            return Conflict(new { message = "Đợt thu chưa có khoản phải thu nào để phát hành giấy báo." });

        var alreadyIssued = dto?.Reissue == true
            ? new HashSet<int>()
            : (await _context.FeeNotices
                .Where(n => n.FeeCollectionId == id && n.Type == "Notice")
                .Select(n => n.ApartmentId)
                .ToListAsync()).ToHashSet();

        var issued = 0;
        var notified = 0;
        decimal total = 0;
        foreach (var row in perApartment.Where(r => !alreadyIssued.Contains(r.ApartmentId)))
        {
            var due = row.DueDate ?? collection.DueDate;
            _context.FeeNotices.Add(new FeeNotice
            {
                FeeCollectionId = id,
                ApartmentId = row.ApartmentId,
                Type = "Notice",
                TotalAmount = row.Total,
                OutstandingAmount = row.Outstanding,
                DueDate = due,
                Message = string.IsNullOrWhiteSpace(dto?.Message) ? null : dto!.Message!.Trim(),
                IssuedByUserId = issuerId.Value
            });
            notified += await _notifications.NotifyApartmentAsync(row.ApartmentId, issuerId, "FeeNotice",
                $"Giấy báo phí {collection.Month:00}/{collection.Year}",
                $"Số tiền phải nộp kỳ {collection.Month:00}/{collection.Year}: {row.Total:N0} đ" +
                (row.Outstanding < row.Total ? $" (còn {row.Outstanding:N0} đ)" : string.Empty) +
                $". Hạn nộp: {due:dd/MM/yyyy}." +
                (string.IsNullOrWhiteSpace(dto?.Message) ? string.Empty : $" {dto!.Message!.Trim()}"),
                "/portal/notices", "warning");
            issued++;
            total += row.Total;
        }

        if (issued > 0)
        {
            await _notifications.NotifyStaffAsync(issuerId, "FeeNotice",
                $"Đã phát hành giấy báo phí: {collection.Name}",
                $"{User.Identity?.Name} đã phát hành {issued} giấy báo phí, tổng {total:N0} đ.",
                $"/fee-collections/{id}/notices");
        }
        await _context.SaveChangesAsync();

        return Ok(new IssueResultDto
        {
            NoticeCount = issued,
            SkippedCount = perApartment.Count - issued,
            NotifiedAccountCount = notified,
            TotalAmount = total
        });
    }

    /// <summary>Danh sách giấy báo (kèm chi tiết từng khoản) để xem / in.</summary>
    [HttpGet("{id:int}/notices")]
    public async Task<ActionResult<IEnumerable<FeeNoticeDto>>> GetNotices(
        int id,
        [FromQuery] string? type,
        [FromQuery] string? building,
        [FromQuery] string? q)
    {
        if (!await _context.FeeCollections.AnyAsync(c => c.Id == id))
            return NotFound(new { message = "Fee collection not found." });

        return Ok(await FeeNoticeQueries.Load(_context, n => n.FeeCollectionId == id, type, building, q));
    }

    private async Task<string?> ValidateStatusChange(FeeCollection collection, string newStatus)
    {
        if (!ValidStatuses.Contains(newStatus))
            return "Status must be Open, Closed, or Cancelled.";
        if (newStatus == "Cancelled" && collection.Status != "Cancelled" &&
            await _context.PaymentDetails.AnyAsync(d => d.FeeCharge!.FeeCollectionId == collection.Id))
            return "Không thể hủy đợt thu đã có thanh toán. Hãy đóng đợt thu thay vì hủy.";
        return null;
    }

    private async Task NotifyStatusChange(FeeCollection collection, string oldStatus)
    {
        var (title, severity) = collection.Status switch
        {
            "Closed" => ($"Đã đóng đợt thu: {collection.Name}", "info"),
            "Cancelled" => ($"Đã hủy đợt thu: {collection.Name}", "danger"),
            _ => ($"Mở lại đợt thu: {collection.Name}", "warning")
        };
        var outstanding = await _context.FeeCharges
            .Where(c => c.FeeCollectionId == collection.Id)
            .SumAsync(c => (decimal?)(c.Amount - c.PaidAmount)) ?? 0m;
        await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCollection", title,
            $"{User.Identity?.Name} đã chuyển trạng thái từ {oldStatus} sang {collection.Status}." +
            (outstanding > 0 ? $" Còn nợ {outstanding:N0} đ." : string.Empty),
            "/fee-collections", severity);
    }

    private IQueryable<FeeCollectionResponseDto> Project(IQueryable<FeeCollection> query) =>
        query.Select(c => new FeeCollectionResponseDto
        {
            Id = c.Id,
            Name = c.Name,
            Month = c.Month,
            Year = c.Year,
            CreatedAt = c.CreatedAt,
            CreatedByUserId = c.CreatedByUserId,
            CreatedByUsername = _context.Users
                .Where(u => u.Id == c.CreatedByUserId)
                .Select(u => u.Username)
                .FirstOrDefault() ?? string.Empty,
            Status = c.Status,
            DueDate = c.DueDate,
            ChargeCount = c.FeeCharges.Count,
            NoticeCount = _context.FeeNotices.Count(n => n.FeeCollectionId == c.Id && n.Type == "Notice")
        });

    private Task<bool> HasDuplicatePeriod(int month, int year, int? excludedId = null)
    {
        var query = _context.FeeCollections.Where(c => c.Month == month && c.Year == year);
        if (excludedId.HasValue)
            query = query.Where(c => c.Id != excludedId.Value);
        return query.AnyAsync();
    }

    private async Task<int?> GetActiveStaffId()
    {
        var userId = User.GetUserId();
        if (userId is null)
            return null;

        return await _context.Users
            .Where(u => u.Id == userId && u.IsActive && (u.Role == Roles.Admin || u.Role == Roles.Accountant))
            .Select(u => (int?)u.Id)
            .FirstOrDefaultAsync();
    }
}
