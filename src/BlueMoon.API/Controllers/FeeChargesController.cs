using System.Linq.Expressions;
using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using BlueMoon.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>Khoản phải thu & công nợ (PBI-011, 014, 015 / US-009). Ban quản trị và Kế toán.</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/fee-charges")]
public sealed class FeeChargesController : ControllerBase
{
    private static readonly string[] PaymentStatuses = ["Unpaid", "PartiallyPaid", "Paid"];
    private static readonly string[] InactiveResidentStatuses = ["MovedOut", "TemporarilyAbsent", "Deceased"];

    private static readonly Dictionary<string, Expression<Func<FeeChargeResponseDto, object?>>> SortColumns = new()
    {
        ["apartment"] = c => c.ApartmentCode,
        ["building"] = c => c.ApartmentBuilding,
        ["collection"] = c => c.FeeCollectionYear * 100 + c.FeeCollectionMonth,
        ["category"] = c => c.FeeCategoryName,
        ["total"] = c => c.TotalAmount,
        ["paid"] = c => c.PaidAmount,
        ["outstanding"] = c => c.OutstandingAmount,
        ["due"] = c => c.DueDate,
        ["status"] = c => c.Status,
    };

    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public FeeChargesController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    /// <summary>
    /// GET /api/fee-charges
    ///   feeCollectionId, apartmentId, feeCategoryId, status, building, q (mã căn),
    ///   overdue (true: quá hạn), dueSoon (true: đến hạn trong 7 ngày), outstanding (true: còn nợ),
    ///   dueFrom, dueTo, page, pageSize, sort
    /// Header X-Total-Count + X-Total-Amount / X-Paid-Amount / X-Outstanding-Amount (tổng của toàn bộ tập lọc).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FeeChargeResponseDto>>> GetAll(
        [FromQuery] int? feeCollectionId,
        [FromQuery] int? apartmentId,
        [FromQuery] int? feeCategoryId,
        [FromQuery] string? status,
        [FromQuery] string? building,
        [FromQuery] string? q,
        [FromQuery] bool? overdue,
        [FromQuery] bool? dueSoon,
        [FromQuery] bool? outstanding,
        [FromQuery] DateTime? dueFrom,
        [FromQuery] DateTime? dueTo,
        [FromQuery] PageQuery paging)
    {
        var query = _context.FeeCharges.AsNoTracking();

        if (feeCollectionId.HasValue)
            query = query.Where(c => c.FeeCollectionId == feeCollectionId.Value);
        if (apartmentId.HasValue)
            query = query.Where(c => c.ApartmentId == apartmentId.Value);
        if (feeCategoryId.HasValue)
            query = query.Where(c => c.FeeCategoryId == feeCategoryId.Value);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim();
            if (!PaymentStatuses.Contains(normalizedStatus, StringComparer.Ordinal))
                return BadRequest(new { message = "Status must be Unpaid, PartiallyPaid, or Paid." });
            query = query.Where(c => c.Status == normalizedStatus);
        }
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(c => c.Apartment!.Building == building.Trim());
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(c =>
                EF.Functions.ILike(c.Apartment!.ApartmentCode, pattern) ||
                c.Apartment.Households.Any(h => h.IsActive &&
                    (EF.Functions.ILike(h.HouseholdCode, pattern) ||
                     h.Residents.Any(r => r.IsHouseholdHead && EF.Functions.ILike(r.SearchName, plain)))));
        }

        var today = VnClock.Today;
        if (outstanding == true)
            query = query.Where(c => c.Amount > c.PaidAmount);
        if (overdue == true)
            query = query.Where(c => c.Amount > c.PaidAmount && c.DueDate != null && c.DueDate < today);
        if (overdue == false)
            query = query.Where(c => !(c.Amount > c.PaidAmount && c.DueDate != null && c.DueDate < today));
        if (dueSoon == true)
        {
            var soon = today.AddDays(7);
            query = query.Where(c => c.Amount > c.PaidAmount && c.DueDate != null && c.DueDate >= today && c.DueDate <= soon);
        }
        if (dueFrom.HasValue)
            query = query.Where(c => c.DueDate >= VnClock.AsDate(dueFrom.Value));
        if (dueTo.HasValue)
            query = query.Where(c => c.DueDate <= VnClock.AsDate(dueTo.Value));

        if (paging.Page.HasValue)
        {
            var totals = await query
                .GroupBy(_ => 1)
                .Select(g => new { Total = g.Sum(c => c.Amount), Paid = g.Sum(c => c.PaidAmount) })
                .FirstOrDefaultAsync();
            Response.Headers["X-Total-Amount"] = (totals?.Total ?? 0m).ToString(System.Globalization.CultureInfo.InvariantCulture);
            Response.Headers["X-Paid-Amount"] = (totals?.Paid ?? 0m).ToString(System.Globalization.CultureInfo.InvariantCulture);
            Response.Headers["X-Outstanding-Amount"] = ((totals?.Total ?? 0m) - (totals?.Paid ?? 0m)).ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        var result = Project(query).ApplySort(paging, SortColumns, x => x
            .OrderBy(c => c.ApartmentCode)
            .ThenByDescending(c => c.FeeCollectionYear)
            .ThenByDescending(c => c.FeeCollectionMonth)
            .ThenBy(c => c.FeeCategoryName)
            .ThenBy(c => c.Id));

        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FeeChargeResponseDto>> GetById(int id)
    {
        var charge = await Project(_context.FeeCharges.AsNoTracking().Where(c => c.Id == id)).FirstOrDefaultAsync();
        return charge is null ? NotFound() : Ok(charge);
    }

    [HttpGet("apartment/{apartmentId:int}")]
    public async Task<ActionResult<FeeChargeDebtSummaryDto>> GetByApartment(
        int apartmentId,
        [FromQuery] int? feeCollectionId,
        [FromQuery] string? status)
    {
        if (!await _context.Apartments.AnyAsync(a => a.Id == apartmentId))
            return NotFound(new { message = "Apartment not found." });

        var charges = await GetFilteredCharges(feeCollectionId, apartmentId, status);
        return Ok(await CreateSummary(apartmentId, feeCollectionId, charges));
    }

    [HttpGet("collection/{collectionId:int}")]
    public async Task<ActionResult<IEnumerable<FeeChargeResponseDto>>> GetByCollection(
        int collectionId,
        [FromQuery] int? apartmentId,
        [FromQuery] string? status)
    {
        if (!await _context.FeeCollections.AnyAsync(c => c.Id == collectionId))
            return NotFound(new { message = "Fee collection not found." });

        return Ok(await GetFilteredCharges(collectionId, apartmentId, status));
    }

    [HttpGet("debt-summary")]
    public async Task<ActionResult<FeeChargeDebtSummaryDto>> GetDebtSummary(
        [FromQuery] int apartmentId,
        [FromQuery] int? feeCollectionId,
        [FromQuery] string? status)
    {
        if (!await _context.Apartments.AnyAsync(a => a.Id == apartmentId))
            return NotFound(new { message = "Apartment not found." });

        var charges = await GetFilteredCharges(feeCollectionId, apartmentId, status);
        return Ok(await CreateSummary(apartmentId, feeCollectionId, charges));
    }

    [HttpPost]
    public async Task<ActionResult<FeeChargeResponseDto>> Create(FeeChargeCreateDto dto)
    {
        var collection = await _context.FeeCollections.FirstOrDefaultAsync(c => c.Id == dto.FeeCollectionId);
        if (collection is null)
            return NotFound(new { message = "Fee collection not found." });
        if (!string.Equals(collection.Status, "Open", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Fee charges can only be created in an open fee collection." });

        if (!await _context.Apartments.AnyAsync(a => a.Id == dto.ApartmentId))
            return NotFound(new { message = "Apartment not found." });

        var category = await _context.FeeCategories.FirstOrDefaultAsync(c => c.Id == dto.FeeCategoryId);
        if (category is null)
            return NotFound(new { message = "Fee category not found." });
        if (!category.IsActive)
            return Conflict(new { message = "The fee category is inactive." });

        if (await HasDuplicate(dto.FeeCollectionId, dto.ApartmentId, dto.FeeCategoryId))
            return Conflict(new { message = "A fee charge already exists for this apartment, collection, and category." });

        var unitPrice = RoundMoney(category.UnitPrice);
        var charge = new FeeCharge
        {
            FeeCollectionId = dto.FeeCollectionId,
            ApartmentId = dto.ApartmentId,
            FeeCategoryId = dto.FeeCategoryId,
            Quantity = dto.Quantity,
            UnitPrice = unitPrice,
            Amount = CalculateAmount(dto.Quantity, unitPrice),
            PaidAmount = 0m,
            DueDate = dto.DueDate.HasValue ? VnClock.AsDate(dto.DueDate.Value) : collection.DueDate,
            Status = "Unpaid"
        };

        _context.FeeCharges.Add(charge);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The fee charge could not be saved." });
        }

        var response = await Project(_context.FeeCharges.AsNoTracking().Where(c => c.Id == charge.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = charge.Id }, response);
    }

    /// <summary>
    /// Sinh danh sách phải thu cho toàn bộ căn hộ theo đợt thu + khoản thu (PBI-011).
    /// Preview=true chỉ tính toán. Bỏ qua căn đã có khoản; ghi trong một transaction.
    /// </summary>
    [HttpPost("generate")]
    public async Task<ActionResult<FeeChargeGenerateResultDto>> Generate(FeeChargeGenerateDto dto)
    {
        var collection = await _context.FeeCollections.FirstOrDefaultAsync(c => c.Id == dto.FeeCollectionId);
        if (collection is null)
            return NotFound(new { message = "Fee collection not found." });
        if (collection.Status != "Open")
            return Conflict(new { message = "Fee charges can only be created in an open fee collection." });

        var category = await _context.FeeCategories.FirstOrDefaultAsync(c => c.Id == dto.FeeCategoryId);
        if (category is null)
            return NotFound(new { message = "Fee category not found." });
        if (!category.IsActive)
            return Conflict(new { message = "The fee category is inactive." });
        if (!category.IsMandatory)
            return Conflict(new { message = "Khoản thu tự nguyện không lập danh sách phải thu hàng loạt (không phải công nợ). Hãy ghi nhận riêng cho từng hộ đóng góp." });
        if (dto.Mode == "fixed" && dto.FixedQuantity is null)
            return BadRequest(new { message = "Cần nhập số lượng cố định." });

        var apartments = await _context.Apartments.AsNoTracking()
            .Where(a => !dto.OnlyOccupied || a.Households.Any(h => h.IsActive))
            .OrderBy(a => a.Building).ThenBy(a => a.Floor).ThenBy(a => a.ApartmentCode)
            .Select(a => new
            {
                a.Id,
                a.ApartmentCode,
                a.Building,
                a.Area,
                Residents = a.Households.Where(h => h.IsActive)
                    .SelectMany(h => h.Residents)
                    .Count(r => !InactiveResidentStatuses.Contains(r.Status)),
                HouseholdCode = a.Households.Where(h => h.IsActive).Select(h => h.HouseholdCode).FirstOrDefault(),
                HeadOfHousehold = a.Households.Where(h => h.IsActive)
                    .SelectMany(h => h.Residents)
                    .Where(r => r.IsHouseholdHead)
                    .Select(r => r.FullName)
                    .FirstOrDefault()
            })
            .ToListAsync();

        var existing = (await _context.FeeCharges
            .Where(c => c.FeeCollectionId == dto.FeeCollectionId && c.FeeCategoryId == dto.FeeCategoryId)
            .Select(c => c.ApartmentId)
            .ToListAsync()).ToHashSet();

        var unitPrice = RoundMoney(category.UnitPrice);
        var rows = new List<FeeChargeGenerateRowDto>();
        foreach (var a in apartments)
        {
            var quantity = dto.Mode == "fixed"
                ? dto.FixedQuantity!.Value
                : category.CalculationMethod switch
                {
                    "PerArea" => a.Area,
                    "PerResident" => a.Residents,
                    _ => 1m
                };
            if (quantity < 0.01m)
                continue;
            rows.Add(new FeeChargeGenerateRowDto
            {
                ApartmentId = a.Id,
                ApartmentCode = a.ApartmentCode,
                Building = a.Building,
                HouseholdCode = a.HouseholdCode,
                HeadOfHousehold = a.HeadOfHousehold,
                Quantity = quantity,
                Amount = CalculateAmount(quantity, unitPrice),
                Exists = existing.Contains(a.Id)
            });
        }

        var dueDate = dto.DueDate.HasValue ? VnClock.AsDate(dto.DueDate.Value) : collection.DueDate;
        var toCreate = rows.Where(r => !r.Exists).ToList();
        var result = new FeeChargeGenerateResultDto
        {
            Preview = dto.Preview,
            ApartmentCount = rows.Count,
            ExistingCount = rows.Count - toCreate.Count,
            CreatedCount = dto.Preview ? 0 : toCreate.Count,
            TotalAmount = toCreate.Sum(r => r.Amount),
            DueDate = dueDate,
            Rows = rows
        };
        if (dto.Preview || toCreate.Count == 0)
            return Ok(result);

        await using var transaction = await _context.Database.BeginTransactionAsync();
        foreach (var row in toCreate)
        {
            _context.FeeCharges.Add(new FeeCharge
            {
                FeeCollectionId = collection.Id,
                ApartmentId = row.ApartmentId,
                FeeCategoryId = category.Id,
                Quantity = row.Quantity,
                UnitPrice = unitPrice,
                Amount = row.Amount,
                PaidAmount = 0m,
                DueDate = dueDate,
                Status = "Unpaid"
            });
        }
        await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCharges",
            $"Đã lập danh sách phải thu: {category.Name}",
            $"{User.Identity?.Name} đã sinh {toCreate.Count} khoản \"{category.Name}\" cho {collection.Name}, tổng {result.TotalAmount:N0} đ, hạn {dueDate:dd/MM/yyyy}.",
            $"/fee-charges?feeCollectionId={collection.Id}&feeCategoryId={category.Id}");
        try
        {
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync();
            return Conflict(new { message = "Không thể lập danh sách phải thu (có thể đã bị tạo đồng thời). Vui lòng thử lại." });
        }

        return Ok(result);
    }

    /// <summary>Gửi nhắc nợ cho các căn hộ có khoản quá hạn (ghi FeeNotice type Reminder + thông báo cư dân).</summary>
    [HttpPost("reminders")]
    public async Task<ActionResult<IssueResultDto>> SendReminders(ReminderRequestDto dto)
    {
        var issuerId = User.GetUserId();
        if (issuerId is null)
            return Unauthorized();

        var today = VnClock.Today;
        var query = _context.FeeCharges
            .Where(c => c.Amount > c.PaidAmount && c.DueDate != null && c.DueDate < today &&
                        c.FeeCollection!.Status != "Cancelled");
        if (dto.ApartmentIds is { Count: > 0 })
            query = query.Where(c => dto.ApartmentIds.Contains(c.ApartmentId));

        var groups = await query
            .GroupBy(c => new { c.ApartmentId, c.FeeCollectionId })
            .Select(g => new
            {
                g.Key.ApartmentId,
                g.Key.FeeCollectionId,
                Total = g.Sum(c => c.Amount),
                Outstanding = g.Sum(c => c.Amount - c.PaidAmount),
                DueDate = g.Min(c => c.DueDate)
            })
            .ToListAsync();
        if (groups.Count == 0)
            return Conflict(new { message = "Không có khoản quá hạn nào để nhắc." });

        var collectionNames = await _context.FeeCollections
            .Where(c => groups.Select(g => g.FeeCollectionId).Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => $"{c.Month:00}/{c.Year}");

        var notified = 0;
        foreach (var apartment in groups.GroupBy(g => g.ApartmentId))
        {
            foreach (var g in apartment)
            {
                _context.FeeNotices.Add(new FeeNotice
                {
                    FeeCollectionId = g.FeeCollectionId,
                    ApartmentId = g.ApartmentId,
                    Type = "Reminder",
                    TotalAmount = g.Total,
                    OutstandingAmount = g.Outstanding,
                    DueDate = g.DueDate!.Value,
                    Message = string.IsNullOrWhiteSpace(dto.Message) ? null : dto.Message.Trim(),
                    IssuedByUserId = issuerId.Value
                });
            }

            var totalOutstanding = apartment.Sum(g => g.Outstanding);
            var periods = string.Join(", ", apartment.Select(g => collectionNames.GetValueOrDefault(g.FeeCollectionId, "?")));
            var maxDays = (today - apartment.Min(g => g.DueDate)!.Value).Days;
            notified += await _notifications.NotifyApartmentAsync(apartment.Key, issuerId, "Reminder",
                "Nhắc nợ phí quá hạn",
                $"Căn hộ của bạn còn nợ {totalOutstanding:N0} đ đã quá hạn (kỳ {periods}, trễ {maxDays} ngày). Vui lòng thanh toán sớm." +
                (string.IsNullOrWhiteSpace(dto.Message) ? string.Empty : $" {dto.Message.Trim()}"),
                "/portal/charges?overdue=true", "danger");
        }

        var apartmentCount = groups.Select(g => g.ApartmentId).Distinct().Count();
        var amount = groups.Sum(g => g.Outstanding);
        await _notifications.NotifyStaffAsync(issuerId, "Reminder",
            "Đã gửi nhắc nợ quá hạn",
            $"{User.Identity?.Name} đã nhắc nợ {apartmentCount} căn hộ, tổng quá hạn {amount:N0} đ.",
            "/fee-charges?overdue=true", "warning");
        await _context.SaveChangesAsync();

        return Ok(new IssueResultDto
        {
            NoticeCount = apartmentCount,
            NotifiedAccountCount = notified,
            TotalAmount = amount
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, FeeChargeUpdateDto dto)
    {
        var charge = await _context.FeeCharges.FirstOrDefaultAsync(c => c.Id == id);
        if (charge is null)
            return NotFound();

        var amount = CalculateAmount(dto.Quantity, charge.UnitPrice);
        if (amount < charge.PaidAmount)
            return Conflict(new { message = "Total amount cannot be less than the amount already paid." });

        charge.Quantity = dto.Quantity;
        charge.Amount = amount;
        if (dto.DueDate.HasValue)
            charge.DueDate = VnClock.AsDate(dto.DueDate.Value);
        ApplyPaymentState(charge);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The fee charge could not be updated." });
        }

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var charge = await _context.FeeCharges.FirstOrDefaultAsync(c => c.Id == id);
        if (charge is null)
            return NotFound();

        if (charge.PaidAmount > 0m || await _context.PaymentDetails.AnyAsync(d => d.FeeChargeId == id))
            return Conflict(new { message = "Cannot delete a fee charge with payment history." });

        _context.FeeCharges.Remove(charge);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Cannot delete the fee charge because related data exists." });
        }

        return NoContent();
    }

    internal static IQueryable<FeeChargeResponseDto> Project(IQueryable<FeeCharge> query) =>
        query.Select(c => new FeeChargeResponseDto
        {
            Id = c.Id,
            FeeCollectionId = c.FeeCollectionId,
            FeeCollectionName = c.FeeCollection == null ? string.Empty : c.FeeCollection.Name,
            FeeCollectionMonth = c.FeeCollection == null ? 0 : c.FeeCollection.Month,
            FeeCollectionYear = c.FeeCollection == null ? 0 : c.FeeCollection.Year,
            FeeCollectionStatus = c.FeeCollection == null ? string.Empty : c.FeeCollection.Status,
            ApartmentId = c.ApartmentId,
            ApartmentCode = c.Apartment == null ? string.Empty : c.Apartment.ApartmentCode,
            ApartmentBuilding = c.Apartment == null ? string.Empty : c.Apartment.Building,
            FeeCategoryId = c.FeeCategoryId,
            FeeCategoryName = c.FeeCategory == null ? string.Empty : c.FeeCategory.Name,
            FeeCategoryUnit = c.FeeCategory == null ? string.Empty : c.FeeCategory.Unit,
            CalculationMethod = c.FeeCategory == null ? string.Empty : c.FeeCategory.CalculationMethod,
            Quantity = c.Quantity,
            UnitPrice = c.UnitPrice,
            TotalAmount = c.Amount,
            PaidAmount = c.PaidAmount,
            OutstandingAmount = c.Amount - c.PaidAmount,
            DueDate = c.DueDate,
            Status = c.Status
        });

    private async Task<List<FeeChargeResponseDto>> GetFilteredCharges(int? feeCollectionId, int? apartmentId, string? status)
    {
        var query = _context.FeeCharges.AsNoTracking();
        if (feeCollectionId.HasValue)
            query = query.Where(c => c.FeeCollectionId == feeCollectionId.Value);
        if (apartmentId.HasValue)
            query = query.Where(c => c.ApartmentId == apartmentId.Value);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim();
            if (!PaymentStatuses.Contains(normalizedStatus, StringComparer.Ordinal))
                throw new BadHttpRequestException("Status must be Unpaid, PartiallyPaid, or Paid.");
            query = query.Where(c => c.Status == normalizedStatus);
        }

        return await Project(query).OrderBy(c => c.DueDate).ThenBy(c => c.Id).ToListAsync();
    }

    private async Task<FeeChargeDebtSummaryDto> CreateSummary(int apartmentId, int? feeCollectionId, List<FeeChargeResponseDto> charges)
    {
        var apartmentCode = await _context.Apartments
            .Where(a => a.Id == apartmentId)
            .Select(a => a.ApartmentCode)
            .FirstAsync();

        return new FeeChargeDebtSummaryDto
        {
            ApartmentId = apartmentId,
            ApartmentCode = apartmentCode,
            FeeCollectionId = feeCollectionId,
            TotalAmount = charges.Sum(c => c.TotalAmount),
            PaidAmount = charges.Sum(c => c.PaidAmount),
            OutstandingAmount = charges.Sum(c => c.OutstandingAmount),
            ChargeCount = charges.Count,
            Charges = charges
        };
    }

    private Task<bool> HasDuplicate(int collectionId, int apartmentId, int categoryId) =>
        _context.FeeCharges.AnyAsync(c =>
            c.FeeCollectionId == collectionId && c.ApartmentId == apartmentId && c.FeeCategoryId == categoryId);

    private static decimal CalculateAmount(decimal quantity, decimal unitPrice) => RoundMoney(quantity * unitPrice);

    private static decimal RoundMoney(decimal amount) => decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    internal static void ApplyPaymentState(FeeCharge charge)
    {
        charge.Status = charge.PaidAmount switch
        {
            <= 0m => "Unpaid",
            _ when charge.PaidAmount < charge.Amount => "PartiallyPaid",
            _ => "Paid"
        };
    }
}
