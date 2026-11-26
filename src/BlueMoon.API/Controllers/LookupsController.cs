using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>
/// Dữ liệu gợi ý cho ô chọn "gõ để tìm" (combobox) — luôn giới hạn số dòng,
/// không bao giờ trả toàn bộ bảng.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/lookups")]
public sealed class LookupsController : ControllerBase
{
    private readonly AppDbContext _context;

    public LookupsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("buildings")]
    public async Task<ActionResult<IEnumerable<string>>> Buildings() =>
        Ok(await _context.Apartments.AsNoTracking()
            .Select(a => a.Building)
            .Distinct()
            .OrderBy(b => b)
            .ToListAsync());

    [HttpGet("apartments")]
    public async Task<ActionResult<IEnumerable<LookupItemDto>>> Apartments(
        [FromQuery] string? q,
        [FromQuery] string? building,
        [FromQuery] bool? occupied,
        [FromQuery] int? id,
        [FromQuery] int limit = 20)
    {
        var query = _context.Apartments.AsNoTracking();
        if (id.HasValue)
            query = query.Where(a => a.Id == id.Value);
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(a => a.Building == building.Trim());
        if (occupied == true)
            query = query.Where(a => a.Households.Any(h => h.IsActive));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var raw = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(a =>
                EF.Functions.ILike(a.ApartmentCode, raw) ||
                a.Households.Any(h => h.IsActive && (EF.Functions.ILike(h.HouseholdCode, raw) ||
                    h.Residents.Any(r => r.IsHouseholdHead && EF.Functions.ILike(r.SearchName, plain)))));
        }

        return Ok(await query
            .OrderBy(a => a.ApartmentCode)
            .Take(Math.Clamp(limit, 1, 50))
            .Select(a => new LookupItemDto
            {
                Id = a.Id,
                Label = a.ApartmentCode,
                Description = "Tòa " + a.Building + " · Tầng " + a.Floor + " · " +
                    (a.Households.Where(h => h.IsActive)
                        .SelectMany(h => h.Residents)
                        .Where(r => r.IsHouseholdHead)
                        .Select(r => r.FullName)
                        .FirstOrDefault() ?? "Chưa có hộ"),
                ApartmentId = a.Id,
                HouseholdId = a.Households.Where(h => h.IsActive).Select(h => (int?)h.Id).FirstOrDefault()
            })
            .ToListAsync());
    }

    [HttpGet("households")]
    public async Task<ActionResult<IEnumerable<LookupItemDto>>> Households(
        [FromQuery] string? q,
        [FromQuery] bool? isActive,
        [FromQuery] bool? withoutAccount,
        [FromQuery] int? id,
        [FromQuery] int limit = 20)
    {
        var query = _context.Households.AsNoTracking();
        if (id.HasValue)
            query = query.Where(h => h.Id == id.Value);
        if (isActive.HasValue)
            query = query.Where(h => h.IsActive == isActive.Value);
        if (withoutAccount == true)
            query = query.Where(h => !_context.Users.Any(u => u.HouseholdId == h.Id));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var raw = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(h =>
                EF.Functions.ILike(h.HouseholdCode, raw) ||
                EF.Functions.ILike(h.Apartment!.ApartmentCode, raw) ||
                h.Residents.Any(r => r.IsHouseholdHead && EF.Functions.ILike(r.SearchName, plain)));
        }

        return Ok(await query
            .OrderBy(h => h.HouseholdCode)
            .Take(Math.Clamp(limit, 1, 50))
            .Select(h => new LookupItemDto
            {
                Id = h.Id,
                Label = h.HouseholdCode,
                Description = "Căn " + h.Apartment!.ApartmentCode + " · " +
                    (h.Residents.Where(r => r.IsHouseholdHead).Select(r => r.FullName).FirstOrDefault() ?? "chưa có chủ hộ") +
                    (h.IsActive ? string.Empty : " · ngừng hoạt động"),
                ApartmentId = h.ApartmentId,
                HouseholdId = h.Id
            })
            .ToListAsync());
    }

    [HttpGet("residents")]
    public async Task<ActionResult<IEnumerable<LookupItemDto>>> Residents(
        [FromQuery] string? q,
        [FromQuery] int? apartmentId,
        [FromQuery] int? householdId,
        [FromQuery] string? status,
        [FromQuery] int? id,
        [FromQuery] int limit = 20)
    {
        var query = _context.Residents.AsNoTracking();
        if (id.HasValue)
            query = query.Where(r => r.Id == id.Value);
        if (apartmentId.HasValue)
            query = query.Where(r => r.Household!.ApartmentId == apartmentId.Value);
        if (householdId.HasValue)
            query = query.Where(r => r.HouseholdId == householdId.Value);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var statuses = status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = query.Where(r => statuses.Contains(r.Status));
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var raw = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(r =>
                EF.Functions.ILike(r.SearchName, plain) ||
                EF.Functions.ILike(r.IdentityNumber, raw) ||
                EF.Functions.ILike(r.PhoneNumber, raw));
        }

        return Ok(await query
            .OrderByDescending(r => r.IsHouseholdHead)
            .ThenBy(r => r.FullName)
            .Take(Math.Clamp(limit, 1, 50))
            .Select(r => new LookupItemDto
            {
                Id = r.Id,
                Label = r.FullName,
                Description = "CCCD " + r.IdentityNumber + " · Hộ " + r.Household!.HouseholdCode +
                              " · Căn " + r.Household.Apartment!.ApartmentCode +
                              (r.IsHouseholdHead ? " · Chủ hộ" : string.Empty),
                ApartmentId = r.Household.ApartmentId,
                HouseholdId = r.HouseholdId
            })
            .ToListAsync());
    }
}
