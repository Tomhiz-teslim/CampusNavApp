const https = require("https");

const data = JSON.stringify({
  "loc_2": { "name": "Lagoon Cafeteria",    "latitude": 6.5205, "longitude": 3.3935, "category": "food",    "icon": "🍽️" },
  "loc_3": { "name": "Open Air Theatre",    "latitude": 6.5170, "longitude": 3.3960, "category": "admin",   "icon": "🎭" },
  "loc_4": { "name": "Innovation Hub",      "latitude": 6.5160, "longitude": 3.3880, "category": "faculty", "icon": "💡" },
  "loc_5": { "name": "Recreation Park",     "latitude": 6.5195, "longitude": 3.3945, "category": "sport",   "icon": "🌳" },
  "loc_6": { "name": "Coffee Lounge",       "latitude": 6.5168, "longitude": 3.3925, "category": "food",    "icon": "☕" },
  "loc_7": { "name": "Biodiversity Garden", "latitude": 6.5152, "longitude": 3.3938, "category": "faculty", "icon": "🌿" },
  "loc_8": { "name": "Parking Area A",      "latitude": 6.5185, "longitude": 3.3920, "category": "admin",   "icon": "🅿️" },
  "loc_9": { "name": "Student Center Annex","latitude": 6.5172, "longitude": 3.3900, "category": "admin",   "icon": "🏫" }
});

const options = {
  hostname: "campusnavapp-e8c4b-default-rtdb.firebaseio.com",
  path: "/approvedLocations.json",
  method: "PATCH",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
};

const req = https.request(options, res => {
  res.on("data", d => console.log("Done:", d.toString()));
});
req.write(data);
req.end();