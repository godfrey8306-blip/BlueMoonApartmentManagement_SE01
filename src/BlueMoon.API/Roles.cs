namespace BlueMoon.API;

/// <summary>
/// Vai trò hệ thống.
///   Admin    = Ban quản trị (toàn quyền)
///   User     = Kế toán (thu phí, công nợ, thanh toán; chỉ đọc dữ liệu cư dân)
///   Resident = Cư dân (chỉ truy cập cổng /api/portal của hộ mình)
/// </summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Accountant = "User";
    public const string Resident = "Resident";

    /// <summary>Nhân viên nội bộ (dùng trong [Authorize(Roles = Roles.Staff)]).</summary>
    public const string Staff = Admin + "," + Accountant;

    public const string Pattern = "^(Admin|User|Resident)$";

    public static bool IsStaff(string? role) => role is Admin or Accountant;
}
