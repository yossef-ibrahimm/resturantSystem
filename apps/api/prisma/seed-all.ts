import { PrismaClient, Role, OrderStatus, PaymentMethod, StockMovementType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════
// DB-003: no hardcoded passwords. Provide SEED_ADMIN_PASSWORD (etc.) via env
// for automated seeds, or omit them to generate one-time random passwords
// printed once. All seeded users mustChangePassword=true.

type SeedUser = {
  email: string;
  name: string;
  role: Role;
  password?: string;
};

const SEED_USER_DEFS: SeedUser[] = [
  { email: "admin@tastytable.com", name: "Ahmed Admin", role: "admin" as Role },
  { email: "kitchen@tastytable.com", name: "Sara Kitchen", role: "kitchen_staff" as Role },
  { email: "kitchen2@tastytable.com", name: "Omar Kitchen", role: "kitchen_staff" as Role },
  { email: "waiter@tastytable.com", name: "Fatima Waiter", role: "waiter" as Role },
  { email: "waiter2@tastytable.com", name: "Layla Waiter", role: "waiter" as Role },
  { email: "cashier@tastytable.com", name: "Mohamed Cashier", role: "cashier" as Role },
  { email: "cashier2@tastytable.com", name: "Nora Cashier", role: "cashier" as Role },
];

const ENV_PASSWORDS: Record<string, string | undefined> = {
  "admin@tastytable.com": process.env.SEED_ADMIN_PASSWORD,
  "kitchen@tastytable.com": process.env.SEED_KITCHEN_PASSWORD,
  "kitchen2@tastytable.com": process.env.SEED_KITCHEN_PASSWORD,
  "waiter@tastytable.com": process.env.SEED_WAITER_PASSWORD,
  "waiter2@tastytable.com": process.env.SEED_WAITER_PASSWORD,
  "cashier@tastytable.com": process.env.SEED_CASHIER_PASSWORD,
  "cashier2@tastytable.com": process.env.SEED_CASHIER_PASSWORD,
};

function generatePassword(): string {
  // 16 bytes → 22-char base64url-ish; meets typical complexity when hashed.
  return randomBytes(12).toString("base64url");
}

function resolvePasswords(users: SeedUser[]): (SeedUser & { password: string })[] {
  return users.map((u) => ({
    ...u,
    password: ENV_PASSWORDS[u.email] ?? generatePassword(),
  }));
}

const USERS = resolvePasswords(SEED_USER_DEFS);

// ══════════════════════════════════════════════════════════════
// MENU CATEGORIES & ITEMS
// ══════════════════════════════════════════════════════════════

type SeedItem = {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  image?: string;
};

type SeedCategory = {
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  items: SeedItem[];
};

const MENU_CATEGORIES: SeedCategory[] = [
  {
    nameAr: "مشروبات ساخنة",
    nameEn: "Hot Drinks",
    sortOrder: 1,
    items: [
      { nameAr: "إسبريسو", nameEn: "Espresso", descriptionAr: "شوت إسبريسو مركز", descriptionEn: "Single shot of rich espresso", price: 3.5 },
      { nameAr: "كابتشينو", nameEn: "Cappuccino", descriptionAr: "إسبريسو مع حليب مخفوق ورغوة", descriptionEn: "Espresso with steamed milk and foam", price: 4.5 },
      { nameAr: "لاتيه", nameEn: "Latte", descriptionAr: "إسبريسو مع حليب ساخن", descriptionEn: "Espresso with steamed milk", price: 4.5 },
      { nameAr: "موكا", nameEn: "Mocha", descriptionAr: "إسبريسو مع شوكولاتة وحليب", descriptionEn: "Espresso blended with chocolate and milk", price: 5.0 },
      { nameAr: "شاي بالنعناع", nameEn: "Mint Tea", descriptionAr: "شاي أسود طازج مع نعناع", descriptionEn: "Fresh black tea with mint leaves", price: 3.0 },
      { nameAr: "هوت شوكليت", nameEn: "Hot Chocolate", descriptionAr: "شوكولاتة ساخنة كريمية", descriptionEn: "Creamy hot chocolate", price: 4.5 },
    ],
  },
  {
    nameAr: "مشروبات باردة",
    nameEn: "Cold Drinks",
    sortOrder: 2,
    items: [
      { nameAr: "آيس لاتيه", nameEn: "Iced Latte", descriptionAr: "إسبريسو مع حليب بارد", descriptionEn: "Espresso poured over cold milk and ice", price: 5.0 },
      { nameAr: "آيس موكا", nameEn: "Iced Mocha", descriptionAr: "إسبريسو مع شوكولاتة وحليب بارد", descriptionEn: "Iced espresso with chocolate and milk", price: 5.5 },
      { nameAr: "فرابتشينو كراميل", nameEn: "Caramel Frappuccino", descriptionAr: "مشروب كراميل مثلج مخفوق", descriptionEn: "Blended iced coffee with caramel", price: 6.0 },
      { nameAr: "سموذي مانجو", nameEn: "Mango Smoothie", descriptionAr: "مانجو طازجة مع زبادي", descriptionEn: "Fresh mango blended with yogurt", price: 5.5 },
      { nameAr: "سموذي فراولة", nameEn: "Strawberry Smoothie", descriptionAr: "فراولة طازجة مع موز", descriptionEn: "Fresh strawberry with banana", price: 5.5 },
      { nameAr: "عصير برتقال طازج", nameEn: "Fresh Orange Juice", descriptionAr: "برتقال طازج معصور", descriptionEn: "Freshly squeezed oranges", price: 4.5 },
      { nameAr: "ليمونادة", nameEn: "Lemonade", descriptionAr: "ليمون طازج مع نعناع", descriptionEn: "Fresh lemon juice with mint", price: 3.5 },
    ],
  },
  {
    nameAr: "فطور",
    nameEn: "Breakfast",
    sortOrder: 3,
    items: [
      { nameAr: "فطور إنجليزي", nameEn: "English Breakfast", descriptionAr: "بيض، فاصوليا، سجق، طماطم، خبز محمص", descriptionEn: "Eggs, beans, sausage, tomato, toast", price: 12.0 },
      { nameAr: "بيض بنديكت", nameEn: "Eggs Benedict", descriptionAr: "بيض مسلوق على خبز محمص مع صلصة هولنديز", descriptionEn: "Poached eggs on toast with hollandaise", price: 11.0 },
      { nameAr: "بان كيك", nameEn: "Pancake Stack", descriptionAr: "بان كيك مع شراب القيقب والتوت", descriptionEn: "Pancakes with maple syrup and berries", price: 9.0 },
      { nameAr: "توست أفوكادو", nameEn: "Avocado Toast", descriptionAr: "خبز مع أفوكادو وطماطم وبذور", descriptionEn: "Toasted bread with avocado, tomato, and seeds", price: 8.5 },
      { nameAr: "فول مدمس", nameEn: "Foul Medames", descriptionAr: "فول مدمس بزيت الزيتون والليمون", descriptionEn: "Slow-cooked fava beans with olive oil and lemon", price: 6.0 },
    ],
  },
  {
    nameAr: "الأطباق الرئيسية",
    nameEn: "Main Courses",
    sortOrder: 4,
    items: [
      { nameAr: "ستيك مشوي", nameEn: "Grilled Steak", descriptionAr: "ستيك لحم بقري مع خضار مشوية", descriptionEn: "Beef steak with grilled vegetables", price: 22.0 },
      { nameAr: "دجاج مشوي", nameEn: "Grilled Chicken", descriptionAr: "نصف دجاجة مع بطاطس مهروسة", descriptionEn: "Half chicken with mashed potatoes", price: 15.0 },
      { nameAr: "سلمون مشوي", nameEn: "Grilled Salmon", descriptionAr: "فيليه سلمون مع أرز وخضار", descriptionEn: "Salmon fillet with rice and vegetables", price: 19.0 },
      { nameAr: "باستا ألفريدو", nameEn: "Chicken Alfredo", descriptionAr: "باستا مع صلصة ألفريدو ودجاج", descriptionEn: "Pasta in alfredo sauce with chicken", price: 13.0 },
      { nameAr: "باستا أرابياتا", nameEn: "Penne Arrabbiata", descriptionAr: "باستا مع صلصة طماطم حارة", descriptionEn: "Pasta in spicy tomato sauce", price: 11.0 },
    ],
  },
  {
    nameAr: "ساندويتشات",
    nameEn: "Sandwiches",
    sortOrder: 5,
    items: [
      { nameAr: "برجر كلاسيك", nameEn: "Classic Burger", descriptionAr: "لحم أنجوس مع جبنة وصوص خاص", descriptionEn: "Angus beef with cheese and house sauce", price: 10.0 },
      { nameAr: "برجر دجاج", nameEn: "Chicken Burger", descriptionAr: "دجاج مقرمش مع خس ومايونيز", descriptionEn: "Crispy chicken with lettuce and mayo", price: 9.0 },
      { nameAr: "كلوب ساندويتش", nameEn: "Club Sandwich", descriptionAr: "دجاج، بيض، جبنة، خضار في خبز محمص", descriptionEn: "Chicken, egg, cheese, and veggies on toast", price: 9.5 },
      { nameAr: "بانيني دجاج", nameEn: "Chicken Panini", descriptionAr: "دجاج مشوي مع موزاريلا وطماطم", descriptionEn: "Grilled chicken with mozzarella and tomato", price: 8.5 },
      { nameAr: "شاورما لحم", nameEn: "Beef Shawarma", descriptionAr: "لحم شاورما مع خضار وصوص ثوم", descriptionEn: "Beef shawarma with veggies and garlic sauce", price: 8.0 },
    ],
  },
  {
    nameAr: "حلويات",
    nameEn: "Desserts",
    sortOrder: 6,
    items: [
      { nameAr: "تشيز كيك", nameEn: "Cheesecake", descriptionAr: "تشيز كيك كلاسيكي مع توت", descriptionEn: "Classic cheesecake with berry compote", price: 6.5 },
      { nameAr: "براونيز", nameEn: "Brownie", descriptionAr: "براونيز شوكولاتة مع آيس كريم", descriptionEn: "Chocolate brownie with vanilla ice cream", price: 6.0 },
      { nameAr: "تيراميسو", nameEn: "Tiramisu", descriptionAr: "حلوى إيطالية بالقهوة", descriptionEn: "Italian coffee-flavored dessert", price: 6.5 },
      { nameAr: "كريب نوتيلا", nameEn: "Nutella Crepe", descriptionAr: "كريب مع نوتيلا وموز", descriptionEn: "Crepe filled with nutella and banana", price: 5.5 },
      { nameAr: "وافل بلجيكي", nameEn: "Belgian Waffle", descriptionAr: "وافل مع فراولة وشوكولاتة", descriptionEn: "Waffle topped with strawberry and chocolate", price: 7.0 },
    ],
  },
];

const IMAGE_MAP: Record<string, string> = {
  "Espresso": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80&auto=format&fit=crop",
  "Cappuccino": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80&auto=format&fit=crop",
  "Latte": "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&q=80&auto=format&fit=crop",
  "Mocha": "https://images.unsplash.com/photo-1578314675229-23d3e2231a04?w=800&q=80&auto=format&fit=crop",
  "Mint Tea": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80&auto=format&fit=crop",
  "Hot Chocolate": "https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=800&q=80&auto=format&fit=crop",
  "Iced Latte": "https://images.unsplash.com/photo-1517959105821-eaf2591984ca?w=800&q=80&auto=format&fit=crop",
  "Iced Mocha": "https://images.unsplash.com/photo-1497636781865-454dc1d9919c?w=800&q=80&auto=format&fit=crop",
  "Caramel Frappuccino": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80&auto=format&fit=crop",
  "Mango Smoothie": "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&q=80&auto=format&fit=crop",
  "Strawberry Smoothie": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80&auto=format&fit=crop",
  "Fresh Orange Juice": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800&q=80&auto=format&fit=crop",
  "Lemonade": "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&q=80&auto=format&fit=crop",
  "English Breakfast": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80&auto=format&fit=crop",
  "Eggs Benedict": "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80&auto=format&fit=crop",
  "Pancake Stack": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&auto=format&fit=crop",
  "Avocado Toast": "https://images.unsplash.com/photo-1603046891744-76e6300f82ef?w=800&q=80&auto=format&fit=crop",
  "Foul Medames": "https://images.unsplash.com/photo-1605209877088-94be25e6c5f1?w=800&q=80&auto=format&fit=crop",
  "Grilled Steak": "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=800&q=80&auto=format&fit=crop",
  "Grilled Chicken": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80&auto=format&fit=crop",
  "Grilled Salmon": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80&auto=format&fit=crop",
  "Chicken Alfredo": "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&q=80&auto=format&fit=crop",
  "Penne Arrabbiata": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&q=80&auto=format&fit=crop",
  "Classic Burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&auto=format&fit=crop",
  "Chicken Burger": "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80&auto=format&fit=crop",
  "Club Sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80&auto=format&fit=crop",
  "Chicken Panini": "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=800&q=80&auto=format&fit=crop",
  "Beef Shawarma": "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=800&q=80&auto=format&fit=crop",
  "Cheesecake": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80&auto=format&fit=crop",
  "Brownie": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80&auto=format&fit=crop",
  "Tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80&auto=format&fit=crop",
  "Nutella Crepe": "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&q=80&auto=format&fit=crop",
  "Belgian Waffle": "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&q=80&auto=format&fit=crop",
};

// ══════════════════════════════════════════════════════════════
// INVENTORY CATEGORIES & ITEMS
// ══════════════════════════════════════════════════════════════

type InventorySeedCategory = {
  nameAr: string;
  nameEn: string;
  description: string;
  sortOrder: number;
  items: {
    nameAr: string;
    nameEn: string;
    code: string;
    unit: string;
    qtyOnHand: number;
    minQty: number;
    reorderPoint: number;
    avgUnitCost: number;
  }[];
};

const INVENTORY_CATEGORIES: InventorySeedCategory[] = [
  {
    nameAr: "المشروبات",
    nameEn: "Beverages",
    description: "All drink-related ingredients",
    sortOrder: 1,
    items: [
      { nameAr: "بن إسبريسو", nameEn: "Espresso Beans", code: "BEV-001", unit: "kg", qtyOnHand: 25, minQty: 5, reorderPoint: 8, avgUnitCost: 45 },
      { nameAr: "حليب طازج", nameEn: "Fresh Milk", code: "BEV-002", unit: "l", qtyOnHand: 50, minQty: 10, reorderPoint: 15, avgUnitCost: 3.5 },
      { nameAr: "شوكولاتة بودرة", nameEn: "Cocoa Powder", code: "BEV-003", unit: "kg", qtyOnHand: 5, minQty: 1, reorderPoint: 2, avgUnitCost: 28 },
      { nameAr: "شراب القيقب", nameEn: "Maple Syrup", code: "BEV-004", unit: "bottle", qtyOnHand: 8, minQty: 2, reorderPoint: 3, avgUnitCost: 22 },
      { nameAr: "نعناع طازج", nameEn: "Fresh Mint", code: "BEV-005", unit: "kg", qtyOnHand: 3, minQty: 0.5, reorderPoint: 1, avgUnitCost: 15 },
      { nameAr: "برتقال طازج", nameEn: "Fresh Oranges", code: "BEV-006", unit: "kg", qtyOnHand: 30, minQty: 5, reorderPoint: 10, avgUnitCost: 4 },
      { nameAr: "مانجو طازج", nameEn: "Fresh Mango", code: "BEV-007", unit: "kg", qtyOnHand: 15, minQty: 3, reorderPoint: 5, avgUnitCost: 8 },
      { nameAr: "فراولة طازجة", nameEn: "Fresh Strawberry", code: "BEV-008", unit: "kg", qtyOnHand: 12, minQty: 3, reorderPoint: 5, avgUnitCost: 10 },
    ],
  },
  {
    nameAr: "المخبوزات",
    nameEn: "Bakery",
    description: "Bread and baked goods",
    sortOrder: 2,
    items: [
      { nameAr: "خبز توست", nameEn: "Toast Bread", code: "BKR-001", unit: "pack", qtyOnHand: 20, minQty: 5, reorderPoint: 8, avgUnitCost: 5 },
      { nameAr: "خبز برجر", nameEn: "Burger Buns", code: "BKR-002", unit: "pack", qtyOnHand: 15, minQty: 5, reorderPoint: 8, avgUnitCost: 6 },
      { nameAr: "خبز عربي", nameEn: "Pita Bread", code: "BKR-003", unit: "pack", qtyOnHand: 18, minQty: 5, reorderPoint: 8, avgUnitCost: 4 },
      { nameAr: "كريب", nameEn: "Crepe Sheets", code: "BKR-004", unit: "pack", qtyOnHand: 10, minQty: 3, reorderPoint: 5, avgUnitCost: 8 },
      { nameAr: "وافل جاهز", nameEn: "Waffle Mix", code: "BKR-005", unit: "kg", qtyOnHand: 8, minQty: 2, reorderPoint: 3, avgUnitCost: 12 },
    ],
  },
  {
    nameAr: "اللحوم والمأكولات البحرية",
    nameEn: "Meat & Seafood",
    description: "All meat and seafood products",
    sortOrder: 3,
    items: [
      { nameAr: "لحم بقري (ستيك)", nameEn: "Beef Steak", code: "MST-001", unit: "kg", qtyOnHand: 10, minQty: 2, reorderPoint: 4, avgUnitCost: 55 },
      { nameAr: "دجاج كامل", nameEn: "Whole Chicken", code: "MST-002", unit: "pc", qtyOnHand: 25, minQty: 5, reorderPoint: 10, avgUnitCost: 12 },
      { nameAr: "فيليه سلمون", nameEn: "Salmon Fillet", code: "MST-003", unit: "kg", qtyOnHand: 8, minQty: 2, reorderPoint: 3, avgUnitCost: 65 },
      { nameAr: "لحم مفروم", nameEn: "Ground Beef", code: "MST-004", unit: "kg", qtyOnHand: 12, minQty: 3, reorderPoint: 5, avgUnitCost: 35 },
      { nameAr: "سجق", nameEn: "Sausage", code: "MST-005", unit: "kg", qtyOnHand: 6, minQty: 2, reorderPoint: 3, avgUnitCost: 25 },
      { nameAr: "صدور دجاج", nameEn: "Chicken Breast", code: "MST-006", unit: "kg", qtyOnHand: 15, minQty: 3, reorderPoint: 5, avgUnitCost: 20 },
    ],
  },
  {
    nameAr: "الخضروات والفواكه",
    nameEn: "Produce",
    description: "Fresh vegetables and fruits",
    sortOrder: 4,
    items: [
      { nameAr: "طماطم", nameEn: "Tomatoes", code: "PRD-001", unit: "kg", qtyOnHand: 20, minQty: 5, reorderPoint: 8, avgUnitCost: 4 },
      { nameAr: "خس", nameEn: "Lettuce", code: "PRD-002", unit: "kg", qtyOnHand: 10, minQty: 3, reorderPoint: 5, avgUnitCost: 5 },
      { nameAr: "بصل", nameEn: "Onions", code: "PRD-003", unit: "kg", qtyOnHand: 15, minQty: 5, reorderPoint: 8, avgUnitCost: 3 },
      { nameAr: "بطاطس", nameEn: "Potatoes", code: "PRD-004", unit: "kg", qtyOnHand: 25, minQty: 5, reorderPoint: 10, avgUnitCost: 3 },
      { nameAr: "أفوكادو", nameEn: "Avocado", code: "PRD-005", unit: "pc", qtyOnHand: 15, minQty: 5, reorderPoint: 8, avgUnitCost: 6 },
      { nameAr: "ليمون", nameEn: "Lemon", code: "PRD-006", unit: "kg", qtyOnHand: 10, minQty: 3, reorderPoint: 5, avgUnitCost: 5 },
      { nameAr: "موز", nameEn: "Banana", code: "PRD-007", unit: "kg", qtyOnHand: 12, minQty: 3, reorderPoint: 5, avgUnitCost: 4 },
      { nameAr: "توت", nameEn: "Berries", code: "PRD-008", unit: "kg", qtyOnHand: 5, minQty: 2, reorderPoint: 3, avgUnitCost: 18 },
    ],
  },
  {
    nameAr: "الألواح والجبن",
    nameEn: "Dairy & Cheese",
    description: "Dairy products and cheeses",
    sortOrder: 5,
    items: [
      { nameAr: "جبنة موزاريلا", nameEn: "Mozzarella", code: "DRY-001", unit: "kg", qtyOnHand: 8, minQty: 2, reorderPoint: 3, avgUnitCost: 30 },
      { nameAr: "جبنة شيدر", nameEn: "Cheddar", code: "DRY-002", unit: "kg", qtyOnHand: 6, minQty: 2, reorderPoint: 3, avgUnitCost: 28 },
      { nameAr: "زبادي", nameEn: "Yogurt", code: "DRY-003", unit: "kg", qtyOnHand: 10, minQty: 3, reorderPoint: 5, avgUnitCost: 8 },
      { nameAr: "كريمة طهي", nameEn: "Cooking Cream", code: "DRY-004", unit: "l", qtyOnHand: 8, minQty: 2, reorderPoint: 3, avgUnitCost: 12 },
      { nameAr: "زبدة", nameEn: "Butter", code: "DRY-005", unit: "kg", qtyOnHand: 5, minQty: 1, reorderPoint: 2, avgUnitCost: 15 },
      { nameAr: "بيض طازج", nameEn: "Fresh Eggs", code: "DRY-006", unit: "pack", qtyOnHand: 20, minQty: 5, reorderPoint: 8, avgUnitCost: 12 },
    ],
  },
  {
    nameAr: "المعلبات والتوابل",
    nameEn: "Pantry",
    description: "Canned goods, spices, and dry ingredients",
    sortOrder: 6,
    items: [
      { nameAr: "صلصة طماطم", nameEn: "Tomato Sauce", code: "PNT-001", unit: "can", qtyOnHand: 30, minQty: 10, reorderPoint: 15, avgUnitCost: 5 },
      { nameAr: "فاصوليا معلبة", nameEn: "Canned Beans", code: "PNT-002", unit: "can", qtyOnHand: 25, minQty: 8, reorderPoint: 12, avgUnitCost: 4 },
      { nameAr: "أرز أبيض", nameEn: "White Rice", code: "PNT-003", unit: "kg", qtyOnHand: 40, minQty: 10, reorderPoint: 15, avgUnitCost: 5 },
      { nameAr: "معجون فول", nameEn: "Fava Bean Paste", code: "PNT-004", unit: "can", qtyOnHand: 15, minQty: 5, reorderPoint: 8, avgUnitCost: 6 },
      { nameAr: "ملح", nameEn: "Salt", code: "PNT-005", unit: "kg", qtyOnHand: 5, minQty: 1, reorderPoint: 2, avgUnitCost: 2 },
      { nameAr: "فلفل أسود", nameEn: "Black Pepper", code: "PNT-006", unit: "kg", qtyOnHand: 2, minQty: 0.5, reorderPoint: 1, avgUnitCost: 25 },
      { nameAr: "زيت زيتون", nameEn: "Olive Oil", code: "PNT-007", unit: "l", qtyOnHand: 10, minQty: 3, reorderPoint: 5, avgUnitCost: 18 },
      { nameAr: "كاتشب", nameEn: "Ketchup", code: "PNT-008", unit: "bottle", qtyOnHand: 12, minQty: 3, reorderPoint: 5, avgUnitCost: 6 },
      { nameAr: "مايونيز", nameEn: "Mayonnaise", code: "PNT-009", unit: "bottle", qtyOnHand: 10, minQty: 3, reorderPoint: 5, avgUnitCost: 7 },
      { nameAr: "نوتيلا", nameEn: "Nutella", code: "PNT-010", unit: "jar", qtyOnHand: 8, minQty: 2, reorderPoint: 3, avgUnitCost: 15 },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// EXPENSE CATEGORIES
// ══════════════════════════════════════════════════════════════

const EXPENSE_CATEGORIES = [
  { nameAr: "إيجار", nameEn: "Rent" },
  { nameAr: "رواتب", nameEn: "Salaries" },
  { nameAr: "مرافق", nameEn: "Utilities" },
  { nameAr: "صيانة", nameEn: "Maintenance" },
  { nameAr: "تسويق", nameEn: "Marketing" },
  { nameAr: "أخرى", nameEn: "Other" },
];

// ══════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ══════════════════════════════════════════════════════════════

async function seedUsers() {
  console.log("\n── Seeding Users ──");
  const printed: { email: string; password: string }[] = [];
  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    const passwordHash = await bcrypt.hash(u.password, 10);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, active: true, mustChangePassword: true },
      });
      console.log(`= updated: ${u.email} (${u.role})`);
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          role: u.role,
          passwordHash,
          active: true,
          mustChangePassword: true,
        },
      });
      console.log(`+ created: ${u.email} (${u.role})`);
    }
    printed.push({ email: u.email, password: u.password });
  }
  console.log("\nOne-time credentials (printed once — users must change password on first login):");
  for (const p of printed) console.log(`  ${p.email}  password=${p.password}`);
}

async function seedMenu() {
  console.log("\n── Seeding Menu ──");
  let catCreated = 0, catSkipped = 0, itemCreated = 0, itemSkipped = 0;

  for (const cat of MENU_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { nameEn: cat.nameEn } });
    let categoryId: string;
    if (existing) {
      categoryId = existing.id;
      catSkipped++;
    } else {
      const created = await prisma.category.create({
        data: { nameAr: cat.nameAr, nameEn: cat.nameEn, sortOrder: cat.sortOrder },
      });
      categoryId = created.id;
      catCreated++;
      console.log(`+ category: ${cat.nameEn}`);
    }

    for (const item of cat.items) {
      const itemExists = await prisma.menuItem.findFirst({ where: { categoryId, nameEn: item.nameEn, deletedAt: null } });
      if (itemExists) { itemSkipped++; continue; }

      await prisma.menuItem.create({
        data: {
          categoryId,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          descriptionAr: item.descriptionAr ?? "",
          descriptionEn: item.descriptionEn ?? "",
          price: item.price,
          image: IMAGE_MAP[item.nameEn] ?? "",
          available: true,
        },
      });
      itemCreated++;
    }
  }
  console.log(`Categories: +${catCreated} new, =${catSkipped} existing`);
  console.log(`Items: +${itemCreated} new, =${itemSkipped} existing`);
}

async function seedInventory() {
  console.log("\n── Seeding Inventory ──");
  let catCreated = 0, itemCreated = 0;

  for (const cat of INVENTORY_CATEGORIES) {
    const existing = await prisma.inventoryCategory.findFirst({ where: { nameEn: cat.nameEn } });
    let categoryId: string;
    if (existing) {
      categoryId = existing.id;
    } else {
      const created = await prisma.inventoryCategory.create({
        data: { nameAr: cat.nameAr, nameEn: cat.nameEn, description: cat.description, sortOrder: cat.sortOrder },
      });
      categoryId = created.id;
      catCreated++;
      console.log(`+ inventory category: ${cat.nameEn}`);
    }

    for (const item of cat.items) {
      const exists = await prisma.inventoryItem.findFirst({ where: { code: item.code, deletedAt: null } });
      if (exists) continue;

      await prisma.inventoryItem.create({
        data: {
          categoryId,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          code: item.code,
          unit: item.unit,
          qtyOnHand: item.qtyOnHand,
          minQty: item.minQty,
          reorderPoint: item.reorderPoint,
          recommendedReorderQty: item.reorderPoint,
          avgUnitCost: item.avgUnitCost,
          active: true,
        },
      });
      itemCreated++;
    }
  }
  console.log(`Inventory categories: +${catCreated}`);
  console.log(`Inventory items: +${itemCreated}`);
}

async function seedExpenseCategories() {
  console.log("\n── Seeding Expense Categories ──");

  // Seed main categories (idempotent)
  const MAIN_CATEGORIES = [
    { id: "00000000-0000-0000-0000-000000000001", nameAr: "مصروفات ثابتة", nameEn: "Fixed Expenses" },
    { id: "00000000-0000-0000-0000-000000000002", nameAr: "مصروفات متغيرة", nameEn: "Variable Expenses" },
    { id: "00000000-0000-0000-0000-000000000003", nameAr: "مصروفات تشغيلية", nameEn: "Operational Expenses" },
  ];

  for (const cat of MAIN_CATEGORIES) {
    const exists = await prisma.mainExpenseCategory.findFirst({ where: { nameEn: cat.nameEn } });
    if (!exists) {
      await prisma.mainExpenseCategory.create({ data: { id: cat.id, nameAr: cat.nameAr, nameEn: cat.nameEn } });
    }
  }

  // Seed sub categories under "Operational Expenses" (idempotent)
  let created = 0;
  for (const cat of EXPENSE_CATEGORIES) {
    const exists = await prisma.subExpenseCategory.findFirst({ where: { nameEn: cat.nameEn } });
    if (exists) continue;
    await prisma.subExpenseCategory.create({
      data: {
        mainCategoryId: "00000000-0000-0000-0000-000000000003",
        nameAr: cat.nameAr,
        nameEn: cat.nameEn,
      },
    });
    created++;
  }
  console.log(`Expense categories: main=${MAIN_CATEGORIES.length}, sub=+${created}`);
}

async function seedOrders() {
  console.log("\n── Seeding Orders ──");

  const existingOrders = await prisma.order.count();
  if (existingOrders > 0) {
    console.log(`= ${existingOrders} orders already exist, skipping`);
    return;
  }

  const admin = await prisma.user.findUnique({ where: { email: "admin@tastytable.com" } });
  const waiter = await prisma.user.findUnique({ where: { email: "waiter@tastytable.com" } });
  const cashier = await prisma.user.findUnique({ where: { email: "cashier@tastytable.com" } });

  const menuItems = await prisma.menuItem.findMany({ where: { deletedAt: null }, take: 20 });
  if (menuItems.length === 0) {
    console.log("! No menu items found, skipping orders");
    return;
  }

  const orderData = [
    { customerName: "خالد محمد", phone: "+201012345678", orderType: "dine_in", tableNumber: 5, status: "completed" as OrderStatus, paymentStatus: "paid", notes: "بدون سكر" },
    { customerName: "سارة علي", phone: "+201098765432", orderType: "dine_in", tableNumber: 12, status: "ready" as OrderStatus, paymentStatus: "unpaid", billRequested: true, notes: null },
    { customerName: "عمر حسن", phone: "+201122334455", orderType: "takeaway", tableNumber: null, status: "preparing" as OrderStatus, paymentStatus: "unpaid", notes: "спеши" },
    { customerName: "فاطمة أحمد", phone: "+201556677889", orderType: "dine_in", tableNumber: 3, status: "received" as OrderStatus, paymentStatus: "unpaid", notes: null },
    { customerName: "يوسف إبراهيم", phone: "+201667788990", orderType: "dine_in", tableNumber: 8, status: "received" as OrderStatus, paymentStatus: "unpaid", notes: "في室外 لو ممكن" },
    { customerName: "نورا سعيد", phone: "+201778899001", orderType: "takeaway", tableNumber: null, status: "cancelled" as OrderStatus, paymentStatus: "unpaid", cancelReason: "العميل الغى الطلب" },
    { customerName: "أحمد محمود", phone: "+201889900112", orderType: "dine_in", tableNumber: 15, status: "completed" as OrderStatus, paymentStatus: "paid", notes: null },
    { customerName: "مريم خالد", phone: "+201990011223", orderType: "dine_in", tableNumber: 7, status: "preparing" as OrderStatus, paymentStatus: "unpaid", notes: "أطفالي بيحبو الشوكولاتة" },
    { customerName: "حسن علي", phone: "+201234567890", orderType: "dine_in", tableNumber: 2, status: "ready" as OrderStatus, paymentStatus: "unpaid", billRequested: false, notes: null },
    { customerName: "رنا ياسر", phone: "+201345678901", orderType: "takeaway", tableNumber: null, status: "completed" as OrderStatus, paymentStatus: "paid", notes: null },
    { customerName: "كريم عادل", phone: "+201456789012", orderType: "dine_in", tableNumber: 10, status: "received" as OrderStatus, paymentStatus: "unpaid", notes: null },
    { customerName: "هدى مصطفى", phone: "+201567890123", orderType: "dine_in", tableNumber: 4, status: "preparing" as OrderStatus, paymentStatus: "unpaid", notes: "بدون بصل" },
  ];

  let counter = 1;
  for (const o of orderData) {
    // Pick 2-4 random items
    const itemCount = 2 + Math.floor(Math.random() * 3);
    const shuffled = [...menuItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, itemCount);

    let itemsTotal = 0;
    const orderItems = selected.map((mi) => {
      const qty = 1 + Math.floor(Math.random() * 3);
      const unitPrice = Number(mi.price);
      itemsTotal += unitPrice * qty;
      return {
        menuItemId: mi.id,
        nameAr: mi.nameAr,
        nameEn: mi.nameEn,
        quantity: qty,
        unitPrice: mi.price,
      };
    });

    const orderNumber = String(counter).padStart(4, "0");
    counter++;

    await prisma.order.create({
      data: {
        orderNumber,
        customerName: o.customerName,
        phone: o.phone,
        orderType: o.orderType,
        tableNumber: o.tableNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        billRequested: o.billRequested ?? false,
        cancelReason: o.cancelReason,
        notes: o.notes,
        itemsTotal,
        total: itemsTotal,
        paidTotal: o.paymentStatus === "paid" ? itemsTotal : 0,
        createdByUserId: waiter?.id,
        items: { create: orderItems },
        ...(o.paymentStatus === "paid" ? {
          payments: {
            create: {
              amount: itemsTotal,
              method: Math.random() > 0.5 ? "cash" : "card",
              actorId: cashier?.id,
            },
          },
        } : {}),
      },
    });
    console.log(`+ order #${orderNumber} — ${o.customerName} (${o.status})`);
  }

  // Update counter
  await prisma.orderCounter.upsert({
    where: { id: "order-counter" },
    create: { id: "order-counter", value: counter },
    update: { value: counter },
  });
}

async function seedRestaurantSettings() {
  console.log("\n── Seeding Restaurant Settings ──");
  const existing = await prisma.restaurantSettings.findUnique({ where: { id: "main" } });
  if (existing) {
    console.log("= Settings already exist");
    return;
  }
  await prisma.restaurantSettings.create({
    data: {
      id: "main",
      nameAr: "تيستي تيبل",
      nameEn: "Tasty Table",
      contactPhone: "+201234567890",
      contactAddress: "شارع التحرير، وسط البلد، القاهرة",
      workingHours: "8:00 AM - 12:00 AM",
      taxEnabled: true,
      taxRate: 0.14,
      serviceEnabled: true,
      serviceRate: 0.10,
    },
  });
  console.log("+ Restaurant settings created");
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Tasty Table — Full Seed");
  console.log("═══════════════════════════════════════════");

  await seedUsers();
  await seedMenu();
  await seedInventory();
  await seedExpenseCategories();
  await seedRestaurantSettings();
  await seedOrders();

  console.log("\n═══════════════════════════════════════════");
  console.log("  Done! Login credentials:");
  console.log("═══════════════════════════════════════════");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(18)} ${u.email.padEnd(28)} ${u.password}`);
  }
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
