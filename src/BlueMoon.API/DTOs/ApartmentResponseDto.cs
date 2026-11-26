namespace BlueMoon.API.DTOs;

public class ApartmentResponseDto
{
    public int Id { get; set; }
    public string ApartmentCode { get; set; } = string.Empty;
    public string Building { get; set; } = string.Empty;
    public int Floor { get; set; }
    public decimal Area { get; set; }
    public string Status { get; set; } = string.Empty;

    /// <summary>Mã hộ gia đình đang hoạt động tại căn hộ (nếu có).</summary>
    public string? HouseholdCode { get; set; }

    /// <summary>Số nhân khẩu đang cư trú (không tính đã chuyển đi).</summary>
    public int ResidentCount { get; set; }
}