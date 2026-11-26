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

/// <summary>Ghi nhận thanh toán (PBI-013 / US-008), tra cứu hóa đơn (US-010). Ban quản trị và Kế toán.</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/payments")]
public sealed class PaymentsController : ControllerBase
{
    private static readonly Dictionary<string, Expression<Func<PaymentResponseDto, object?>>> SortColumns = new()
    {
        ["date"] = p => p.PaymentDate,
        ["receipt"] = p => p.ReceiptNumber,
        ["apartment"] = p => p.ApartmentCode,
        ["amount"] = p => p.TotalAmount,
        ["method"] = p => p.PaymentMethod,
    };

    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public PaymentsController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    /// <summary>
    /// GET /api/payments?q=&amp;apartmentId=&amp;feeChargeId=&amp;feeCollectionId=&amp;receiptNumber=&amp;fromDate=&amp;toDate=&amp;method=&amp;building=&amp;page=&amp;pageSize=&amp;sort=
    /// q: mã phiếu / mã căn / tên người nộp (không dấu). Header X-Total-Amount = tổng tiền của tập lọc.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PaymentResponseDto>>> GetAll(
        [FromQuery] string? q,
        [FromQuery] int? apartmentId,
        [FromQuery] int? feeChargeId,
        [FromQuery] int? feeCollectionId,
        [FromQuery] string? receiptNumber,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? method,
        [FromQuery] string? building,
        [FromQuery] PageQuery paging)
    {
        var query = _context.Payments.AsNoTracking();

        if (apartmentId.HasValue)
            query = query.Where(p => p.ApartmentId == apartmentId.Value);
        if (feeChargeId.HasValue)
            query = query.Where(p => p.PaymentDetails.Any(d => d.FeeChargeId == feeChargeId.Value));
        if (feeCollectionId.HasValue)
            query = query.Where(p => p.PaymentDetails.Any(d => d.FeeCharge!.FeeCollectionId == feeCollectionId.Value));
        if (!string.IsNullOrWhiteSpace(receiptNumber))
            query = query.Where(p => EF.Functions.ILike(p.ReceiptNumber, TextNormalizer.LikePattern(receiptNumber.Trim())));
        if (!string.IsNullOrWhiteSpace(method))
            query = query.Where(p => p.PaymentMethod == method.Trim());
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(p => p.Apartment!.Building == building.Trim());
        // fromDate/toDate là ngày theo lịch VN → quy về khoảng UTC
        if (fromDate.HasValue)
        {
            var fromUtc = VnClock.AsDate(fromDate.Value).AddHours(-7);
            query = query.Where(p => p.PaymentDate >= fromUtc);
        }
        if (toDate.HasValue)
        {
            var toUtc = VnClock.AsDate(toDate.Value).AddDays(1).AddHours(-7);
            query = query.Where(p => p.PaymentDate < toUtc);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var raw = TextNormalizer.LikePattern(q.Trim());
            var plain = TextNormalizer.LikePattern(TextNormalizer.Normalize(q));
            query = query.Where(p =>
                EF.Functions.ILike(p.ReceiptNumber, raw) ||
                EF.Functions.ILike(p.Apartment!.ApartmentCode, raw) ||
                (p.Resident != null && EF.Functions.ILike(p.Resident.SearchName, plain)));
        }

        if (paging.Page.HasValue)
        {
            var sum = await query.SumAsync(p => (decimal?)p.TotalAmount) ?? 0m;
            Response.Headers["X-Total-Amount"] = sum.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        var result = Project(query).ApplySort(paging, SortColumns,
            x => x.OrderByDescending(p => p.PaymentDate).ThenByDescending(p => p.Id));
        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PaymentResponseDto>> GetById(int id)
    {
        var payment = await Project(_context.Payments.AsNoTracking().Where(p => p.Id == id)).FirstOrDefaultAsync();
        return payment is null ? NotFound() : Ok(payment);
    }

    [HttpGet("apartment/{apartmentId:int}")]
    public async Task<ActionResult<IEnumerable<PaymentResponseDto>>> GetByApartment(int apartmentId)
    {
        if (!await _context.Apartments.AnyAsync(a => a.Id == apartmentId))
            return NotFound(new { message = "Apartment not found." });

        return Ok(await Project(_context.Payments.AsNoTracking().Where(p => p.ApartmentId == apartmentId))
            .OrderByDescending(p => p.PaymentDate)
            .ThenByDescending(p => p.Id)
            .ToListAsync());
    }

    [HttpGet("fee-charge/{feeChargeId:int}")]
    public async Task<ActionResult<IEnumerable<PaymentDetailHistoryDto>>> GetByFeeCharge(int feeChargeId)
    {
        if (!await _context.FeeCharges.AnyAsync(c => c.Id == feeChargeId))
            return NotFound(new { message = "Fee charge not found." });

        var history = await _context.PaymentDetails
            .AsNoTracking()
            .Where(d => d.FeeChargeId == feeChargeId)
            .OrderByDescending(d => d.Payment!.PaymentDate)
            .ThenByDescending(d => d.Id)
            .Select(d => new PaymentDetailHistoryDto
            {
                PaymentId = d.PaymentId,
                ReceiptNumber = d.Payment == null ? string.Empty : d.Payment.ReceiptNumber,
                PaymentDate = d.Payment == null ? default : d.Payment.PaymentDate,
                PaymentMethod = d.Payment == null ? string.Empty : d.Payment.PaymentMethod,
                Amount = d.Amount
            })
            .ToListAsync();

        return Ok(history);
    }

    /// <summary>Gợi ý mã phiếu thu kế tiếp: PT{yyyyMMdd}-{số thứ tự trong ngày}.</summary>
    [HttpGet("next-receipt-number")]
    public async Task<ActionResult<object>> NextReceiptNumber()
    {
        var prefix = $"PT{VnClock.Today:yyyyMMdd}-";
        var count = await _context.Payments.CountAsync(p => p.ReceiptNumber.StartsWith(prefix));
        string candidate;
        do
        {
            count++;
            candidate = $"{prefix}{count:0000}";
        } while (await _context.Payments.AnyAsync(p => p.ReceiptNumber == candidate));
        return Ok(new { receiptNumber = candidate });
    }

    [HttpPost]
    public async Task<ActionResult<PaymentResponseDto>> Create(PaymentCreateDto dto)
    {
        var receivedByUserId = User.GetUserId();
        if (!receivedByUserId.HasValue)
            return Unauthorized(new { message = "Authenticated user id is missing from the token." });

        if (!await _context.Users.AnyAsync(u =>
                u.Id == receivedByUserId.Value && u.IsActive &&
                (u.Role == Roles.Admin || u.Role == Roles.Accountant)))
            return Forbid();

        var paymentDate = dto.PaymentDate.HasValue
            ? DateTime.SpecifyKind(dto.PaymentDate.Value, DateTimeKind.Utc)
            : DateTime.UtcNow;
        if (paymentDate > DateTime.UtcNow.AddMinutes(5))
            return BadRequest(new { message = "Ngày thanh toán không được ở tương lai." });

        var receiptNumber = dto.ReceiptNumber.Trim();
        if (await _context.Payments.AnyAsync(p => p.ReceiptNumber == receiptNumber))
            return Conflict(new { message = "Receipt number already exists." });

        var apartment = await _context.Apartments.FirstOrDefaultAsync(a => a.Id == dto.ApartmentId);
        if (apartment is null)
            return NotFound(new { message = "Apartment not found." });

        if (dto.ResidentId.HasValue)
        {
            var residentBelongsToApartment = await _context.Residents
                .AnyAsync(r => r.Id == dto.ResidentId.Value &&
                    r.Household != null && r.Household.ApartmentId == dto.ApartmentId);
            if (!residentBelongsToApartment)
                return BadRequest(new { message = "Resident does not belong to the selected apartment." });
        }

        var detailIds = dto.Details.Select(d => d.FeeChargeId).ToList();
        if (detailIds.Count != detailIds.Distinct().Count())
            return BadRequest(new { message = "A fee charge may appear only once in a payment." });

        var charges = await _context.FeeCharges
            .Include(c => c.FeeCollection)
            .Include(c => c.FeeCategory)
            .Where(c => detailIds.Contains(c.Id))
            .ToListAsync();
        if (charges.Count != detailIds.Count)
            return NotFound(new { message = "One or more fee charges were not found." });

        if (charges.Any(c => c.ApartmentId != dto.ApartmentId))
            return BadRequest(new { message = "All fee charges must belong to the selected apartment." });
        if (charges.Any(c => c.FeeCollection?.Status == "Cancelled"))
            return Conflict(new { message = "Không thể thu tiền cho khoản thuộc đợt thu đã hủy." });

        var requestedAmounts = dto.Details.ToDictionary(d => d.FeeChargeId, d => RoundMoney(d.Amount));
        foreach (var charge in charges)
        {
            var outstanding = RoundMoney(charge.Amount - charge.PaidAmount);
            if (requestedAmounts[charge.Id] > outstanding)
                return Conflict(new { message = $"Payment amount for fee charge {charge.Id} exceeds its outstanding amount." });
        }

        var totalAmount = RoundMoney(requestedAmounts.Values.Sum());
        if (totalAmount <= 0m)
            return BadRequest(new { message = "Payment total must be greater than zero." });

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var payment = new Payment
            {
                ApartmentId = dto.ApartmentId,
                ResidentId = dto.ResidentId,
                ReceivedByUserId = receivedByUserId.Value,
                ReceiptNumber = receiptNumber,
                PaymentDate = paymentDate,
                TotalAmount = totalAmount,
                PaymentMethod = dto.PaymentMethod.Trim(),
                Note = Normalize(dto.Note)
            };

            var paymentDay = VnClock.DateOf(paymentDate);
            var lateCount = 0;
            foreach (var charge in charges)
            {
                var amount = requestedAmounts[charge.Id];
                payment.PaymentDetails.Add(new PaymentDetail { FeeCharge = charge, Amount = amount });
                charge.PaidAmount = RoundMoney(charge.PaidAmount + amount);
                FeeChargesController.ApplyPaymentState(charge);
                if (charge.DueDate.HasValue && paymentDay > VnClock.AsDate(charge.DueDate.Value))
                    lateCount++;
            }

            _context.Payments.Add(payment);

            var items = string.Join(", ", charges.Select(c => $"{c.FeeCategory?.Name} {c.FeeCollection?.Month:00}/{c.FeeCollection?.Year}"));
            await _notifications.NotifyApartmentAsync(apartment.Id, receivedByUserId, "PaymentReceived",
                $"Đã nhận thanh toán {totalAmount:N0} đ",
                $"Phiếu thu {receiptNumber} ngày {paymentDay:dd/MM/yyyy}: {items}. Cảm ơn quý cư dân!",
                "/portal/payments", "success");
            await _notifications.NotifyStaffAsync(receivedByUserId, "Payment",
                $"Phiếu thu {receiptNumber} — căn {apartment.ApartmentCode}",
                $"{User.Identity?.Name} đã thu {totalAmount:N0} đ ({dto.PaymentMethod.Trim()})" +
                (lateCount > 0 ? $", trong đó {lateCount} khoản nộp trễ hạn." : "."),
                $"/payments?q={Uri.EscapeDataString(receiptNumber)}", lateCount > 0 ? "warning" : "success");

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var response = await Project(_context.Payments.AsNoTracking().Where(p => p.Id == payment.Id)).FirstAsync();
            return CreatedAtAction(nameof(GetById), new { id = payment.Id }, response);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync();
            return Conflict(new { message = "The payment could not be saved." });
        }
    }

    internal IQueryable<PaymentResponseDto> Project(IQueryable<Payment> query) => ProjectPayments(_context, query);

    internal static IQueryable<PaymentResponseDto> ProjectPayments(AppDbContext context, IQueryable<Payment> query) =>
        query.Select(p => new PaymentResponseDto
        {
            Id = p.Id,
            ApartmentId = p.ApartmentId,
            ApartmentCode = p.Apartment == null ? string.Empty : p.Apartment.ApartmentCode,
            ResidentId = p.ResidentId,
            ResidentFullName = p.Resident == null ? string.Empty : p.Resident.FullName,
            ReceivedByUserId = p.ReceivedByUserId,
            ReceivedByUsername = context.Users.Where(u => u.Id == p.ReceivedByUserId).Select(u => u.FullName).FirstOrDefault() ?? string.Empty,
            ReceiptNumber = p.ReceiptNumber,
            PaymentDate = p.PaymentDate,
            TotalAmount = p.TotalAmount,
            PaymentMethod = p.PaymentMethod,
            Note = p.Note ?? string.Empty,
            Details = p.PaymentDetails
                .OrderBy(d => d.Id)
                .Select(d => new PaymentDetailResponseDto
                {
                    Id = d.Id,
                    FeeChargeId = d.FeeChargeId,
                    FeeCategoryName = d.FeeCharge == null || d.FeeCharge.FeeCategory == null
                        ? string.Empty
                        : d.FeeCharge.FeeCategory.Name,
                    FeeCollectionId = d.FeeCharge == null ? 0 : d.FeeCharge.FeeCollectionId,
                    FeeCollectionName = d.FeeCharge == null || d.FeeCharge.FeeCollection == null
                        ? string.Empty
                        : d.FeeCharge.FeeCollection.Name,
                    Amount = d.Amount,
                    DueDate = d.FeeCharge == null ? null : d.FeeCharge.DueDate,
                    // Trễ hạn nếu thời điểm nộp (giờ VN) đã sang ngày sau hạn nộp: PaymentDate ≥ DueDate + 1 ngày - 7 giờ
                    IsLate = d.FeeCharge != null && d.FeeCharge.DueDate != null &&
                             p.PaymentDate >= d.FeeCharge.DueDate.Value.AddHours(17)
                })
                .ToList()
        });

    private static decimal RoundMoney(decimal amount) => decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class PaymentDetailHistoryDto
{
    public int PaymentId { get; init; }
    public string ReceiptNumber { get; init; } = string.Empty;
    public DateTime PaymentDate { get; init; }
    public string PaymentMethod { get; init; } = string.Empty;
    public decimal Amount { get; init; }
}
