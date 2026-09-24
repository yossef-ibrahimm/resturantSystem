import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const imageByName: Record<string, string> = {
  // Hot Drinks
  "Espresso": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80&auto=format&fit=crop",
  "Cappuccino": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80&auto=format&fit=crop",
  "Latte": "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=800&q=80&auto=format&fit=crop",
  "Mocha": "https://images.unsplash.com/photo-1578314675229-23d3e2231a04?w=800&q=80&auto=format&fit=crop",
  "Mint Tea": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80&auto=format&fit=crop",
  "Hot Chocolate": "https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=800&q=80&auto=format&fit=crop",

  // Cold Drinks
  "Iced Latte": "https://images.unsplash.com/photo-1517959105821-eaf2591984ca?w=800&q=80&auto=format&fit=crop",
  "Iced Mocha": "https://images.unsplash.com/photo-1497636781865-454dc1d9919c?w=800&q=80&auto=format&fit=crop",
  "Caramel Frappuccino": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80&auto=format&fit=crop",
  "Mango Smoothie": "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&q=80&auto=format&fit=crop",
  "Strawberry Smoothie": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80&auto=format&fit=crop",
  "Fresh Orange Juice": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800&q=80&auto=format&fit=crop",
  "Lemonade": "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&q=80&auto=format&fit=crop",

  // Breakfast
  "English Breakfast": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80&auto=format&fit=crop",
  "Eggs Benedict": "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80&auto=format&fit=crop",
  "Pancake Stack": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&auto=format&fit=crop",
  "Avocado Toast": "https://images.unsplash.com/photo-1603046891744-76e6300f82ef?w=800&q=80&auto=format&fit=crop",
  "Foul Medames": "https://images.unsplash.com/photo-1605209877088-94be25e6c5f1?w=800&q=80&auto=format&fit=crop",

  // Main Courses
  "Grilled Steak": "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=800&q=80&auto=format&fit=crop",
  "Grilled Chicken": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80&auto=format&fit=crop",
  "Grilled Salmon": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80&auto=format&fit=crop",
  "Chicken Alfredo": "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&q=80&auto=format&fit=crop",
  "Penne Arrabbiata": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&q=80&auto=format&fit=crop",

  // Sandwiches
  "Classic Burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&auto=format&fit=crop",
  "Chicken Burger": "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80&auto=format&fit=crop",
  "Club Sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80&auto=format&fit=crop",
  "Chicken Panini": "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=800&q=80&auto=format&fit=crop",
  "Beef Shawarma": "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=800&q=80&auto=format&fit=crop",

  // Desserts
  "Cheesecake": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80&auto=format&fit=crop",
  "Brownie": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80&auto=format&fit=crop",
  "Tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80&auto=format&fit=crop",
  "Nutella Crepe": "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800&q=80&auto=format&fit=crop",
  "Belgian Waffle": "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=800&q=80&auto=format&fit=crop",
};

async function main() {
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const [nameEn, imageUrl] of Object.entries(imageByName)) {
    const item = await prisma.menuItem.findFirst({
      where: { nameEn, deletedAt: null },
    });
    if (!item) {
      console.log(`! not found: ${nameEn}`);
      missing++;
      continue;
    }
    if (item.image === imageUrl) {
      skipped++;
      continue;
    }
    await prisma.menuItem.update({ where: { id: item.id }, data: { image: imageUrl } });
    updated++;
    console.log(`+ ${nameEn}`);
  }

  console.log(`\nUpdated: ${updated}, Already set: ${skipped}, Missing items: ${missing}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
