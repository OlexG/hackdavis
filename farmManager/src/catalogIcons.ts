const livestockIcons = new Map([
  ["chicken", "chickens"],
  ["cow", "cows"],
  ["duck", "ducks"],
  ["goat", "goats"],
  ["pig", "pigs"],
  ["quail", "quails"],
  ["rabbit", "rabbits"],
  ["sheep", "sheep"],
]);

export function livestockIcon(key?: string | null, name?: string): string | undefined {
  for (const value of [key, name]) {
    const icon = livestockIcons.get(value?.trim().toLowerCase().replace(/s$/, "") ?? "");
    if (icon) return `/inventory-icons/animals/${icon}.png`;
  }
}

const cropCategoryIcons = new Map([
  ["berry", "strawberries"],
  ["bulb", "onions"],
  ["fruit", "tomato"],
  ["fruit_tree", "apples"],
  ["fruit_vine", "pumpkin"],
  ["grain", "corn"],
  ["grass", "wheatgrass"],
  ["herb", "basil"],
  ["leafy_green", "lettuce"],
  ["legume", "peas"],
  ["rhizome", "ginger"],
  ["root_vegetable", "carrots"],
  ["seed_crop", "sunflower"],
  ["sprouts", "alfalfa-sprouts"],
  ["succulent", "aloe-vera"],
  ["tree_nut", "almonds"],
  ["tuber", "potatoes"],
  ["vegetable", "broccoli"],
]);

const cropVisualIcons = new Map([
  ["fruiting", "tomato"],
  ["grain", "corn"],
  ["leafy", "lettuce"],
  ["herb", "basil"],
  ["mound", "potatoes"],
  ["vine", "pumpkin"],
  ["root", "carrots"],
  ["groundcover", "strawberries"],
]);

export function cropIcon(crop: {
  name?: string;
  cropCategory?: string;
  visual?: string;
}): string | undefined {
  const name = crop.name?.toLowerCase() ?? "";
  let icon: string | undefined;
  if (/blueberr|blackberr|grape/.test(name)) icon = "blueberries";
  else if (/eggplant/.test(name)) icon = "eggplant";
  else if (/beet|radish|turnip|rutabaga/.test(name)) icon = "beets";
  else if (/cucumber|zucchini|summer squash/.test(name)) icon = "cucumber";
  else if (/squash|pumpkin|melon/.test(name)) icon = "pumpkin";
  else if (/pepper/.test(name)) icon = "peppers";
  else if (/\b(lemons?|limes?)\b/.test(name) && !/grass/.test(name)) icon = "lemons-limes";
  else if (/orange|grapefruit|tangerine/.test(name)) icon = "oranges-tangerines";
  else if (/potato/.test(name)) icon = "potatoes";
  else if (/corn|wheat/.test(name)) icon = "corn";
  else if (/tomato/.test(name)) icon = "tomato";
  const asset = icon ?? cropCategoryIcons.get(crop.cropCategory ?? "") ?? cropVisualIcons.get(crop.visual ?? "");
  return asset ? `/inventory-icons/plants/${asset}.png` : undefined;
}
