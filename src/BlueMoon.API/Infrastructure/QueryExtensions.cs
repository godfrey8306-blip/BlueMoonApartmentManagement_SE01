using System.Linq.Expressions;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Infrastructure;

/// <summary>
/// Tham số phân trang dùng chung. Khi <see cref="Page"/> = null, endpoint giữ hành vi cũ
/// (trả toàn bộ danh sách) để tương thích ngược.
/// Sort: "field" (tăng dần) hoặc "-field" (giảm dần).
/// </summary>
public sealed class PageQuery
{
    public const int MaxPageSize = 500;

    [FromQuery(Name = "page")] public int? Page { get; set; }
    [FromQuery(Name = "pageSize")] public int? PageSize { get; set; }
    [FromQuery(Name = "sort")] public string? Sort { get; set; }

    public bool Descending => Sort?.StartsWith('-') == true;
    public string? SortField => Sort?.TrimStart('-').Trim().ToLowerInvariant();
}

public static class QueryExtensions
{
    public const string TotalCountHeader = "X-Total-Count";

    /// <summary>
    /// Áp dụng phân trang. Có page → ghi header X-Total-Count và trả về một trang.
    /// </summary>
    public static async Task<List<T>> ToPagedListAsync<T>(
        this IQueryable<T> query,
        HttpResponse response,
        PageQuery paging)
    {
        if (paging.Page is null)
            return await query.ToListAsync();

        var size = Math.Clamp(paging.PageSize ?? 20, 1, PageQuery.MaxPageSize);
        var page = Math.Max(paging.Page.Value, 1);
        var total = await query.CountAsync();
        response.Headers[TotalCountHeader] = total.ToString();
        response.Headers.AccessControlExposeHeaders = TotalCountHeader;
        return await query.Skip((page - 1) * size).Take(size).ToListAsync();
    }

    /// <summary>
    /// Sắp xếp theo danh sách cột được phép (whitelist). Cột không hợp lệ → dùng mặc định.
    /// </summary>
    public static IQueryable<T> ApplySort<T>(
        this IQueryable<T> query,
        PageQuery paging,
        IReadOnlyDictionary<string, Expression<Func<T, object?>>> columns,
        Func<IQueryable<T>, IOrderedQueryable<T>> defaultOrder)
    {
        var field = paging.SortField;
        if (field is null || !columns.TryGetValue(field, out var key))
            return defaultOrder(query);

        return paging.Descending ? query.OrderByDescending(key) : query.OrderBy(key);
    }

    public static int? GetUserId(this ClaimsPrincipal user)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(subject, out var id) ? id : null;
    }
}
