using Microsoft.EntityFrameworkCore;
using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;

namespace BlueMoon.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Apartment> Apartments { get; set; }
    public DbSet<Household> Households { get; set; }
    public DbSet<Resident> Residents { get; set; }
    public DbSet<ResidenceHistory> ResidenceHistories { get; set; }
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<FeeCategory> FeeCategories { get; set; }
    public DbSet<FeeCollection> FeeCollections { get; set; }
    public DbSet<FeeCharge> FeeCharges { get; set; }
    public DbSet<Payment> Payments { get; set; }
    public DbSet<PaymentDetail> PaymentDetails { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<FeeNotice> FeeNotices { get; set; }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        UpdateSearchColumns();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        UpdateSearchColumns();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>Tự tính cột tìm kiếm không dấu cho cư dân mỗi khi thêm/sửa.</summary>
    private void UpdateSearchColumns()
    {
        foreach (var entry in ChangeTracker.Entries<Resident>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified)
                entry.Entity.SearchName = TextNormalizer.Normalize(entry.Entity.FullName);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Tìm kiếm chuỗi con nhanh (ILIKE '%term%') cần index trigram
        modelBuilder.HasPostgresExtension("pg_trgm");

        // USER
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username).IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        // APARTMENT
        modelBuilder.Entity<Apartment>()
            .HasIndex(a => a.ApartmentCode).IsUnique();

        modelBuilder.Entity<Apartment>()
            .Property(a => a.Area).HasPrecision(10, 2);
        modelBuilder.Entity<Apartment>()
            .HasIndex(a => a.Building);
        modelBuilder.Entity<Apartment>()
            .HasIndex(a => a.ApartmentCode, "IX_Apartments_ApartmentCode_trgm")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops");

        // HOUSEHOLD
        modelBuilder.Entity<Household>()
            .HasIndex(h => h.HouseholdCode).IsUnique();
        modelBuilder.Entity<Household>()
            .HasIndex(h => h.HouseholdCode, "IX_Households_HouseholdCode_trgm")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops");

        modelBuilder.Entity<Household>()
            .HasOne(h => h.Apartment)
            .WithMany(a => a.Households)
            .HasForeignKey(h => h.ApartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        // RESIDENT
        modelBuilder.Entity<Resident>()
            .HasIndex(r => r.IdentityNumber).IsUnique();
        modelBuilder.Entity<Resident>()
            .HasIndex(r => r.Status);
        modelBuilder.Entity<Resident>()
            .HasIndex(r => r.SearchName, "IX_Residents_SearchName_trgm")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops");
        modelBuilder.Entity<Resident>()
            .HasIndex(r => r.IdentityNumber, "IX_Residents_IdentityNumber_trgm")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops");
        modelBuilder.Entity<Resident>()
            .HasIndex(r => r.PhoneNumber, "IX_Residents_PhoneNumber_trgm")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops");
        modelBuilder.Entity<Resident>()
            .HasOne(r => r.Household)
            .WithMany(h => h.Residents)
            .HasForeignKey(r => r.HouseholdId)
            .OnDelete(DeleteBehavior.Restrict);

        // RESIDENCE HISTORY
        modelBuilder.Entity<ResidenceHistory>()
            .HasOne(r => r.Resident)
            .WithMany(r => r.ResidenceHistories)
            .HasForeignKey(r => r.ResidentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ResidenceHistory>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // VEHICLE
        modelBuilder.Entity<Vehicle>()
            .HasOne(v => v.Apartment)
            .WithMany(a => a.Vehicles)
            .HasForeignKey(v => v.ApartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Vehicle>()
            .HasOne(v => v.Resident)
            .WithMany(r => r.Vehicles)
            .HasForeignKey(v => v.ResidentId)
            .OnDelete(DeleteBehavior.Restrict);

        // FEE CATEGORY
        modelBuilder.Entity<FeeCategory>()
            .Property(f => f.UnitPrice).HasPrecision(18, 2);

        // FEE COLLECTION
        modelBuilder.Entity<FeeCollection>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(f => f.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // FEE CHARGE
        modelBuilder.Entity<FeeCharge>()
            .HasIndex(f => new { f.FeeCollectionId, f.ApartmentId, f.FeeCategoryId }).IsUnique();
        modelBuilder.Entity<FeeCharge>()
            .HasIndex(f => f.DueDate);
        modelBuilder.Entity<FeeCharge>()
            .HasIndex(f => f.Status);
        modelBuilder.Entity<FeeCharge>()
            .HasOne(f => f.FeeCollection)
            .WithMany(c => c.FeeCharges)
            .HasForeignKey(f => f.FeeCollectionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FeeCharge>()
            .HasOne(f => f.Apartment)
            .WithMany()
            .HasForeignKey(f => f.ApartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FeeCharge>()
            .HasOne(f => f.FeeCategory)
            .WithMany(c => c.FeeCharges)
            .HasForeignKey(f => f.FeeCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FeeCharge>()
            .Property(f => f.Quantity).HasPrecision(18, 2);

        modelBuilder.Entity<FeeCharge>()
            .Property(f => f.UnitPrice).HasPrecision(18, 2);

        modelBuilder.Entity<FeeCharge>()
            .Property(f => f.Amount).HasPrecision(18, 2);

        modelBuilder.Entity<FeeCharge>()
            .Property(f => f.PaidAmount).HasPrecision(18, 2);

        // PAYMENT
        modelBuilder.Entity<Payment>()
            .HasOne(p => p.Apartment)
            .WithMany()
            .HasForeignKey(p => p.ApartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Payment>()
            .HasOne(p => p.Resident)
            .WithMany()
            .HasForeignKey(p => p.ResidentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Payment>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(p => p.ReceivedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.ReceiptNumber).IsUnique();
        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.ReceiptNumber, "IX_Payments_ReceiptNumber_trgm")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops");
        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.PaymentDate);

        modelBuilder.Entity<Payment>()
            .Property(p => p.TotalAmount).HasPrecision(18, 2);

        // PAYMENT DETAIL
        modelBuilder.Entity<PaymentDetail>()
            .HasOne(d => d.Payment)
            .WithMany(p => p.PaymentDetails)
            .HasForeignKey(d => d.PaymentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PaymentDetail>()
            .HasOne(d => d.FeeCharge)
            .WithMany(f => f.PaymentDetails)
            .HasForeignKey(d => d.FeeChargeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PaymentDetail>()
            .Property(d => d.Amount).HasPrecision(18, 2);

        // USER ↔ HOUSEHOLD (tài khoản cư dân)
        modelBuilder.Entity<User>()
            .HasOne(u => u.Household)
            .WithMany()
            .HasForeignKey(u => u.HouseholdId)
            .OnDelete(DeleteBehavior.Restrict);

        // NOTIFICATION
        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Recipient)
            .WithMany()
            .HasForeignKey(n => n.RecipientUserId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Notification>()
            .HasIndex(n => new { n.RecipientUserId, n.ReadAt, n.CreatedAt });
        modelBuilder.Entity<Notification>()
            .Property(n => n.Title).HasMaxLength(200);
        modelBuilder.Entity<Notification>()
            .Property(n => n.Message).HasMaxLength(2000);

        // FEE NOTICE
        modelBuilder.Entity<FeeNotice>()
            .HasOne(n => n.FeeCollection)
            .WithMany()
            .HasForeignKey(n => n.FeeCollectionId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<FeeNotice>()
            .HasOne(n => n.Apartment)
            .WithMany()
            .HasForeignKey(n => n.ApartmentId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<FeeNotice>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(n => n.IssuedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<FeeNotice>()
            .HasIndex(n => new { n.FeeCollectionId, n.ApartmentId, n.Type });
        modelBuilder.Entity<FeeNotice>()
            .Property(n => n.TotalAmount).HasPrecision(18, 2);
        modelBuilder.Entity<FeeNotice>()
            .Property(n => n.OutstandingAmount).HasPrecision(18, 2);
    }
}