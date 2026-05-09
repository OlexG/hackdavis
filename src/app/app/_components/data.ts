export const appNavItems = [
  ["Farm", "/app/farm"],
  ["Season", "/app/seasonal"],
  ["Shop", "/app/shop"],
  ["Impact", "/app/impact"],
];

export const plots = Array.from({ length: 48 }, (_, index) => index);

export const seasons = [
  ["Spring", "Prep soil", "Seed starts", "Irrigation check"],
  ["Summer", "Harvest waves", "Pest watch", "Market listings"],
  ["Fall", "Cover crops", "Storage", "Compost reset"],
  ["Winter", "Planning", "Repairs", "Seed orders"],
];

export const shopStats = [
  ["Keep", "40%", "Family pantry and preserves"],
  ["Sell", "60%", "Local marketplace listings"],
  ["Potential earnings", "$1,840", "Projected seasonal revenue"],
  ["Auto post", "Ready", "Draft listings when harvest windows open"],
];

export const costs = [
  ["Animal feed", "$120", "Recurring"],
  ["Building upkeep", "$240", "Monthly reserve"],
  ["Water costs", "$76", "Metered"],
  ["Electricity", "$54", "Solar offset"],
  ["Seeds and starts", "$190", "Seasonal"],
];

export const impactRows = [
  ["Water usage", "38% lower", "Compared with conventional regional averages"],
  ["Carbon output", "0.7 tons saved", "Local trade and shorter food miles"],
  ["Major farms", "A- tier", "Lower transport and smaller inputs"],
  ["Grocery trips", "24 avoided", "Based on planned household share"],
];
