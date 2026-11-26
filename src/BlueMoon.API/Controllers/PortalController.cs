using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>
/// Cổng cư dân — chỉ role Resident. Mọi dữ liệu được giới hạn theo hộ gia đình
/// gắn với tài khoản (User.HouseholdId → căn hộ của hộ).
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Resident)]
[Route("api/portal")]
public sealed class PortalController : ControllerBase
{
    private readonly AppDbContext _context;

    public PortalController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<PortalSummaryDto>> Summary()
    {
        var scope = await Scope();
        if (scope is null)
            return Forbid();

        var today = VnClock.Today;
        var charges = await _context.FeeCharges.AsNoTracking()
            .Where(c => c.ApartmentId == scope.ApartmentId && c.FeeCollection!.Status != "Cancelled")
            .Select(c => new { c.Amount, c.PaidAmount, c.DueDate })
            .ToListAsync();
        var open = charges.Where(c => c.Amount > c.PaidAmount).ToList();
        var overdue = open.Where(c => VnClock.IsOverdue(c.DueDate, c.Amount - c.PaidAmount)).ToList();
        var upcoming = open.Where(c => c.DueDate.HasValue && VnClock.AsDate(c.DueDate.Value) >= today)
            .OrderBy(c => c.DueDate).ToList();
        var nextDue = upcoming.FirstOrDefault()?.DueDate;

        var yearStartUtc = new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(-7);
        var paidThisYear = await _context.Payments.AsNoTracking()
            .Where(p => p.ApartmentId == scope.ApartmentId && p.PaymentDate >= yearStartUtc)
            .SumAsync(p => (decimal?)p.TotalAmount) ?? 0m;

        var userId = User.GetUserId();
        var unread = await _context.Notifications.CountAsync(n => n.RecipientUserId == userId && n.ReadAt == null);

        return Ok(new PortalSummaryDto
        {
            HouseholdId = scope.HouseholdId,
            HouseholdCode = scope.HouseholdCode,
            ApartmentId = scope.ApartmentId,
            ApartmentCode = scope.ApartmentCode,
            Building = scope.Building,
            OutstandingAmount = open.Sum(c => c.Amount - c.PaidAmount),
            OverdueAmount = overdue.Sum(c => c.Amount - c.PaidAmount),
            OverdueChargeCount = overdue.Count,
            UnpaidChargeCount = open.Count,
            NextDueDate = nextDue,
            NextDueAmount = nextDue.HasValue
                ? upcoming.Where(c => c.DueDate == nextDue).Sum(c => c.Amount - c.PaidAmount)
                : 0m,
            PaidThisYear = paidThisYear,
            UnreadNotificationCount = unread
        });
    }

    [HttpGet("household")]
    public async Task<ActionResult<PortalHouseholdDto>> Household()
    {
        var scope = await Scope();
        if (scope is null)
            return Forbid();

        var household = await _context.Households.AsNoTracking()
            .Where(h => h.Id == scope.HouseholdId)
            .Select(h => new PortalHouseholdDto
            {
                Id = h.Id,
                HouseholdCode = h.HouseholdCode,
                ApartmentCode = h.Apartment!.ApartmentCode,
                Building = h.Apartment.Building,
                Floor = h.Apartment.Floor,
                Area = h.Apartment.Area,
                CreatedAt = h.CreatedAt,
                Members = h.Residents
                    .Where(r => r.Status != "MovedOut")
                    .OrderByDescending(r => r.IsHouseholdHead)
                    .ThenBy(r => r.DateOfBirth)
                    .Select(r => new PortalMemberDto
                    {
                        Id = r.Id,
                        FullName = r.FullName,
                        DateOfBirth = r.DateOfBirth,
                        Gender = r.Gender,
                        Relationship = r.Relationship,
                        IsHouseholdHead = r.IsHouseholdHead,
                        Status = r.Status
                    })
                    .ToList()
            })
            .FirstAsync();

        return Ok(household);
    }

    [HttpGet("charges")]
    public async Task<ActionResult<IEnumerable<FeeChargeResponseDto>>> Charges(
        [FromQuery] bool? outstanding,
        [FromQuery] bool? overdue,
        [FromQuery] int? year,
        [FromQuery] PageQuery paging)
    {
        var scope = await Scope();
        if (scope is null)
            return Forbid();

        var today = VnClock.Today;
        var query = _context.FeeCharges.AsNoTracking()
            .Where(c => c.ApartmentId == scope.ApartmentId && c.FeeCollection!.Status != "Cancelled");
        if (outstanding == true)
            query = query.Where(c => c.Amount > c.PaidAmount);
        if (overdue == true)
            query = query.Where(c => c.Amount > c.PaidAmount && c.DueDate != null && c.DueDate < today);
        if (year.HasValue)
            query = query.Where(c => c.FeeCollection!.Year == year.Value);

        var result = FeeChargesController.Project(query)
            .OrderByDescending(c => c.FeeCollectionYear)
            .ThenByDescending(c => c.FeeCollectionMonth)
            .ThenBy(c => c.FeeCategoryName);
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("payments")]
    public async Task<ActionResult<IEnumerable<PaymentResponseDto>>> Payments([FromQuery] PageQuery paging)
    {
        var scope = await Scope();
        if (scope is null)
            return Forbid();

        var result = PaymentsController
            .ProjectPayments(_context, _context.Payments.AsNoTracking().Where(p => p.ApartmentId == scope.ApartmentId))
            .OrderByDescending(p => p.PaymentDate)
            .ThenByDescending(p => p.Id);
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("notices")]
    public async Task<ActionResult<IEnumerable<FeeNoticeDto>>> Notices([FromQuery] string? type)
    {
        var scope = await Scope();
        if (scope is null)
            return Forbid();

        var apartmentId = scope.ApartmentId;
        return Ok(await FeeNoticeQueries.Load(_context, n => n.ApartmentId == apartmentId, type, take: 100));
    }

    private sealed record PortalScope(int HouseholdId, string HouseholdCode, int ApartmentId, string ApartmentCode, string Building);

    private async Task<PortalScope?> Scope()
    {
        var userId = User.GetUserId();
        if (userId is null)
            return null;

        return await _context.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.IsActive && u.Role == Roles.Resident &&
                        u.Household != null && u.Household.IsActive)
            .Select(u => new PortalScope(
                u.Household!.Id,
                u.Household.HouseholdCode,
                u.Household.ApartmentId,
                u.Household.Apartment!.ApartmentCode,
                u.Household.Apartment.Building))
            .FirstOrDefaultAsync();
    }
}
