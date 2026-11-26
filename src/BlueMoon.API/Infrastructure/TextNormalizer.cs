using System.Globalization;
using System.Text;

namespace BlueMoon.API.Infrastructure;

/// <summary>
/// Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không dấu: "Nguyễn Văn Đạt" → "nguyen van dat".
/// </summary>
public static class TextNormalizer
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;
            builder.Append(ch == 'đ' ? 'd' : ch);
        }

        // Gộp khoảng trắng liên tiếp
        return string.Join(' ', builder.ToString().Normalize(NormalizationForm.FormC)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>Escape ký tự đặc biệt của LIKE để người dùng gõ % hoặc _ không làm sai truy vấn.</summary>
    public static string LikePattern(string term) =>
        "%" + term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
