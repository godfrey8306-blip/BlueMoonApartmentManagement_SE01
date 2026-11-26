namespace BlueMoon.API.Models;

public class User
{
    public int Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    /// <summary>Chỉ dùng cho role Resident: tài khoản thuộc hộ gia đình nào.</summary>
    public int? HouseholdId { get; set; }

    /// <summary>Bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp (tài khoản cấp mật khẩu tạm).</summary>
    public bool MustChangePassword { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Household? Household { get; set; }
}