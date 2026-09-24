import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

const categories: SeedCategory[] = [
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

async function main() {
  let categoryCreated = 0;
  let categorySkipped = 0;
  let itemCreated = 0;
  let itemSkipped = 0;

  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { nameEn: cat.nameEn } });

    let categoryId: string;
    if (existing) {
      categoryId = existing.id;
      categorySkipped++;
      console.log(`= category exists: ${cat.nameEn}`);
    } else {
      const created = await prisma.category.create({
        data: { nameAr: cat.nameAr, nameEn: cat.nameEn, sortOrder: cat.sortOrder },
      });
      categoryId = created.id;
      categoryCreated++;
      console.log(`+ category created: ${cat.nameEn}`);
    }

    for (const item of cat.items) {
      const itemExists = await prisma.menuItem.findFirst({
        where: { categoryId, nameEn: item.nameEn, deletedAt: null },
      });

      if (itemExists) {
        itemSkipped++;
        console.log(`  = item exists: ${item.nameEn}`);
        continue;
      }

      await prisma.menuItem.create({
        data: {
          categoryId,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          descriptionAr: item.descriptionAr ?? "",
          descriptionEn: item.descriptionEn ?? "",
          price: item.price,
          image: item.image ?? "",
          available: true,
        },
      });
      itemCreated++;
      console.log(`  + item created: ${item.nameEn} (${item.price})`);
    }
  }

  console.log("\nDone.");
  console.log(`Categories — created: ${categoryCreated}, skipped: ${categorySkipped}`);
  console.log(`Items     — created: ${itemCreated}, skipped: ${itemSkipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
