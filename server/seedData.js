/** Accounts created on first run (from env, see config.js). */
export const ADMIN_SEED = (config) => [
  { name: 'Shop Admin', email: config.adminEmail, password: config.adminPassword, role: 'admin' },
  { name: 'Kitchen Crew', email: config.kitchenEmail, password: config.kitchenPassword, role: 'kitchen' },
];

// [name, category, price, emoji fallback, description, prep minutes, photo]
export const MENU_SEED = [
  ['Samosa (2 pcs)', 'snacks', 30, '🥟', 'Crisp pastry filled with spiced potato and peas, with green chutney.', 10, '/images/samosa.jpg'],
  ['Vada Pav', 'snacks', 35, '🍔', 'Spiced potato fritter in a soft pav with dry garlic chutney.', 10, '/images/vada-pav.jpg'],
  ['Masala Fries', 'snacks', 80, '🍟', 'Thick-cut fries tossed in our house masala.', 10, '/images/fries.jpg'],
  ['Chicken Tikka Wrap', 'snacks', 140, '🌯', 'Tandoori chicken, onions and mint mayo rolled in a soft flatbread.', 15, '/images/wrap.jpg'],
  ['Crispy Chicken Strips', 'snacks', 150, '🍗', 'Six golden strips with a garlic dip.', 12, '/images/chicken-strips.jpg'],
  ['Veg Burger', 'food', 110, '🍔', 'Herbed veg patty, lettuce, tomato and house sauce.', 15, '/images/veg-burger.jpg'],
  ['Crispy Chicken Burger', 'food', 150, '🍔', 'Fried chicken fillet, slaw and peri-peri mayo.', 15, '/images/chicken-burger.jpg'],
  ['Veg Fried Rice', 'food', 130, '🍚', 'Wok-tossed rice with carrots, beans and spring onion.', 20, '/images/fried-rice.jpg'],
  ['Hakka Noodles', 'food', 130, '🍜', 'Indo-Chinese noodles with cabbage, peppers and soy.', 20, '/images/noodles.jpg'],
  ['Margherita Pizza (7")', 'food', 180, '🍕', 'Tomato, mozzarella and basil on a thin crust.', 25, '/images/pizza.jpg'],
  ['Masala Chai', 'drinks', 20, '☕', 'Milky tea brewed with ginger and cardamom.', 5, '/images/chai.jpg'],
  ['Cold Coffee', 'drinks', 90, '🧋', 'Strong coffee shaken with milk over ice.', 5, '/images/cold-coffee.jpg'],
  ['Fresh Lime Soda', 'drinks', 50, '🍋', 'Sweet, salted or mixed. Made to order.', 5, '/images/lime-soda.jpg'],
  ['Mango Lassi', 'drinks', 70, '🥭', 'Thick yoghurt blended with Alphonso mango.', 5, '/images/mango-lassi.jpg'],
  ['Chocolate Shake', 'drinks', 110, '🥤', 'Chocolate ice cream blended with cold milk.', 8, '/images/choc-shake.jpg'],
];
