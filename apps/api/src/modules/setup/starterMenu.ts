import { prisma } from "../../lib/prisma.js";

// A small, genuinely useful starting point offered during onboarding — not
// the full 45-item/100-order demo dataset (prisma/seed-data.ts), which is
// only for local dev/demo purposes. A real restaurant either starts from
// this modest template and edits it, or skips it and builds their menu from
// scratch in Menu Management.
const STARTER_CATEGORIES: {
  name: string;
  items: { name: string; description: string; price: number; foodType: "VEG" | "NON_VEG" | "EGG" }[];
}[] = [
  {
    name: "Starters",
    items: [
      { name: "Paneer Tikka", description: "Char-grilled cottage cheese, house spice marinade", price: 260, foodType: "VEG" },
      { name: "Chicken Lollipop", description: "Frenched chicken wings tossed in a spicy glaze", price: 320, foodType: "NON_VEG" },
      { name: "Veg Spring Roll", description: "Crisp rolls stuffed with julienned vegetables", price: 220, foodType: "VEG" },
    ],
  },
  {
    name: "Soups",
    items: [
      { name: "Tomato Soup", description: "Slow-simmered tomato, basil, a touch of cream", price: 140, foodType: "VEG" },
      { name: "Hot & Sour Soup", description: "Spicy Indo-Chinese vegetable soup", price: 160, foodType: "VEG" },
    ],
  },
  {
    name: "Main Course",
    items: [
      { name: "Butter Chicken", description: "Tandoori chicken simmered in a rich tomato-butter gravy", price: 380, foodType: "NON_VEG" },
      { name: "Paneer Butter Masala", description: "Cottage cheese in a velvety tomato-cashew gravy", price: 320, foodType: "VEG" },
      { name: "Dal Makhani", description: "Slow-cooked black lentils, butter, cream", price: 260, foodType: "VEG" },
      { name: "Chicken Curry", description: "Home-style chicken curry with warm spices", price: 340, foodType: "NON_VEG" },
    ],
  },
  {
    name: "Rice & Biryani",
    items: [
      { name: "Chicken Biryani", description: "Layered basmati rice, spiced chicken, saffron", price: 350, foodType: "NON_VEG" },
      { name: "Veg Biryani", description: "Layered basmati rice with mixed vegetables", price: 280, foodType: "VEG" },
      { name: "Jeera Rice", description: "Basmati rice tempered with cumin", price: 160, foodType: "VEG" },
    ],
  },
  {
    name: "Breads",
    items: [
      { name: "Butter Naan", description: "Tandoor-baked leavened bread, brushed with butter", price: 60, foodType: "VEG" },
      { name: "Garlic Naan", description: "Tandoor-baked naan topped with garlic and coriander", price: 70, foodType: "VEG" },
      { name: "Tandoori Roti", description: "Whole-wheat tandoor bread", price: 40, foodType: "VEG" },
    ],
  },
  {
    name: "Beverages",
    items: [
      { name: "Masala Chai", description: "Spiced Indian tea", price: 60, foodType: "VEG" },
      { name: "Fresh Lime Soda", description: "Sweet, salted, or mixed", price: 90, foodType: "VEG" },
      { name: "Mango Lassi", description: "Yogurt blended with mango pulp", price: 120, foodType: "VEG" },
    ],
  },
  {
    name: "Desserts",
    items: [
      { name: "Gulab Jamun", description: "Milk dumplings soaked in cardamom syrup", price: 100, foodType: "VEG" },
      { name: "Gajar Ka Halwa", description: "Slow-cooked carrot dessert with ghee and nuts", price: 130, foodType: "VEG" },
    ],
  },
];

export async function loadStarterMenu(restaurantId: string): Promise<void> {
  for (const [index, category] of STARTER_CATEGORIES.entries()) {
    const createdCategory = await prisma.menuCategory.create({
      data: { restaurantId, name: category.name, sortOrder: index },
    });
    await prisma.menuItem.createMany({
      data: category.items.map((item) => ({
        restaurantId,
        categoryId: createdCategory.id,
        name: item.name,
        description: item.description,
        price: item.price,
        foodType: item.foodType,
        available: true,
      })),
    });
  }
}
