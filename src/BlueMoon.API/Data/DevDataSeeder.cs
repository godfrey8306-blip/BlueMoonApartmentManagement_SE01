using BlueMoon.API.Infrastructure;
using BlueMoon.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BlueMoon.API.Data;

/// <summary>
/// Sinh dữ liệu mẫu để demo / kiểm thử:  dotnet run -- --seed [--reset] [--residents N] [--exit]
///
/// - Mặc định ~260 nhân khẩu, 3 tòa × 9 tầng × 4 căn = 108 căn hộ.
/// - --residents 20000 → tự tăng số tòa/tầng (dùng để đo hiệu năng tìm kiếm, NFR-005).
/// - Random có seed cố định → mỗi lần chạy cho cùng một bộ dữ liệu.
/// - --reset XÓA toàn bộ dữ liệu nghiệp vụ (giữ tài khoản nhân viên) trước khi seed.
/// </summary>
public static class DevDataSeeder
{
    private const string ResidentPassword = "Cudan@123";

    private static readonly string[] Surnames =
        ["Nguyễn", "Nguyễn", "Nguyễn", "Trần", "Trần", "Lê", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Trịnh", "Mai", "Tạ"];
    private static readonly string[] MaleMiddle = ["Văn", "Đức", "Minh", "Quốc", "Hữu", "Công", "Thành", "Quang", "Xuân", "Gia", "Trọng", "Anh"];
    private static readonly string[] FemaleMiddle = ["Thị", "Thị", "Ngọc", "Thu", "Thanh", "Minh", "Phương", "Kim", "Hồng", "Bảo", "Khánh", "Mỹ"];
    private static readonly string[] MaleGiven =
        ["An", "Bình", "Cường", "Dũng", "Đạt", "Hải", "Hiếu", "Hoàng", "Hùng", "Huy", "Khánh", "Khoa", "Long", "Minh", "Nam", "Nghĩa", "Phong", "Phúc", "Quân", "Sơn", "Tài", "Thắng", "Thịnh", "Trung", "Tuấn", "Tùng", "Việt", "Vinh", "Đăng", "Kiên", "Lâm", "Toàn"];
    private static readonly string[] FemaleGiven =
        ["Anh", "Chi", "Dung", "Giang", "Hà", "Hạnh", "Hằng", "Hoa", "Hương", "Lan", "Linh", "Loan", "Mai", "My", "Nga", "Ngân", "Nhung", "Oanh", "Phương", "Quỳnh", "Thảo", "Trang", "Trinh", "Tuyết", "Uyên", "Vân", "Yến", "Diệp", "Thư", "Hiền"];
    private static readonly string[] Provinces = ["001", "001", "079", "079", "031", "048", "036", "038", "040", "034", "026", "033"];
    private static readonly string[] PhonePrefixes = ["090", "091", "093", "094", "096", "097", "098", "032", "033", "034", "035", "036", "037", "038", "039", "070", "077", "079", "081", "083", "085", "086", "088"];
    private static readonly decimal[] Areas = [45m, 52.5m, 58m, 62m, 68.5m, 72m, 75m, 82m, 88.5m, 95m, 110m];
    private static readonly string[] Destinations = ["TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Bắc Ninh", "Nam Định", "Thanh Hóa", "Nhật Bản", "Hàn Quốc", "Úc"];

    private enum PayerProfile { Punctual, Late, Partial, Delinquent, Never }

    public static async Task RunAsync(AppDbContext db, PasswordHasher hasher, bool reset, int targetResidents)
    {
        if (reset)
        {
            Log("Đang xóa dữ liệu nghiệp vụ cũ (giữ tài khoản nhân viên)…");
            await ResetAsync(db);
        }
        else if (await db.Apartments.AnyAsync())
        {
            Log("CSDL đã có dữ liệu — bỏ qua. Chạy lại với --reset để xóa và seed lại.");
            return;
        }

        targetResidents = Math.Clamp(targetResidents, 20, 200_000);
        var rng = new Random(20261126);
        var today = VnClock.Today;

        var admin = await EnsureStaff(db, hasher, "admin", "Admin@123", "Ban quản trị", "admin@bluemoon.vn", Roles.Admin);
        var accountant = await EnsureStaff(db, hasher, "ketoan", "Ketoan@123", "Kế toán viên", "ketoan@bluemoon.vn", Roles.Accountant);
        var staff = new[] { admin, accountant };

        // ── 1. Căn hộ ─────────────────────────────────────────
        var large = targetResidents > 1000;
        var floors = large ? 25 : 9;
        var unitsPerFloor = large ? 10 : 4;
        var apartmentsNeeded = (int)Math.Ceiling(targetResidents / 3.1 / 0.82);
        var buildingCount = Math.Max(1, (int)Math.Ceiling(apartmentsNeeded / (double)(floors * unitsPerFloor)));
        var apartments = new List<Apartment>();
        for (var b = 0; b < buildingCount; b++)
        {
            var building = BuildingName(b);
            for (var f = 1; f <= floors; f++)
            for (var u = 1; u <= unitsPerFloor; u++)
            {
                apartments.Add(new Apartment
                {
                    ApartmentCode = $"{building}-{f:00}{u:00}",
                    Building = building,
                    Floor = f,
                    Area = Areas[rng.Next(Areas.Length)],
                    Status = "Available"
                });
            }
        }
        db.Apartments.AddRange(apartments);
        await db.SaveChangesAsync();
        Log($"{apartments.Count} căn hộ ở {buildingCount} tòa.");

        // ── 2. Hộ gia đình & nhân khẩu ────────────────────────
        var identities = new HashSet<string>();
        var households = new List<Household>();
        var residents = new List<Resident>();
        var histories = new List<ResidenceHistory>();
        var maintenanceCount = 0;
        foreach (var apartment in apartments)
        {
            if (residents.Count >= targetResidents)
                break;
            var forceOccupied = apartment.ApartmentCode.EndsWith("-0101");
            if (!forceOccupied && rng.NextDouble() < 0.16)
            {
                if (rng.NextDouble() < 0.12 && maintenanceCount < 5)
                {
                    apartment.Status = "Maintenance";
                    maintenanceCount++;
                }
                continue;
            }

            apartment.Status = "Occupied";
            var created = today.AddDays(-rng.Next(60, 365 * 8));
            var household = new Household
            {
                HouseholdCode = $"HK-{apartment.Building}{apartment.ApartmentCode[(apartment.Building.Length + 1)..]}",
                Apartment = apartment,
                ApartmentId = apartment.Id,
                CreatedAt = created.AddHours(2),
                IsActive = true
            };
            households.Add(household);
            residents.AddRange(CreateFamily(rng, household, identities, today, created, histories, admin.Id));
        }
        db.Households.AddRange(households);
        db.Residents.AddRange(residents);
        foreach (var r in residents)
            r.SearchName = TextNormalizer.Normalize(r.FullName);
        await db.SaveChangesAsync();
        db.ResidenceHistories.AddRange(histories);
        await db.SaveChangesAsync();
        Log($"{households.Count} hộ, {residents.Count} nhân khẩu, {histories.Count} biến động cư trú.");

        // ── 3. Danh mục khoản thu ─────────────────────────────
        var management = new FeeCategory { Name = "Phí quản lý chung cư", Description = "Phí quản lý vận hành tòa nhà, tính theo diện tích căn hộ.", Unit = "m²", UnitPrice = 7000m, CalculationMethod = "PerArea", IsMandatory = true };
        var cleaning = new FeeCategory { Name = "Phí dịch vụ vệ sinh", Description = "Thu gom rác thải sinh hoạt, tính theo nhân khẩu đang cư trú.", Unit = "người", UnitPrice = 15000m, CalculationMethod = "PerResident", IsMandatory = true };
        var elevator = new FeeCategory { Name = "Phí bảo trì thang máy", Description = "Bảo trì, kiểm định thang máy định kỳ.", Unit = "căn hộ", UnitPrice = 50000m, CalculationMethod = "Fixed", IsMandatory = true };
        var scholarship = new FeeCategory { Name = "Quỹ khuyến học", Description = "Đóng góp tự nguyện hỗ trợ học sinh có hoàn cảnh khó khăn dịp khai giảng.", Unit = "căn hộ", UnitPrice = 100000m, CalculationMethod = "Voluntary", IsMandatory = false };
        db.FeeCategories.AddRange(management, cleaning, elevator, scholarship);
        await db.SaveChangesAsync();

        // ── 4. Đợt thu 6 tháng gần nhất ───────────────────────
        var collections = new List<FeeCollection>();
        for (var i = 5; i >= 0; i--)
        {
            var month = today.AddMonths(-i);
            collections.Add(new FeeCollection
            {
                Name = $"Thu phí tháng {month.Month}/{month.Year}",
                Month = month.Month,
                Year = month.Year,
                DueDate = VnClock.EndOfMonth(month.Year, month.Month),
                CreatedAt = new DateTime(month.Year, month.Month, 1, 2, 0, 0, DateTimeKind.Utc),
                CreatedByUserId = accountant.Id,
                Status = i >= 2 ? "Closed" : "Open"
            });
        }
        db.FeeCollections.AddRange(collections);
        await db.SaveChangesAsync();

        // ── 5. Khoản phải thu ─────────────────────────────────
        var activeCount = residents
            .Where(r => r.Status is "Active" or "TemporaryResident")
            .GroupBy(r => r.Household!.ApartmentId)
            .ToDictionary(g => g.Key, g => g.Count());
        var charges = new List<FeeCharge>();
        var scholarshipCollection = collections.FirstOrDefault(c => c.Month == 9) ?? collections[^3];
        foreach (var collection in collections)
        foreach (var household in households)
        {
            var apartment = household.Apartment!;
            if (household.CreatedAt > collection.DueDate)
                continue;
            AddCharge(charges, collection, apartment, management, apartment.Area);
            var people = activeCount.GetValueOrDefault(apartment.Id);
            if (people > 0)
                AddCharge(charges, collection, apartment, cleaning, people);
            AddCharge(charges, collection, apartment, elevator, 1);
            // Khoản tự nguyện: chỉ ghi nhận cho hộ thực sự đóng góp (không phải công nợ)
            if (collection == scholarshipCollection && rng.NextDouble() < 0.45)
                AddCharge(charges, collection, apartment, scholarship, 1);
        }
        db.FeeCharges.AddRange(charges);
        await db.SaveChangesAsync();
        Log($"{collections.Count} đợt thu, {charges.Count} khoản phải thu.");

        // ── 6. Thanh toán theo hành vi từng hộ ────────────────
        var profiles = households.ToDictionary(h => h.ApartmentId, h =>
            h.Apartment!.ApartmentCode.EndsWith("A-0101") ? PayerProfile.Delinquent : PickProfile(rng));
        var chargesByKey = charges
            .GroupBy(c => (c.ApartmentId, c.FeeCollectionId))
            .ToDictionary(g => g.Key, g => g.ToList());
        var heads = residents.Where(r => r.IsHouseholdHead).ToDictionary(r => r.Household!.ApartmentId);
        var payments = new List<Payment>();
        var receiptSeq = new Dictionary<DateTime, int>();

        foreach (var ((apartmentId, collectionId), group) in chargesByKey.OrderBy(k => k.Key.FeeCollectionId).ThenBy(k => k.Key.ApartmentId))
        {
            var collection = collections.First(c => c.Id == collectionId);
            var monthsAgo = (today.Year - collection.Year) * 12 + today.Month - collection.Month;
            var profile = profiles[apartmentId];
            var mandatory = group.Where(c => c.FeeCategoryId != scholarship.Id).ToList();
            var voluntary = group.FirstOrDefault(c => c.FeeCategoryId == scholarship.Id);
            var start = new DateTime(collection.Year, collection.Month, 3, 0, 0, 0, DateTimeKind.Utc);

            (bool pay, DateTime day, decimal ratio) plan = profile switch
            {
                PayerProfile.Punctual => (true, start.AddDays(rng.Next(0, Math.Max(1, (collection.DueDate - start).Days))), 1m),
                PayerProfile.Late => (true, collection.DueDate.AddDays(rng.Next(2, 22)), 1m),
                PayerProfile.Partial => (true, start.AddDays(rng.Next(5, 25)), 0.5m),
                PayerProfile.Delinquent => (monthsAgo >= 3, start.AddDays(rng.Next(5, 35)), 1m),
                _ => (monthsAgo >= 4, start.AddDays(rng.Next(10, 50)), 1m),
            };
            // Đợt hiện tại: chỉ một phần cư dân đã đóng tới hôm nay
            if (monthsAgo == 0 && profile == PayerProfile.Punctual && rng.NextDouble() < 0.35)
                plan.pay = false;
            if (!plan.pay || plan.day > today)
            {
                if (voluntary is not null)
                {
                    var giftDay = start.AddDays(rng.Next(0, 20));
                    if (giftDay <= today)
                        payments.Add(CreatePayment(rng, apartmentId, heads.GetValueOrDefault(apartmentId), staff, giftDay, [(voluntary, voluntary.Amount)], receiptSeq));
                }
                continue;
            }

            var details = new List<(FeeCharge Charge, decimal Amount)>();
            foreach (var charge in mandatory)
            {
                var amount = decimal.Round(charge.Amount * plan.ratio, 0, MidpointRounding.AwayFromZero);
                if (amount > 0) details.Add((charge, amount));
            }
            if (voluntary is not null)
                details.Add((voluntary, voluntary.Amount));
            if (details.Count == 0)
                continue;

            payments.Add(CreatePayment(rng, apartmentId, heads.GetValueOrDefault(apartmentId), staff, plan.day, details, receiptSeq));

            // Hộ đóng một phần: phần còn lại đóng sau (trừ 2 kỳ gần nhất)
            if (profile == PayerProfile.Partial && monthsAgo >= 2)
            {
                var rest = mandatory
                    .Select(c => (Charge: c, Amount: c.Amount - c.PaidAmount))
                    .Where(x => x.Amount > 0)
                    .ToList();
                var laterDay = collection.DueDate.AddDays(rng.Next(5, 30));
                if (rest.Count > 0 && laterDay <= today)
                    payments.Add(CreatePayment(rng, apartmentId, heads.GetValueOrDefault(apartmentId), staff, laterDay, rest, receiptSeq));
            }
        }
        db.Payments.AddRange(payments);
        await db.SaveChangesAsync();
        Log($"{payments.Count} phiếu thu, tổng {payments.Sum(p => p.TotalAmount):N0} đ.");

        // ── 7. Tài khoản cư dân ───────────────────────────────
        var accountHouseholds = households.Take(large ? 200 : 30).ToList();
        var passwordHash = hasher.Hash(ResidentPassword);
        var residentUsers = accountHouseholds.Select(h => new User
        {
            Username = h.HouseholdCode.ToLowerInvariant(),
            PasswordHash = passwordHash,
            FullName = heads.GetValueOrDefault(h.ApartmentId)?.FullName ?? h.HouseholdCode,
            Email = $"{h.HouseholdCode.ToLowerInvariant()}@cudan.bluemoon.local",
            Role = Roles.Resident,
            HouseholdId = h.Id,
            MustChangePassword = true,
            IsActive = true,
            CreatedAt = today.AddDays(-rng.Next(30, 200))
        }).ToList();
        db.Users.AddRange(residentUsers);
        await db.SaveChangesAsync();
        var userByApartment = residentUsers.ToDictionary(u => accountHouseholds.First(h => h.Id == u.HouseholdId).ApartmentId);

        // ── 8. Giấy báo phí, nhắc nợ & thông báo ──────────────
        var notices = new List<FeeNotice>();
        var notifications = new List<Notification>();
        foreach (var ((apartmentId, collectionId), group) in chargesByKey)
        {
            var collection = collections.First(c => c.Id == collectionId);
            var issuedAt = collection.CreatedAt.AddDays(1).AddHours(1);
            var total = group.Sum(c => c.Amount);
            notices.Add(new FeeNotice
            {
                FeeCollectionId = collectionId,
                ApartmentId = apartmentId,
                Type = "Notice",
                TotalAmount = total,
                OutstandingAmount = total,
                DueDate = collection.DueDate,
                IssuedAt = issuedAt,
                IssuedByUserId = accountant.Id
            });
            if (userByApartment.TryGetValue(apartmentId, out var user))
            {
                notifications.Add(new Notification
                {
                    RecipientUserId = user.Id,
                    Type = "FeeNotice",
                    Severity = "warning",
                    Title = $"Giấy báo phí {collection.Month:00}/{collection.Year}",
                    Message = $"Số tiền phải nộp kỳ {collection.Month:00}/{collection.Year}: {total:N0} đ. Hạn nộp: {collection.DueDate:dd/MM/yyyy}.",
                    Link = "/portal/notices",
                    CreatedAt = issuedAt,
                    ReadAt = collection.DueDate < today ? issuedAt.AddDays(2) : null,
                    CreatedByUserId = accountant.Id
                });
            }

            // Nhắc nợ 7 ngày sau hạn nếu khi đó vẫn còn nợ
            var outstanding = group.Where(c => c.FeeCategoryId != scholarship.Id).Sum(c => c.Amount - c.PaidAmount);
            var reminderAt = collection.DueDate.AddDays(7).AddHours(2);
            if (outstanding > 0 && reminderAt <= today)
            {
                notices.Add(new FeeNotice
                {
                    FeeCollectionId = collectionId,
                    ApartmentId = apartmentId,
                    Type = "Reminder",
                    TotalAmount = total,
                    OutstandingAmount = outstanding,
                    DueDate = collection.DueDate,
                    IssuedAt = reminderAt,
                    IssuedByUserId = accountant.Id
                });
                if (userByApartment.TryGetValue(apartmentId, out var debtor))
                {
                    notifications.Add(new Notification
                    {
                        RecipientUserId = debtor.Id,
                        Type = "Reminder",
                        Severity = "danger",
                        Title = "Nhắc nợ phí quá hạn",
                        Message = $"Căn hộ của bạn còn nợ {outstanding:N0} đ kỳ {collection.Month:00}/{collection.Year} đã quá hạn. Vui lòng thanh toán sớm.",
                        Link = "/portal/charges?overdue=true",
                        CreatedAt = reminderAt,
                        CreatedByUserId = accountant.Id
                    });
                }
            }
        }
        foreach (var payment in payments.Where(p => userByApartment.ContainsKey(p.ApartmentId)))
        {
            notifications.Add(new Notification
            {
                RecipientUserId = userByApartment[payment.ApartmentId].Id,
                Type = "PaymentReceived",
                Severity = "success",
                Title = $"Đã nhận thanh toán {payment.TotalAmount:N0} đ",
                Message = $"Phiếu thu {payment.ReceiptNumber} ngày {VnClock.DateOf(payment.PaymentDate):dd/MM/yyyy}. Cảm ơn quý cư dân!",
                Link = "/portal/payments",
                CreatedAt = payment.PaymentDate,
                ReadAt = payment.PaymentDate.AddDays(1) < DateTime.UtcNow.AddDays(-14) ? payment.PaymentDate.AddDays(1) : null,
                CreatedByUserId = payment.ReceivedByUserId
            });
        }

        // Thông báo cho nhân viên về các sự kiện gần đây
        var current = collections[^1];
        foreach (var s in staff)
        {
            notifications.Add(new Notification
            {
                RecipientUserId = s.Id, Type = "FeeCharges", Severity = "info",
                Title = $"Đã lập danh sách phải thu: {current.Name}",
                Message = $"Đã sinh {charges.Count(c => c.FeeCollectionId == current.Id)} khoản phải thu, hạn nộp {current.DueDate:dd/MM/yyyy}.",
                Link = $"/fee-charges?feeCollectionId={current.Id}",
                CreatedAt = current.CreatedAt.AddHours(1), ReadAt = current.CreatedAt.AddDays(1), CreatedByUserId = accountant.Id
            });
            notifications.Add(new Notification
            {
                RecipientUserId = s.Id, Type = "Reminder", Severity = "warning",
                Title = "Đã gửi nhắc nợ quá hạn",
                Message = $"Đã nhắc nợ {notices.Where(n => n.Type == "Reminder").Select(n => n.ApartmentId).Distinct().Count()} căn hộ có khoản quá hạn.",
                Link = "/fee-charges?overdue=true",
                CreatedAt = DateTime.UtcNow.AddDays(-3), CreatedByUserId = accountant.Id
            });
            foreach (var p in payments.OrderByDescending(p => p.PaymentDate).Take(4))
            {
                notifications.Add(new Notification
                {
                    RecipientUserId = s.Id, Type = "Payment", Severity = "success",
                    Title = $"Phiếu thu {p.ReceiptNumber}",
                    Message = $"Đã thu {p.TotalAmount:N0} đ ({p.PaymentMethod}).",
                    Link = $"/payments?q={p.ReceiptNumber}",
                    CreatedAt = p.PaymentDate, CreatedByUserId = p.ReceivedByUserId
                });
            }
        }

        db.FeeNotices.AddRange(notices);
        db.Notifications.AddRange(notifications);
        await db.SaveChangesAsync();
        Log($"{residentUsers.Count} tài khoản cư dân (mật khẩu {ResidentPassword}), {notices.Count} giấy báo/nhắc nợ, {notifications.Count} thông báo.");
        Log($"Tài khoản demo cư dân: {residentUsers.FirstOrDefault()?.Username} / {ResidentPassword}");
        Log("Hoàn tất.");
    }

    // ── Helpers ───────────────────────────────────────────────

    private static void Log(string message) => Console.WriteLine($"[seed] {message}");

    private static string BuildingName(int index) =>
        index < 26 ? ((char)('A' + index)).ToString() : $"{(char)('A' + index / 26 - 1)}{(char)('A' + index % 26)}";

    private static async Task ResetAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            DELETE FROM "Notifications";
            DELETE FROM "FeeNotices";
            DELETE FROM "PaymentDetails";
            DELETE FROM "Payments";
            DELETE FROM "FeeCharges";
            DELETE FROM "FeeCollections";
            DELETE FROM "FeeCategories";
            DELETE FROM "ResidenceHistories";
            DELETE FROM "Vehicles";
            DELETE FROM "Users" WHERE "Role" = 'Resident';
            UPDATE "Users" SET "HouseholdId" = NULL;
            DELETE FROM "Residents";
            DELETE FROM "Households";
            DELETE FROM "Apartments";
            """);
        foreach (var table in new[] { "Notifications", "FeeNotices", "PaymentDetails", "Payments", "FeeCharges", "FeeCollections",
                     "FeeCategories", "ResidenceHistories", "Vehicles", "Residents", "Households", "Apartments" })
        {
#pragma warning disable EF1002 // tên bảng là hằng số nội bộ, không phải dữ liệu người dùng
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ALTER COLUMN \"Id\" RESTART WITH 1;");
#pragma warning restore EF1002
        }
        db.ChangeTracker.Clear();
    }

    private static async Task<User> EnsureStaff(AppDbContext db, PasswordHasher hasher, string username, string password, string fullName, string email, string role)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user is not null)
            return user;

        user = new User
        {
            Username = username,
            PasswordHash = hasher.Hash(password),
            FullName = fullName,
            Email = email,
            Role = role,
            IsActive = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        Log($"Tạo tài khoản {username} / {password}");
        return user;
    }

    private static PayerProfile PickProfile(Random rng)
    {
        var x = rng.NextDouble();
        return x switch
        {
            < 0.66 => PayerProfile.Punctual,
            < 0.84 => PayerProfile.Late,
            < 0.91 => PayerProfile.Partial,
            < 0.97 => PayerProfile.Delinquent,
            _ => PayerProfile.Never
        };
    }

    private static void AddCharge(List<FeeCharge> charges, FeeCollection collection, Apartment apartment, FeeCategory category, decimal quantity)
    {
        charges.Add(new FeeCharge
        {
            FeeCollectionId = collection.Id,
            ApartmentId = apartment.Id,
            FeeCategoryId = category.Id,
            Quantity = quantity,
            UnitPrice = category.UnitPrice,
            Amount = decimal.Round(quantity * category.UnitPrice, 2, MidpointRounding.AwayFromZero),
            PaidAmount = 0m,
            DueDate = collection.DueDate,
            Status = "Unpaid"
        });
    }

    private static Payment CreatePayment(
        Random rng,
        int apartmentId,
        Resident? payer,
        User[] staff,
        DateTime vnDay,
        List<(FeeCharge Charge, decimal Amount)> details,
        Dictionary<DateTime, int> receiptSeq)
    {
        var seq = receiptSeq.GetValueOrDefault(vnDay) + 1;
        receiptSeq[vnDay] = seq;
        var method = rng.NextDouble() switch { < 0.45 => "Tiền mặt", < 0.9 => "Chuyển khoản", _ => "Ví điện tử" };
        var payment = new Payment
        {
            ApartmentId = apartmentId,
            ResidentId = payer?.Id,
            ReceivedByUserId = staff[rng.Next(staff.Length)].Id,
            ReceiptNumber = $"PT{vnDay:yyyyMMdd}-{seq:0000}",
            // Giờ làm việc 8h–19h (VN) → UTC
            PaymentDate = Earlier(vnDay.AddHours(rng.Next(8, 19) - 7).AddMinutes(rng.Next(0, 60)), DateTime.UtcNow.AddMinutes(-rng.Next(5, 120))),
            PaymentMethod = method,
            Note = method == "Chuyển khoản" && rng.NextDouble() < 0.3 ? "Đã đối chiếu sao kê ngân hàng" : null
        };
        foreach (var (charge, amount) in details)
        {
            payment.PaymentDetails.Add(new PaymentDetail { FeeChargeId = charge.Id, Amount = amount });
            charge.PaidAmount += amount;
            charge.Status = charge.PaidAmount <= 0 ? "Unpaid" : charge.PaidAmount < charge.Amount ? "PartiallyPaid" : "Paid";
        }
        payment.TotalAmount = details.Sum(d => d.Amount);
        return payment;
    }

    // ── Gia đình ─────────────────────────────────────────────

    private static List<Resident> CreateFamily(
        Random rng,
        Household household,
        HashSet<string> identities,
        DateTime today,
        DateTime householdCreated,
        List<ResidenceHistory> histories,
        int adminId)
    {
        var size = rng.NextDouble() switch { < 0.12 => 1, < 0.34 => 2, < 0.62 => 3, < 0.87 => 4, < 0.97 => 5, _ => 6 };
        var members = new List<Resident>();
        var headMale = rng.NextDouble() < 0.72;
        var headAge = rng.Next(size == 1 ? 24 : 30, 72);
        var surname = Pick(rng, Surnames);
        var head = Person(rng, household, identities, today, surname, headMale, headAge, "Chủ hộ", true);
        members.Add(head);

        var spouseAge = 0;
        if (size >= 2 && rng.NextDouble() < 0.85)
        {
            spouseAge = Math.Max(20, headAge + rng.Next(-6, 5));
            members.Add(Person(rng, household, identities, today, Pick(rng, Surnames), !headMale, spouseAge, headMale ? "Vợ" : "Chồng", false));
        }

        var fatherSurname = headMale ? surname : members.Count > 1 ? members[1].FullName.Split(' ')[0] : surname;
        var youngest = Math.Min(headAge, spouseAge == 0 ? headAge : spouseAge);
        // Ông bà sống cùng (hộ đông người)
        if (size >= 5 && rng.NextDouble() < 0.5)
            members.Add(Person(rng, household, identities, today, surname, rng.NextDouble() < 0.4, Math.Min(95, headAge + rng.Next(24, 32)), headMale ? "Mẹ" : "Bố", false));

        while (members.Count < size)
        {
            var childAge = Math.Max(0, Math.Min(youngest - 21, rng.Next(0, Math.Max(1, youngest - 20))));
            members.Add(Person(rng, household, identities, today, fatherSurname, rng.NextDouble() < 0.5, childAge, "Con", false));
        }

        // Lịch sử chuyển đến của cả hộ
        foreach (var m in members)
        {
            histories.Add(new ResidenceHistory
            {
                Resident = m,
                HistoryType = "MoveIn",
                StartDate = householdCreated,
                Note = "Đăng ký thường trú khi nhận căn hộ.",
                CreatedByUserId = adminId
            });
        }

        // Biến động: tạm vắng / chuyển đi / người tạm trú
        foreach (var m in members.Where(m => !m.IsHouseholdHead))
        {
            var age = Age(m.DateOfBirth, today);
            var x = rng.NextDouble();
            if (x < 0.07 && age >= 18)
            {
                m.Status = "TemporarilyAbsent";
                var start = today.AddDays(-rng.Next(10, 200));
                histories.Add(new ResidenceHistory
                {
                    Resident = m,
                    HistoryType = "TemporaryAbsence",
                    StartDate = start = Later(householdCreated.AddDays(30), start, today),
                    EndDate = start.AddMonths(rng.Next(3, 13)),
                    Destination = Pick(rng, Destinations),
                    Note = Pick(rng, new[] { "Đi công tác dài hạn.", "Đi học tập.", "Lao động có thời hạn.", "Về quê chăm sóc người thân." }),
                    CreatedByUserId = adminId
                });
            }
            else if (x < 0.12 && age >= 18)
            {
                m.Status = "MovedOut";
                histories.Add(new ResidenceHistory
                {
                    Resident = m,
                    HistoryType = "MoveOut",
                    StartDate = Later(householdCreated.AddDays(30), today.AddDays(-rng.Next(20, 400)), today),
                    Destination = Pick(rng, Destinations),
                    Note = "Chuyển hộ khẩu đi nơi khác.",
                    CreatedByUserId = adminId
                });
            }
        }

        if (rng.NextDouble() < 0.06)
        {
            var guest = Person(rng, household, identities, today, Pick(rng, Surnames), rng.NextDouble() < 0.5, rng.Next(19, 30), "Người thuê trọ", false);
            guest.Status = "TemporaryResident";
            var start = today.AddDays(-rng.Next(5, 150));
            histories.Add(new ResidenceHistory
            {
                Resident = guest,
                HistoryType = "TemporaryResidence",
                StartDate = start,
                EndDate = start.AddMonths(rng.Next(6, 13)),
                Destination = Pick(rng, Destinations),
                Note = "Đăng ký tạm trú (sinh viên / người lao động).",
                CreatedByUserId = adminId
            });
            members.Add(guest);
        }

        return members;
    }

    private static Resident Person(
        Random rng,
        Household household,
        HashSet<string> identities,
        DateTime today,
        string surname,
        bool male,
        int age,
        string relationship,
        bool isHead)
    {
        var dob = today.AddYears(-age).AddDays(-rng.Next(0, 365));
        var middle = Pick(rng, male ? MaleMiddle : FemaleMiddle);
        var given = Pick(rng, male ? MaleGiven : FemaleGiven);
        return new Resident
        {
            Household = household,
            FullName = $"{surname} {middle} {given}",
            IdentityNumber = Cccd(rng, identities, dob, male),
            DateOfBirth = dob,
            Gender = male ? "Nam" : "Nữ",
            PhoneNumber = age >= 16 ? Phone(rng) : string.Empty,
            Relationship = relationship,
            IsHouseholdHead = isHead,
            Status = "Active"
        };
    }

    /// <summary>CCCD 12 số: mã tỉnh (3) + giới tính/thế kỷ (1) + năm sinh (2) + ngẫu nhiên (6).</summary>
    private static string Cccd(Random rng, HashSet<string> used, DateTime dob, bool male)
    {
        string value;
        do
        {
            var century = dob.Year >= 2000 ? (male ? 2 : 3) : (male ? 0 : 1);
            value = $"{Pick(rng, Provinces)}{century}{dob.Year % 100:00}{rng.Next(0, 1_000_000):000000}";
        } while (!used.Add(value));
        return value;
    }

    private static DateTime Earlier(DateTime a, DateTime b) => a < b ? a : b;

    /// <summary>Ngày muộn hơn giữa a và b, nhưng không vượt quá hôm nay.</summary>
    private static DateTime Later(DateTime a, DateTime b, DateTime today) => (a > b ? a : b) > today ? today : (a > b ? a : b);

    private static string Phone(Random rng) => $"{Pick(rng, PhonePrefixes)}{rng.Next(0, 10_000_000):0000000}";

    private static int Age(DateTime? dob, DateTime today) =>
        dob is null ? 0 : today.Year - dob.Value.Year - (today.DayOfYear < dob.Value.DayOfYear ? 1 : 0);

    private static T Pick<T>(Random rng, IReadOnlyList<T> items) => items[rng.Next(items.Count)];
}
