#!/usr/bin/env tsx
/**
 * Seeds 25 recipes into MongoDB and matching rows into MySQL recipe_catalog.
 * Run: npx tsx scripts/seed-recipes.ts
 */
import { MongoClient, type Filter, type Document } from 'mongodb';
import type { RowDataPacket } from 'mysql2';
import pool from '../lib/mysql';

const uri    = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB  ?? 'nutrition_tracker';

const RECIPES = [
  {
    _id: '11111111-aaaa-4000-8000-000000000001',
    recipe_name: 'Paneer Quinoa Bowl',
    description: 'High-protein vegetarian bowl with quinoa and paneer.',
    cuisine: 'Indian',
    meal_type: 'dinner',
    dietary_tags: ['vegetarian', 'high-protein', 'gluten-free'],
    allergens: ['milk'],
    ingredients: [
      { name: 'Quinoa', quantity: 80, unit: 'g' },
      { name: 'Paneer', quantity: 100, unit: 'g' },
      { name: 'Tomato', quantity: 100, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Cook the quinoa in 2x water.' },
      { step: 2, text: 'Pan-fry paneer cubes until golden.' },
      { step: 3, text: 'Combine with diced tomato and serve.' },
    ],
    nutrition_per_serving: { calories: 420, protein_g: 25, carbs_g: 45, fat_g: 15, fiber_g: 7, sodium_mg: 380 },
    preparation: { prep_minutes: 10, cook_minutes: 20 },
    equipment: ['pan', 'pot'],
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000002',
    recipe_name: 'Masala Oats',
    description: 'Savory oats with Indian spices for a quick, fiber-rich breakfast.',
    cuisine: 'Indian',
    meal_type: 'breakfast',
    dietary_tags: ['vegetarian', 'high-fiber'],
    allergens: ['gluten'],
    ingredients: [
      { name: 'Rolled oats', quantity: 60, unit: 'g' },
      { name: 'Onion', quantity: 50, unit: 'g' },
      { name: 'Green chili', quantity: 5, unit: 'g' },
      { name: 'Cumin seeds', quantity: 2, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Sauté onion and chili in oil.' },
      { step: 2, text: 'Add oats and water, cook 5 min.' },
      { step: 3, text: 'Season with salt and cumin.' },
    ],
    nutrition_per_serving: { calories: 220, protein_g: 8, carbs_g: 38, fat_g: 5, fiber_g: 5, sodium_mg: 290 },
    preparation: { prep_minutes: 5, cook_minutes: 10 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000003',
    recipe_name: 'Vegan Chana Masala',
    description: 'Hearty chickpea curry, fully plant-based.',
    cuisine: 'Indian',
    meal_type: 'lunch',
    dietary_tags: ['vegan', 'high-protein', 'gluten-free'],
    allergens: [],
    ingredients: [
      { name: 'Chickpeas (boiled)', quantity: 200, unit: 'g' },
      { name: 'Tomato puree', quantity: 100, unit: 'ml' },
      { name: 'Onion', quantity: 80, unit: 'g' },
      { name: 'Spice blend', quantity: 10, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Sauté onion until golden.' },
      { step: 2, text: 'Add puree and cook 5 min.' },
      { step: 3, text: 'Add chickpeas and simmer 15 min.' },
    ],
    nutrition_per_serving: { calories: 310, protein_g: 15, carbs_g: 48, fat_g: 6, fiber_g: 12, sodium_mg: 420 },
    preparation: { prep_minutes: 10, cook_minutes: 25 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000004',
    recipe_name: 'Egg Bhurji',
    description: 'Spiced scrambled eggs, Indian style — eggetarian classic.',
    cuisine: 'Indian',
    meal_type: 'breakfast',
    dietary_tags: ['eggetarian', 'high-protein'],
    allergens: ['egg'],
    ingredients: [
      { name: 'Eggs', quantity: 3, unit: 'whole' },
      { name: 'Onion', quantity: 60, unit: 'g' },
      { name: 'Tomato', quantity: 60, unit: 'g' },
      { name: 'Green pepper', quantity: 30, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Sauté onion, tomato, pepper.' },
      { step: 2, text: 'Beat eggs and pour in; scramble.' },
      { step: 3, text: 'Season and serve with toast.' },
    ],
    nutrition_per_serving: { calories: 265, protein_g: 18, carbs_g: 10, fat_g: 17, fiber_g: 2, sodium_mg: 310 },
    preparation: { prep_minutes: 5, cook_minutes: 10 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000005',
    recipe_name: 'Grilled Salmon with Asparagus',
    description: 'Omega-3-rich grilled salmon with lemon-garlic asparagus.',
    cuisine: 'Mediterranean',
    meal_type: 'dinner',
    dietary_tags: ['pescatarian', 'gluten-free', 'high-protein'],
    allergens: ['fish'],
    ingredients: [
      { name: 'Salmon fillet', quantity: 180, unit: 'g' },
      { name: 'Asparagus', quantity: 150, unit: 'g' },
      { name: 'Lemon', quantity: 30, unit: 'g' },
      { name: 'Garlic', quantity: 5, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Marinate salmon with lemon and garlic.' },
      { step: 2, text: 'Grill 4 min per side.' },
      { step: 3, text: 'Blanch asparagus; serve alongside.' },
    ],
    nutrition_per_serving: { calories: 380, protein_g: 42, carbs_g: 8, fat_g: 18, fiber_g: 4, sodium_mg: 350 },
    preparation: { prep_minutes: 10, cook_minutes: 15 },
    regional_tags: ['Mediterranean diet'],
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000006',
    recipe_name: 'Chicken Tikka',
    description: 'Marinated chicken chunks grilled in a tandoor-style.',
    cuisine: 'Indian',
    meal_type: 'dinner',
    dietary_tags: ['non_vegetarian', 'high-protein', 'gluten-free'],
    allergens: ['milk'],
    ingredients: [
      { name: 'Chicken breast', quantity: 200, unit: 'g' },
      { name: 'Yogurt', quantity: 60, unit: 'g' },
      { name: 'Tikka masala', quantity: 15, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Marinate chicken in yogurt + spices for 1 hr.' },
      { step: 2, text: 'Grill at 220°C for 20 min, turning halfway.' },
      { step: 3, text: 'Serve with mint chutney.' },
    ],
    nutrition_per_serving: { calories: 300, protein_g: 38, carbs_g: 5, fat_g: 13, fiber_g: 1, sodium_mg: 480 },
    preparation: { prep_minutes: 70, cook_minutes: 20 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000007',
    recipe_name: 'Greek Salad',
    description: 'Classic Mediterranean salad with olives, feta and cucumber.',
    cuisine: 'Mediterranean',
    meal_type: 'lunch',
    dietary_tags: ['vegetarian', 'gluten-free', 'low-calorie'],
    allergens: ['milk'],
    ingredients: [
      { name: 'Cucumber', quantity: 100, unit: 'g' },
      { name: 'Tomato', quantity: 100, unit: 'g' },
      { name: 'Feta cheese', quantity: 50, unit: 'g' },
      { name: 'Kalamata olives', quantity: 30, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Chop cucumber and tomato.' },
      { step: 2, text: 'Combine with olives and feta.' },
      { step: 3, text: 'Dress with olive oil and oregano.' },
    ],
    nutrition_per_serving: { calories: 190, protein_g: 7, carbs_g: 10, fat_g: 14, fiber_g: 3, sodium_mg: 560 },
    preparation: { prep_minutes: 10, cook_minutes: 0 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000008',
    recipe_name: 'Dal Tadka',
    description: 'Yellow lentils with a spiced ghee tempering.',
    cuisine: 'Indian',
    meal_type: 'lunch',
    dietary_tags: ['vegetarian', 'high-protein', 'gluten-free'],
    allergens: ['milk'],
    ingredients: [
      { name: 'Yellow lentils (moong dal)', quantity: 100, unit: 'g' },
      { name: 'Ghee', quantity: 10, unit: 'g' },
      { name: 'Cumin', quantity: 2, unit: 'g' },
      { name: 'Garlic', quantity: 5, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Boil lentils until soft.' },
      { step: 2, text: 'Heat ghee; add cumin and garlic until fragrant.' },
      { step: 3, text: 'Pour tadka over dal and serve.' },
    ],
    nutrition_per_serving: { calories: 280, protein_g: 16, carbs_g: 42, fat_g: 6, fiber_g: 10, sodium_mg: 320 },
    preparation: { prep_minutes: 5, cook_minutes: 25 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000009',
    recipe_name: 'Overnight Oats with Berries',
    description: 'No-cook breakfast; soak oats overnight, top with mixed berries.',
    cuisine: 'Western',
    meal_type: 'breakfast',
    dietary_tags: ['vegetarian', 'high-fiber', 'low-calorie'],
    allergens: ['gluten', 'milk'],
    ingredients: [
      { name: 'Rolled oats', quantity: 60, unit: 'g' },
      { name: 'Greek yogurt', quantity: 100, unit: 'g' },
      { name: 'Mixed berries', quantity: 80, unit: 'g' },
      { name: 'Chia seeds', quantity: 10, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Combine oats, yogurt, and chia in a jar.' },
      { step: 2, text: 'Refrigerate overnight.' },
      { step: 3, text: 'Top with berries and serve cold.' },
    ],
    nutrition_per_serving: { calories: 310, protein_g: 15, carbs_g: 45, fat_g: 8, fiber_g: 9, sodium_mg: 80 },
    preparation: { prep_minutes: 5, cook_minutes: 0 },
    serving_notes: 'Best served within 24 h of preparation.',
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000010',
    recipe_name: 'Tofu Stir-Fry',
    description: 'Crispy tofu with seasonal vegetables in a soy-ginger sauce.',
    cuisine: 'Asian',
    meal_type: 'dinner',
    dietary_tags: ['vegan', 'high-protein'],
    allergens: ['soy'],
    ingredients: [
      { name: 'Firm tofu', quantity: 200, unit: 'g' },
      { name: 'Broccoli', quantity: 100, unit: 'g' },
      { name: 'Bell pepper', quantity: 80, unit: 'g' },
      { name: 'Soy sauce', quantity: 20, unit: 'ml' },
      { name: 'Ginger', quantity: 5, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Press and cube tofu; pan-fry until crispy.' },
      { step: 2, text: 'Stir-fry vegetables 3 min.' },
      { step: 3, text: 'Add tofu and soy-ginger sauce; toss.' },
    ],
    nutrition_per_serving: { calories: 290, protein_g: 20, carbs_g: 20, fat_g: 14, fiber_g: 5, sodium_mg: 650 },
    preparation: { prep_minutes: 15, cook_minutes: 15 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000011',
    recipe_name: 'Avocado Toast with Egg',
    description: 'Whole-grain toast topped with smashed avocado and a poached egg.',
    cuisine: 'Western',
    meal_type: 'breakfast',
    dietary_tags: ['eggetarian', 'high-fiber'],
    allergens: ['egg', 'gluten'],
    ingredients: [
      { name: 'Whole-grain bread', quantity: 60, unit: 'g' },
      { name: 'Avocado', quantity: 100, unit: 'g' },
      { name: 'Egg', quantity: 1, unit: 'whole' },
      { name: 'Lemon juice', quantity: 5, unit: 'ml' },
    ],
    instructions: [
      { step: 1, text: 'Toast bread.' },
      { step: 2, text: 'Smash avocado with lemon; spread on toast.' },
      { step: 3, text: 'Poach egg; place on top.' },
    ],
    nutrition_per_serving: { calories: 350, protein_g: 14, carbs_g: 30, fat_g: 20, fiber_g: 7, sodium_mg: 230 },
    preparation: { prep_minutes: 5, cook_minutes: 10 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000012',
    recipe_name: 'Rajma Chawal',
    description: 'Kidney bean curry served over steamed basmati rice.',
    cuisine: 'Indian',
    meal_type: 'lunch',
    dietary_tags: ['vegan', 'high-protein', 'high-fiber'],
    allergens: [],
    ingredients: [
      { name: 'Kidney beans (boiled)', quantity: 150, unit: 'g' },
      { name: 'Basmati rice', quantity: 80, unit: 'g' },
      { name: 'Tomato', quantity: 100, unit: 'g' },
      { name: 'Onion', quantity: 70, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Cook rice.' },
      { step: 2, text: 'Make tomato-onion gravy and add beans.' },
      { step: 3, text: 'Simmer 20 min; serve over rice.' },
    ],
    nutrition_per_serving: { calories: 460, protein_g: 18, carbs_g: 82, fat_g: 5, fiber_g: 14, sodium_mg: 350 },
    preparation: { prep_minutes: 10, cook_minutes: 30 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000013',
    recipe_name: 'Tuna Salad Wrap',
    description: 'Light tuna salad with lettuce in a whole-wheat wrap.',
    cuisine: 'Western',
    meal_type: 'lunch',
    dietary_tags: ['pescatarian', 'high-protein'],
    allergens: ['fish', 'gluten'],
    ingredients: [
      { name: 'Canned tuna', quantity: 120, unit: 'g' },
      { name: 'Whole-wheat wrap', quantity: 60, unit: 'g' },
      { name: 'Lettuce', quantity: 40, unit: 'g' },
      { name: 'Greek yogurt', quantity: 30, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Mix tuna with yogurt and seasoning.' },
      { step: 2, text: 'Lay lettuce on wrap; add tuna mix.' },
      { step: 3, text: 'Roll and serve.' },
    ],
    nutrition_per_serving: { calories: 320, protein_g: 30, carbs_g: 28, fat_g: 8, fiber_g: 3, sodium_mg: 490 },
    preparation: { prep_minutes: 10, cook_minutes: 0 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000014',
    recipe_name: 'Palak Paneer',
    description: 'Creamy spinach curry with paneer — a North Indian classic.',
    cuisine: 'Indian',
    meal_type: 'dinner',
    dietary_tags: ['vegetarian', 'high-protein'],
    allergens: ['milk'],
    ingredients: [
      { name: 'Spinach', quantity: 200, unit: 'g' },
      { name: 'Paneer', quantity: 100, unit: 'g' },
      { name: 'Cream', quantity: 30, unit: 'ml' },
      { name: 'Spices', quantity: 10, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Blanch spinach; blend smooth.' },
      { step: 2, text: 'Fry paneer; set aside.' },
      { step: 3, text: 'Cook spinach puree; add paneer and cream.' },
    ],
    nutrition_per_serving: { calories: 340, protein_g: 20, carbs_g: 10, fat_g: 24, fiber_g: 4, sodium_mg: 400 },
    preparation: { prep_minutes: 15, cook_minutes: 20 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000015',
    recipe_name: 'Protein Banana Smoothie',
    description: 'Banana, peanut butter, and whey protein shake for post-workout.',
    cuisine: 'Western',
    meal_type: 'snack',
    dietary_tags: ['vegetarian', 'high-protein'],
    allergens: ['milk', 'peanut'],
    ingredients: [
      { name: 'Banana', quantity: 1, unit: 'medium' },
      { name: 'Peanut butter', quantity: 30, unit: 'g' },
      { name: 'Whey protein', quantity: 30, unit: 'g' },
      { name: 'Milk', quantity: 250, unit: 'ml' },
    ],
    instructions: [
      { step: 1, text: 'Blend all ingredients until smooth.' },
      { step: 2, text: 'Serve immediately.' },
    ],
    nutrition_per_serving: { calories: 420, protein_g: 32, carbs_g: 38, fat_g: 14, fiber_g: 3, sodium_mg: 180 },
    preparation: { prep_minutes: 5, cook_minutes: 0 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000016',
    recipe_name: 'Mixed Vegetable Upma',
    description: 'South Indian semolina breakfast with colorful vegetables.',
    cuisine: 'Indian',
    meal_type: 'breakfast',
    dietary_tags: ['vegetarian'],
    allergens: ['gluten'],
    ingredients: [
      { name: 'Semolina (rava)', quantity: 80, unit: 'g' },
      { name: 'Mixed vegetables', quantity: 100, unit: 'g' },
      { name: 'Mustard seeds', quantity: 2, unit: 'g' },
      { name: 'Curry leaves', quantity: 3, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Dry-roast semolina; set aside.' },
      { step: 2, text: 'Temper mustard seeds and curry leaves.' },
      { step: 3, text: 'Add vegetables and water; stir in semolina.' },
    ],
    nutrition_per_serving: { calories: 250, protein_g: 7, carbs_g: 45, fat_g: 5, fiber_g: 4, sodium_mg: 350 },
    preparation: { prep_minutes: 10, cook_minutes: 15 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000017',
    recipe_name: 'Pasta Arrabiata',
    description: 'Spicy tomato pasta, plant-based and quick to make.',
    cuisine: 'Italian',
    meal_type: 'dinner',
    dietary_tags: ['vegan'],
    allergens: ['gluten'],
    ingredients: [
      { name: 'Penne pasta', quantity: 100, unit: 'g' },
      { name: 'Crushed tomatoes', quantity: 150, unit: 'g' },
      { name: 'Garlic', quantity: 6, unit: 'g' },
      { name: 'Red chili flakes', quantity: 2, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Cook penne al dente.' },
      { step: 2, text: 'Sauté garlic; add tomatoes and chili.' },
      { step: 3, text: 'Toss pasta in sauce.' },
    ],
    nutrition_per_serving: { calories: 380, protein_g: 12, carbs_g: 72, fat_g: 5, fiber_g: 6, sodium_mg: 310 },
    preparation: { prep_minutes: 5, cook_minutes: 20 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000018',
    recipe_name: 'Prawn Coconut Curry',
    description: 'Kerala-style prawn curry in coconut milk.',
    cuisine: 'Indian',
    meal_type: 'dinner',
    dietary_tags: ['pescatarian', 'gluten-free'],
    allergens: ['shellfish'],
    ingredients: [
      { name: 'Prawns', quantity: 200, unit: 'g' },
      { name: 'Coconut milk', quantity: 150, unit: 'ml' },
      { name: 'Tomato', quantity: 80, unit: 'g' },
      { name: 'Spices', quantity: 10, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Marinate prawns in turmeric and salt.' },
      { step: 2, text: 'Cook tomatoes with spices; add coconut milk.' },
      { step: 3, text: 'Add prawns; simmer 8 min.' },
    ],
    nutrition_per_serving: { calories: 350, protein_g: 28, carbs_g: 10, fat_g: 22, fiber_g: 2, sodium_mg: 530 },
    preparation: { prep_minutes: 15, cook_minutes: 20 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000019',
    recipe_name: 'Hummus & Veggie Platter',
    description: 'Creamy homemade hummus with sliced raw vegetables.',
    cuisine: 'Middle Eastern',
    meal_type: 'snack',
    dietary_tags: ['vegan', 'gluten-free', 'high-fiber'],
    allergens: ['sesame'],
    ingredients: [
      { name: 'Chickpeas (boiled)', quantity: 120, unit: 'g' },
      { name: 'Tahini', quantity: 20, unit: 'g' },
      { name: 'Lemon juice', quantity: 15, unit: 'ml' },
      { name: 'Carrot sticks', quantity: 80, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Blend chickpeas, tahini, lemon and garlic.' },
      { step: 2, text: 'Adjust seasoning; serve with veggies.' },
    ],
    nutrition_per_serving: { calories: 220, protein_g: 9, carbs_g: 26, fat_g: 10, fiber_g: 7, sodium_mg: 290 },
    preparation: { prep_minutes: 10, cook_minutes: 0 },
    substitutions: ['Replace tahini with peanut butter for nut variant'],
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000020',
    recipe_name: 'Mutton Biryani',
    description: 'Fragrant slow-cooked mutton and basmati rice layered with saffron.',
    cuisine: 'Indian',
    meal_type: 'lunch',
    dietary_tags: ['non_vegetarian'],
    allergens: ['milk'],
    ingredients: [
      { name: 'Mutton (bone-in)', quantity: 250, unit: 'g' },
      { name: 'Basmati rice', quantity: 100, unit: 'g' },
      { name: 'Yogurt', quantity: 80, unit: 'g' },
      { name: 'Onion', quantity: 80, unit: 'g' },
      { name: 'Spice blend', quantity: 15, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Marinate mutton in yogurt and spices overnight.' },
      { step: 2, text: 'Par-cook rice; layer with mutton.' },
      { step: 3, text: 'Dum-cook (slow bake) 45 min at 180°C.' },
    ],
    nutrition_per_serving: { calories: 580, protein_g: 36, carbs_g: 58, fat_g: 20, fiber_g: 3, sodium_mg: 620 },
    preparation: { prep_minutes: 480, cook_minutes: 60 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000021',
    recipe_name: 'Acai Bowl',
    description: 'Frozen acai blended thick and topped with granola and tropical fruits.',
    cuisine: 'Brazilian',
    meal_type: 'breakfast',
    dietary_tags: ['vegan', 'high-fiber'],
    allergens: ['gluten'],
    ingredients: [
      { name: 'Frozen acai puree', quantity: 100, unit: 'g' },
      { name: 'Banana', quantity: 80, unit: 'g' },
      { name: 'Granola', quantity: 40, unit: 'g' },
      { name: 'Mixed berries', quantity: 60, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Blend acai and banana with minimal liquid.' },
      { step: 2, text: 'Pour into bowl; top with granola and berries.' },
    ],
    nutrition_per_serving: { calories: 340, protein_g: 6, carbs_g: 55, fat_g: 11, fiber_g: 9, sodium_mg: 60 },
    preparation: { prep_minutes: 5, cook_minutes: 0 },
    regional_tags: ['Brazilian', 'Superfood'],
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000022',
    recipe_name: 'Korean Bibimbap (Veg)',
    description: 'Rice bowl topped with colorful vegetables, gochujang sauce, and sesame.',
    cuisine: 'Korean',
    meal_type: 'lunch',
    dietary_tags: ['vegetarian', 'gluten-free'],
    allergens: ['sesame'],
    ingredients: [
      { name: 'Cooked rice', quantity: 150, unit: 'g' },
      { name: 'Spinach', quantity: 60, unit: 'g' },
      { name: 'Carrot', quantity: 50, unit: 'g' },
      { name: 'Bean sprouts', quantity: 50, unit: 'g' },
      { name: 'Gochujang', quantity: 15, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Blanch spinach, sauté carrot and sprouts separately.' },
      { step: 2, text: 'Arrange over rice; drizzle with gochujang.' },
      { step: 3, text: 'Mix before eating.' },
    ],
    nutrition_per_serving: { calories: 360, protein_g: 9, carbs_g: 68, fat_g: 5, fiber_g: 6, sodium_mg: 480 },
    preparation: { prep_minutes: 20, cook_minutes: 15 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000023',
    recipe_name: 'Turkey & Veggie Lettuce Cups',
    description: 'Low-carb ground turkey in crisp lettuce cups.',
    cuisine: 'Asian',
    meal_type: 'lunch',
    dietary_tags: ['non_vegetarian', 'gluten-free', 'low-calorie'],
    allergens: ['soy'],
    ingredients: [
      { name: 'Ground turkey', quantity: 150, unit: 'g' },
      { name: 'Butter lettuce leaves', quantity: 60, unit: 'g' },
      { name: 'Water chestnuts', quantity: 50, unit: 'g' },
      { name: 'Hoisin sauce', quantity: 15, unit: 'ml' },
    ],
    instructions: [
      { step: 1, text: 'Cook ground turkey with garlic and ginger.' },
      { step: 2, text: 'Add water chestnuts and hoisin.' },
      { step: 3, text: 'Serve in lettuce cups.' },
    ],
    nutrition_per_serving: { calories: 240, protein_g: 28, carbs_g: 14, fat_g: 7, fiber_g: 2, sodium_mg: 420 },
    preparation: { prep_minutes: 10, cook_minutes: 15 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000024',
    recipe_name: 'Vegetable Khichdi',
    description: 'One-pot comfort meal with rice, moong dal and mixed vegetables.',
    cuisine: 'Indian',
    meal_type: 'dinner',
    dietary_tags: ['vegetarian', 'gluten-free', 'high-fiber'],
    allergens: [],
    ingredients: [
      { name: 'Rice', quantity: 60, unit: 'g' },
      { name: 'Moong dal (split)', quantity: 60, unit: 'g' },
      { name: 'Mixed vegetables', quantity: 100, unit: 'g' },
      { name: 'Ghee', quantity: 10, unit: 'g' },
      { name: 'Turmeric', quantity: 2, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Wash rice and dal together.' },
      { step: 2, text: 'Cook with vegetables, water, and turmeric in pressure cooker.' },
      { step: 3, text: 'Top with ghee and serve.' },
    ],
    nutrition_per_serving: { calories: 320, protein_g: 14, carbs_g: 55, fat_g: 6, fiber_g: 8, sodium_mg: 280 },
    preparation: { prep_minutes: 10, cook_minutes: 20 },
  },
  {
    _id: '11111111-aaaa-4000-8000-000000000025',
    recipe_name: 'Black Bean Tacos',
    description: 'Spiced black beans in corn tortillas with pico de gallo.',
    cuisine: 'Mexican',
    meal_type: 'dinner',
    dietary_tags: ['vegan', 'high-fiber', 'gluten-free'],
    allergens: [],
    ingredients: [
      { name: 'Black beans (canned)', quantity: 150, unit: 'g' },
      { name: 'Corn tortillas', quantity: 60, unit: 'g' },
      { name: 'Tomato', quantity: 60, unit: 'g' },
      { name: 'Onion', quantity: 30, unit: 'g' },
      { name: 'Cilantro', quantity: 10, unit: 'g' },
    ],
    instructions: [
      { step: 1, text: 'Season and heat beans.' },
      { step: 2, text: 'Dice tomato, onion, and cilantro for pico.' },
      { step: 3, text: 'Fill tortillas with beans and pico.' },
    ],
    nutrition_per_serving: { calories: 300, protein_g: 13, carbs_g: 52, fat_g: 4, fiber_g: 12, sodium_mg: 390 },
    preparation: { prep_minutes: 10, cook_minutes: 10 },
    substitutions: ['Add avocado slices for healthy fats'],
  },
];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('recipes');

  console.log(`Seeding ${RECIPES.length} recipes into MongoDB and MySQL…`);

  try {
    for (const recipe of RECIPES) {
      // Check existing states in both databases to avoid silently reactivating archived recipes
      const existingMongo = await col.findOne({ _id: recipe._id } as unknown as Filter<Document>);
      const [existingMysql] = await pool.execute<RowDataPacket[]>(
        'SELECT is_active FROM recipe_catalog WHERE recipe_id = ?',
        [recipe._id]
      );

      // If already marked archived in Mongo or inactive in MySQL, preserve archived/inactive state
      const isArchived = Boolean(existingMongo?.archived) || (existingMysql.length > 0 && !Boolean(existingMysql[0].is_active));
      const isActive = !isArchived;

      const docToStore = {
        ...recipe,
        archived: isArchived,
      };

      await col.replaceOne({ _id: recipe._id } as unknown as Filter<Document>, docToStore as unknown as Document, { upsert: true });
      console.log(`  ✓ Mongo: ${recipe.recipe_name} (${isArchived ? 'archived' : 'active'})`);

      await pool.execute(
        `INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           recipe_name = VALUES(recipe_name),
           cuisine = VALUES(cuisine),
           is_active = VALUES(is_active)`,
        [recipe._id, recipe.recipe_name, recipe.cuisine ?? null, isActive]
      );
      console.log(`  ✓ MySQL: ${recipe.recipe_name} (${isActive ? 'active' : 'inactive'})`);
    }

    console.log(`\n✅ Seeded ${RECIPES.length} recipes into both DBs synchronously.`);
  } finally {
    await client.close();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
