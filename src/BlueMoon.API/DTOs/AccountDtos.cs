using System.ComponentModel.DataAnnotations;

namespace BlueMoon.API.DTOs;

public sealed class LoginRequest
{
    [Required]
    [StringLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;
}

public sealed class LoginResponse
{
    public string AccessToken { get; init; } = string.Empty;
    public DateTime ExpiresAtUtc { get; init; }
    public UserResponse User { get; init; } = new();
}

public sealed class UserResponse
{
    public int Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public int? HouseholdId { get; init; }
    public string? HouseholdCode { get; init; }
    public string? ApartmentCode { get; init; }
    public bool MustChangePassword { get; init; }
}

public sealed class CreateUserRequest
{
    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(320)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [RegularExpression(Roles.Pattern, ErrorMessage = "Role must be Admin, User or Resident.")]
    public string Role { get; set; } = "User";

    /// <summary>Bắt buộc khi Role = Resident.</summary>
    public int? HouseholdId { get; set; }
}

public sealed class UpdateUserRequest
{
    [Required]
    [StringLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(320)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [RegularExpression(Roles.Pattern, ErrorMessage = "Role must be Admin, User or Resident.")]
    public string Role { get; set; } = "User";

    [StringLength(200, MinimumLength = 8)]
    public string? NewPassword { get; set; }

    /// <summary>Bắt buộc khi Role = Resident (bỏ trống → giữ hộ hiện tại).</summary>
    public int? HouseholdId { get; set; }
}

public sealed class UpdateProfileRequest
{
    [Required]
    [StringLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(320)]
    public string Email { get; set; } = string.Empty;
}

public sealed class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}

/// <summary>Kết quả cấp tài khoản cư dân — mật khẩu tạm chỉ trả về một lần.</summary>
public sealed record ProvisionedAccountDto
{
    public int UserId { get; init; }
    public int HouseholdId { get; init; }
    public string HouseholdCode { get; init; } = string.Empty;
    public string ApartmentCode { get; init; } = string.Empty;
    public string Username { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string TemporaryPassword { get; init; } = string.Empty;
}
