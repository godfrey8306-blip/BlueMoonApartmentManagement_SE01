using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>
/// Biến động cư trú (PBI-003, PBI-004 / US-004).
/// Mỗi loại biến động tự cập nhật trạng thái cư trú của nhân khẩu trong cùng transaction:
///   MoveIn → Active · MoveOut → MovedOut · TemporaryResidence → TemporaryResident
///   TemporaryAbsence → TemporarilyAbsent · InformationChange → giữ nguyên
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/residence-histories")]
public sealed class ResidentHistoriesController : ControllerBase
{
    private static readonly Dictionary<string, string> StatusAfter = new()
    {
        ["MoveIn"] = "Active",
        ["MoveOut"] = "MovedOut",
        ["TemporaryResidence"] = "TemporaryResident",
        ["TemporaryAbsence"] = "TemporarilyAbsent",
    };

    private readonly AppDbContext _context;

    public ResidentHistoriesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ResidentHistoryResponseDto>>> GetAll(
        [FromQuery] int? residentId,
        [FromQuery] string? historyType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? q,
        [FromQuery] string? building,
        [FromQuery] PageQuery paging)
    {
        var query = _context.ResidenceHistories.AsNoTracking();

        if (residentId.HasValue)
            query = query.Where(h => h.ResidentId == residentId.Value);
        if (!string.IsNullOrWhiteSpace(historyType))
        {
            var types = historyType.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = query.Where(h => types.Contains(h.HistoryType));
        }
        if (fromDate.HasValue)
            query = query.Where(h => h.StartDate >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(h => h.StartDate <= toDate.Value);
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(h => h.Resident!.Household!.Apartment!.Building == building.Trim());
        if (!string.IsNullOrWhiteSpace(q))
        {
            var raw = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(h =>
                EF.Functions.ILike(h.Resident!.SearchName, plain) ||
                EF.Functions.ILike(h.Resident!.IdentityNumber, raw) ||
                EF.Functions.ILike(h.Resident!.Household!.HouseholdCode, raw) ||
                EF.Functions.ILike(h.Resident!.Household!.Apartment!.ApartmentCode, raw));
        }

        var result = Project(query)
            .OrderByDescending(h => h.StartDate)
            .ThenByDescending(h => h.Id);
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ResidentHistoryResponseDto>> GetById(int id)
    {
        var history = await Project(_context.ResidenceHistories.AsNoTracking().Where(h => h.Id == id)).FirstOrDefaultAsync();
        return history is null ? NotFound() : Ok(history);
    }

    [HttpGet("resident/{residentId:int}")]
    public async Task<ActionResult<IEnumerable<ResidentHistoryResponseDto>>> GetByResident(int residentId)
    {
        if (!await _context.Residents.AnyAsync(r => r.Id == residentId))
            return NotFound(new { message = "Resident not found." });

        return Ok(await Project(_context.ResidenceHistories.AsNoTracking().Where(h => h.ResidentId == residentId))
            .OrderByDescending(h => h.StartDate)
            .ThenByDescending(h => h.Id)
            .ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<ResidentHistoryResponseDto>> Create(ResidentHistoryCreateDto dto)
    {
        var creatorId = User.GetUserId();
        if (!creatorId.HasValue)
            return Unauthorized(new { message = "Authenticated user id is missing from the token." });

        var resident = await _context.Residents.FirstOrDefaultAsync(r => r.Id == dto.ResidentId);
        if (resident is null)
            return NotFound(new { message = "Resident not found." });

        if (dto.HistoryType == "MoveIn" && resident.Status == "Active")
            return Conflict(new { message = "Nhân khẩu đang thường trú, không thể ghi nhận chuyển đến." });
        if (dto.HistoryType == "MoveOut" && resident.Status == "MovedOut")
            return Conflict(new { message = "Nhân khẩu đã chuyển đi trước đó." });
        if (resident.Status == "MovedOut" && dto.HistoryType is "TemporaryAbsence")
            return Conflict(new { message = "Nhân khẩu đã chuyển đi, không thể ghi nhận tạm vắng." });

        var history = new ResidenceHistory
        {
            ResidentId = dto.ResidentId,
            HistoryType = dto.HistoryType,
            StartDate = VnClock.AsDate(dto.StartDate),
            EndDate = dto.EndDate.HasValue ? VnClock.AsDate(dto.EndDate.Value) : null,
            Destination = Normalize(dto.Destination),
            Note = dto.Note.Trim(),
            PreviousValue = Normalize(dto.PreviousValue),
            NewValue = Normalize(dto.NewValue),
            CreatedByUserId = creatorId.Value
        };

        if (StatusAfter.TryGetValue(dto.HistoryType, out var newStatus))
        {
            resident.Status = newStatus;
            // Người chuyển đi không còn là chủ hộ
            if (newStatus == "MovedOut")
                resident.IsHouseholdHead = false;
        }

        _context.ResidenceHistories.Add(history);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The resident history could not be saved." });
        }

        var response = await Project(_context.ResidenceHistories.AsNoTracking().Where(h => h.Id == history.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = history.Id }, response);
    }

    private IQueryable<ResidentHistoryResponseDto> Project(IQueryable<ResidenceHistory> query) =>
        query.Select(h => new ResidentHistoryResponseDto
        {
            Id = h.Id,
            ResidentId = h.ResidentId,
            ResidentFullName = h.Resident == null ? string.Empty : h.Resident.FullName,
            HouseholdId = h.Resident == null ? 0 : h.Resident.HouseholdId,
            HouseholdCode = h.Resident == null || h.Resident.Household == null
                ? string.Empty
                : h.Resident.Household.HouseholdCode,
            ApartmentId = h.Resident == null || h.Resident.Household == null
                ? 0
                : h.Resident.Household.ApartmentId,
            ApartmentCode = h.Resident == null || h.Resident.Household == null || h.Resident.Household.Apartment == null
                ? string.Empty
                : h.Resident.Household.Apartment.ApartmentCode,
            HistoryType = h.HistoryType,
            StartDate = h.StartDate,
            EndDate = h.EndDate,
            Destination = h.Destination,
            Note = h.Note ?? string.Empty,
            PreviousValue = h.PreviousValue,
            NewValue = h.NewValue,
            CreatedByUserId = h.CreatedByUserId ?? 0
        });

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
