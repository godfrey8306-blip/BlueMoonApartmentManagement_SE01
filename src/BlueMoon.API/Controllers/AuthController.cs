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
public sealed class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PasswordHasher _passwordHasher;
    private readonly JwtTokenService _tokenService;

    public AuthController(
        AppDbContext context,
        PasswordHasher passwordHasher,
        JwtTokenService tokenService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var username = request.Username.Trim();
        var user = await _context.Users
            .Include(u => u.Household).ThenInclude(h => h!.Apartment)
            .SingleOrDefaultAsync(u => u.Username == username);

        if (user is null || !user.IsActive || !_passwordHasher.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid username or password." });

        if (user.Role == Roles.Resident && (user.Household is null || !user.Household.IsActive))
            return Unauthorized(new { message = "Tài khoản cư dân không còn gắn với hộ gia đình đang hoạt động." });

        var (token, expiresAtUtc) = _tokenService.CreateToken(user);

        return Ok(new LoginResponse
        {
            AccessToken = token,
            ExpiresAtUtc = expiresAtUtc,
            User = ToResponse(user)
        });
    }

    /// <summary>Thông tin tài khoản đang đăng nhập (mọi vai trò).</summary>
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var user = await CurrentUser();
        return user is null ? Unauthorized() : Ok(ToResponse(user));
    }

    /// <summary>Tự cập nhật họ tên, email (PBI-024) — mọi vai trò.</summary>
    [Authorize]
    [HttpPut("me")]
    public async Task<ActionResult<UserResponse>> UpdateMe(UpdateProfileRequest request)
    {
        var user = await CurrentUser();
        if (user is null)
            return Unauthorized();

        var email = request.Email.Trim();
        if (await _context.Users.AnyAsync(u => u.Email == email && u.Id != user.Id))
            return Conflict(new { message = "Email already exists." });

        user.FullName = request.FullName.Trim();
        user.Email = email;
        await _context.SaveChangesAsync();
        return Ok(ToResponse(user));
    }

    /// <summary>Đổi mật khẩu (PBI-023): bắt buộc xác thực mật khẩu hiện tại — mọi vai trò.</summary>
    [Authorize]
    [HttpPost("change-password")]
    public async Task<ActionResult<UserResponse>> ChangePassword(ChangePasswordRequest request)
    {
        var user = await CurrentUser();
        if (user is null)
            return Unauthorized();

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Mật khẩu hiện tại không đúng." });

        if (request.CurrentPassword == request.NewPassword)
            return BadRequest(new { message = "Mật khẩu mới phải khác mật khẩu hiện tại." });

        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        user.MustChangePassword = false;
        await _context.SaveChangesAsync();
        return Ok(ToResponse(user));
    }

    private async Task<User?> CurrentUser()
    {
        var id = User.GetUserId();
        if (id is null)
            return null;

        return await _context.Users
            .Include(u => u.Household).ThenInclude(h => h!.Apartment)
            .FirstOrDefaultAsync(u => u.Id == id && u.IsActive);
    }

    internal static UserResponse ToResponse(User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role,
        IsActive = user.IsActive,
        HouseholdId = user.HouseholdId,
        HouseholdCode = user.Household?.HouseholdCode,
        ApartmentCode = user.Household?.Apartment?.ApartmentCode,
        MustChangePassword = user.MustChangePassword
    };
}
