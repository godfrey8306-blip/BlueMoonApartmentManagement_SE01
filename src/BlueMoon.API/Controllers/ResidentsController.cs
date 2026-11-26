using System.Linq.Expressions;
using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/[controller]")]
public sealed class ResidentsController : ControllerBase
{
    private static readonly Dictionary<string, Expression<Func<ResidentResponseDto, object?>>> SortColumns = new()
    {
        ["name"] = r => r.FullName,
        ["dob"] = r => r.DateOfBirth,
        ["household"] = r => r.HouseholdCode,
        ["apartment"] = r => r.ApartmentCode,
        ["building"] = r => r.Building,
        ["status"] = r => r.Status,
    };

    private readonly AppDbContext _context;

    public ResidentsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/residents
    ///   q: họ tên (không dấu) / CCCD / SĐT / mã hộ / mã căn hộ
    ///   building, gender, status, isHouseholdHead, ageFrom, ageTo, householdId, apartmentId, name (cũ)
    ///   page, pageSize, sort (name|dob|household|apartment|building|status, tiền tố "-" để giảm dần)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ResidentResponseDto>>> GetAll(
        [FromQuery] string? q,
        [FromQuery] int? householdId,
        [FromQuery] int? apartmentId,
        [FromQuery] string? building,
        [FromQuery] string? name,
        [FromQuery] string? status,
        [FromQuery] string? gender,
        [FromQuery] bool? isHouseholdHead,
        [FromQuery] int? ageFrom,
        [FromQuery] int? ageTo,
        [FromQuery] PageQuery paging)
    {
        var query = _context.Residents.AsNoTracking();

        if (householdId.HasValue)
            query = query.Where(r => r.HouseholdId == householdId.Value);
        if (apartmentId.HasValue)
            query = query.Where(r => r.Household != null && r.Household.ApartmentId == apartmentId.Value);
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(r => r.Household != null && r.Household.Apartment != null &&
                                     r.Household.Apartment.Building == building.Trim());
        if (!string.IsNullOrWhiteSpace(status))
        {
            var statuses = status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = query.Where(r => statuses.Contains(r.Status));
        }
        if (!string.IsNullOrWhiteSpace(gender))
            query = query.Where(r => r.Gender == gender.Trim());
        if (isHouseholdHead.HasValue)
            query = query.Where(r => r.IsHouseholdHead == isHouseholdHead.Value);

        // Tuổi tính theo ngày hôm nay (VN): tuổi ≥ ageFrom ⇔ sinh trước hoặc đúng (hôm nay - ageFrom năm)
        var today = VnClock.Today;
        if (ageFrom.HasValue)
        {
            var bornOnOrBefore = today.AddYears(-ageFrom.Value);
            query = query.Where(r => r.DateOfBirth != null && r.DateOfBirth <= bornOnOrBefore);
        }
        if (ageTo.HasValue)
        {
            var bornAfter = today.AddYears(-(ageTo.Value + 1));
            query = query.Where(r => r.DateOfBirth != null && r.DateOfBirth > bornAfter);
        }

        var text = q ?? name;
        if (!string.IsNullOrWhiteSpace(text))
        {
            var raw = TextNormalizer.LikePattern(text.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(text));
            query = query.Where(r =>
                EF.Functions.ILike(r.SearchName, plain) ||
                EF.Functions.ILike(r.IdentityNumber, raw) ||
                EF.Functions.ILike(r.PhoneNumber, raw) ||
                (r.Household != null && EF.Functions.ILike(r.Household.HouseholdCode, raw)) ||
                (r.Household != null && r.Household.Apartment != null &&
                 EF.Functions.ILike(r.Household.Apartment.ApartmentCode, raw)));
        }

        var result = Project(query).ApplySort(paging, SortColumns,
            x => x.OrderBy(r => r.FullName).ThenBy(r => r.Id));
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ResidentResponseDto>> GetById(int id)
    {
        var resident = await Project(_context.Residents.AsNoTracking().Where(r => r.Id == id)).FirstOrDefaultAsync();
        return resident is null ? NotFound() : Ok(resident);
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPost]
    public async Task<ActionResult<ResidentResponseDto>> Create(ResidentCreateDto dto)
    {
        var validationError = ValidateDateOfBirth(dto.DateOfBirth);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        if (!await _context.Households.AnyAsync(h => h.Id == dto.HouseholdId))
            return NotFound(new { message = "Household not found." });

        var identityNumber = dto.IdentityNumber.Trim();
        if (await _context.Residents.AnyAsync(r => r.IdentityNumber == identityNumber))
            return Conflict(new { message = "Identity number already exists." });

        if (dto.IsHouseholdHead && await _context.Residents.AnyAsync(r =>
                r.HouseholdId == dto.HouseholdId && r.IsHouseholdHead))
            return Conflict(new { message = "Hộ gia đình này đã có chủ hộ. Bỏ chọn chủ hộ cũ trước." });

        var resident = new Resident
        {
            HouseholdId = dto.HouseholdId,
            FullName = dto.FullName.Trim(),
            IdentityNumber = identityNumber,
            DateOfBirth = dto.DateOfBirth.HasValue ? VnClock.AsDate(dto.DateOfBirth.Value) : null,
            Gender = dto.Gender.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            Relationship = dto.Relationship.Trim(),
            IsHouseholdHead = dto.IsHouseholdHead,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim()
        };

        _context.Residents.Add(resident);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Identity number already exists or the household reference is invalid." });
        }

        var response = await Project(_context.Residents.AsNoTracking().Where(r => r.Id == resident.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = resident.Id }, response);
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ResidentUpdateDto dto)
    {
        var validationError = ValidateDateOfBirth(dto.DateOfBirth);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var resident = await _context.Residents.FirstOrDefaultAsync(r => r.Id == id);
        if (resident is null)
            return NotFound();

        if (!await _context.Households.AnyAsync(h => h.Id == dto.HouseholdId))
            return NotFound(new { message = "Household not found." });

        var identityNumber = dto.IdentityNumber.Trim();
        if (await _context.Residents.AnyAsync(r => r.IdentityNumber == identityNumber && r.Id != id))
            return Conflict(new { message = "Identity number already exists." });

        if (dto.IsHouseholdHead && await _context.Residents.AnyAsync(r =>
                r.HouseholdId == dto.HouseholdId && r.IsHouseholdHead && r.Id != id))
            return Conflict(new { message = "Hộ gia đình này đã có chủ hộ. Bỏ chọn chủ hộ cũ trước." });

        resident.HouseholdId = dto.HouseholdId;
        resident.FullName = dto.FullName.Trim();
        resident.IdentityNumber = identityNumber;
        resident.DateOfBirth = dto.DateOfBirth.HasValue ? VnClock.AsDate(dto.DateOfBirth.Value) : null;
        resident.Gender = dto.Gender.Trim();
        resident.PhoneNumber = dto.PhoneNumber.Trim();
        resident.Relationship = dto.Relationship.Trim();
        resident.IsHouseholdHead = dto.IsHouseholdHead;
        resident.Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim();

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Identity number already exists or the household reference is invalid." });
        }

        return NoContent();
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var resident = await _context.Residents.FirstOrDefaultAsync(r => r.Id == id);
        if (resident is null)
            return NotFound();

        var hasRelatedData =
            await _context.ResidenceHistories.AnyAsync(h => h.ResidentId == id) ||
            await _context.Vehicles.AnyAsync(v => v.ResidentId == id) ||
            await _context.Payments.AnyAsync(p => p.ResidentId == id);

        if (hasRelatedData)
            return Conflict(new { message = "Cannot delete a resident with related data." });

        _context.Residents.Remove(resident);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Cannot delete the resident because related data exists." });
        }

        return NoContent();
    }

    private static IQueryable<ResidentResponseDto> Project(IQueryable<Resident> query) =>
        query.Select(r => new ResidentResponseDto
        {
            Id = r.Id,
            HouseholdId = r.HouseholdId,
            HouseholdCode = r.Household == null ? string.Empty : r.Household.HouseholdCode,
            ApartmentId = r.Household == null ? 0 : r.Household.ApartmentId,
            ApartmentCode = r.Household == null || r.Household.Apartment == null
                ? string.Empty
                : r.Household.Apartment.ApartmentCode,
            Building = r.Household == null || r.Household.Apartment == null
                ? string.Empty
                : r.Household.Apartment.Building,
            FullName = r.FullName,
            IdentityNumber = r.IdentityNumber,
            DateOfBirth = r.DateOfBirth,
            Gender = r.Gender,
            PhoneNumber = r.PhoneNumber,
            Relationship = r.Relationship,
            IsHouseholdHead = r.IsHouseholdHead,
            Status = r.Status
        });

    private static string? ValidateDateOfBirth(DateTime? dateOfBirth)
    {
        return dateOfBirth.HasValue && VnClock.AsDate(dateOfBirth.Value) > VnClock.Today
            ? "Date of birth cannot be in the future."
            : null;
    }
}
