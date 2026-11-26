using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>Tra cứu & thống kê (EP-004). Ban quản trị và Kế toán.</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/search-statistics")]
public sealed class SearchStatisticsController : ControllerBase
{
    private readonly AppDbContext _context;

    public SearchStatisticsController(AppDbContext context)
    {
        _context = context;
    }

    // ── Tìm kiếm toàn cục (Ctrl+K) ───────────────────────────

    [HttpGet("global")]
    public async Task<ActionResult<IEnumerable<GlobalSearchItemDto>>> Global([FromQuery] string? q, [FromQuery] int limit = 5)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return Ok(Array.Empty<GlobalSearchItemDto>());

        limit = Math.Clamp(limit, 1, 20);
        var raw = TextNormalizer.LikePattern(q.Trim());
        var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
        var results = new List<GlobalSearchItemDto>();

        results.AddRange(await _context.Apartments.AsNoTracking()
            .Where(a => EF.Functions.ILike(a.ApartmentCode, raw))
            .OrderBy(a => a.ApartmentCode)
            .Take(limit)
            .Select(a => new GlobalSearchItemDto
            {
                Type = "apartment",
                Id = a.Id,
                Title = $"Căn hộ {a.ApartmentCode}",
                Subtitle = "Tòa " + a.Building + " · Tầng " + a.Floor + " · " + a.Status,
                Link = "/apartments?q=" + a.ApartmentCode
            })
            .ToListAsync());

        results.AddRange(await _context.Households.AsNoTracking()
            .Where(h => EF.Functions.ILike(h.HouseholdCode, raw))
            .OrderBy(h => h.HouseholdCode)
            .Take(limit)
            .Select(h => new GlobalSearchItemDto
            {
                Type = "household",
                Id = h.Id,
                Title = $"Hộ {h.HouseholdCode}",
                Subtitle = "Căn " + h.Apartment!.ApartmentCode + " · Chủ hộ: " +
                           (h.Residents.Where(r => r.IsHouseholdHead).Select(r => r.FullName).FirstOrDefault() ?? "—"),
                Link = "/residents?householdId=" + h.Id
            })
            .ToListAsync());

        results.AddRange(await _context.Residents.AsNoTracking()
            .Where(r => EF.Functions.ILike(r.SearchName, plain) ||
                        EF.Functions.ILike(r.IdentityNumber, raw) ||
                        EF.Functions.ILike(r.PhoneNumber, raw))
            .OrderBy(r => r.FullName)
            .Take(limit)
            .Select(r => new GlobalSearchItemDto
            {
                Type = "resident",
                Id = r.Id,
                Title = r.FullName,
                Subtitle = "CCCD " + r.IdentityNumber + " · Căn " + r.Household!.Apartment!.ApartmentCode + " · " + r.Status,
                Link = "/residents?q=" + r.IdentityNumber
            })
            .ToListAsync());

        results.AddRange(await _context.Payments.AsNoTracking()
            .Where(p => EF.Functions.ILike(p.ReceiptNumber, raw))
            .OrderByDescending(p => p.PaymentDate)
            .Take(limit)
            .Select(p => new GlobalSearchItemDto
            {
                Type = "payment",
                Id = p.Id,
                Title = $"Phiếu thu {p.ReceiptNumber}",
                Subtitle = "Căn " + p.Apartment!.ApartmentCode,
                Link = "/payments?q=" + p.ReceiptNumber
            })
            .ToListAsync());

        return Ok(results);
    }

    // ── Tra cứu hộ / cư dân (PBI-005) ────────────────────────

    [HttpGet("households")]
    public async Task<ActionResult<IEnumerable<HouseholdSearchResponseDto>>> SearchHouseholds(
        [FromQuery] string? search,
        [FromQuery] int? apartmentId,
        [FromQuery] bool? isActive,
        [FromQuery] string? building,
        [FromQuery] PageQuery paging)
    {
        var query = _context.Households.AsNoTracking();

        if (apartmentId.HasValue)
            query = query.Where(h => h.ApartmentId == apartmentId.Value);
        if (isActive.HasValue)
            query = query.Where(h => h.IsActive == isActive.Value);
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(h => h.Apartment!.Building == building.Trim());
        if (!string.IsNullOrWhiteSpace(search))
        {
            var raw = TextNormalizer.LikePattern(search.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(search));
            query = query.Where(h =>
                EF.Functions.ILike(h.HouseholdCode, raw) ||
                (h.Apartment != null && EF.Functions.ILike(h.Apartment.ApartmentCode, raw)) ||
                h.Residents.Any(r =>
                    EF.Functions.ILike(r.SearchName, plain) ||
                    EF.Functions.ILike(r.IdentityNumber, raw) ||
                    EF.Functions.ILike(r.PhoneNumber, raw)));
        }

        var result = query
            .OrderBy(h => h.HouseholdCode)
            .Select(h => new HouseholdSearchResponseDto
            {
                Id = h.Id,
                HouseholdCode = h.HouseholdCode,
                ApartmentId = h.ApartmentId,
                ApartmentCode = h.Apartment == null ? string.Empty : h.Apartment.ApartmentCode,
                Building = h.Apartment == null ? string.Empty : h.Apartment.Building,
                IsActive = h.IsActive,
                ResidentCount = h.Residents.Count,
                Residents = h.Residents
                    .OrderByDescending(r => r.IsHouseholdHead)
                    .ThenBy(r => r.FullName)
                    .Select(r => new ResidentSearchResponseDto
                    {
                        Id = r.Id,
                        FullName = r.FullName,
                        IdentityNumber = r.IdentityNumber,
                        PhoneNumber = r.PhoneNumber,
                        Relationship = r.Relationship,
                        IsHouseholdHead = r.IsHouseholdHead,
                        Status = r.Status
                    })
                    .ToList()
            });

        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    // ── Tra cứu khoản thu / hóa đơn (PBI-016, 017) ───────────

    [HttpGet("charges")]
    public async Task<ActionResult<IEnumerable<FinancialSearchResponseDto>>> SearchCharges(
        [FromQuery] int? apartmentId,
        [FromQuery] int? feeCollectionId,
        [FromQuery] int? feeCategoryId,
        [FromQuery] string? status,
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] bool? overdue,
        [FromQuery] string? q,
        [FromQuery] PageQuery paging)
    {
        var query = _context.FeeCharges.AsNoTracking();
        if (apartmentId.HasValue)
            query = query.Where(c => c.ApartmentId == apartmentId.Value);
        if (feeCollectionId.HasValue)
            query = query.Where(c => c.FeeCollectionId == feeCollectionId.Value);
        if (feeCategoryId.HasValue)
            query = query.Where(c => c.FeeCategoryId == feeCategoryId.Value);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(c => c.Status == status.Trim());
        if (month.HasValue)
            query = query.Where(c => c.FeeCollection!.Month == month.Value);
        if (year.HasValue)
            query = query.Where(c => c.FeeCollection!.Year == year.Value);
        if (overdue == true)
        {
            var today = VnClock.Today;
            query = query.Where(c => c.Amount > c.PaidAmount && c.DueDate != null && c.DueDate < today);
        }
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(c => EF.Functions.ILike(c.Apartment!.ApartmentCode, TextNormalizer.LikePattern(q.Trim())));

        var result = query
            .OrderBy(c => c.Apartment!.ApartmentCode)
            .ThenByDescending(c => c.FeeCollection!.Year)
            .ThenByDescending(c => c.FeeCollection!.Month)
            .Select(c => new FinancialSearchResponseDto
            {
                FeeChargeId = c.Id,
                ApartmentId = c.ApartmentId,
                ApartmentCode = c.Apartment == null ? string.Empty : c.Apartment.ApartmentCode,
                FeeCollectionId = c.FeeCollectionId,
                FeeCollectionName = c.FeeCollection == null ? string.Empty : c.FeeCollection.Name,
                FeeCollectionMonth = c.FeeCollection == null ? 0 : c.FeeCollection.Month,
                FeeCollectionYear = c.FeeCollection == null ? 0 : c.FeeCollection.Year,
                FeeCategoryId = c.FeeCategoryId,
                FeeCategoryName = c.FeeCategory == null ? string.Empty : c.FeeCategory.Name,
                TotalAmount = c.Amount,
                PaidAmount = c.PaidAmount,
                OutstandingAmount = c.Amount - c.PaidAmount,
                Status = c.Status,
                DueDate = c.DueDate
            });

        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("payments")]
    public async Task<ActionResult<IEnumerable<PaymentSearchResponseDto>>> SearchPayments(
        [FromQuery] int? apartmentId,
        [FromQuery] int? feeCollectionId,
        [FromQuery] int? feeCategoryId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? receiptNumber,
        [FromQuery] PageQuery paging)
    {
        var query = _context.PaymentDetails.AsNoTracking();
        if (apartmentId.HasValue)
            query = query.Where(d => d.Payment!.ApartmentId == apartmentId.Value);
        if (feeCollectionId.HasValue)
            query = query.Where(d => d.FeeCharge!.FeeCollectionId == feeCollectionId.Value);
        if (feeCategoryId.HasValue)
            query = query.Where(d => d.FeeCharge!.FeeCategoryId == feeCategoryId.Value);
        if (fromDate.HasValue)
        {
            var fromUtc = VnClock.AsDate(fromDate.Value).AddHours(-7);
            query = query.Where(d => d.Payment!.PaymentDate >= fromUtc);
        }
        if (toDate.HasValue)
        {
            var toUtc = VnClock.AsDate(toDate.Value).AddDays(1).AddHours(-7);
            query = query.Where(d => d.Payment!.PaymentDate < toUtc);
        }
        if (!string.IsNullOrWhiteSpace(receiptNumber))
            query = query.Where(d => EF.Functions.ILike(d.Payment!.ReceiptNumber, TextNormalizer.LikePattern(receiptNumber.Trim())));

        var result = query
            .OrderByDescending(d => d.Payment!.PaymentDate)
            .ThenByDescending(d => d.PaymentId)
            .Select(d => new PaymentSearchResponseDto
            {
                PaymentId = d.PaymentId,
                ApartmentId = d.Payment == null ? 0 : d.Payment.ApartmentId,
                ApartmentCode = d.Payment == null || d.Payment.Apartment == null ? string.Empty : d.Payment.Apartment.ApartmentCode,
                ReceiptNumber = d.Payment == null ? string.Empty : d.Payment.ReceiptNumber,
                PaymentDate = d.Payment == null ? default : d.Payment.PaymentDate,
                Amount = d.Amount,
                PaymentMethod = d.Payment == null ? string.Empty : d.Payment.PaymentMethod,
                FeeChargeId = d.FeeChargeId,
                FeeCategoryName = d.FeeCharge == null || d.FeeCharge.FeeCategory == null ? string.Empty : d.FeeCharge.FeeCategory.Name,
                FeeCollectionId = d.FeeCharge == null ? 0 : d.FeeCharge.FeeCollectionId,
                FeeCollectionName = d.FeeCharge == null || d.FeeCharge.FeeCollection == null ? string.Empty : d.FeeCharge.FeeCollection.Name
            });

        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    // ── Thống kê ─────────────────────────────────────────────

    [HttpGet("statistics/collections")]
    public async Task<ActionResult<IEnumerable<CollectionStatisticsDto>>> CollectionStatistics(
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] string? status)
    {
        var query = _context.FeeCollections.AsNoTracking();
        if (month.HasValue)
            query = query.Where(c => c.Month == month.Value);
        if (year.HasValue)
            query = query.Where(c => c.Year == year.Value);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(c => c.Status == status.Trim());

        var today = VnClock.Today;
        var rows = await query
            .OrderByDescending(c => c.Year)
            .ThenByDescending(c => c.Month)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Month,
                c.Year,
                c.Status,
                c.DueDate,
                ChargeCount = c.FeeCharges.Count,
                TotalAmount = c.FeeCharges.Sum(f => (decimal?)f.Amount) ?? 0m,
                PaidAmount = c.FeeCharges.Sum(f => (decimal?)f.PaidAmount) ?? 0m,
                OverdueAmount = c.FeeCharges
                    .Where(f => f.DueDate != null && f.DueDate < today)
                    .Sum(f => (decimal?)(f.Amount - f.PaidAmount)) ?? 0m
            })
            .ToListAsync();

        return Ok(rows.Select(c => new CollectionStatisticsDto
        {
            FeeCollectionId = c.Id,
            FeeCollectionName = c.Name,
            Month = c.Month,
            Year = c.Year,
            Status = c.Status,
            DueDate = c.DueDate,
            ChargeCount = c.ChargeCount,
            TotalAmount = c.TotalAmount,
            PaidAmount = c.PaidAmount,
            OutstandingAmount = c.TotalAmount - c.PaidAmount,
            OverdueAmount = c.OverdueAmount,
            CollectionRate = CalculateRate(c.PaidAmount, c.TotalAmount)
        }));
    }

    [HttpGet("statistics/financial")]
    public async Task<ActionResult<FinancialStatisticsDto>> FinancialStatistics(
        [FromQuery] int? apartmentId,
        [FromQuery] int? feeCollectionId,
        [FromQuery] int? feeCategoryId,
        [FromQuery] string? building)
    {
        var charges = _context.FeeCharges.AsNoTracking().Where(c => c.FeeCollection!.Status != "Cancelled");
        if (apartmentId.HasValue)
            charges = charges.Where(c => c.ApartmentId == apartmentId.Value);
        if (feeCollectionId.HasValue)
            charges = charges.Where(c => c.FeeCollectionId == feeCollectionId.Value);
        if (feeCategoryId.HasValue)
            charges = charges.Where(c => c.FeeCategoryId == feeCategoryId.Value);
        if (!string.IsNullOrWhiteSpace(building))
            charges = charges.Where(c => c.Apartment!.Building == building.Trim());

        var rows = await charges
            .Select(c => new { c.ApartmentId, c.Amount, c.PaidAmount, c.Status, c.DueDate })
            .ToListAsync();

        var payments = _context.PaymentDetails.AsNoTracking();
        if (apartmentId.HasValue)
            payments = payments.Where(d => d.Payment!.ApartmentId == apartmentId.Value);
        if (feeCollectionId.HasValue)
            payments = payments.Where(d => d.FeeCharge!.FeeCollectionId == feeCollectionId.Value);
        if (feeCategoryId.HasValue)
            payments = payments.Where(d => d.FeeCharge!.FeeCategoryId == feeCategoryId.Value);
        if (!string.IsNullOrWhiteSpace(building))
            payments = payments.Where(d => d.Payment!.Apartment!.Building == building.Trim());

        var overdue = rows.Where(c => VnClock.IsOverdue(c.DueDate, c.Amount - c.PaidAmount)).ToList();
        var soon = VnClock.Today.AddDays(7);

        return Ok(new FinancialStatisticsDto
        {
            ChargeCount = rows.Count,
            PaymentCount = await payments.Select(d => d.PaymentId).Distinct().CountAsync(),
            TotalAmount = rows.Sum(c => c.Amount),
            PaidAmount = rows.Sum(c => c.PaidAmount),
            OutstandingAmount = rows.Sum(c => c.Amount - c.PaidAmount),
            CollectionRate = CalculateRate(rows.Sum(c => c.PaidAmount), rows.Sum(c => c.Amount)),
            UnpaidChargeCount = rows.Count(c => c.Status == "Unpaid"),
            PartiallyPaidChargeCount = rows.Count(c => c.Status == "PartiallyPaid"),
            PaidChargeCount = rows.Count(c => c.Status == "Paid"),
            OverdueChargeCount = overdue.Count,
            OverdueAmount = overdue.Sum(c => c.Amount - c.PaidAmount),
            OverdueApartmentCount = overdue.Select(c => c.ApartmentId).Distinct().Count(),
            DueSoonChargeCount = rows.Count(c => c.Amount > c.PaidAmount && c.DueDate.HasValue &&
                                                 c.DueDate.Value >= VnClock.Today && c.DueDate.Value <= soon)
        });
    }

    [HttpGet("statistics/apartments")]
    public async Task<ActionResult<IEnumerable<ApartmentContributionStatisticsDto>>> ApartmentStatistics(
        [FromQuery] int? feeCollectionId,
        [FromQuery] int? apartmentId,
        [FromQuery] string? building,
        [FromQuery] bool? debtOnly,
        [FromQuery] PageQuery paging)
    {
        var charges = _context.FeeCharges.AsNoTracking().Where(c => c.FeeCollection!.Status != "Cancelled");
        if (feeCollectionId.HasValue)
            charges = charges.Where(c => c.FeeCollectionId == feeCollectionId.Value);
        if (apartmentId.HasValue)
            charges = charges.Where(c => c.ApartmentId == apartmentId.Value);
        if (!string.IsNullOrWhiteSpace(building))
            charges = charges.Where(c => c.Apartment!.Building == building.Trim());

        var grouped = charges
            .GroupBy(c => new { c.ApartmentId, c.Apartment!.ApartmentCode })
            .Select(g => new
            {
                g.Key.ApartmentId,
                g.Key.ApartmentCode,
                ChargeCount = g.Count(),
                TotalAmount = g.Sum(c => c.Amount),
                PaidAmount = g.Sum(c => c.PaidAmount)
            });
        if (debtOnly == true)
            grouped = grouped.Where(g => g.TotalAmount > g.PaidAmount);

        var rows = await grouped
            .OrderByDescending(g => g.TotalAmount - g.PaidAmount)
            .ThenBy(g => g.ApartmentCode)
            .ToPagedListAsync(Response, paging);

        return Ok(rows.Select(r => new ApartmentContributionStatisticsDto
        {
            ApartmentId = r.ApartmentId,
            ApartmentCode = r.ApartmentCode,
            ChargeCount = r.ChargeCount,
            TotalAmount = r.TotalAmount,
            PaidAmount = r.PaidAmount,
            OutstandingAmount = r.TotalAmount - r.PaidAmount,
            CollectionRate = CalculateRate(r.PaidAmount, r.TotalAmount)
        }));
    }

    /// <summary>Doanh thu theo ngày thu thực tế, gom theo tháng / quý / năm (US-011, PBI-020).</summary>
    [HttpGet("statistics/revenue")]
    public async Task<ActionResult<RevenueReportDto>> Revenue(
        [FromQuery] string groupBy = "month",
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        groupBy = groupBy is "quarter" or "year" ? groupBy : "month";
        var toDate = to.HasValue ? VnClock.AsDate(to.Value) : VnClock.Today;
        var fromDate = from.HasValue
            ? VnClock.AsDate(from.Value)
            : groupBy == "year" ? new DateTime(toDate.Year - 4, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            : new DateTime(toDate.Year, toDate.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-11);
        var fromUtc = fromDate.AddHours(-7);
        var toUtc = toDate.AddDays(1).AddHours(-7);

        var details = await _context.PaymentDetails.AsNoTracking()
            .Where(d => d.Payment!.PaymentDate >= fromUtc && d.Payment.PaymentDate < toUtc)
            .Select(d => new
            {
                d.PaymentId,
                d.Payment!.PaymentDate,
                d.Amount,
                d.FeeCharge!.FeeCategoryId,
                CategoryName = d.FeeCharge.FeeCategory!.Name
            })
            .ToListAsync();

        string Key(DateTime utc)
        {
            var day = VnClock.DateOf(utc);
            return groupBy switch
            {
                "year" => $"{day.Year}",
                "quarter" => $"{day.Year}-Q{(day.Month - 1) / 3 + 1}",
                _ => $"{day.Year}-{day.Month:00}"
            };
        }

        string Label(string key) => groupBy switch
        {
            "year" => $"Năm {key}",
            "quarter" => $"Quý {key[^1]}/{key[..4]}",
            _ => $"{key[5..]}/{key[..4]}"
        };

        // Bao gồm cả các kỳ không có doanh thu để biểu đồ liền mạch
        var keys = new List<string>();
        for (var cursor = fromDate; cursor <= toDate; cursor = groupBy == "year" ? cursor.AddYears(1) : cursor.AddMonths(groupBy == "quarter" ? 3 : 1))
        {
            var k = Key(cursor);
            if (!keys.Contains(k)) keys.Add(k);
        }
        var lastKey = Key(toDate);
        if (!keys.Contains(lastKey)) keys.Add(lastKey);

        var grouped = details.GroupBy(d => Key(d.PaymentDate)).ToDictionary(g => g.Key);
        var buckets = keys.Select(k =>
        {
            grouped.TryGetValue(k, out var g);
            return new RevenueBucketDto
            {
                Period = k,
                Label = Label(k),
                Amount = g?.Sum(x => x.Amount) ?? 0m,
                PaymentCount = g?.Select(x => x.PaymentId).Distinct().Count() ?? 0,
                Categories = g?.GroupBy(x => new { x.FeeCategoryId, x.CategoryName })
                    .Select(c => new RevenueByCategoryDto
                    {
                        FeeCategoryId = c.Key.FeeCategoryId,
                        FeeCategoryName = c.Key.CategoryName,
                        Amount = c.Sum(x => x.Amount)
                    })
                    .OrderByDescending(c => c.Amount)
                    .ToList() ?? []
            };
        }).ToList();

        return Ok(new RevenueReportDto
        {
            GroupBy = groupBy,
            From = fromDate,
            To = toDate,
            TotalAmount = details.Sum(d => d.Amount),
            PaymentCount = details.Select(d => d.PaymentId).Distinct().Count(),
            Buckets = buckets
        });
    }

    /// <summary>Báo cáo tuổi nợ quá hạn (US-012, PBI-019).</summary>
    [HttpGet("statistics/aging")]
    public async Task<ActionResult<AgingReportDto>> Aging([FromQuery] string? building, [FromQuery] int top = 20)
    {
        var today = VnClock.Today;
        var charges = _context.FeeCharges.AsNoTracking()
            .Where(c => c.Amount > c.PaidAmount && c.FeeCollection!.Status != "Cancelled");
        if (!string.IsNullOrWhiteSpace(building))
            charges = charges.Where(c => c.Apartment!.Building == building.Trim());

        var rows = await charges
            .Select(c => new
            {
                c.ApartmentId,
                c.Apartment!.ApartmentCode,
                c.Apartment.Building,
                Outstanding = c.Amount - c.PaidAmount,
                c.DueDate
            })
            .ToListAsync();

        var overdue = rows
            .Where(r => r.DueDate.HasValue && VnClock.AsDate(r.DueDate.Value) < today)
            .Select(r => new { r.ApartmentId, r.ApartmentCode, r.Building, r.Outstanding, Days = (today - VnClock.AsDate(r.DueDate!.Value)).Days })
            .ToList();

        AgingBucketDto Bucket(string key, string label, Func<int, bool> match)
        {
            var items = overdue.Where(o => match(o.Days)).ToList();
            return new AgingBucketDto
            {
                Key = key,
                Label = label,
                ChargeCount = items.Count,
                ApartmentCount = items.Select(i => i.ApartmentId).Distinct().Count(),
                Amount = items.Sum(i => i.Outstanding)
            };
        }

        var notDue = rows.Where(r => !r.DueDate.HasValue || VnClock.AsDate(r.DueDate.Value) >= today).ToList();
        var buckets = new List<AgingBucketDto>
        {
            new()
            {
                Key = "current",
                Label = "Chưa đến hạn",
                ChargeCount = notDue.Count,
                ApartmentCount = notDue.Select(r => r.ApartmentId).Distinct().Count(),
                Amount = notDue.Sum(r => r.Outstanding)
            },
            Bucket("1-30", "Quá hạn 1–30 ngày", d => d <= 30),
            Bucket("31-60", "Quá hạn 31–60 ngày", d => d is > 30 and <= 60),
            Bucket("60+", "Quá hạn trên 60 ngày", d => d > 60),
        };

        var overdueIds = overdue.Select(o => o.ApartmentId).Distinct().ToList();
        var households = await _context.Households.AsNoTracking()
            .Where(h => h.IsActive && overdueIds.Contains(h.ApartmentId))
            .Select(h => new
            {
                h.ApartmentId,
                h.HouseholdCode,
                Head = h.Residents.Where(r => r.IsHouseholdHead).Select(r => new { r.FullName, r.PhoneNumber }).FirstOrDefault()
            })
            .ToListAsync();
        var lastReminders = await _context.FeeNotices.AsNoTracking()
            .Where(n => n.Type == "Reminder" && overdueIds.Contains(n.ApartmentId))
            .GroupBy(n => n.ApartmentId)
            .Select(g => new { ApartmentId = g.Key, Last = g.Max(n => n.IssuedAt) })
            .ToDictionaryAsync(x => x.ApartmentId, x => x.Last);

        var apartments = overdue
            .GroupBy(o => new { o.ApartmentId, o.ApartmentCode, o.Building })
            .Select(g =>
            {
                var h = households.FirstOrDefault(x => x.ApartmentId == g.Key.ApartmentId);
                return new OverdueApartmentDto
                {
                    ApartmentId = g.Key.ApartmentId,
                    ApartmentCode = g.Key.ApartmentCode,
                    Building = g.Key.Building,
                    HouseholdCode = h?.HouseholdCode,
                    HeadOfHousehold = h?.Head?.FullName,
                    PhoneNumber = h?.Head?.PhoneNumber,
                    ChargeCount = g.Count(),
                    OverdueAmount = g.Sum(x => x.Outstanding),
                    MaxDaysOverdue = g.Max(x => x.Days),
                    LastReminderAt = lastReminders.TryGetValue(g.Key.ApartmentId, out var last) ? last : null
                };
            })
            .OrderByDescending(a => a.OverdueAmount)
            .Take(Math.Clamp(top, 1, 500))
            .ToList();

        return Ok(new AgingReportDto
        {
            TotalOutstanding = rows.Sum(r => r.Outstanding),
            OverdueAmount = overdue.Sum(o => o.Outstanding),
            OverdueApartmentCount = overdueIds.Count,
            Buckets = buckets,
            Apartments = apartments
        });
    }

    private static decimal CalculateRate(decimal paid, decimal total) =>
        total <= 0m ? 0m : decimal.Round(paid / total * 100m, 2, MidpointRounding.AwayFromZero);
}
