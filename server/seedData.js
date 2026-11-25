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

/** Dishes that leave "food" for the burgers, sandwiches & pizza section. */
export const MOVE_TO_BURGERS = ['Veg Burger', 'Crispy Chicken Burger', 'Margherita Pizza (7")'];

// Added in the second menu update: what the shop is known for.
export const MENU_SEED_V2 = [
  ['Egg Puff', 'snacks', 25, '🥐', 'Flaky bakery puff with a boiled egg in spiced onion masala.', 8, '/images/egg-puff.jpg'],
  ['Veg Puff', 'snacks', 20, '🥐', 'Flaky puff filled with spiced potato and peas.', 8, ''],
  ['Chicken Puff', 'snacks', 35, '🥐', 'Flaky puff with minced chicken masala.', 8, ''],
  ['Veg Grilled Sandwich', 'burgers', 90, '🥪', 'Tomato, cucumber, onion and mint chutney, grilled until crisp.', 10, '/images/veg-sandwich.jpg'],
  ['Corn Cheese Sandwich', 'burgers', 100, '🥪', 'Sweet corn and melted cheese, grilled, with a chilli flake kick.', 10, '/images/corn-sandwich.jpg'],
  ['Chicken Club Sandwich', 'burgers', 140, '🥪', 'Triple-decker with chicken, egg, lettuce and mayo.', 12, ''],
  ['Paneer Tikka Pizza (7")', 'burgers', 220, '🍕', 'Tandoori paneer, onion and capsicum on a thin crust.', 25, ''],
  ['Chicken Dum Biryani', 'biryani', 220, '🍛', 'Basmati and marinated chicken slow-cooked under a sealed lid. With raita and salan.', 20, '/images/chicken-biryani.jpg'],
  ['Mutton Dum Biryani', 'biryani', 320, '🍛', 'Tender mutton, saffron rice and fried onions. With raita and salan.', 25, '/images/biryani-plate.jpg'],
  ['Egg Biryani', 'biryani', 170, '🍛', 'Masala-coated boiled eggs layered with spiced basmati.', 20, ''],
  ['Veg Biryani', 'biryani', 160, '🍛', 'Basmati with seasonal vegetables, mint and whole spices.', 20, '/images/veg-biryani.jpg'],
  ['Veg Thali', 'homemade', 150, '🍱', 'Two rotis, sabzi, dal, rice and a sweet. Changes daily, cooked like at home.', 15, '/images/home-thali.jpg'],
  ['South Indian Meals', 'homemade', 170, '🍱', 'Rice with sambar, rasam, two poriyals, curd and pickle.', 15, '/images/meals-thali.jpg'],
  ['Paneer Butter Masala + Rice', 'homemade', 190, '🍛', 'Paneer in a mild tomato-butter gravy with jeera rice.', 15, '/images/paneer-masala.jpg'],
  ['Home-style Chicken Curry + Rice', 'homemade', 210, '🍛', 'Bone-in chicken in an onion-tomato gravy, the way it is made at home. With steamed rice.', 15, '/images/chicken-curry.jpg'],
  ['Dal Rice', 'homemade', 110, '🍚', 'Yellow dal tadka with steamed rice and pickle.', 10, ''],
];

// [name, price, description, photo, [[item name, qty], ...]]
export const COMBO_SEED_V2 = [
  ['Biryani + Lime Soda', 249, 'Chicken dum biryani and a fresh lime soda.', '/images/chicken-biryani.jpg', [['Chicken Dum Biryani', 1], ['Fresh Lime Soda', 1]]],
  ['Puff + Chai', 40, 'An egg puff and a hot masala chai.', '/images/egg-puff.jpg', [['Egg Puff', 1], ['Masala Chai', 1]]],
];
