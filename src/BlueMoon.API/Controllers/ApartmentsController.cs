using System.Linq.Expressions;
using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Controllers;

[ApiController]
[Authorize(Roles = Roles.Staff)]
[Route("api/[controller]")]
public class ApartmentsController : ControllerBase
{
    private static readonly Dictionary<string, Expression<Func<ApartmentResponseDto, object?>>> SortColumns = new()
    {
        ["code"] = a => a.ApartmentCode,
        ["building"] = a => a.Building,
        ["floor"] = a => a.Floor,
        ["area"] = a => a.Area,
        ["status"] = a => a.Status,
        ["residents"] = a => a.ResidentCount,
    };

    private readonly AppDbContext _context;

    public ApartmentsController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/apartments?q=&building=&floor=&status=&page=&pageSize=&sort=
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ApartmentResponseDto>>> GetAll(
        [FromQuery] string? q,
        [FromQuery] string? building,
        [FromQuery] int? floor,
        [FromQuery] string? status,
        [FromQuery] PageQuery paging)
    {
        var query = _context.Apartments.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = TextNormalizer.LikePattern(q.Trim());
            query = query.Where(a =>
                EF.Functions.ILike(a.ApartmentCode, pattern) ||
                a.Households.Any(h => h.IsActive && EF.Functions.ILike(h.HouseholdCode, pattern)));
        }
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(a => a.Building == building.Trim());
        if (floor.HasValue)
            query = query.Where(a => a.Floor == floor.Value);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(a => a.Status == status.Trim());

        var result = Project(query).ApplySort(paging, SortColumns,
            x => x.OrderBy(a => a.Building).ThenBy(a => a.Floor).ThenBy(a => a.ApartmentCode));

        return Ok(await result.ToPagedListAsync(Response, paging));
    }

    // GET: api/apartments/1
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApartmentResponseDto>> GetById(int id)
    {
        var apartment = await Project(_context.Apartments.AsNoTracking().Where(a => a.Id == id)).FirstOrDefaultAsync();
        return apartment is null ? NotFound() : Ok(apartment);
    }

    // POST: api/apartments
    [Authorize(Roles = Roles.Admin)]
    [HttpPost]
    public async Task<ActionResult<ApartmentResponseDto>> Create(ApartmentCreateDto dto)
    {
        var code = dto.ApartmentCode.Trim();
        if (await _context.Apartments.AnyAsync(a => a.ApartmentCode == code))
            return Conflict(new { message = "Mã căn hộ đã tồn tại." });

        var apartment = new Apartment
        {
            ApartmentCode = code,
            Building = dto.Building.Trim(),
            Floor = dto.Floor,
            Area = dto.Area,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Available" : dto.Status.Trim()
        };

        _context.Apartments.Add(apartment);
        await _context.SaveChangesAsync();

        var response = await Project(_context.Apartments.AsNoTracking().Where(a => a.Id == apartment.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = apartment.Id }, response);
    }

    // PUT: api/apartments/1
    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ApartmentUpdateDto dto)
    {
        var apartment = await _context.Apartments.FindAsync(id);
        if (apartment == null)
            return NotFound();

        var code = dto.ApartmentCode.Trim();
        if (await _context.Apartments.AnyAsync(a => a.ApartmentCode == code && a.Id != id))
            return Conflict(new { message = "Mã căn hộ đã tồn tại." });

        apartment.ApartmentCode = code;
        apartment.Building = dto.Building.Trim();
        apartment.Floor = dto.Floor;
        apartment.Area = dto.Area;
        apartment.Status = string.IsNullOrWhiteSpace(dto.Status) ? "Available" : dto.Status.Trim();

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/apartments/1
    [Authorize(Roles = Roles.Admin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var apartment = await _context.Apartments.FindAsync(id);
        if (apartment == null)
            return NotFound();

        var hasReferences =
            await _context.Households.AnyAsync(h => h.ApartmentId == id) ||
            await _context.Vehicles.AnyAsync(v => v.ApartmentId == id) ||
            await _context.FeeCharges.AnyAsync(f => f.ApartmentId == id) ||
            await _context.Payments.AnyAsync(p => p.ApartmentId == id);

        if (hasReferences)
            return Conflict(new { message = "Không thể xóa căn hộ đang có dữ liệu liên quan." });

        _context.Apartments.Remove(apartment);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static IQueryable<ApartmentResponseDto> Project(IQueryable<Apartment> query) =>
        query.Select(a => new ApartmentResponseDto
        {
            Id = a.Id,
            ApartmentCode = a.ApartmentCode,
            Building = a.Building,
            Floor = a.Floor,
            Area = a.Area,
            Status = a.Status,
            HouseholdCode = a.Households.Where(h => h.IsActive).Select(h => h.HouseholdCode).FirstOrDefault(),
            ResidentCount = a.Households.Where(h => h.IsActive)
                .SelectMany(h => h.Residents)
                .Count(r => r.Status != "MovedOut" && r.Status != "Deceased")
        });
}
