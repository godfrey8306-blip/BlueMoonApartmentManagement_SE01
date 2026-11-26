using System.Linq.Expressions;
using System.Security.Cryptography;
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
public sealed class HouseholdsController : ControllerBase
{
    private static readonly Dictionary<string, Expression<Func<HouseholdResponseDto, object?>>> SortColumns = new()
    {
        ["code"] = h => h.HouseholdCode,
        ["apartment"] = h => h.ApartmentCode,
        ["building"] = h => h.Building,
        ["createdat"] = h => h.CreatedAt,
        ["residents"] = h => h.ResidentCount,
        ["head"] = h => h.HeadOfHousehold,
    };

    private readonly AppDbContext _context;
    private readonly PasswordHasher _passwordHasher;

    public HouseholdsController(AppDbContext context, PasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    /// <summary>
    /// GET /api/households?q=&amp;building=&amp;apartmentId=&amp;isActive=&amp;hasAccount=&amp;page=&amp;pageSize=&amp;sort=
    /// q: mã hộ, mã căn hộ hoặc tên chủ hộ (không dấu).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<HouseholdResponseDto>>> GetAll(
        [FromQuery] string? q,
        [FromQuery] string? building,
        [FromQuery] int? apartmentId,
        [FromQuery] bool? isActive,
        [FromQuery] bool? hasAccount,
        [FromQuery] string? householdCode,
        [FromQuery] PageQuery paging)
    {
        var query = _context.Households.AsNoTracking();

        if (apartmentId.HasValue)
            query = query.Where(h => h.ApartmentId == apartmentId.Value);
        if (isActive.HasValue)
            query = query.Where(h => h.IsActive == isActive.Value);
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(h => h.Apartment != null && h.Apartment.Building == building.Trim());
        if (!string.IsNullOrWhiteSpace(householdCode))
            query = query.Where(h => EF.Functions.ILike(h.HouseholdCode, TextNormalizer.LikePattern(householdCode.Trim())));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var raw = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(h =>
                EF.Functions.ILike(h.HouseholdCode, raw) ||
                (h.Apartment != null && EF.Functions.ILike(h.Apartment.ApartmentCode, raw)) ||
                h.Residents.Any(r => r.IsHouseholdHead && EF.Functions.ILike(r.SearchName, plain)));
        }
        if (hasAccount.HasValue)
        {
            query = hasAccount.Value
                ? query.Where(h => _context.Users.Any(u => u.HouseholdId == h.Id))
                : query.Where(h => !_context.Users.Any(u => u.HouseholdId == h.Id));
        }

        var result = Project(query).ApplySort(paging, SortColumns, x => x.OrderBy(h => h.HouseholdCode));
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HouseholdResponseDto>> GetById(int id)
    {
        var household = await Project(_context.Households.AsNoTracking().Where(h => h.Id == id)).FirstOrDefaultAsync();
        return household is null ? NotFound() : Ok(household);
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPost]
    public async Task<ActionResult<HouseholdResponseDto>> Create(HouseholdCreateDto dto)
    {
        var householdCode = dto.HouseholdCode.Trim();

        if (!await _context.Apartments.AnyAsync(a => a.Id == dto.ApartmentId))
            return NotFound(new { message = "Apartment not found." });

        if (await _context.Households.AnyAsync(h => h.HouseholdCode == householdCode))
            return Conflict(new { message = "Household code already exists." });

        if (await _context.Households.AnyAsync(h => h.ApartmentId == dto.ApartmentId && h.IsActive))
            return Conflict(new { message = "Căn hộ này đang có hộ gia đình khác sinh sống." });

        var household = new Household
        {
            HouseholdCode = householdCode,
            ApartmentId = dto.ApartmentId,
            IsActive = true
        };

        _context.Households.Add(household);
        await MarkApartmentOccupied(dto.ApartmentId, true);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Household code already exists or the apartment reference is invalid." });
        }

        var response = await Project(_context.Households.AsNoTracking().Where(h => h.Id == household.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = household.Id }, response);
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, HouseholdUpdateDto dto)
    {
        var household = await _context.Households.FirstOrDefaultAsync(h => h.Id == id);
        if (household is null)
            return NotFound();

        if (!await _context.Apartments.AnyAsync(a => a.Id == dto.ApartmentId))
            return NotFound(new { message = "Apartment not found." });

        var householdCode = dto.HouseholdCode.Trim();
        if (await _context.Households.AnyAsync(h => h.HouseholdCode == householdCode && h.Id != id))
            return Conflict(new { message = "Household code already exists." });

        if (dto.IsActive && await _context.Households.AnyAsync(h =>
                h.ApartmentId == dto.ApartmentId && h.IsActive && h.Id != id))
            return Conflict(new { message = "Căn hộ này đang có hộ gia đình khác sinh sống." });

        var oldApartmentId = household.ApartmentId;
        household.HouseholdCode = householdCode;
        household.ApartmentId = dto.ApartmentId;
        household.IsActive = dto.IsActive;

        if (oldApartmentId != dto.ApartmentId || !dto.IsActive)
            await MarkApartmentOccupied(oldApartmentId, false, exceptHouseholdId: id);
        if (dto.IsActive)
            await MarkApartmentOccupied(dto.ApartmentId, true);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Household code already exists or the apartment reference is invalid." });
        }

        return NoContent();
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var household = await _context.Households.FirstOrDefaultAsync(h => h.Id == id);
        if (household is null)
            return NotFound();

        if (await _context.Residents.AnyAsync(r => r.HouseholdId == id))
            return Conflict(new { message = "Cannot delete a household that has residents." });
        if (await _context.Users.AnyAsync(u => u.HouseholdId == id))
            return Conflict(new { message = "Không thể xóa hộ đã được cấp tài khoản cư dân." });

        _context.Households.Remove(household);
        await MarkApartmentOccupied(household.ApartmentId, false, exceptHouseholdId: id);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Cannot delete the household because related data exists." });
        }

        return NoContent();
    }

    /// <summary>Cấp tài khoản cổng cư dân cho một hộ. Trả mật khẩu tạm một lần.</summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPost("{id:int}/account")]
    public async Task<ActionResult<ProvisionedAccountDto>> ProvisionAccount(int id)
    {
        var household = await _context.Households
            .Include(h => h.Apartment)
            .Include(h => h.Residents)
            .FirstOrDefaultAsync(h => h.Id == id);
        if (household is null)
            return NotFound();
        if (!household.IsActive)
            return Conflict(new { message = "Hộ gia đình đã ngừng hoạt động." });
        if (await _context.Users.AnyAsync(u => u.HouseholdId == id))
            return Conflict(new { message = "Hộ gia đình này đã có tài khoản cư dân." });

        var account = await CreateAccount(household);
        await _context.SaveChangesAsync();
        return Ok(account.Result with { UserId = account.User.Id });
    }

    /// <summary>Cấp tài khoản hàng loạt cho mọi hộ đang hoạt động chưa có tài khoản.</summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPost("accounts/bulk")]
    public async Task<ActionResult<IEnumerable<ProvisionedAccountDto>>> ProvisionAccounts([FromQuery] string? building)
    {
        var query = _context.Households
            .Include(h => h.Apartment)
            .Include(h => h.Residents)
            .Where(h => h.IsActive && !_context.Users.Any(u => u.HouseholdId == h.Id));
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(h => h.Apartment != null && h.Apartment.Building == building.Trim());

        var households = await query.OrderBy(h => h.HouseholdCode).ToListAsync();
        var created = new List<(User User, ProvisionedAccountDto Result)>();
        foreach (var household in households)
            created.Add(await CreateAccount(household));

        await _context.SaveChangesAsync();
        return Ok(created.Select(c => c.Result with { UserId = c.User.Id }));
    }

    private async Task<(User User, ProvisionedAccountDto Result)> CreateAccount(Household household)
    {
        var baseName = household.HouseholdCode.ToLowerInvariant().Replace(' ', '-');
        var username = baseName;
        var suffix = 1;
        while (await _context.Users.AnyAsync(u => u.Username == username) ||
               _context.Users.Local.Any(u => u.Username == username))
            username = $"{baseName}-{++suffix}";

        var head = household.Residents.FirstOrDefault(r => r.IsHouseholdHead) ?? household.Residents.FirstOrDefault();
        var password = GenerateTemporaryPassword();
        var user = new User
        {
            Username = username,
            PasswordHash = _passwordHasher.Hash(password),
            FullName = head?.FullName ?? $"Hộ {household.HouseholdCode}",
            Email = $"{username}@cudan.bluemoon.local",
            Role = Roles.Resident,
            HouseholdId = household.Id,
            MustChangePassword = true,
            IsActive = true
        };
        _context.Users.Add(user);

        return (user, new ProvisionedAccountDto
        {
            HouseholdId = household.Id,
            HouseholdCode = household.HouseholdCode,
            ApartmentCode = household.Apartment?.ApartmentCode ?? string.Empty,
            Username = username,
            FullName = user.FullName,
            TemporaryPassword = password
        });
    }

    private static string GenerateTemporaryPassword()
    {
        const string letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
        const string digits = "23456789";
        var chars = new char[10];
        for (var i = 0; i < 6; i++) chars[i] = letters[RandomNumberGenerator.GetInt32(letters.Length)];
        for (var i = 6; i < 10; i++) chars[i] = digits[RandomNumberGenerator.GetInt32(digits.Length)];
        return new string(chars);
    }

    /// <summary>Đồng bộ trạng thái căn hộ theo việc có hộ đang ở hay không.</summary>
    private async Task MarkApartmentOccupied(int apartmentId, bool occupied, int? exceptHouseholdId = null)
    {
        var apartment = await _context.Apartments.FindAsync(apartmentId);
        if (apartment is null || apartment.Status == "Maintenance")
            return;

        if (occupied)
        {
            apartment.Status = "Occupied";
            return;
        }

        var stillOccupied = await _context.Households.AnyAsync(h =>
            h.ApartmentId == apartmentId && h.IsActive && h.Id != exceptHouseholdId);
        if (!stillOccupied)
            apartment.Status = "Available";
    }

    private IQueryable<HouseholdResponseDto> Project(IQueryable<Household> query) =>
        query.Select(h => new HouseholdResponseDto
        {
            Id = h.Id,
            HouseholdCode = h.HouseholdCode,
            ApartmentId = h.ApartmentId,
            ApartmentCode = h.Apartment == null ? string.Empty : h.Apartment.ApartmentCode,
            Building = h.Apartment == null ? string.Empty : h.Apartment.Building,
            CreatedAt = h.CreatedAt,
            IsActive = h.IsActive,
            HeadResidentId = h.Residents.Where(r => r.IsHouseholdHead).Select(r => (int?)r.Id).FirstOrDefault(),
            HeadOfHousehold = h.Residents.Where(r => r.IsHouseholdHead).Select(r => r.FullName).FirstOrDefault(),
            HeadPhoneNumber = h.Residents.Where(r => r.IsHouseholdHead).Select(r => r.PhoneNumber).FirstOrDefault(),
            ResidentCount = h.Residents.Count(r => r.Status != "MovedOut" && r.Status != "Deceased"),
            AccountUserId = _context.Users.Where(u => u.HouseholdId == h.Id).Select(u => (int?)u.Id).FirstOrDefault(),
            AccountUsername = _context.Users.Where(u => u.HouseholdId == h.Id).Select(u => u.Username).FirstOrDefault()
        });
}
