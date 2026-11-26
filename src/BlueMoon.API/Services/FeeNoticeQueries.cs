using System.Linq.Expressions;
using BlueMoon.API.Data;
using BlueMoon.API.DTOs;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Services;

/// <summary>Đọc giấy báo phí kèm chi tiết từng khoản — dùng chung cho nhân viên và cổng cư dân.</summary>
public static class FeeNoticeQueries
{
    public static async Task<List<FeeNoticeDto>> Load(
        AppDbContext context,
        Expression<Func<FeeNotice, bool>> filter,
        string? type = null,
        string? building = null,
        string? q = null,
        int? take = null)
    {
        var query = context.FeeNotices.AsNoTracking().Where(filter);
        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(n => n.Type == type.Trim());
        if (!string.IsNullOrWhiteSpace(building))
            query = query.Where(n => n.Apartment!.Building == building.Trim());
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = TextNormalizer.LikePattern(q.Trim());
            query = query.Where(n => EF.Functions.ILike(n.Apartment!.ApartmentCode, pattern));
        }

        IQueryable<FeeNotice> ordered = query
            .OrderByDescending(n => n.IssuedAt)
            .ThenBy(n => n.Apartment!.ApartmentCode);
        if (take.HasValue)
            ordered = ordered.Take(take.Value);

        var notices = await ordered
            .Select(n => new
            {
                n.Id,
                n.Type,
                n.FeeCollectionId,
                CollectionName = n.FeeCollection!.Name,
                n.FeeCollection.Month,
                n.FeeCollection.Year,
                n.ApartmentId,
                n.Apartment!.ApartmentCode,
                n.Apartment.Building,
                Household = n.Apartment.Households
                    .Where(h => h.IsActive)
                    .Select(h => new
                    {
                        h.HouseholdCode,
                        Head = h.Residents.Where(r => r.IsHouseholdHead).Select(r => r.FullName).FirstOrDefault()
                    })
                    .FirstOrDefault(),
                n.TotalAmount,
                n.OutstandingAmount,
                n.DueDate,
                n.Message,
                n.IssuedAt,
                IssuedBy = context.Users.Where(u => u.Id == n.IssuedByUserId).Select(u => u.Username).FirstOrDefault()
            })
            .ToListAsync();

        if (notices.Count == 0)
            return [];

        var collectionIds = notices.Select(n => n.FeeCollectionId).Distinct().ToList();
        var apartmentIds = notices.Select(n => n.ApartmentId).Distinct().ToList();
        var lines = await context.FeeCharges.AsNoTracking()
            .Where(c => collectionIds.Contains(c.FeeCollectionId) && apartmentIds.Contains(c.ApartmentId))
            .Select(c => new
            {
                c.FeeCollectionId,
                c.ApartmentId,
                Line = new FeeNoticeLineDto
                {
                    FeeCategoryName = c.FeeCategory!.Name,
                    Unit = c.FeeCategory.Unit,
                    Quantity = c.Quantity,
                    UnitPrice = c.UnitPrice,
                    Amount = c.Amount,
                    PaidAmount = c.PaidAmount
                }
            })
            .ToListAsync();
        var linesByKey = lines.ToLookup(l => (l.FeeCollectionId, l.ApartmentId), l => l.Line);

        return notices.Select(n => new FeeNoticeDto
        {
            Id = n.Id,
            Type = n.Type,
            FeeCollectionId = n.FeeCollectionId,
            FeeCollectionName = n.CollectionName,
            Month = n.Month,
            Year = n.Year,
            ApartmentId = n.ApartmentId,
            ApartmentCode = n.ApartmentCode,
            Building = n.Building,
            HouseholdCode = n.Household?.HouseholdCode,
            HeadOfHousehold = n.Household?.Head,
            TotalAmount = n.TotalAmount,
            OutstandingAmount = n.OutstandingAmount,
            DueDate = n.DueDate,
            Message = n.Message,
            IssuedAt = n.IssuedAt,
            IssuedByUsername = n.IssuedBy ?? string.Empty,
            Lines = linesByKey[(n.FeeCollectionId, n.ApartmentId)].OrderBy(l => l.FeeCategoryName).ToList()
        }).ToList();
    }
}
