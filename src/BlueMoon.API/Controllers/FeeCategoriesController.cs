using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using BlueMoon.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

/// <summary>Danh mục khoản thu — Ban quản trị và Kế toán (US-006).</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/[controller]")]
public sealed class FeeCategoriesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notifications;

    public FeeCategoriesController(AppDbContext context, NotificationService notifications)
    {
        _context = context;
        _notifications = notifications;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FeeCategoryResponseDto>>> GetAll(
        [FromQuery] bool? isActive,
        [FromQuery] string? name)
    {
        var query = FeeCategoryResponses();

        if (isActive.HasValue)
            query = query.Where(f => f.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(name))
        {
            var search = name.Trim();
            query = query.Where(f => EF.Functions.ILike(f.Name, $"%{search}%"));
        }

        return Ok(await query
            .OrderBy(f => f.Name)
            .ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FeeCategoryResponseDto>> GetById(int id)
    {
        var category = await FeeCategoryResponses()
            .FirstOrDefaultAsync(f => f.Id == id);

        return category is null ? NotFound() : Ok(category);
    }

    [HttpPost]
    public async Task<ActionResult<FeeCategoryResponseDto>> Create(FeeCategoryCreateDto dto)
    {
        var name = dto.Name.Trim();
        if (await HasDuplicateName(name))
            return Conflict(new { message = "Fee category name already exists." });

        var category = new FeeCategory
        {
            Name = name,
            Description = Normalize(dto.Description),
            Unit = dto.Unit.Trim(),
            UnitPrice = dto.UnitPrice,
            CalculationMethod = dto.CalculationMethod.Trim(),
            IsMandatory = dto.IsMandatory,
            IsActive = true
        };

        _context.FeeCategories.Add(category);
        await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCategory",
            $"Khoản thu mới: {category.Name}",
            $"{User.Identity?.Name} đã tạo khoản thu \"{category.Name}\" — {category.UnitPrice:N0} đ/{category.Unit} ({(category.IsMandatory ? "bắt buộc" : "tự nguyện")}).",
            "/fee-categories");
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Fee category name already exists." });
        }

        var response = await FeeCategoryResponses()
            .FirstAsync(f => f.Id == category.Id);

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, response);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, FeeCategoryUpdateDto dto)
    {
        var category = await _context.FeeCategories.FirstOrDefaultAsync(f => f.Id == id);
        if (category is null)
            return NotFound();

        var name = dto.Name.Trim();
        if (await HasDuplicateName(name, id))
            return Conflict(new { message = "Fee category name already exists." });

        var oldPrice = category.UnitPrice;
        var wasActive = category.IsActive;

        category.Name = name;
        category.Description = Normalize(dto.Description);
        category.Unit = dto.Unit.Trim();
        category.UnitPrice = dto.UnitPrice;
        category.CalculationMethod = dto.CalculationMethod.Trim();
        category.IsMandatory = dto.IsMandatory;
        category.IsActive = dto.IsActive;

        if (oldPrice != dto.UnitPrice)
        {
            await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCategory",
                $"Đổi đơn giá: {category.Name}",
                $"{User.Identity?.Name} đã đổi đơn giá \"{category.Name}\" từ {oldPrice:N0} đ thành {dto.UnitPrice:N0} đ/{category.Unit}. Chỉ áp dụng cho khoản phải thu sinh sau thời điểm này.",
                "/fee-categories", "warning");
        }
        else if (wasActive && !dto.IsActive)
        {
            await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCategory",
                $"Ngừng áp dụng: {category.Name}",
                $"{User.Identity?.Name} đã ngừng áp dụng khoản thu \"{category.Name}\".",
                "/fee-categories", "warning");
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Fee category name already exists." });
        }

        return NoContent();
    }

    [HttpPatch("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var category = await _context.FeeCategories.FirstOrDefaultAsync(f => f.Id == id);
        if (category is null)
            return NotFound();

        if (!category.IsActive)
            return NoContent();

        category.IsActive = false;
        await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCategory",
            $"Ngừng áp dụng: {category.Name}",
            $"{User.Identity?.Name} đã ngừng áp dụng khoản thu \"{category.Name}\".",
            "/fee-categories", "warning");
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _context.FeeCategories.FirstOrDefaultAsync(f => f.Id == id);
        if (category is null)
            return NotFound();

        if (await _context.FeeCharges.AnyAsync(f => f.FeeCategoryId == id))
            return Conflict(new { message = "Cannot delete a fee category referenced by fee charges." });

        _context.FeeCategories.Remove(category);
        await _notifications.NotifyStaffAsync(User.GetUserId(), "FeeCategory",
            $"Đã xóa khoản thu: {category.Name}",
            $"{User.Identity?.Name} đã xóa khoản thu \"{category.Name}\".",
            "/fee-categories", "danger");
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Cannot delete the fee category because related data exists." });
        }

        return NoContent();
    }

    private IQueryable<FeeCategoryResponseDto> FeeCategoryResponses()
    {
        return _context.FeeCategories
            .AsNoTracking()
            .Select(f => new FeeCategoryResponseDto
            {
                Id = f.Id,
                Name = f.Name,
                Description = f.Description,
                Unit = f.Unit,
                UnitPrice = f.UnitPrice,
                CalculationMethod = f.CalculationMethod,
                IsMandatory = f.IsMandatory,
                IsActive = f.IsActive
            });
    }

    private Task<bool> HasDuplicateName(string name, int? excludedId = null)
    {
        var normalizedName = name.ToLower();
        var query = _context.FeeCategories
            .Where(f => f.Name.ToLower() == normalizedName);

        if (excludedId.HasValue)
            query = query.Where(f => f.Id != excludedId.Value);

        return query.AnyAsync();
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
