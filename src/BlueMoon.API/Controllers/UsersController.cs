using BlueMoon.API;
using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PasswordHasher _passwordHasher;

    public UsersController(AppDbContext context, PasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserResponse>>> GetAll(
        [FromQuery] string? role,
        [FromQuery] string? q,
        [FromQuery] bool? isActive,
        [FromQuery] PageQuery paging)
    {
        var query = Users();
        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => u.Role == role.Trim());
        if (isActive.HasValue)
            query = query.Where(u => u.IsActive == isActive.Value);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = TextNormalizer.LikePattern(q.Trim());
            query = query.Where(u =>
                EF.Functions.ILike(u.Username, pattern) ||
                EF.Functions.ILike(u.FullName, pattern) ||
                EF.Functions.ILike(u.Email, pattern) ||
                (u.HouseholdCode != null && EF.Functions.ILike(u.HouseholdCode, pattern)));
        }

        query = query.ApplySort(paging, new Dictionary<string, System.Linq.Expressions.Expression<Func<UserResponse, object?>>>
        {
            ["username"] = u => u.Username,
            ["fullname"] = u => u.FullName,
            ["role"] = u => u.Role,
        }, q => q.OrderBy(u => u.Role == Roles.Resident).ThenBy(u => u.Username));

        return Ok(await query.ToPagedListAsync(Response, paging));
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserResponse>> GetById(int id)
    {
        var user = await Users().FirstOrDefaultAsync(u => u.Id == id);
        return user is null ? NotFound() : Ok(user);
    }

    [AllowAnonymous]
    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request)
    {
        var hasUsers = await _context.Users.AnyAsync();
        if (hasUsers && !User.IsInRole(Roles.Admin))
            return Forbid();

        if (!hasUsers && !string.Equals(request.Role, Roles.Admin, StringComparison.Ordinal))
            return BadRequest(new { message = "The first account must have the Admin role." });

        var householdError = await ValidateHousehold(request.Role, request.HouseholdId);
        if (householdError is not null)
            return BadRequest(new { message = householdError });

        var username = request.Username.Trim();
        var email = request.Email.Trim();
        if (await _context.Users.AnyAsync(u => u.Username == username || u.Email == email))
            return Conflict(new { message = "Username or email already exists." });

        var user = new User
        {
            Username = username,
            PasswordHash = _passwordHasher.Hash(request.Password),
            FullName = request.FullName.Trim(),
            Email = email,
            Role = request.Role,
            HouseholdId = request.Role == Roles.Resident ? request.HouseholdId : null,
            MustChangePassword = request.Role == Roles.Resident,
            IsActive = true
        };

        _context.Users.Add(user);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Username or email already exists." });
        }

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, await Users().FirstAsync(u => u.Id == user.Id));
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserResponse>> Update(int id, UpdateUserRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound();

        var email = request.Email.Trim();
        if (await _context.Users.AnyAsync(u => u.Email == email && u.Id != id))
            return Conflict(new { message = "Email already exists." });

        var householdId = request.HouseholdId ?? user.HouseholdId;
        var householdError = await ValidateHousehold(request.Role, householdId);
        if (householdError is not null)
            return BadRequest(new { message = householdError });

        if (user.IsActive && user.Role == Roles.Admin && request.Role != Roles.Admin)
        {
            var activeAdminCount = await _context.Users.CountAsync(u =>
                u.IsActive && u.Role == Roles.Admin && u.Id != id);
            if (activeAdminCount == 0)
                return Conflict(new { message = "At least one active Admin account is required." });
        }

        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.Role = request.Role;
        user.HouseholdId = request.Role == Roles.Resident ? householdId : null;
        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
            // Admin đặt lại mật khẩu cho người khác → buộc họ đổi ở lần đăng nhập sau
            user.MustChangePassword = user.Id != User.GetUserId();
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Email already exists." });
        }

        return Ok(await Users().FirstAsync(u => u.Id == id));
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPatch("{id:int}/lock")]
    public async Task<IActionResult> Lock(int id)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound();

        if (user.Id == User.GetUserId())
            return Conflict(new { message = "You cannot lock your own account." });

        if (user.IsActive && user.Role == Roles.Admin)
        {
            var activeAdminCount = await _context.Users.CountAsync(u =>
                u.IsActive && u.Role == Roles.Admin && u.Id != id);
            if (activeAdminCount == 0)
                return Conflict(new { message = "At least one active Admin account is required." });
        }

        user.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPatch("{id:int}/unlock")]
    public async Task<IActionResult> Unlock(int id)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound();

        user.IsActive = true;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> ValidateHousehold(string role, int? householdId)
    {
        if (role != Roles.Resident)
            return null;
        if (householdId is null)
            return "Tài khoản cư dân phải gắn với một hộ gia đình.";
        if (!await _context.Households.AnyAsync(h => h.Id == householdId && h.IsActive))
            return "Hộ gia đình không tồn tại hoặc đã ngừng hoạt động.";
        return null;
    }

    private IQueryable<UserResponse> Users() =>
        _context.Users.AsNoTracking().Select(u => new UserResponse
        {
            Id = u.Id,
            Username = u.Username,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role,
            IsActive = u.IsActive,
            HouseholdId = u.HouseholdId,
            HouseholdCode = u.Household == null ? null : u.Household.HouseholdCode,
            ApartmentCode = u.Household == null || u.Household.Apartment == null ? null : u.Household.Apartment.ApartmentCode,
            MustChangePassword = u.MustChangePassword
        });
}
