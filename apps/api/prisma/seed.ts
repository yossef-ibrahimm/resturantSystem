import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItemVariant.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const passwordHash = await bcrypt.hash("password123", 10);
  const admin = await prisma.user.create({
    data: { email: "admin@tastytable.com", passwordHash, name: "Ahmed Admin", role: "admin" },
  });
  const kitchen = await prisma.user.create({
    data: { email: "kitchen@tastytable.com", passwordHash, name: "Sara Kitchen", role: "kitchen_staff" },
  });
  console.log(`Created users: ${admin.email}, ${kitchen.email}`);

  // Categories
  const cats = await Promise.all([
    prisma.category.create({ data: { nameAr: "المقبلات", nameEn: "Appetizers", sortOrder: 1 } }),
    prisma.category.create({ data: { nameAr: "الأطباق الرئيسية", nameEn: "Main Courses", sortOrder: 2 } }),
    prisma.category.create({ data: { nameAr: "المشويات", nameEn: "Grills", sortOrder: 3 } }),
    prisma.category.create({ data: { nameAr: "المكالمات", nameEn: "Desserts", sortOrder: 4 } }),
    prisma.category.create({ data: { nameAr: "المشروبات", nameEn: "Beverages", sortOrder: 5 } }),
  ]);
  console.log(`Created ${cats.length} categories`);

  // Menu Items
  const items = await Promise.all([
    prisma.menuItem.create({ data: { categoryId: cats[0].id, nameAr: "حمص بالطحينة", nameEn: "Hummus with Tahini", descriptionAr: "حمص طازج مخفوق مع طحينة وزيت زيتون وليمون", descriptionEn: "Fresh chickpeas blended with tahini, olive oil, and lemon", price: 45, image: "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[0].id, nameAr: "فتوش", nameEn: "Fattoush Salad", descriptionAr: "سلطة فتوش مع خضار طازج وخبز مقرمش وصلصة رمان", descriptionEn: "Fresh vegetable salad with crispy bread and pomegranate dressing", price: 55, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[0].id, nameAr: "ورق عنب", nameEn: "Stuffed Grape Leaves", descriptionAr: "ورق عنب محشي بالأرز والخضار مع الليمون", descriptionEn: "Grape leaves stuffed with rice and vegetables, served with lemon", price: 60, image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[0].id, nameAr: "تبولة", nameEn: "Tabbouleh", descriptionAr: "سلطة بقدونس طازج مع بطل وطماطم وعصير الليمون", descriptionEn: "Fresh parsley salad with bulgur, tomatoes, and lemon juice", price: 50, image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[1].id, nameAr: "كبسة لحم", nameEn: "Lamb Kabsa", descriptionAr: "أرز بالتوابل مع لحم ضأن مطهو ببطء ومكسرات", descriptionEn: "Spiced rice with slow-cooked lamb and nuts", price: 180, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[1].id, nameAr: "مقلوبة", nameEn: "Maqluba", descriptionAr: "أرز مقلوب مع باذنجان ولحم مطهو معصوب", descriptionEn: "Upside-down rice with eggplant and tender meat", price: 160, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[1].id, nameAr: "منسف", nameEn: "Mansaf", descriptionAr: "طبق أردني تقليدي مع لبن Jameed ولحم ضأن", descriptionEn: "Traditional Jordanian dish with Jameed yogurt and lamb", price: 200, image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[1].id, nameAr: "فتة حمص", nameEn: "Fatteh with Chickpeas", descriptionAr: "خبز مقرمش مع حمص وعلبة زبادي وصلصة البقدونس", descriptionEn: "Crispy bread with chickpeas, yogurt, and parsley sauce", price: 95, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[2].id, nameAr: "شيش طاووق", nameEn: "Shish Tawook", descriptionAr: "دجاج متبل بالمتوابل مشوي على الفحم مع أرز وسلطة", descriptionEn: "Spiced chicken grilled over charcoal with rice and salad", price: 140, image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[2].id, nameAr: "كفتة مشوية", nameEn: "Grilled Kofta", descriptionAr: "كرات لحم مشوية مع بصل وطماطم مشوية", descriptionEn: "Grilled meatballs with grilled onions and tomatoes", price: 130, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[2].id, nameAr: "مشكل مشاوي", nameEn: "Mixed Grill Platter", descriptionAr: "تشكيلة من المشويات مع لحم ودجاج وكرات اللحم", descriptionEn: "Selection of grilled meats, chicken, and kofta", price: 250, image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[2].id, nameAr: "ستيك ريب آي", nameEn: "Grilled Ribeye", descriptionAr: "ستيك ريب آي مشوي مع صلصة الفطر والأعشاب", descriptionEn: "Grilled ribeye steak with mushroom herb sauce", price: 320, image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop", available: false } }),
    prisma.menuItem.create({ data: { categoryId: cats[3].id, nameAr: "بقلاوة", nameEn: "Baklava", descriptionAr: "بقلاوة بالمكسرات مع شيرة القطر", descriptionEn: "Nut baklava with syrup", price: 65, image: "https://images.unsplash.com/photo-1519676867240-f03562e64571?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[3].id, nameAr: "كنافة نابلسية", nameEn: "Nablusi Kunafa", descriptionAr: "كنافة بالجبنة مع شيرة القطر ومكسرات", descriptionEn: "Cheese kunafa with syrup and nuts", price: 80, image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[3].id, nameAr: "أم علي", nameEn: "Om Ali", descriptionAr: "حلوى مصرية تقليدية بالحليب والمكسرات", descriptionEn: "Traditional Egyptian dessert with milk and nuts", price: 70, image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[3].id, nameAr: "آيس كريم بالفستق", nameEn: "Pistachio Ice Cream", descriptionAr: "آيس كريم بالفستق الحلبي مع صلصة الكراميل", descriptionEn: "Pistachio ice cream with caramel sauce", price: 55, image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[4].id, nameAr: "شاي بالنعناع", nameEn: "Mint Tea", descriptionAr: "شاي أحمر طازج مع نعناع طازج", descriptionEn: "Fresh red tea with fresh mint", price: 20, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[4].id, nameAr: "قهوة عربية", nameEn: "Arabic Coffee", descriptionAr: "قهوة عربية تقليدية بالهيل", descriptionEn: "Traditional Arabic coffee with cardamom", price: 25, image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefda?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[4].id, nameAr: "عصير رمان طازج", nameEn: "Fresh Pomegranate Juice", descriptionAr: "عصير رمان طازج معصور", descriptionEn: "Freshly squeezed pomegranate juice", price: 45, image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop", available: true } }),
    prisma.menuItem.create({ data: { categoryId: cats[4].id, nameAr: "ليمون بالنعناع", nameEn: "Mint Lemonade", descriptionAr: "ليمون طازج مع نعناع وسكر", descriptionEn: "Fresh lemon with mint and sugar", price: 30, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop", available: true } }),
  ]);
  console.log(`Created ${items.length} menu items`);

  // Sample Orders
  await prisma.order.create({
    data: {
      orderNumber: "1001",
      customerName: "محمد علي",
      phone: "01012345678",
      orderType: "dine_in",
      tableNumber: 5,
      notes: "بدون بصل في الحمص",
      status: "received",
      paymentStatus: "unpaid",
      items: {
        create: [
          { menuItemId: items[0].id, nameAr: "حمص بالطحينة", nameEn: "Hummus with Tahini", quantity: 2, unitPrice: 45 },
          { menuItemId: items[4].id, nameAr: "كبسة لحم", nameEn: "Lamb Kabsa", quantity: 1, unitPrice: 180 },
          { menuItemId: items[16].id, nameAr: "شاي بالنعناع", nameEn: "Mint Tea", quantity: 3, unitPrice: 20 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "1002",
      customerName: "فاطمة أحمد",
      orderType: "takeaway",
      notes: "تيك أواي — 4 أشخاص",
      status: "preparing",
      paymentStatus: "paid",
      items: {
        create: [
          { menuItemId: items[8].id, nameAr: "شيش طاووق", nameEn: "Shish Tawook", quantity: 2, unitPrice: 140 },
          { menuItemId: items[1].id, nameAr: "فتوش", nameEn: "Fattoush Salad", quantity: 1, unitPrice: 55 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "1003",
      customerName: "خالد حسن",
      orderType: "dine_in",
      tableNumber: 12,
      status: "ready",
      paymentStatus: "unpaid",
      items: {
        create: [
          { menuItemId: items[10].id, nameAr: "مشكل مشاوي", nameEn: "Mixed Grill Platter", quantity: 1, unitPrice: 250 },
          { menuItemId: items[12].id, nameAr: "بقلاوة", nameEn: "Baklava", quantity: 2, unitPrice: 65 },
          { menuItemId: items[17].id, nameAr: "قهوة عربية", nameEn: "Arabic Coffee", quantity: 2, unitPrice: 25 },
        ],
      },
    },
  });
  console.log("Created 3 orders");

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
