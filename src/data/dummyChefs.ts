import chef1 from "@/assets/chef-1.jpg";
import chef2 from "@/assets/chef-2.jpg";
import chef3 from "@/assets/chef-3.jpg";
import chef4 from "@/assets/chef-4.jpg";
import chef5 from "@/assets/chef-5.jpg";
import chef6 from "@/assets/chef-6.jpg";

export type Recipe = {
  id: string;
  title: string;
  duration: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
};

export type Chef = {
  id: string;
  name: string;
  cuisine: string;
  city: string;
  bio: string;
  image: string;
  signature: string;
  recipes: Recipe[];
};

export const chefs: Chef[] = [
  {
    id: "alessia-romano",
    name: "Alessia Romano",
    cuisine: "Italian",
    city: "Bologna",
    bio: "Third-generation pasta maker reimagining Emilia-Romagna classics with modern restraint.",
    image: chef1,
    signature: "Hand-rolled tagliatelle al ragù",
    recipes: [
      { id: "r1", title: "Tagliatelle al Ragù", duration: "3h", difficulty: "Medium", description: "Slow-braised beef and pork sugo over silky egg pasta." },
      { id: "r2", title: "Tortellini in Brodo", duration: "2h", difficulty: "Hard", description: "Tiny pillows of pork and parmigiano in a clear capon broth." },
      { id: "r3", title: "Tiramisù", duration: "30m", difficulty: "Easy", description: "Mascarpone, espresso-soaked savoiardi, a whisper of marsala." },
    ],
  },
  {
    id: "kenji-watanabe",
    name: "Kenji Watanabe",
    cuisine: "Japanese",
    city: "Kyoto",
    bio: "Edomae-trained sushi master with two decades behind the counter at Ginza's Sukiyabashi.",
    image: chef2,
    signature: "Aged otoro nigiri",
    recipes: [
      { id: "r1", title: "Tamago Nigiri", duration: "45m", difficulty: "Medium", description: "Layered sweet egg omelet over seasoned shari." },
      { id: "r2", title: "Miso-Glazed Black Cod", duration: "2 days", difficulty: "Easy", description: "Saikyo miso marinade, broiled until lacquered." },
    ],
  },
  {
    id: "louis-marchand",
    name: "Louis Marchand",
    cuisine: "French",
    city: "Lyon",
    bio: "Patissier with a Michelin star for his work on lamination and chocolate.",
    image: chef3,
    signature: "Croissant au beurre noisette",
    recipes: [
      { id: "r1", title: "Pain au Chocolat", duration: "12h", difficulty: "Hard", description: "Twenty-seven layers of butter and dough wrapped around dark chocolate batons." },
      { id: "r2", title: "Tarte Tatin", duration: "1h30", difficulty: "Medium", description: "Caramelized apples beneath a flaky pastry crown." },
      { id: "r3", title: "Crème Brûlée", duration: "4h", difficulty: "Easy", description: "Vanilla bean custard under a crackling sugar shell." },
      { id: "r4", title: "Mille-Feuille", duration: "3h", difficulty: "Hard", description: "Three layers of puff pastry, vanilla diplomat cream." },
    ],
  },
  {
    id: "lucia-mendoza",
    name: "Lucía Mendoza",
    cuisine: "Mexican",
    city: "Oaxaca",
    bio: "Champion of mole negro and heirloom corn, working with masa producers across the valley.",
    image: chef4,
    signature: "Mole negro de Oaxaca",
    recipes: [
      { id: "r1", title: "Mole Negro", duration: "5h", difficulty: "Hard", description: "Twenty-six ingredients toasted, ground, and simmered into velvet." },
      { id: "r2", title: "Tlayudas", duration: "1h", difficulty: "Easy", description: "Crisp masa flatbread, asiento, beans, quesillo, salsa." },
    ],
  },
  {
    id: "ravi-iyer",
    name: "Ravi Iyer",
    cuisine: "Indian",
    city: "Chennai",
    bio: "Spice trader turned chef, exploring South Indian heritage through fire and ferment.",
    image: chef5,
    signature: "Coastal fish curry",
    recipes: [
      { id: "r1", title: "Chettinad Chicken", duration: "1h30", difficulty: "Medium", description: "Fennel, star anise, and black pepper braise from Tamil Nadu." },
      { id: "r2", title: "Masala Dosa", duration: "2 days", difficulty: "Medium", description: "Fermented rice and lentil crepe folded over potato masala." },
      { id: "r3", title: "Payasam", duration: "1h", difficulty: "Easy", description: "Vermicelli and cardamom milk pudding with toasted cashews." },
    ],
  },
  {
    id: "magnus-eriksson",
    name: "Magnus Eriksson",
    cuisine: "Nordic",
    city: "Copenhagen",
    bio: "Forager and fermenter, building a hyper-local pantry from coast and forest.",
    image: chef6,
    signature: "Sea-buckthorn cured trout",
    recipes: [
      { id: "r1", title: "Cured Sea Trout", duration: "24h", difficulty: "Easy", description: "Salt, sugar, dill, and sea-buckthorn berries." },
      { id: "r2", title: "Rye Sourdough", duration: "3 days", difficulty: "Hard", description: "Dense, malted, with a thick mahogany crust." },
    ],
  },
];

export const cuisines = ["All", ...Array.from(new Set(chefs.map((c) => c.cuisine)))];
