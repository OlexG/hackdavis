import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { GridFSBucket, MongoClient } from "mongodb";
import { Readable } from "node:stream";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

if (!dbName) {
  throw new Error("Missing MONGODB_DB in .env.local");
}

const now = new Date();
const shopImagesBucket = "shop_images";
const imageUserAgent = "davishacks-seed/1.0 (local development seed script)";
const testUser = {
  username: "testfarmer",
  email: "test@gmail.com",
  password: "test1234",
  displayName: "Test Farmer",
};

function unsplashImage(photoId, label) {
  return {
    key: `unsplash-${photoId}`,
    fileName: `${label}-${photoId}.jpg`,
    downloadUrl: `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=800&q=80`,
    sourcePage: `https://unsplash.com/photos/${photoId}`,
  };
}

const imageSources = {
  tomatoes: unsplashImage("1592924357228-91a4daadcfea", "tomatoes"),
  strawberries: unsplashImage("1464965911861-746a04b4bca6", "strawberries"),
  lettuce: unsplashImage("1622206151226-18ca2c9ab4a1", "lettuce"),
  cilantro: unsplashImage("1601493700631-2b16ec4b4716", "herbs"),
  eggs: unsplashImage("1582722872445-44dc5f7e3c8f", "eggs"),
  mushrooms: unsplashImage("1504545102780-26774c1bb073", "mushrooms"),
  jam: unsplashImage("1590080875852-ba44f83ff2db", "jam"),
  flowers: unsplashImage("1561181286-d3fee7d55364", "flowers"),
  vegetables: unsplashImage("1542838132-92c53300491e", "vegetables"),
  marketMushrooms: unsplashImage("1504545102780-26774c1bb073", "market-mushrooms"),
};

const catalogItems = [
  {
    slug: "tomatoes",
    type: "crop",
    name: "Tomatoes",
    defaultSize: { width: 1, depth: 1, height: 1 },
    render: {
      model: "plant",
      color: "#4CAF50",
      label: "Tomatoes",
    },
    growthStages: [
      {
        name: "seedling",
        minAgeDays: 0,
        maxAgeDays: 14,
        render: {
          model: "sprout",
          color: "#7CB342",
          label: "Tomato Seedlings",
          heightMultiplier: 0.25,
        },
      },
      {
        name: "growing",
        minAgeDays: 15,
        maxAgeDays: 45,
        render: {
          model: "plant",
          color: "#4CAF50",
          label: "Growing Tomatoes",
          heightMultiplier: 0.7,
        },
      },
      {
        name: "fruiting",
        minAgeDays: 46,
        maxAgeDays: 90,
        render: {
          model: "tomato_plant_fruiting",
          color: "#388E3C",
          fruitColor: "#E53935",
          label: "Fruiting Tomatoes",
          heightMultiplier: 1,
        },
      },
    ],
  },
  {
    slug: "lettuce",
    type: "crop",
    name: "Lettuce",
    defaultSize: { width: 0.75, depth: 0.75, height: 0.4 },
    render: {
      model: "leafy_plant",
      color: "#66BB6A",
      label: "Lettuce",
    },
    growthStages: [
      {
        name: "sprout",
        minAgeDays: 0,
        maxAgeDays: 10,
        render: {
          model: "sprout",
          color: "#81C784",
          label: "Lettuce Sprouts",
          heightMultiplier: 0.25,
        },
      },
      {
        name: "harvest_ready",
        minAgeDays: 11,
        maxAgeDays: 55,
        render: {
          model: "leafy_plant",
          color: "#43A047",
          label: "Harvest Ready Lettuce",
          heightMultiplier: 1,
        },
      },
    ],
  },
  {
    slug: "chickens",
    type: "livestock",
    name: "Chickens",
    defaultSize: { width: 3, depth: 3, height: 1 },
    render: {
      model: "coop",
      color: "#F4C542",
      label: "Chicken Coop",
    },
    lifeStages: [
      {
        name: "chick",
        minAgeDays: 0,
        maxAgeDays: 42,
        render: {
          model: "chick",
          color: "#F4C542",
          label: "Chicks",
          scale: 0.4,
        },
      },
      {
        name: "adult",
        minAgeDays: 43,
        maxAgeDays: null,
        render: {
          model: "chicken",
          color: "#F4C542",
          label: "Adult Chickens",
          scale: 1,
        },
      },
    ],
    dailyBehavior: [
      {
        from: "06:00",
        to: "18:00",
        animation: "wandering",
        visibleIn: "yard",
      },
      {
        from: "18:00",
        to: "06:00",
        animation: "resting",
        visibleIn: "coop",
      },
    ],
  },
  {
    slug: "goats",
    type: "livestock",
    name: "Goats",
    defaultSize: { width: 4, depth: 4, height: 1.5 },
    render: {
      model: "goat_pen",
      color: "#C2A878",
      label: "Goat Pen",
    },
    lifeStages: [
      {
        name: "kid",
        minAgeDays: 0,
        maxAgeDays: 120,
        render: {
          model: "young_goat",
          color: "#D7C3A3",
          label: "Young Goats",
          scale: 0.55,
        },
      },
      {
        name: "adult",
        minAgeDays: 121,
        maxAgeDays: null,
        render: {
          model: "goat",
          color: "#C2A878",
          label: "Adult Goats",
          scale: 1,
        },
      },
    ],
    dailyBehavior: [
      {
        from: "07:00",
        to: "19:00",
        animation: "grazing",
        visibleIn: "pasture",
      },
      {
        from: "19:00",
        to: "07:00",
        animation: "resting",
        visibleIn: "shelter",
      },
    ],
  },
];

const inventoryItems = [
  {
    name: "Sun Gold tomatoes",
    category: "harvest",
    status: "ready",
    quantity: { amount: 7.5, unit: "lb" },
    location: "cool pantry crate",
    source: "south trellis",
    notes: "Sort into market pints tonight; keep blemished fruit for sauce.",
    color: "#e9783a",
    useBy: new Date("2026-05-14T07:00:00.000Z"),
    acquiredAt: new Date("2026-05-09T07:00:00.000Z"),
  },
  {
    name: "Butter lettuce heads",
    category: "harvest",
    status: "ready",
    quantity: { amount: 12, unit: "heads" },
    location: "wash station",
    source: "shade bed A",
    notes: "Hydrocool before neighborhood swap pickup.",
    color: "#65a95a",
    useBy: new Date("2026-05-11T07:00:00.000Z"),
    acquiredAt: new Date("2026-05-09T07:00:00.000Z"),
  },
  {
    name: "Glass gem corn seed",
    category: "seeds",
    status: "stocked",
    quantity: { amount: 86, unit: "seeds" },
    reorderAt: 24,
    location: "seed library drawer 02",
    source: "saved seed",
    notes: "Dry, labeled, and ready for the summer block.",
    color: "#d7b64b",
    acquiredAt: new Date("2026-04-18T07:00:00.000Z"),
  },
  {
    name: "Basil starts",
    category: "starts",
    status: "stocked",
    quantity: { amount: 18, unit: "plants" },
    reorderAt: 6,
    location: "greenhouse bench",
    source: "propagation tray 4",
    notes: "Pinch tips before moving to the herb spiral.",
    color: "#3f8b58",
    acquiredAt: new Date("2026-05-01T07:00:00.000Z"),
  },
  {
    name: "Layer feed",
    category: "feed",
    status: "low",
    quantity: { amount: 18, unit: "lb" },
    reorderAt: 20,
    location: "sealed bin by coop",
    source: "Davis co-op",
    notes: "Below reorder line; add oyster shell to next run.",
    color: "#b0834b",
    acquiredAt: new Date("2026-04-26T07:00:00.000Z"),
  },
  {
    name: "Finished compost",
    category: "amendments",
    status: "stocked",
    quantity: { amount: 5, unit: "carts" },
    reorderAt: 2,
    location: "bay three",
    source: "home cycle",
    notes: "Screened and warm; reserve two carts for pepper bed.",
    color: "#6f8f55",
    acquiredAt: new Date("2026-05-02T07:00:00.000Z"),
  },
  {
    name: "Drip repair kit",
    category: "tools",
    status: "stocked",
    quantity: { amount: 1, unit: "kit" },
    location: "tool wall cubby",
    source: "farm shed",
    notes: "Emitters, goof plugs, punch, and two couplers.",
    color: "#48b9df",
    acquiredAt: new Date("2026-03-20T07:00:00.000Z"),
  },
  {
    name: "Strawberry basil jam",
    category: "preserves",
    status: "curing",
    quantity: { amount: 9, unit: "jars" },
    location: "pantry shelf B",
    source: "spring berry flush",
    notes: "Set aside three jars for crop-swap bundles.",
    color: "#c95b76",
    useBy: new Date("2026-11-09T08:00:00.000Z"),
    acquiredAt: new Date("2026-05-07T07:00:00.000Z"),
  },
  {
    name: "Nest box herbs",
    category: "livestock",
    status: "low",
    quantity: { amount: 3, unit: "bundles" },
    reorderAt: 4,
    location: "coop shelf",
    source: "mint and lavender bed",
    notes: "Dry another batch before the weekend cleanout.",
    color: "#8a6f3f",
    acquiredAt: new Date("2026-05-05T07:00:00.000Z"),
  },
];

const neighborFarms = [
  {
    email: "riverbed@sunpatch.local",
    displayName: "Maya at Riverbed Rows",
    farmName: "Riverbed Rows",
    bio: "A shady east Davis microfarm with salad greens, herbs, and porch pickup.",
    details: {
      shopName: "Riverbed Rows Stand",
      hours: "Wed and Sat, 8 AM - 12 PM",
      pickupLocation: "East Davis porch cooler",
      pickupCoords: { lat: 38.5549, lng: -121.7121 },
      pickupInstructions: "Text before arrival; cooler is under the blue awning.",
      paymentOptions: "Venmo, cash, or herb trades",
      contact: "maya@riverbed.local",
      availabilityNote: "Tender greens and herbs are cut early on pickup mornings.",
    },
    inventory: [
      itemSeed("Little gem lettuce", "harvest", "ready", 18, "heads", "wash table", "north shade bed", "#65a95a", 450, "Crisp mini heads packed for same-day pickup.", "2026-05-12T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Cilantro bundles", "harvest", "ready", 24, "bunches", "porch cooler", "herb strip", "#4f9f52", 250, "Fragrant bunches with roots rinsed and wrapped.", "2026-05-11T07:00:00.000Z", imageSources.cilantro),
      itemSeed("Strawberry mint shrub", "preserves", "curing", 10, "bottles", "pantry crate", "spring berry bed", "#c95b76", 900, "Bright drinking vinegar for soda water or salad dressing.", "2026-08-20T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Nora Chen", 5, "Pickup was simple and the lettuce stayed crisp for days.", ["fresh", "easy pickup"]),
      reviewSeed("Omar Patel", 5, "The cilantro bundles were huge and packed clean.", ["generous", "clean"]),
      reviewSeed("Jess Rivera", 4, "Loved the shrub bottles. I wish I had bought two.", ["preserves", "small batch"]),
    ],
  },
  {
    email: "poppy@sunpatch.local",
    displayName: "Theo from Poppy Patch",
    farmName: "Poppy Patch Backyard",
    bio: "Sunny backyard beds focused on berries, tomatoes, and pollinator-friendly extras.",
    details: {
      shopName: "Poppy Patch Cart",
      hours: "Fri, 4 PM - 7 PM · Sun, 9 AM - 1 PM",
      pickupLocation: "South Davis driveway cart",
      pickupCoords: { lat: 38.5394, lng: -121.7443 },
      pickupInstructions: "Use the honor box clipped to the cart shelf.",
      paymentOptions: "Cash, Venmo, Zelle",
      contact: "theo@poppypatch.local",
      availabilityNote: "Tomatoes go fast; berry pints are posted as they ripen.",
    },
    inventory: [
      itemSeed("Early girl tomatoes", "harvest", "ready", 9, "lb", "driveway cart", "sun trellis", "#e9783a", 500, "Firm slicing tomatoes picked at first blush.", "2026-05-15T07:00:00.000Z", imageSources.tomatoes),
      itemSeed("Albion strawberries", "harvest", "ready", 16, "pints", "cooler shelf", "berry trough", "#d94d5c", 650, "Sweet pints sorted with the soft berries removed.", "2026-05-11T07:00:00.000Z", imageSources.strawberries),
      itemSeed("Pollinator posies", "harvest", "ready", 12, "bunches", "water bucket", "front border", "#d7b64b", 400, "Small edible-flower and pollinator bouquets.", "2026-05-13T07:00:00.000Z", imageSources.flowers),
    ],
    reviews: [
      reviewSeed("Ari Salazar", 5, "The strawberry pints tasted like the first real week of spring.", ["sweet", "seasonal"]),
      reviewSeed("Priya Shah", 4, "Cute stand and clear honor-box pricing.", ["cute stand", "clear prices"]),
      reviewSeed("Mina Brooks", 5, "Tomatoes were labeled by ripeness, which helped a lot.", ["organized", "tomatoes"]),
    ],
  },
  {
    email: "oaklane@sunpatch.local",
    displayName: "Sam at Oak Lane Coop",
    farmName: "Oak Lane Coop & Garden",
    bio: "A compact family farm stand with eggs, jam, mushrooms, and rotating garden harvests.",
    details: {
      shopName: "Oak Lane Farm Shelf",
      hours: "Daily after 10 AM while stocked",
      pickupLocation: "Oak Lane side gate",
      pickupCoords: { lat: 38.5668, lng: -121.7601 },
      pickupInstructions: "Shelf is inside the side gate; close the latch after pickup.",
      paymentOptions: "Cash jar, PayPal, or trade",
      contact: "sam@oaklane.local",
      availabilityNote: "Eggs and preserves are steady; mushrooms appear after cool nights.",
    },
    inventory: [
      itemSeed("Pasture eggs", "harvest", "ready", 8, "dozen", "gate shelf", "coop run", "#d7b64b", 700, "Mixed-color dozen from the backyard flock.", "2026-05-18T07:00:00.000Z", imageSources.eggs),
      itemSeed("Oyster mushrooms", "harvest", "ready", 5, "lb", "cooler tray", "oak log stack", "#b99067", 900, "Tender clusters harvested before the caps flatten.", "2026-05-12T07:00:00.000Z", imageSources.mushrooms),
      itemSeed("Apricot rosemary jam", "preserves", "curing", 14, "jars", "pantry shelf", "tree guild", "#e0a33a", 850, "Low-sugar jam with a soft rosemary finish.", "2026-11-01T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Eli Morgan", 5, "The eggs were spotless and the pickup shelf was easy to find.", ["eggs", "easy pickup"]),
      reviewSeed("Talia Nguyen", 5, "Best oyster mushrooms I have found nearby.", ["mushrooms", "fresh"]),
      reviewSeed("Rowan Lee", 4, "Jam was excellent and the labels made gifting easy.", ["preserves", "giftable"]),
    ],
  },
  {
    email: "willowbox@sunpatch.local",
    displayName: "Lena at Willow Box",
    farmName: "Willow Box Microgreens",
    bio: "A tiny hydro shelf and raised-bed setup with greens, pea shoots, and bright preserves.",
    details: {
      shopName: "Willow Box Greens",
      hours: "Tue and Thu, 5 PM - 7 PM",
      pickupLocation: "North Davis alley shelf",
      pickupCoords: { lat: 38.5709, lng: -121.7418 },
      pickupInstructions: "Orders sit in the labeled insulated tote by the side door.",
      paymentOptions: "Venmo or cash",
      contact: "lena@willowbox.local",
      availabilityNote: "Greens are cut to order when the tote list fills.",
    },
    inventory: [
      itemSeed("Pea shoot clamshells", "harvest", "ready", 20, "clamshells", "alley tote", "hydro shelf", "#66ad63", 550, "Tender pea shoots clipped the morning of pickup.", "2026-05-11T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Spicy salad mix", "harvest", "ready", 14, "bags", "cool tote", "mustard bed", "#72b85b", 600, "Peppery baby greens with edible flower petals.", "2026-05-12T07:00:00.000Z", imageSources.vegetables),
      itemSeed("Strawberry lavender jam", "preserves", "curing", 18, "jars", "pantry crate", "berry rail", "#c95b76", 950, "Soft-set berry jam with a light lavender finish.", "2026-10-15T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Cam Huynh", 5, "The pea shoots were clean, sweet, and packed perfectly.", ["greens", "clean"]),
      reviewSeed("Drew Ellis", 4, "Great salad mix with just enough spice.", ["salad", "peppery"]),
      reviewSeed("Lara Kim", 5, "Jam tasted homemade in the best way.", ["jam", "giftable"]),
    ],
  },
  {
    email: "figyard@sunpatch.local",
    displayName: "Amir from Fig Yard",
    farmName: "Fig Yard Garden",
    bio: "A warm courtyard garden with tomatoes, herbs, edible flowers, and weekend bundles.",
    details: {
      shopName: "Fig Yard Weekend Box",
      hours: "Sat, 10 AM - 2 PM",
      pickupLocation: "Central Davis courtyard gate",
      pickupCoords: { lat: 38.5457, lng: -121.7391 },
      pickupInstructions: "Ring the brass bell if the courtyard gate is closed.",
      paymentOptions: "Cash, Zelle, or garden trade",
      contact: "amir@figyard.local",
      availabilityNote: "Weekend boxes mix ripe produce with a few garden surprises.",
    },
    inventory: [
      itemSeed("Cherry tomato cups", "harvest", "ready", 22, "cups", "courtyard table", "arch trellis", "#e9783a", 450, "Mixed cherry tomatoes sorted by color.", "2026-05-14T07:00:00.000Z", imageSources.tomatoes),
      itemSeed("Basil bouquets", "harvest", "ready", 16, "bunches", "water jar", "herb border", "#3f8b58", 350, "Long-stem basil bundles for pesto or porch bouquets.", "2026-05-12T07:00:00.000Z", imageSources.cilantro),
      itemSeed("Edible flower cups", "harvest", "ready", 10, "cups", "shade tray", "flower edge", "#d7b64b", 500, "Calendula, viola, and borage flowers for salads.", "2026-05-11T07:00:00.000Z", imageSources.flowers),
    ],
    reviews: [
      reviewSeed("Maya Ortiz", 5, "The tomato cups were gorgeous and sorted with care.", ["tomatoes", "colorful"]),
      reviewSeed("Ben Tran", 5, "Basil bundles made enough pesto for the freezer.", ["herbs", "generous"]),
      reviewSeed("Sofia Park", 4, "Flower cups made dinner look fancy.", ["flowers", "fun"]),
    ],
  },
  {
    email: "compostcorner@sunpatch.local",
    displayName: "June at Compost Corner",
    farmName: "Compost Corner",
    bio: "A practical neighborhood plot with mushrooms, hardy greens, and preserved pantry goods.",
    details: {
      shopName: "Compost Corner Shelf",
      hours: "Mon, Wed, Fri after 3 PM",
      pickupLocation: "West Davis shed shelf",
      pickupCoords: { lat: 38.5525, lng: -121.7733 },
      pickupInstructions: "Look for the cedar shelf beside the rain barrel.",
      paymentOptions: "Cash jar, PayPal, or compost swap",
      contact: "june@compostcorner.local",
      availabilityNote: "Mushrooms and greens are stocked in small cool-weather batches.",
    },
    inventory: [
      itemSeed("Blue oyster clusters", "harvest", "ready", 6, "lb", "shed cooler", "straw blocks", "#b99067", 950, "Dense clusters harvested while caps are still curled.", "2026-05-12T07:00:00.000Z", imageSources.marketMushrooms),
      itemSeed("Romaine bundles", "harvest", "ready", 11, "heads", "wash bin", "compost bed", "#65a95a", 425, "Tall romaine heads grown in finished compost.", "2026-05-13T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Tomato leaf sauce", "preserves", "curing", 12, "jars", "pantry shelf", "summer sauce batch", "#e9783a", 875, "Savory sauce from frozen summer tomatoes and herbs.", "2026-09-30T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Inez Ford", 5, "The mushrooms cooked down beautifully.", ["mushrooms", "high quality"]),
      reviewSeed("Mark Yu", 4, "Romaine was crisp and the pickup shelf was obvious.", ["greens", "pickup"]),
      reviewSeed("Harper Reed", 5, "The sauce jar saved a weeknight dinner.", ["preserves", "practical"]),
    ],
  },
  {
    email: "sunsetrows@sunpatch.local",
    displayName: "Nico at Sunset Rows",
    farmName: "Sunset Rows",
    bio: "A west-facing garden with warm tomatoes, berry boxes, and little porch bundles.",
    details: {
      shopName: "Sunset Rows Porch",
      hours: "Thu and Sun, 4 PM - 7 PM",
      pickupLocation: "West Davis porch rail",
      pickupCoords: { lat: 38.5487, lng: -121.7856 },
      pickupInstructions: "Porch rail boxes are labeled by first name.",
      paymentOptions: "Venmo, cash, or tomato trades",
      contact: "nico@sunsetrows.local",
      availabilityNote: "Evening harvests are posted after the beds cool down.",
    },
    inventory: [
      itemSeed("Sunset tomato quarts", "harvest", "ready", 18, "quarts", "porch rail", "west trellis", "#e9783a", 650, "Mixed slicers and cherries packed just before sunset.", "2026-05-15T07:00:00.000Z", imageSources.tomatoes),
      itemSeed("Berry breakfast boxes", "harvest", "ready", 12, "boxes", "cooler bench", "berry run", "#d94d5c", 750, "Small strawberry boxes with mint tucked on top.", "2026-05-11T07:00:00.000Z", imageSources.strawberries),
      itemSeed("Basil tomato jam", "preserves", "curing", 15, "jars", "pantry crate", "late summer batch", "#e0a33a", 875, "Sweet tomato jam with basil and a little lemon.", "2026-10-10T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Tess Walker", 5, "The evening pickup timing worked perfectly after work.", ["evening pickup", "tomatoes"]),
      reviewSeed("Owen Li", 4, "Berry boxes were small but really sweet.", ["berries", "sweet"]),
      reviewSeed("Keira Stone", 5, "Tomato jam was surprisingly good on toast.", ["preserves", "unique"]),
    ],
  },
  {
    email: "meadowmilk@sunpatch.local",
    displayName: "Priya at Meadow Milk & Greens",
    farmName: "Meadow Milk & Greens",
    bio: "A family yard with pasture eggs, herbs, and small-batch greens near the greenbelt.",
    details: {
      shopName: "Meadow Milk & Greens",
      hours: "Mon and Sat, 9 AM - 11 AM",
      pickupLocation: "Greenbelt gate cooler",
      pickupCoords: { lat: 38.5612, lng: -121.7312 },
      pickupInstructions: "Cooler is chained to the inside fence post.",
      paymentOptions: "Cash, Zelle, or herb swap",
      contact: "priya@meadowmilk.local",
      availabilityNote: "Eggs restock most mornings; herbs depend on heat.",
    },
    inventory: [
      itemSeed("Greenbelt eggs", "harvest", "ready", 10, "dozen", "gate cooler", "small flock", "#d7b64b", 725, "Mixed shell colors from the backyard layers.", "2026-05-18T07:00:00.000Z", imageSources.eggs),
      itemSeed("Dill and parsley bunches", "harvest", "ready", 18, "bunches", "water crock", "kitchen bed", "#4f9f52", 300, "Soft herb bunches wrapped for fridge storage.", "2026-05-12T07:00:00.000Z", imageSources.cilantro),
      itemSeed("Butterhead lettuce", "harvest", "ready", 9, "heads", "wash basket", "shade row", "#65a95a", 400, "Loose butterhead lettuce rinsed and spun dry.", "2026-05-12T07:00:00.000Z", imageSources.lettuce),
    ],
    reviews: [
      reviewSeed("Jules Park", 5, "Egg colors were beautiful and the cooler was easy to spot.", ["eggs", "easy pickup"]),
      reviewSeed("Morgan Shah", 5, "Herbs lasted all week in the fridge.", ["herbs", "fresh"]),
      reviewSeed("Ana Moore", 4, "Lettuce was tender and clean.", ["greens", "clean"]),
    ],
  },
  {
    email: "clovercart@sunpatch.local",
    displayName: "Rafi at Clover Cart",
    farmName: "Clover Cart",
    bio: "A curbside cart with flower cups, salad bags, and whatever the clover beds produce.",
    details: {
      shopName: "Clover Cart",
      hours: "Wed, 3 PM - 6 PM · Sat, 8 AM - 10 AM",
      pickupLocation: "Clover Court curb cart",
      pickupCoords: { lat: 38.5358, lng: -121.7319 },
      pickupInstructions: "Cart is rolled out by the mailbox during open hours.",
      paymentOptions: "Cash box or Cash App",
      contact: "rafi@clovercart.local",
      availabilityNote: "Cart quantities are small and rotate every open day.",
    },
    inventory: [
      itemSeed("Clover salad bags", "harvest", "ready", 15, "bags", "curb cart", "clover beds", "#72b85b", 550, "Tender salad bags with pea shoots and baby greens.", "2026-05-12T07:00:00.000Z", imageSources.vegetables),
      itemSeed("Tiny flower cups", "harvest", "ready", 12, "cups", "shade tray", "flower strip", "#d7b64b", 450, "Edible flower cups for cakes, salads, and drinks.", "2026-05-11T07:00:00.000Z", imageSources.flowers),
      itemSeed("Strawberry spoon jam", "preserves", "curing", 16, "jars", "pantry box", "berry corner", "#c95b76", 900, "Loose spoon jam for yogurt and biscuits.", "2026-10-01T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Milo Grant", 5, "The cart setup is adorable and fast.", ["cute stand", "quick"]),
      reviewSeed("Nadia Fox", 4, "Flower cups made cupcakes look professional.", ["flowers", "fun"]),
      reviewSeed("Samir Cole", 5, "Salad bags had great texture.", ["salad", "fresh"]),
    ],
  },
  {
    email: "pondside@sunpatch.local",
    displayName: "Iris at Pondside Produce",
    farmName: "Pondside Produce",
    bio: "A damp little garden with mushrooms, herbs, and cool-weather greens.",
    details: {
      shopName: "Pondside Produce Shelf",
      hours: "Tue, Fri, and Sun after 1 PM",
      pickupLocation: "Pondside shed window",
      pickupCoords: { lat: 38.5755, lng: -121.7538 },
      pickupInstructions: "Use the sliding shed window; bags are on the blue tray.",
      paymentOptions: "PayPal, cash, or compost trade",
      contact: "iris@pondside.local",
      availabilityNote: "Mushrooms flush after cooler nights and sell out quickly.",
    },
    inventory: [
      itemSeed("Mixed oyster mushrooms", "harvest", "ready", 7, "lb", "shed window", "mushroom rack", "#b99067", 1000, "Mixed oyster mushrooms packed in paper bags.", "2026-05-12T07:00:00.000Z", imageSources.mushrooms),
      itemSeed("Pondside romaine", "harvest", "ready", 13, "heads", "blue tray", "cool bed", "#65a95a", 425, "Crunchy romaine from the damp garden edge.", "2026-05-13T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Herb salt jars", "preserves", "curing", 20, "jars", "dry shelf", "herb rack", "#8a6f3f", 600, "Garden herb salt for eggs and roasted vegetables.", "2026-12-01T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Dani Ruiz", 5, "Mushrooms were meaty and super fresh.", ["mushrooms", "fresh"]),
      reviewSeed("Elena Brooks", 4, "The pickup window is quirky but clear.", ["pickup", "organized"]),
      reviewSeed("Jon Bell", 5, "Herb salt has become a kitchen staple.", ["preserves", "practical"]),
    ],
  },
  {
    email: "lavenderlane@sunpatch.local",
    displayName: "Mina at Lavender Lane",
    farmName: "Lavender Lane",
    bio: "A pollinator-heavy strip garden with flowers, strawberries, and fragrant herb bundles.",
    details: {
      shopName: "Lavender Lane Table",
      hours: "Sat and Sun, 8 AM - 12 PM",
      pickupLocation: "Lavender Lane front table",
      pickupCoords: { lat: 38.5481, lng: -121.7215 },
      pickupInstructions: "Front table is shaded by the purple umbrella.",
      paymentOptions: "Cash, Venmo, or bouquet trade",
      contact: "mina@lavenderlane.local",
      availabilityNote: "Bouquets and berries are posted every weekend morning.",
    },
    inventory: [
      itemSeed("Lavender herb bundles", "harvest", "ready", 20, "bundles", "front table", "herb strip", "#8a6f3f", 375, "Fragrant bundles with lavender, mint, and rosemary.", "2026-05-18T07:00:00.000Z", imageSources.cilantro),
      itemSeed("Weekend strawberries", "harvest", "ready", 14, "pints", "ice tray", "berry row", "#d94d5c", 675, "Bright weekend strawberry pints.", "2026-05-11T07:00:00.000Z", imageSources.strawberries),
      itemSeed("Pollinator bouquets", "harvest", "ready", 16, "bunches", "water bucket", "flower lane", "#d7b64b", 550, "Small bouquets for kitchen tables and bees.", "2026-05-13T07:00:00.000Z", imageSources.flowers),
    ],
    reviews: [
      reviewSeed("Tara Lane", 5, "The bouquet lasted longer than expected.", ["flowers", "lasting"]),
      reviewSeed("Noah Stein", 5, "Strawberries were sweet and carefully packed.", ["berries", "sweet"]),
      reviewSeed("Rina Patel", 4, "Herb bundles smelled amazing.", ["herbs", "fragrant"]),
    ],
  },
  {
    email: "railtrail@sunpatch.local",
    displayName: "Eli at Rail Trail Farm",
    farmName: "Rail Trail Farm",
    bio: "A narrow rail-trail plot with dependable greens, tomato cups, and pantry jars.",
    details: {
      shopName: "Rail Trail Farm Box",
      hours: "Every day, 7 AM - 9 AM",
      pickupLocation: "Rail trail lockbox",
      pickupCoords: { lat: 38.5422, lng: -121.7587 },
      pickupInstructions: "Lockbox code is posted after reservation; cold items are below.",
      paymentOptions: "Zelle, card, or cash",
      contact: "eli@railtrail.local",
      availabilityNote: "Morning boxes are packed before the trail gets busy.",
    },
    inventory: [
      itemSeed("Trail tomato cups", "harvest", "ready", 18, "cups", "lockbox shelf", "trail trellis", "#e9783a", 450, "Snack cups of cherry tomatoes for trail walkers.", "2026-05-14T07:00:00.000Z", imageSources.tomatoes),
      itemSeed("Morning lettuce bags", "harvest", "ready", 12, "bags", "cold shelf", "rail bed", "#65a95a", 525, "Washed morning lettuce packed for same-day salads.", "2026-05-12T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Roasted tomato sauce", "preserves", "curing", 18, "jars", "pantry bin", "sauce batch", "#e9783a", 925, "Roasted tomato sauce with garlic and basil.", "2026-10-20T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Parker Wynn", 5, "Morning pickup before my walk was perfect.", ["morning", "easy pickup"]),
      reviewSeed("Leah Green", 4, "Tomato cups were a great snack size.", ["tomatoes", "snack"]),
      reviewSeed("Cal Foster", 5, "Sauce jar tasted like summer.", ["preserves", "tomatoes"]),
    ],
  },
  {
    email: "peppergate@sunpatch.local",
    displayName: "Marisol at Pepper Gate",
    farmName: "Pepper Gate Garden",
    bio: "A sunny gate-side stand with peppers, tomatoes, salsa jars, and a few herb bunches.",
    details: {
      shopName: "Pepper Gate Stand",
      hours: "Tue and Sat, 9 AM - 12 PM",
      pickupLocation: "Southwest Davis red gate",
      pickupCoords: { lat: 38.5326, lng: -121.7609 },
      pickupInstructions: "Stand is just inside the red gate; use the left basket for paid orders.",
      paymentOptions: "Venmo, cash, or pepper starts",
      contact: "marisol@peppergate.local",
      availabilityNote: "Pepper boxes rotate by heat level and tomatoes are packed when fully colored.",
    },
    inventory: [
      itemSeed("Sweet pepper bags", "harvest", "ready", 13, "bags", "gate stand", "pepper row", "#e9783a", 600, "Mixed sweet peppers sorted into mild snack bags.", "2026-05-16T07:00:00.000Z", imageSources.vegetables),
      itemSeed("Roma tomato pounds", "harvest", "ready", 18, "lb", "shade crate", "sauce trellis", "#e9783a", 475, "Meaty Roma tomatoes for sauce and roasting.", "2026-05-15T07:00:00.000Z", imageSources.tomatoes),
      itemSeed("Roasted salsa jars", "preserves", "curing", 20, "jars", "pantry tote", "pepper kitchen", "#c95b76", 950, "Smoky roasted salsa with mild garden heat.", "2026-10-25T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Alina Cruz", 5, "The pepper bags were labeled by heat and super easy to cook with.", ["peppers", "organized"]),
      reviewSeed("Theo Grant", 4, "Roma tomatoes were dense and perfect for sauce.", ["tomatoes", "sauce"]),
      reviewSeed("Cass Lee", 5, "Salsa jar disappeared in one dinner.", ["preserves", "flavorful"]),
    ],
  },
  {
    email: "maplebin@sunpatch.local",
    displayName: "Hannah at Maple Bin",
    farmName: "Maple Bin Farmlet",
    bio: "A quiet north-side farmlet with eggs, salad greens, and weekend flower jars.",
    details: {
      shopName: "Maple Bin Pickup",
      hours: "Mon, Thu, Sat, 8 AM - 10 AM",
      pickupLocation: "North Davis maple tree bin",
      pickupCoords: { lat: 38.5792, lng: -121.7336 },
      pickupInstructions: "Cold items are in the green bin under the maple tree.",
      paymentOptions: "Cash, Zelle, or egg carton returns",
      contact: "hannah@maplebin.local",
      availabilityNote: "Eggs are stocked most mornings; flower jars appear on weekends.",
    },
    inventory: [
      itemSeed("Maple bin eggs", "harvest", "ready", 11, "dozen", "green bin", "cedar coop", "#d7b64b", 700, "Clean mixed-color dozens packed in reused cartons.", "2026-05-18T07:00:00.000Z", imageSources.eggs),
      itemSeed("Baby kale bags", "harvest", "ready", 15, "bags", "cooler insert", "north bed", "#65a95a", 525, "Tender baby kale washed and packed loose.", "2026-05-13T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Weekend flower jars", "harvest", "ready", 8, "jars", "maple table", "front border", "#d7b64b", 650, "Small jar arrangements with edible and pollinator flowers.", "2026-05-14T07:00:00.000Z", imageSources.flowers),
    ],
    reviews: [
      reviewSeed("Grace Patel", 5, "Egg pickup was clear and the carton return note was helpful.", ["eggs", "easy pickup"]),
      reviewSeed("Leo Santos", 5, "Baby kale was tender enough for salad.", ["greens", "fresh"]),
      reviewSeed("Imani Rowe", 4, "The flower jar made a sweet desk bouquet.", ["flowers", "cute"]),
    ],
  },
  {
    email: "orchardcrate@sunpatch.local",
    displayName: "Devin at Orchard Crate",
    farmName: "Orchard Crate",
    bio: "A small fruit-tree yard with berries, herbs, mushrooms, and pantry crate specials.",
    details: {
      shopName: "Orchard Crate Shelf",
      hours: "Fri and Sun, 10 AM - 2 PM",
      pickupLocation: "Central Davis alley crate",
      pickupCoords: { lat: 38.5519, lng: -121.7468 },
      pickupInstructions: "Alley crate is labeled Orchard Crate; cold bags are in the lower cooler.",
      paymentOptions: "Cash, PayPal, or fruit swaps",
      contact: "devin@orchardcrate.local",
      availabilityNote: "Berries are limited, herbs are steady, and mushrooms depend on cool weather.",
    },
    inventory: [
      itemSeed("Orchard berry cups", "harvest", "ready", 10, "cups", "lower cooler", "berry strip", "#d94d5c", 700, "Mixed berry cups picked before the afternoon heat.", "2026-05-11T07:00:00.000Z", imageSources.strawberries),
      itemSeed("Rosemary thyme bundles", "harvest", "ready", 18, "bundles", "alley crate", "tree guild", "#8a6f3f", 300, "Woody herb bundles for roasting and bread.", "2026-05-18T07:00:00.000Z", imageSources.cilantro),
      itemSeed("Chestnut mushroom boxes", "harvest", "ready", 6, "boxes", "cool bag", "mushroom shelf", "#b99067", 1050, "Nutty chestnut mushrooms packed in small boxes.", "2026-05-12T07:00:00.000Z", imageSources.mushrooms),
    ],
    reviews: [
      reviewSeed("Nell Harper", 5, "Berry cups were small but packed with flavor.", ["berries", "sweet"]),
      reviewSeed("Micah Sun", 4, "Herb bundles were generous and very fragrant.", ["herbs", "fragrant"]),
      reviewSeed("Rae Kim", 5, "Chestnut mushrooms had great texture.", ["mushrooms", "fresh"]),
    ],
  },
  {
    email: "sageporch@sunpatch.local",
    displayName: "Luca at Sage Porch",
    farmName: "Sage Porch Garden",
    bio: "A porch-side herb garden with salad boxes, fragrant bundles, and small-batch pantry jars.",
    details: {
      shopName: "Sage Porch Shelf",
      hours: "Wed and Fri, 7 AM - 10 AM",
      pickupLocation: "East Davis sage porch",
      pickupCoords: { lat: 38.5573, lng: -121.7048 },
      pickupInstructions: "Shelf is beside the sage planter; cold bags are in the striped cooler.",
      paymentOptions: "Venmo, cash, or seed packet trade",
      contact: "luca@sageporch.local",
      availabilityNote: "Herbs are clipped early and salad boxes are packed while cool.",
    },
    inventory: [
      itemSeed("Sage herb bundles", "harvest", "ready", 22, "bundles", "porch shelf", "herb rail", "#8a6f3f", 325, "Sage, thyme, and oregano bundles tied for roasting.", "2026-05-18T07:00:00.000Z", imageSources.cilantro),
      itemSeed("Porch salad boxes", "harvest", "ready", 12, "boxes", "striped cooler", "shade trough", "#72b85b", 625, "Mixed baby greens with herbs tucked in.", "2026-05-12T07:00:00.000Z", imageSources.vegetables),
      itemSeed("Herbed tomato chutney", "preserves", "curing", 15, "jars", "pantry shelf", "summer kettle", "#e9783a", 900, "Savory tomato chutney with sage and thyme.", "2026-10-12T07:00:00.000Z", imageSources.jam),
    ],
    reviews: [
      reviewSeed("Mara Klein", 5, "The herb bundles made the whole kitchen smell good.", ["herbs", "fragrant"]),
      reviewSeed("Soren Diaz", 4, "Salad boxes were neat and very fresh.", ["salad", "fresh"]),
      reviewSeed("Viv Rao", 5, "Chutney was excellent with eggs.", ["preserves", "practical"]),
    ],
  },
  {
    email: "bluebarrel@sunpatch.local",
    displayName: "Noemi at Blue Barrel",
    farmName: "Blue Barrel Beds",
    bio: "A water-wise barrel garden growing greens, strawberries, flowers, and bright porch extras.",
    details: {
      shopName: "Blue Barrel Beds",
      hours: "Thu, 5 PM - 7 PM · Sun, 8 AM - 11 AM",
      pickupLocation: "Blue barrel driveway stand",
      pickupCoords: { lat: 38.5411, lng: -121.7244 },
      pickupInstructions: "Driveway stand is next to the painted rain barrels.",
      paymentOptions: "Cash, PayPal, or flower trade",
      contact: "noemi@bluebarrel.local",
      availabilityNote: "Strawberries and flowers are posted as short weekend batches.",
    },
    inventory: [
      itemSeed("Barrel strawberries", "harvest", "ready", 11, "pints", "driveway cooler", "barrel row", "#d94d5c", 700, "Small sweet strawberries from the blue barrel row.", "2026-05-11T07:00:00.000Z", imageSources.strawberries),
      itemSeed("Rain barrel greens", "harvest", "ready", 14, "bags", "cool shelf", "wicking bed", "#65a95a", 525, "Tender greens grown in the wicking beds.", "2026-05-13T07:00:00.000Z", imageSources.lettuce),
      itemSeed("Marigold posies", "harvest", "ready", 10, "bunches", "water crock", "flower barrel", "#d7b64b", 450, "Cheerful marigold and herb posies.", "2026-05-14T07:00:00.000Z", imageSources.flowers),
    ],
    reviews: [
      reviewSeed("Ivy Chen", 5, "The strawberry pints were tiny and very sweet.", ["berries", "sweet"]),
      reviewSeed("Mateo Hill", 5, "Greens were washed well and stayed crisp.", ["greens", "clean"]),
      reviewSeed("Asha Noor", 4, "The marigold bunch was bright and fun.", ["flowers", "colorful"]),
    ],
  },
  {
    email: "cedarcoop@sunpatch.local",
    displayName: "Tomas at Cedar Coop",
    farmName: "Cedar Coop Stand",
    bio: "A cedar-fenced coop and garden with eggs, mushrooms, greens, and simple breakfast staples.",
    details: {
      shopName: "Cedar Coop Stand",
      hours: "Daily, 8 AM - 10 AM while stocked",
      pickupLocation: "Cedar fence egg cooler",
      pickupCoords: { lat: 38.5694, lng: -121.7687 },
      pickupInstructions: "Egg cooler is hooked to the cedar fence near the side path.",
      paymentOptions: "Cash jar, Zelle, or carton returns",
      contact: "tomas@cedarcoop.local",
      availabilityNote: "Eggs restock daily; mushrooms show up in smaller flushes.",
    },
    inventory: [
      itemSeed("Cedar coop eggs", "harvest", "ready", 12, "dozen", "fence cooler", "cedar coop", "#d7b64b", 725, "Mixed-size backyard eggs with date labels.", "2026-05-18T07:00:00.000Z", imageSources.eggs),
      itemSeed("Breakfast greens", "harvest", "ready", 16, "bags", "cool tote", "coop-side bed", "#72b85b", 500, "Mild greens for omelets and toast.", "2026-05-12T07:00:00.000Z", imageSources.vegetables),
      itemSeed("Pearl oyster boxes", "harvest", "ready", 7, "boxes", "shade cooler", "cedar rack", "#b99067", 1000, "Pearl oyster mushrooms packed in vented boxes.", "2026-05-12T07:00:00.000Z", imageSources.mushrooms),
    ],
    reviews: [
      reviewSeed("Della Park", 5, "Egg labels were clear and the cooler was easy to find.", ["eggs", "organized"]),
      reviewSeed("Kai Morgan", 4, "Breakfast greens cooked down perfectly.", ["greens", "practical"]),
      reviewSeed("Ren Ito", 5, "Oyster mushrooms were clean and meaty.", ["mushrooms", "fresh"]),
    ],
  },
];

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("catalog_items").createIndex({ type: 1, slug: 1 }, { unique: true }),
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1 }),
    db.collection("inventory_items").createIndex({ userId: 1, category: 1, status: 1 }),
    db.collection("inventory_items").createIndex({ userId: 1, name: 1 }, { unique: true }),
    db.collection("shop_displays").createIndex({ userId: 1 }, { unique: true }),
    db.collection("farm_reviews").createIndex({ farmUserId: 1, rating: -1 }),
    db.collection("farm_reviews").createIndex({ farmUserId: 1, reviewerName: 1 }, { unique: true }),
  ]);
}

function itemSeed(name, category, status, amount, unit, location, source, color, priceCents, notes, useBy, image) {
  return {
    name,
    category,
    status,
    quantity: { amount, unit },
    location,
    source,
    notes,
    color,
    priceCents,
    useBy: new Date(useBy),
    acquiredAt: new Date("2026-05-09T07:00:00.000Z"),
    image,
  };
}

function reviewSeed(reviewerName, rating, comment, tags) {
  return {
    reviewerName,
    rating,
    comment,
    tags,
  };
}

async function ensureSeedShopImage(db, userId, inventoryItemId, image) {
  const files = db.collection(`${shopImagesBucket}.files`);
  const existing = await files.findOne({
    "metadata.seedKey": image.key,
    "metadata.inventoryItemId": inventoryItemId,
  });

  if (existing?._id) {
    return existing._id;
  }

  const downloaded = await downloadSeedImage(image.downloadUrl);
  const bucket = new GridFSBucket(db, { bucketName: shopImagesBucket });
  const uploadStream = bucket.openUploadStream(image.fileName, {
    metadata: {
      userId,
      inventoryItemId,
      contentType: downloaded.contentType,
      sourceUrl: image.downloadUrl,
      sourcePage: image.sourcePage,
      seedKey: image.key,
      uploadedAt: now,
    },
  });

  await new Promise((resolve, reject) => {
    uploadStream.on("error", reject);
    uploadStream.on("finish", resolve);
    Readable.from(downloaded.bytes).pipe(uploadStream);
  });

  return uploadStream.id;
}

async function downloadSeedImage(url) {
  let lastError;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await sleep(900 * attempt);
    }

    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": imageUserAgent,
          "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*",
        },
      });
      const contentType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";

      if (!response.ok || !contentType.startsWith("image/")) {
        throw new Error(`Image download failed ${response.status} ${contentType}`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) {
        throw new Error("Image download was empty");
      }

      return { bytes, contentType };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Image download failed");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedNeighborFarm(db, farmSeed, passwordHash) {
  const userResult = await db.collection("users").findOneAndUpdate(
    { email: farmSeed.email },
    {
      $set: {
        email: farmSeed.email,
        username: farmSeed.email.split("@")[0].replace(/[^a-z0-9_-]/g, "").slice(0, 32),
        passwordHash,
        role: "user",
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  const user = userResult;

  await db.collection("profiles").updateOne(
    { userId: user._id },
    {
      $set: {
        displayName: farmSeed.displayName,
        bio: farmSeed.bio,
        updatedAt: now,
      },
      $setOnInsert: {
        userId: user._id,
        avatarUrl: null,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  await db.collection("farms").findOneAndUpdate(
    { userId: user._id, name: farmSeed.farmName },
    {
      $set: {
        userId: user._id,
        name: farmSeed.farmName,
        units: "feet",
        bounds: {
          width: 36,
          depth: 28,
          height: 8,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  const savedInventory = [];

  for (const inventoryItem of farmSeed.inventory) {
    const { image, ...inventoryDocument } = inventoryItem;
    const saved = await db.collection("inventory_items").findOneAndUpdate(
      { userId: user._id, name: inventoryItem.name },
      {
        $set: {
          ...inventoryDocument,
          userId: user._id,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const imageId = image ? await ensureSeedShopImage(db, user._id, saved._id, image) : null;
    savedInventory.push({ ...saved, imageId });
  }

  await db.collection("shop_displays").findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        theme: "farm-stand",
        layoutMode: "shelves",
        details: farmSeed.details,
        slots: savedInventory.map((item, index) => ({
          inventoryItemId: item._id,
          position: index,
          displayAmount: item.quantity.amount,
          displayUnit: item.quantity.unit,
          priceCents: item.priceCents,
          signText: `${item.name} · ${item.notes.split(".")[0]}`,
          visible: true,
          ...(item.imageId ? { imageId: item.imageId } : {}),
        })),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  for (const review of farmSeed.reviews) {
    await db.collection("farm_reviews").findOneAndUpdate(
      { farmUserId: user._id, reviewerName: review.reviewerName },
      {
        $set: {
          ...review,
          farmUserId: user._id,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
}

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    await ensureIndexes(db);

    const passwordHash = await bcrypt.hash(testUser.password, 12);
    const userResult = await db.collection("users").findOneAndUpdate(
      { email: testUser.email },
      {
        $set: {
          email: testUser.email,
          username: testUser.username,
          passwordHash,
          role: "user",
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const user = userResult;

    await db.collection("profiles").updateOne(
      { userId: user._id },
      {
        $set: {
          displayName: testUser.displayName,
          bio: "Seeded profile for local development.",
          updatedAt: now,
        },
        $setOnInsert: {
          userId: user._id,
          avatarUrl: null,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    const catalogBySlug = new Map();

    for (const item of catalogItems) {
      const result = await db.collection("catalog_items").findOneAndUpdate(
        { type: item.type, slug: item.slug },
        {
          $set: {
            ...item,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      catalogBySlug.set(item.slug, result);
    }

    const farmResult = await db.collection("farms").findOneAndUpdate(
      { userId: user._id, name: "Test Backyard Farm" },
      {
        $set: {
          userId: user._id,
          name: "Test Backyard Farm",
          units: "meters",
          bounds: {
            width: 24,
            depth: 18,
            height: 8,
          },
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const farm = farmResult;
    const tomatoes = catalogBySlug.get("tomatoes");
    const lettuce = catalogBySlug.get("lettuce");
    const chickens = catalogBySlug.get("chickens");

    for (const item of inventoryItems) {
      await db.collection("inventory_items").findOneAndUpdate(
        { userId: user._id, name: item.name },
        {
          $set: {
            ...item,
            userId: user._id,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    }

    await db.collection("plans").findOneAndUpdate(
      { farmId: farm._id, userId: user._id, name: "Balanced Test Plan" },
      {
        $set: {
          farmId: farm._id,
          userId: user._id,
          name: "Balanced Test Plan",
          status: "draft",
          version: 1,
          simulation: {
            startDate: new Date("2026-05-09T00:00:00.000Z"),
            currentDate: new Date("2026-06-01T08:00:00.000Z"),
            day: 23,
            timeOfDay: "08:00",
            season: "spring",
            speed: 1,
            paused: true,
          },
          objects: [
            {
              instanceId: "tomatoes_01",
              type: "crop",
              slug: "tomatoes",
              sourceId: tomatoes._id,
              displayName: "Tomato Bed",
              status: "planned",
              plantedAtDay: 0,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              size: tomatoes.defaultSize,
              renderOverrides: {},
              notes: "Seeded tomato crop for simulation testing.",
            },
            {
              instanceId: "lettuce_01",
              type: "crop",
              slug: "lettuce",
              sourceId: lettuce._id,
              displayName: "Lettuce Bed",
              status: "planned",
              plantedAtDay: 10,
              position: { x: 2, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              size: lettuce.defaultSize,
              renderOverrides: {},
            },
            {
              instanceId: "chickens_01",
              type: "livestock",
              slug: "chickens",
              sourceId: chickens._id,
              displayName: "Chicken Coop",
              status: "planned",
              addedAtDay: 0,
              ageDaysAtStart: 60,
              position: { x: 7, y: 0, z: 4 },
              rotation: { x: 0, y: 90, z: 0 },
              size: chickens.defaultSize,
              renderOverrides: {},
              notes: "Adults during the seeded simulation date.",
            },
          ],
          summary: {
            description: "A compact starter farm with crop beds separated from the chicken area.",
            highlights: [
              "Tomatoes and lettuce have lifecycle stages for time simulation.",
              "Chickens switch between daytime wandering and nighttime coop behavior.",
              "Objects include planted/added days for deterministic simulation playback.",
            ],
            maintenanceLevel: "low",
          },
          generation: {
            strategy: "balanced",
            prompt: "Create a small balanced 3D farm with tomatoes, lettuce, and chickens.",
            constraints: {
              maxWidthMeters: 24,
              maxDepthMeters: 18,
              separateLivestockFromCrops: true,
            },
            score: 0.84,
          },
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    for (const neighborFarm of neighborFarms) {
      await seedNeighborFarm(db, neighborFarm, passwordHash);
    }

    console.log(`Seeded ${dbName} for ${testUser.email} and ${neighborFarms.length} public farm shopfronts`);
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
