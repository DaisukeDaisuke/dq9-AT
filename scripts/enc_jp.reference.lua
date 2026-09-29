-- In JP ROMs, this displays the enemies on the screen, their positions, and the details of the encounters.
-- This lua has an unresolved freeze bug.


-- setting
-- Specify the behavior when the monster moves off-screen.
-- If true, the numbers will remain on the edge of the screen, if false, the numbers will be hidden.
local overflow = true -- true or false
local encTableBaseAddr = 0x020FDBCC

local monsters = {
	[0x1] = "Slime(0x1)",
	[0x10a] = "Slime(bloomingdale)",
	[0x10b] = "Slime(Newid Isle)",
	[0x122] = "Slime(0x122)",
	[0x123] = "Slime(0x123)",
	[0x39] = "Cruelcumber(0x39)",
	[0x124] = "Cruelcumber(0x124)",
	[0x38] = "Teeny sanguini",
	[0x3f] = "Sacksquatch",
	[0x20] = "Batterfly",
	[0x4] = "Dracky",
	[0x17] = "Bodkin archer",
	[0x2b] = "Bag o' laughs",
	[0x14] = "Mecha-mynah",
	[0x7] = "Firespirit",
	[0x1e] = "Spirit",
	[0x23] = "Winkster",
	[0x1c] = "Hammerhood",
	[0x2] = "She-slime",
	[0x9] = "Funghoul",
	[0x1a] = "Bubble slime",
	[0x3c] = "Wooper trooper",
	[0x21] = "Betterfly",
	[0xc] = "Meowgician",
	[0x8e] = "Ragged reaper",
	[0x50] = "Gastropog",
	[0x1d] = "Brownie",
	[0x90] = "Boppin' badger",
	[0x5] = "Drackmage",
	[0x18] = "Bodkin fletcher",
	[0x71] = "Ram raider",
	[0x2d] = "Cumaulus",
	[0x55] = "Skeleton",
	[0xf] = "Healslime",
	[0x24] = "Blinkster",
	[0x30] = "Leery lout",
	[0x29] = "Lunatick",
	[0x4e] = "Leafy larrikin",
	[0x16] = "Clockwork cuckoo",
	[0x33] = "Slugger",
	[0x93] = "Chariot chappie",
	[0xa] = "Morphean mushroom",
	[0x8] = "Lost soul",
	[0x58] = "Flython",
	[0x91] = "Badger mager",
	[0x100] = "Crabid",
	[0x1f] = "Mean spirit",
	[0x84] = "Magus",
	[0x6c] = "Mummy boy",
	[0x53] = "Earthenwarrior",
	[0x3] = "Metal slime(normal)",
	[0x129] = "Metal slime(electro Light)",
	[0x19] = "Bodkin kowyer",
	[0x7a] = "Slime knight",
	[0x69] = "Cyclown",
	[0x81] = "Badboon",
	[0x4b] = "Slime stack",
	[0x7e] = "Mudraker",
	[0xb] = "Mushroom mage",
	[0x6] = "Drackyma",
	[0x66] = "Walking corpse",
	[0x25] = "Jinkster",
	[0x77] = "Restless armour",
	[0x9d] = "Knocktopus",
	[0x8c] = "Chimaera",
	[0x3d] = "Salamarauder",
	[0x10] = "Man o' war",
	[0x95] = "Mortoad",
	[0x22] = "Dread admiral",
	[0x3a] = "Zumeanie",
	[0x4f] = "Bud brother",
	[0x6a] = "Spinchilla",
	[0x63] = "Bewarewolf",
	[0xd] = "Clawcerer",
	[0x72] = "Rampage",
	[0x5b] = "Beakon",
	[0xc8] = "Mad moai",
	[0xa4] = "Trigertaur",
	[0x75] = "Grinade",
	[0x67] = "Toxic zombie",
	[0x7b] = "Metal slime knight",
	[0x8d] = "Hocus chimaera",
	[0x8a] = "Treeface",
	[0x10d] = "Stone golem(0x10D)",
	[0xba] = "Stone golem(0x0BA)",
	[0x32] = "Gum shield",
	[0x36] = "Pink sanguini",
	[0x65] = "Scarewolf",
	[0x82] = "Big badboon",
	[0x11] = "Medislime",
	[0x85] = "Shaman",
	[0x5c] = "Weaken beakon",
	[0x2a] = "Raving lunatick",
	[0xb1] = "Hunter mech",
	[0x104] = "Riptide",
	[0x4c] = "Metal medley",
	[0xb3] = "King slime",
	[0xcf] = "Claw hammer",
	[0x9e] = "Shocktopus",
	[0x3e] = "Axolhotl",
	[0x98] = "Parched peckerel",
	[0xd0] = "Power hammer",
	[0xbb] = "Gold golem",
	[0x96] = "Expload",
	[0x6d] = "Mummy",
	[0x7f] = "Admirer",
	[0x5e] = "Lesionnaire",
	[0x59] = "Diethon",
	[0xe] = "Purrestidigitator",
	[0x9f] = "Manguini",
	[0x87] = "Mandrake major",
	[0x3b] = "Scourgette",
	[0x6f] = "Wyrtle",
	[0x101] = "Crabber dabber doo",
	[0x92] = "Badja",
	[0x51] = "Giddy gastropog",
	[0x8b] = "Treevil",
	[0x68] = "Ghoul",
	[0x15] = "Robo-robin",
	[0x7c] = "Swinoceros(0x7C)",
	[0x11d] = "Swinoceros(0x11D)",
	[0x99] = "Peckerel",
	[0x73] = "Battering ram",
	[0x74] = "Rockbomb",
	[0x83] = "Brainy badboon",
	[0x110] = "Drackal(0x110)",
	[0xbd] = "Drackal(0xBD)",
	[0xa1] = "Gruffon",
	[0x86] = "Sorcerer",
	[0x61] = "Cheeky tiki",
	[0x5f] = "Deadcurion",
	[0x78] = "Infernal armour",
	[0xdc] = "Troll",
	[0xe8] = "Shivery shrubbery",
	[0x64] = "Tearwolf",
	[0x54] = "Brreatherwarrior",
	[0xe9] = "Apeckalypse",
	[0xa2] = "Great gruffon",
	[0xa5] = "White trigertaur",
	[0x12] = "Sootheslime",
	[0x103] = "cikiller",
	[0x62] = "Teaky mask",
	[0x8f] = "Raving reaper",
	[0xcd] = "Wight priest",
	[0xca] = "Sculptrice",
	[0xff] = "Handsome crab(0xFF)",
	[0x111] = "Handsome crab(0x111)",
	[0x5a] = "Sail serpent",
	[0x31] = "Grim grinner",
	[0x34] = "Sluggernaut",
	[0x7d] = "Splatterhorn",
	[0x11e] = "Whirly girly",
	[0x6b] = "Whirly girly",
	[0xa3] = "Gramarye gruffon",
	[0x56] = "Skeleton soldier",
	[0xa0] = "Bloody manguini",
	[0x6e] = "Blood mummy",
	[0x117] = "Harmour(0x117)",
	[0xc0] = "Harmour(0xC0)",
	[0xd4] = "Python priest",
	[0xcb] = "Sculpture vulture",
	[0x10e] = "Living statue(0x10E)",
	[0xac] = "Living statue(0xAC)",
	[0x2c] = "Goodybag",
	[0xae] = "Drakularge",
	[0x1b] = "Liquid metal slime(normal)",
	[0x126] = "Liquid metal slime(electro Light)",
	[0xa7] = "Moosifer",
	[0xbe] = "Drastic drackal",
	[0xc5] = "Terrorhawk",
	[0xd9] = "Cyclops(0xD9)",
	[0x112] = "Cyclops(0x112)",
	[0xb6] = "Cumulus rex",
	[0x76] = "Bomboulder",
	[0x40] = "Bagma",
	[0xbc] = "Golem",
	[0x106] = "Seasaur",
	[0x2e] = "Hell niño(0x2E)",
	[0x11b] = "Hell niño(0x11B)",
	[0x94] = "Corrupt carter",
	[0x80] = "Live lava",
	[0x88] = "Mandrake marauder",
	[0xc9] = "Mega moai",
	[0xdf] = "Magmalice",
	[0xa9] = "Green dragon",
	[0x107] = "Abyss diver",
	[0x125] = "Stenchurion(0x125)",
	[0x60] = "Stenchurion(0x60)",
	[0x52] = "Gloomy gastropog",
	[0x57] = "Dark skeleton",
	[0xb2] = "Killing machine",
	[0xbf] = "Dreadful drackal",
	[0x79] = "Lethal armour(0x79)",
	[0x12a] = "Lethal armour(0x12A)",
	[0x2f] = "Freezing fog",
	[0xad] = "Stone guardian(0xAD)",
	[0x113] = "Stone guardian(0x113)",
	[0xdd] = "Boss troll",
	[0x97] = "Blastoad(0x97)",
	[0x10f] = "Blastoad(0x10F)",
	[0x119] = "Fright knight(0x119)",
	[0xc3] = "Fright knight(0xC3)",
	[0xce] = "Wight king",
	[0x105] = "Claws",
	[0x11a] = "Aggrosculpture(0x11A)",
	[0xcc] = "Aggrosculpture(0xCC)",
	[0x89] = "Mandrake marshal",
	[0x118] = "Bad karmour(0x118)",
	[0xc1] = "Bad karmour(0xC1)",
	[0x70] = "Wyrtloise",
	[0x102] = "King crab",
	[0x37] = "Genie sanguini",
	[0xb7] = "Cumulus vex",
	[0xaa] = "Red dragon",
	[0xda] = "Gigantes",
	[0x5d] = "Belisha beakon",
	[0xf3] = "Charmour",
	[0x13] = "Cureslime",
	[0xde] = "Great troll",
	[0xd5] = "Cobra cardinal",
	[0xc6] = "Prism peacock",
	[0xc4] = "Night knight",
	[0x114] = "Drakulard(0x114)",
	[0xaf] = "Drakulard(0xAF)",
	[0xa8] = "Barbatos",
	[0xe0] = "Firn fiend",
	[0xa6] = "Sick trigertaur",
	[0x26] = "Cannibox",
	[0x27] = "Mimic",
	[0xb4] = "King cureslime",
	[0x4d] = "Gem jamboree",
	[0x35] = "Sluggerslaught",
	[0x109] = "Terror troll(0x109)",
	[0x116] = "Terror troll(0x116)",
	[0xed] = "Cosmic chimaera",
	[0x14e] = "Wishmaster",
	[0xf1] = "Cumulus hex",
	[0x147] = "Stale whale",
	[0xb5] = "Metal king slime(normal)",
	[0x127] = "Metal king slime(electro Light)",
	[0xe2] = "Slionheart",
	[0xd7] = "Godsteed",
	[0xeb] = "Wonder wyrtle",
	[0x149] = "Widow's pique",
	[0x141] = "Octagoon",
	[0xb8] = "Darkonium slime",
	[0xef] = "Freaky tiki",
	[0xc2] = "Alamour",
	[0xfe] = "Boa bishop",
	[0x14a] = "Cyber spider",
	[0xe6] = "Alphyn",
	[0xb9] = "Gem slime",
	[0xe4] = "AU-1000",
	[0xe5] = "Void droid",
	[0xf2] = "Platinum king jewel(normal)",
	[0x128] = "Platinum king jewel(electro Light)",
	[0x143] = "Cannibelle",
	[0xfa] = "Grim reaper",
	[0xf7] = "Wight emperor",
	[0xf6] = "Grrrgoyle",
	[0x28] = "Pandora's box",
	[0x145] = "Uncommon cold",
	[0xec] = "Geothaum",
	[0xf4] = "Blight knight",
	[0xfc] = "Flamin' drayman",
	[0xd6] = "antamount",
	[0xf9] = "Barriearthenwarrior",
	[0xc7] = "Bird of terrordise",
	[0x144] = "Scarlet fever(0x144)",
	[0x11c] = "Scarlet fever(0x11C)",
	[0x11f] = "Scarlet fever(0x11F)",
	[0x120] = "Scarlet fever(0x120)",
	[0x121] = "Scarlet fever(0x121)",
	[0x14d] = "Hell's gatekeeper",
	[0xab] = "Rashaverak",
	[0xee] = "Master moosifer",
	[0xe7] = "Vermil lion(0xE7)",
	[0x115] = "Vermil lion(0x115)",
	[0x14b] = "Slugly betsy",
	[0xf5] = "Moai minstrel",
	[0xf8] = "Boogie manguini",
	[0xf0] = "Mandrake monarch",
	[0xfb] = "Bling badger",
	[0x10c] = "Prime slime",
	[0xfd] = "Hammer horror",
	[0xb0] = "Drakulord",
	[0x148] = "Pale whale",
	[0x108] = "Seavern",
	[0x12c] = "Hexagoon",
	[0x12d] = "Wight Knight",
	[0x12e] = "Morag",
	[0x12f] = "Ragin' Contagion",
	[0x130] = "Master of Nu'un",
	[0x15b] = "Lleviathan",
	[0x131] = "Lleviathan",
	[0x132] = "Garth Goyle",
	[0x133] = "Tyrantula",
	[0x134] = "Grand Lizzier",
	[0x135] = "Larstastnaras",
	[0x2eb] = "Dreadmaster",
	[0x136] = "Dreadmaster",
	[0x137] = "Gadrongo",
	[0x158] = "Goreham-Hogg",
	[0x139] = "Goreham-Hogg",
	[0x159] = "Hootingham-Gore",
	[0x13a] = "Hootingham-Gore",
	[0x13b] = "Goresby-Purrvis",
	[0x15a] = "Goresby-Purrvis",
	[0x13c] = "King Godwym",
	[0x13d] = "King Godwym",
	[0x2ec] = "King Godwym",
	[0x2ed] = "King Godwym",
	[0x13e] = "Barbarus",
	[0x2ee] = "Barbarus",
	[0x13f] = "Corvus",
	[0x140] = "Corvus",
	[0x2ef] = "Corvus",
	[0x2f0] = "Corvus",
	[0x2f1] = "Corvus",
	[0x2f2] = "Corvus",
	[0x2f3] = "Corvus",
	[0x321] = "Corvus",
	[0x153] = "Yore",
	[0x2fa] = "Yore",
	[0x2fb] = "Yore",
	[0x155] = "Rover",
	[0x2f8] = "King Godfrey",
	[0x156] = "King Godfrey",
	[0x2f9] = "Tyrannosaura Wrecks",
	[0x157] = "Tyrannosaura Wrecks",
	[0x154] = "Nodoph",
	[0xd8] = "Equinox",
	[0xea] = "Nemean",
	[0xe1] = "Shogum",
	[0xe3] = "Trauminator",
	[0x14c] = "Elusid",
	[0x142] = "Sir Sanguinus",
	[0xdb] = "Atlas",
	[0x14f] = "Hammibal",
	[0x150] = "Fowleye",
	[0x151] = "Excalipurr",
	[0x2fc] = "Excalipurr",
	[0x146] = "Tyrannosaurus Wrecks",
	[0x2f4] = "Tyrannosaurus Wrecks",
	[0x2f5] = "Tyrannosaurus Wrecks",
	[0x2f6] = "Greygnarl",
	[0x2f7] = "Greygnarl",
	[0x152] = "Greygnarl",
	[0x138] = "Greygnarl",
	[0x1f4] = "Dragonlord",
	[0x258] = "Dragonlord",
	[0x259] = "Dragonlord",
	[0x1f5] = "Malroth",
	[0x25a] = "Malroth",
	[0x25b] = "Malroth",
	[0x25c] = "Malroth",
	[0x25d] = "Malroth",
	[0x1f6] = "Baramos",
	[0x25e] = "Baramos",
	[0x25f] = "Baramos",
	[0x260] = "Baramos",
	[0x261] = "Baramos",
	[0x1f7] = "Zoma",
	[0x262] = "Zoma",
	[0x263] = "Zoma",
	[0x264] = "Zoma",
	[0x265] = "Zoma",
	[0x1f8] = "Psaro",
	[0x266] = "Psaro",
	[0x267] = "Psaro",
	[0x268] = "Psaro",
	[0x269] = "Psaro",
	[0x26a] = "Psaro",
	[0x26b] = "Psaro",
	[0x26c] = "Psaro",
	[0x1f9] = "Estark",
	[0x26d] = "Estark",
	[0x26e] = "Estark",
	[0x26f] = "Estark",
	[0x270] = "Estark",
	[0x271] = "Estark",
	[0x272] = "Estark",
	[0x1fa] = "Nimzo",
	[0x273] = "Nimzo",
	[0x274] = "Nimzo",
	[0x275] = "Nimzo",
	[0x276] = "Nimzo",
	[0x277] = "Nimzo",
	[0x1fb] = "Murdaw",
	[0x278] = "Murdaw",
	[0x279] = "Murdaw",
	[0x27a] = "Murdaw",
	[0x27b] = "Murdaw",
	[0x27c] = "Murdaw",
	[0x27d] = "Murdaw",
	[0x1fc] = "Mortamor",
	[0x27e] = "Mortamor",
	[0x27f] = "Mortamor",
	[0x280] = "Mortamor",
	[0x281] = "Mortamor",
	[0x282] = "Mortamor",
	[0x283] = "Mortamor",
	[0x301] = "Nokturnus",
	[0x302] = "Nokturnus",
	[0x303] = "Nokturnus",
	[0x304] = "Nokturnus",
	[0x305] = "Nokturnus",
	[0x306] = "Nokturnus",
	[0x307] = "Nokturnus",
	[0x202] = "Nokturnus",
	[0x1ff] = "Orgodemir",
	[0x284] = "Orgodemir",
	[0x285] = "Orgodemir",
	[0x286] = "Orgodemir",
	[0x287] = "Orgodemir",
	[0x288] = "Orgodemir",
	[0x28b] = "Dhoulmagus",
	[0x28c] = "Dhoulmagus",
	[0x28d] = "Dhoulmagus",
	[0x200] = "Dhoulmagus",
	[0x289] = "Dhoulmagus",
	[0x28a] = "Dhoulmagus",
	[0x28e] = "Rhapthorne",
	[0x28f] = "Rhapthorne",
	[0x290] = "Rhapthorne",
	[0x291] = "Rhapthorne",
	[0x292] = "Rhapthorne",
	[0x293] = "Rhapthorne",
	[0x294] = "Rhapthorne",
	[0x201] = "Rhapthorne",
	[0x308] = "Mortamor's Left Claw",
	[0x309] = "Mortamor's Left Claw",
	[0x1fd] = "Mortamor's Left Claw",
	[0x30a] = "Mortamor's Right Claw",
	[0x30b] = "Mortamor's Right Claw",
	[0x1fe] = "Mortamor's Right Claw",
	[0x320] = "aquila",
	[0x384] = "debug sacksquach?",
}
local monstersHp = {
	[0x1] = 8,
	[0x10a] = 76,
	[0x10b] = 55,
	[0x39] = 10,
	[0x38] = 13,
	[0x3f] = 15,
	[0x20] = 14,
	[0x4] = 15,
	[0x17] = 17,
	[0x2b] = 16,
	[0x14] = 6,
	[0x7] = 14,
	[0x1e] = 20,
	[0x23] = 18,
	[0x1c] = 20,
	[0x2] = 19,
	[0x9] = 22,
	[0x1a] = 23,
	[0x3c] = 30,
	[0x21] = 37,
	[0xc] = 29,
	[0x8e] = 34,
	[0x50] = 28,
	[0x1d] = 40,
	[0x90] = 39,
	[0x5] = 35,
	[0x18] = 36,
	[0x71] = 57,
	[0x2d] = 30,
	[0x55] = 42,
	[0xf] = 30,
	[0x24] = 33,
	[0x30] = 36,
	[0x29] = 36,
	[0x4e] = 36,
	[0x16] = 27,
	[0x33] = 48,
	[0x93] = 55,
	[0xa] = 50,
	[0x8] = 62,
	[0x58] = 70,
	[0x91] = 56,
	[0x100] = 72,
	[0x1f] = 65,
	[0x84] = 58,
	[0x6c] = 91,
	[0x53] = 55,
	[0x3] = 4,
	[0x129] = 4,
	[0x19] = 58,
	[0x7a] = 60,
	[0x69] = 56,
	[0x81] = 90,
	[0x4b] = 177,
	[0x7e] = 120,
	[0xb] = 67,
	[0x6] = 52,
	[0x66] = 105,
	[0x25] = 60,
	[0x77] = 100,
	[0x9d] = 75,
	[0x8c] = 75,
	[0x3d] = 80,
	[0x10] = 70,
	[0x95] = 140,
	[0x22] = 76,
	[0x3a] = 85,
	[0x4f] = 65,
	[0x6a] = 126,
	[0x63] = 87,
	[0xd] = 75,
	[0x72] = 100,
	[0x5b] = 65,
	[0xc8] = 125,
	[0xa4] = 100,
	[0x75] = 75,
	[0x67] = 150,
	[0x7b] = 46,
	[0x8d] = 80,
	[0x8a] = 95,
	[0x10d] = 156,
	[0xba] = 156,
	[0x32] = 80,
	[0x36] = 85,
	[0x65] = 102,
	[0x82] = 147,
	[0x11] = 82,
	[0x85] = 90,
	[0x5c] = 78,
	[0x2a] = 85,
	[0xb1] = 95,
	[0x104] = 102,
	[0x4c] = 6,
	[0xb3] = 245,
	[0xcf] = 98,
	[0x9e] = 75,
	[0x3e] = 92,
	[0x98] = 101,
	[0xd0] = 110,
	[0xbb] = 250,
	[0x96] = 142,
	[0x6d] = 138,
	[0x7f] = 120,
	[0x5e] = 99,
	[0x59] = 109,
	[0xe] = 96,
	[0x9f] = 108,
	[0x87] = 107,
	[0x3b] = 96,
	[0x6f] = 105,
	[0x101] = 112,
	[0x92] = 105,
	[0x51] = 90,
	[0x8b] = 111,
	[0x68] = 162,
	[0x15] = 75,
	[0x7c] = 120,
	[0x11d] = 120,
	[0x99] = 107,
	[0x73] = 105,
	[0x74] = 100,
	[0x83] = 150,
	[0x110] = 230,
	[0xbd] = 230,
	[0xa1] = 136,
	[0x86] = 99,
	[0x61] = 117,
	[0x5f] = 112,
	[0x78] = 125,
	[0xdc] = 413,
	[0xe8] = 81,
	[0x64] = 136,
	[0x54] = 125,
	[0xe9] = 130,
	[0xa2] = 150,
	[0xa5] = 128,
	[0x12] = 138,
	[0x103] = 140,
	[0x62] = 98,
	[0x8f] = 134,
	[0xcd] = 126,
	[0xca] = 145,
	[0xff] = 121,
	[0x111] = 121,
	[0x5a] = 148,
	[0x31] = 110,
	[0x34] = 118,
	[0x7d] = 134,
	[0x11e] = 134,
	[0x6b] = 144,
	[0xa3] = 215,
	[0x56] = 146,
	[0xa0] = 154,
	[0x6e] = 166,
	[0x117] = 145,
	[0xc0] = 145,
	[0xd4] = 136,
	[0xcb] = 153,
	[0x10e] = 236,
	[0xac] = 236,
	[0x2c] = 126,
	[0xae] = 286,
	[0x1b] = 8,
	[0x126] = 8,
	[0xa7] = 156,
	[0xbe] = 225,
	[0xc5] = 146,
	[0xd9] = 355,
	[0x112] = 355,
	[0xb6] = 252,
	[0x76] = 146,
	[0x40] = 120,
	[0xbc] = 300,
	[0x106] = 304,
	[0x2e] = 125,
	[0x11b] = 125,
	[0x94] = 155,
	[0x80] = 165,
	[0x88] = 172,
	[0xc9] = 180,
	[0xdf] = 200,
	[0xa9] = 245,
	[0x107] = 600,
	[0x125] = 160,
	[0x60] = 160,
	[0x52] = 144,
	[0x57] = 186,
	[0xb2] = 182,
	[0xbf] = 240,
	[0x79] = 194,
	[0x12a] = 194,
	[0x2f] = 126,
	[0xad] = 255,
	[0x113] = 255,
	[0xdd] = 496,
	[0x97] = 356,
	[0x10f] = 356,
	[0x119] = 226,
	[0xc3] = 226,
	[0xce] = 186,
	[0x105] = 206,
	[0x11a] = 220,
	[0xcc] = 220,
	[0x89] = 222,
	[0x118] = 188,
	[0xc1] = 188,
	[0x70] = 215,
	[0x102] = 270,
	[0x37] = 155,
	[0xb7] = 268,
	[0xaa] = 325,
	[0xda] = 640,
	[0x5d] = 136,
	[0xf3] = 220,
	[0x13] = 165,
	[0xde] = 768,
	[0xd5] = 236,
	[0xc6] = 246,
	[0xc4] = 256,
	[0x114] = 520,
	[0xaf] = 520,
	[0xa8] = 355,
	[0xe0] = 365,
	[0xa6] = 480,
	[0x26] = 187,
	[0x27] = 627,
	[0xb4] = 256,
	[0x4d] = 5,
	[0x35] = 468,
	[0x109] = 1176,
	[0x116] = 1176,
	[0xed] = 516,
	[0x14e] = 663,
	[0xf1] = 796,
	[0x147] = 1244,
	[0xb5] = 16,
	[0x127] = 16,
	[0xe2] = 825,
	[0xd7] = 686,
	[0xeb] = 1040,
	[0x149] = 955,
	[0x141] = 522,
	[0xb8] = 420,
	[0xef] = 596,
	[0xc2] = 454,
	[0xfe] = 633,
	[0x14a] = 596,
	[0xe6] = 1246,
	[0xb9] = 20,
	[0xe4] = 996,
	[0xe5] = 1325,
	[0xf2] = 20,
	[0x128] = 20,
	[0x143] = 468,
	[0xfa] = 596,
	[0xf7] = 488,
	[0xf6] = 636,
	[0x28] = 868,
	[0x145] = 907,
	[0xec] = 708,
	[0xf4] = 965,
	[0xfc] = 480,
	[0xd6] = 1056,
	[0xf9] = 512,
	[0xc7] = 648,
	[0x144] = 743,
	[0x11c] = 743,
	[0x11f] = 743,
	[0x120] = 743,
	[0x121] = 743,
	[0x14d] = 996,
	[0xab] = 1124,
	[0xee] = 1056,
	[0xe7] = 1378,
	[0x115] = 1378,
	[0x14b] = 1477,
	[0xf5] = 518,
	[0xf8] = 488,
	[0xf0] = 735,
	[0xfb] = 445,
	[0x10c] = 914,
	[0xfd] = 874,
	[0xb0] = 1414,
	[0x148] = 1456,
	[0x108] = 1127,
}

local costTable = {
	[0x1] = 26624,
	[0x2] = 25600,
	[0x3] = 25600,
	[0x4] = 28672,
	[0x5] = 30720,
	[0x6] = 30720,
	[0x7] = 56320,
	[0x8] = 59392,
	[0x9] = 36864,
	[0xa] = 39936,
	[0xb] = 37888,
	[0xc] = 47104,
	[0xd] = 44032,
	[0xe] = 44032,
	[0xf] = 41984,
	[0x10] = 50176,
	[0x11] = 41984,
	[0x12] = 43008,
	[0x13] = 41984,
	[0x14] = 33792,
	[0x15] = 49152,
	[0x16] = 37888,
	[0x17] = 53248,
	[0x18] = 54272,
	[0x19] = 60416,
	[0x1a] = 47104,
	[0x1b] = 43008,
	[0x1c] = 36864,
	[0x1d] = 38912,
	[0x1e] = 45056,
	[0x1f] = 53248,
	[0x20] = 31744,
	[0x21] = 34816,
	[0x22] = 37888,
	[0x23] = 40960,
	[0x24] = 43008,
	[0x25] = 49152,
	[0x26] = 71680,
	[0x27] = 75776,
	[0x28] = 66560,
	[0x29] = 60416,
	[0x2a] = 51200,
	[0x2b] = 40960,
	[0x2c] = 58368,
	[0x2d] = 60416,
	[0x2e] = 64512,
	[0x2f] = 73728,
	[0x30] = 50176,
	[0x31] = 48128,
	[0x32] = 39936,
	[0x33] = 46080,
	[0x34] = 51200,
	[0x35] = 52224,
	[0x36] = 47104,
	[0x37] = 73728,
	[0x38] = 45056,
	[0x39] = 55296,
	[0x3a] = 67584,
	[0x3b] = 65536,
	[0x3c] = 51200,
	[0x3d] = 61440,
	[0x3e] = 64512,
	[0x3f] = 54272,
	[0x40] = 72704,
	[0x4b] = 51200,
	[0x4c] = 50176,
	[0x4d] = 47104,
	[0x4e] = 49152,
	[0x4f] = 49152,
	[0x50] = 54272,
	[0x51] = 49152,
	[0x52] = 52224,
	[0x53] = 50176,
	[0x54] = 50176,
	[0x55] = 41984,
	[0x56] = 41984,
	[0x57] = 38912,
	[0x58] = 59392,
	[0x59] = 59392,
	[0x5a] = 62464,
	[0x5b] = 49152,
	[0x5c] = 39936,
	[0x5d] = 47104,
	[0x5e] = 49152,
	[0x5f] = 50176,
	[0x60] = 50176,
	[0x61] = 45056,
	[0x62] = 46080,
	[0x63] = 62464,
	[0x64] = 69632,
	[0x65] = 72704,
	[0x66] = 43008,
	[0x67] = 41984,
	[0x68] = 38912,
	[0x69] = 50176,
	[0x6a] = 43008,
	[0x6b] = 43008,
	[0x6c] = 44032,
	[0x6d] = 44032,
	[0x6e] = 49152,
	[0x6f] = 59392,
	[0x70] = 59392,
	[0x71] = 46080,
	[0x72] = 48128,
	[0x73] = 44032,
	[0x74] = 25600,
	[0x75] = 23552,
	[0x76] = 26624,
	[0x77] = 51200,
	[0x78] = 45056,
	[0x79] = 51200,
	[0x7a] = 57344,
	[0x7b] = 60416,
	[0x7c] = 45056,
	[0x7d] = 45056,
	[0x7e] = 68608,
	[0x7f] = 65536,
	[0x80] = 65536,
	[0x81] = 43008,
	[0x82] = 47104,
	[0x83] = 38912,
	[0x84] = 45056,
	[0x85] = 44032,
	[0x86] = 44032,
	[0x87] = 46080,
	[0x88] = 53248,
	[0x89] = 49152,
	[0x8a] = 55296,
	[0x8b] = 54272,
	[0x8c] = 38912,
	[0x8d] = 38912,
	[0x8e] = 46080,
	[0x8f] = 49152,
	[0x90] = 52224,
	[0x91] = 54272,
	[0x92] = 55296,
	[0x93] = 65536,
	[0x94] = 66560,
	[0x95] = 50176,
	[0x96] = 54272,
	[0x97] = 64512,
	[0x98] = 65536,
	[0x99] = 71680,
	[0x9d] = 52224,
	[0x9e] = 53248,
	[0x9f] = 70656,
	[0xa0] = 71680,
	[0xa1] = 49152,
	[0xa2] = 62464,
	[0xa3] = 59392,
	[0xa4] = 72704,
	[0xa5] = 77824,
	[0xa6] = 72704,
	[0xa7] = 50176,
	[0xa8] = 52224,
	[0xa9] = 88064,
	[0xaa] = 84992,
	[0xab] = 82944,
	[0xac] = 50176,
	[0xad] = 52224,
	[0xae] = 69632,
	[0xaf] = 66560,
	[0xb0] = 77824,
	[0xb1] = 53248,
	[0xb2] = 64512,
	[0xb3] = 47104,
	[0xb4] = 47104,
	[0xb5] = 40960,
	[0xb6] = 71680,
	[0xb7] = 81920,
	[0xb8] = 27648,
	[0xb9] = 21504,
	[0xba] = 48128,
	[0xbb] = 44032,
	[0xbc] = 56320,
	[0xbd] = 51200,
	[0xbe] = 60416,
	[0xbf] = 53248,
	[0xc0] = 40960,
	[0xc1] = 49152,
	[0xc2] = 48128,
	[0xc3] = 75776,
	[0xc4] = 60416,
	[0xc5] = 51200,
	[0xc6] = 52224,
	[0xc7] = 54272,
	[0xc8] = 50176,
	[0xc9] = 53248,
	[0xca] = 71680,
	[0xcb] = 71680,
	[0xcc] = 71680,
	[0xcd] = 41984,
	[0xce] = 37888,
	[0xcf] = 53248,
	[0xd0] = 53248,
	[0xd4] = 52224,
	[0xd5] = 49152,
	[0xd6] = 66560,
	[0xd7] = 62464,
	[0xd8] = 72704,
	[0xd9] = 60416,
	[0xda] = 80896,
	[0xdb] = 79872,
	[0xdc] = 110592,
	[0xdd] = 98304,
	[0xde] = 98304,
	[0xdf] = 72704,
	[0xe0] = 54272,
	[0xe1] = 81920,
	[0xe2] = 61440,
	[0xe3] = 103424,
	[0xe4] = 104448,
	[0xe5] = 95232,
	[0xe6] = 99328,
	[0xe7] = 114688,
	[0xe8] = 52224,
	[0xe9] = 77824,
	[0xea] = 113664,
	[0xeb] = 50176,
	[0xec] = 48128,
	[0xed] = 40960,
	[0xee] = 53248,
	[0xef] = 47104,
	[0xf0] = 51200,
	[0xf1] = 88064,
	[0xf2] = 17408,
	[0xf3] = 34816,
	[0xf4] = 61440,
	[0xf5] = 60416,
	[0xf6] = 84992,
	[0xf7] = 37888,
	[0xf8] = 68608,
	[0xf9] = 47104,
	[0xfa] = 53248,
	[0xfb] = 54272,
	[0xfc] = 73728,
	[0xfd] = 61440,
	[0xfe] = 57344,
	[0xff] = 61440,
	[0x100] = 60416,
	[0x101] = 58368,
	[0x102] = 61440,
	[0x103] = 48128,
	[0x104] = 80896,
	[0x105] = 65536,
	[0x106] = 60416,
	[0x107] = 56320,
	[0x108] = 70656,
	[0x109] = 98304,
	[0x10a] = 27648,
	[0x10b] = 27648,
	[0x10c] = 73728,
	[0x10d] = 48128,
	[0x10e] = 50176,
	[0x10f] = 64512,
	[0x110] = 51200,
	[0x111] = 61440,
	[0x112] = 60416,
	[0x113] = 52224,
	[0x114] = 66560,
	[0x115] = 114688,
	[0x116] = 98304,
	[0x117] = 40960,
	[0x118] = 49152,
	[0x119] = 75776,
	[0x11a] = 71680,
	[0x11b] = 64512,
	[0x11c] = 88064,
	[0x11d] = 45056,
	[0x11e] = 45056,
	[0x11f] = 88064,
	[0x120] = 88064,
	[0x121] = 88064,
	[0x122] = 26624,
	[0x123] = 26624,
	[0x124] = 55296,
	[0x125] = 50176,
	[0x126] = 43008,
	[0x127] = 40960,
	[0x128] = 17408,
	[0x129] = 25600,
	[0x12a] = 51200,
	[0x12c] = 55296,
	[0x12d] = 112640,
	[0x12e] = 99328,
	[0x12f] = 102400,
	[0x130] = 66560,
	[0x131] = 92160,
	[0x132] = 75776,
	[0x133] = 76800,
	[0x134] = 67584,
	[0x135] = 71680,
	[0x136] = 79872,
	[0x137] = 94208,
	[0x138] = 94208,
	[0x139] = 84992,
	[0x13a] = 66560,
	[0x13b] = 110592,
	[0x13c] = 82944,
	[0x13d] = 120832,
	[0x13e] = 104448,
	[0x13f] = 114688,
	[0x140] = 139264,
	[0x141] = 70656,
	[0x142] = 122880,
	[0x143] = 97280,
	[0x144] = 88064,
	[0x145] = 95232,
	[0x146] = 93184,
	[0x147] = 94208,
	[0x148] = 99328,
	[0x149] = 63488,
	[0x14a] = 63488,
	[0x14b] = 70656,
	[0x14c] = 66560,
	[0x14d] = 70656,
	[0x14e] = 72704,
	[0x14f] = 80896,
	[0x150] = 75776,
	[0x151] = 105472,
	[0x152] = 113664,
	[0x153] = 94208,
	[0x154] = 109568,
	[0x155] = 59392,
	[0x156] = 82944,
	[0x157] = 101376,
	[0x158] = 84992,
	[0x159] = 66560,
	[0x15a] = 110592,
	[0x15b] = 92160,
	[0x1f4] = 126976,
	[0x1f5] = 118784,
	[0x1f6] = 88064,
	[0x1f7] = 122880,
	[0x1f8] = 96256,
	[0x1f9] = 120832,
	[0x1fa] = 95232,
	[0x1fb] = 99328,
	[0x1fc] = 62464,
	[0x1fd] = 33792,
	[0x1fe] = 37888,
	[0x1ff] = 133120,
	[0x200] = 130048,
	[0x201] = 124928,
	[0x202] = 0,
	[0x258] = 126976,
	[0x259] = 126976,
	[0x25a] = 118784,
	[0x25b] = 118784,
	[0x25c] = 118784,
	[0x25d] = 118784,
	[0x25e] = 88064,
	[0x25f] = 88064,
	[0x260] = 88064,
	[0x261] = 88064,
	[0x262] = 122880,
	[0x263] = 122880,
	[0x264] = 122880,
	[0x265] = 122880,
	[0x266] = 96256,
	[0x267] = 96256,
	[0x268] = 96256,
	[0x269] = 96256,
	[0x26a] = 96256,
	[0x26b] = 96256,
	[0x26c] = 96256,
	[0x26d] = 120832,
	[0x26e] = 120832,
	[0x26f] = 120832,
	[0x270] = 120832,
	[0x271] = 120832,
	[0x272] = 120832,
	[0x273] = 95232,
	[0x274] = 95232,
	[0x275] = 95232,
	[0x276] = 95232,
	[0x277] = 95232,
	[0x278] = 99328,
	[0x279] = 99328,
	[0x27a] = 99328,
	[0x27b] = 99328,
	[0x27c] = 99328,
	[0x27d] = 99328,
	[0x27e] = 62464,
	[0x27f] = 62464,
	[0x280] = 62464,
	[0x281] = 62464,
	[0x282] = 62464,
	[0x283] = 62464,
	[0x284] = 133120,
	[0x285] = 133120,
	[0x286] = 133120,
	[0x287] = 133120,
	[0x288] = 133120,
	[0x289] = 130048,
	[0x28a] = 130048,
	[0x28b] = 130048,
	[0x28c] = 130048,
	[0x28d] = 130048,
	[0x28e] = 124928,
	[0x28f] = 124928,
	[0x290] = 124928,
	[0x291] = 124928,
	[0x292] = 124928,
	[0x293] = 124928,
	[0x294] = 124928,
	[0x2eb] = 79872,
	[0x2ec] = 120832,
	[0x2ed] = 120832,
	[0x2ee] = 104448,
	[0x2ef] = 114688,
	[0x2f0] = 139264,
	[0x2f1] = 139264,
	[0x2f2] = 139264,
	[0x2f3] = 139264,
	[0x2f4] = 93184,
	[0x2f5] = 93184,
	[0x2f6] = 113664,
	[0x2f7] = 113664,
	[0x2f8] = 82944,
	[0x2f9] = 101376,
	[0x2fa] = 94208,
	[0x2fb] = 94208,
	[0x2fc] = 105472,
	[0x301] = 0,
	[0x302] = 0,
	[0x303] = 0,
	[0x304] = 0,
	[0x305] = 0,
	[0x306] = 0,
	[0x307] = 0,
	[0x308] = 33792,
	[0x309] = 33792,
	[0x30a] = 37888,
	[0x30b] = 37888,
	[0x320] = 49152,
	[0x321] = 114688,
	[0x384] = 36864
}


function printf(...) print(string.format(...)) end
function printhex(string, hex) 
    if hex == nil then
        print(string .. ": nil")
    else
        printf("%s: %#.8x", string, hex)
    end
end
reg = memory.getregister
regw = memory.setregister
read8 = memory.readbyte
write8 = memory.writebyte
read16 = memory.readword
read32 = memory.readdword

BT = {}   -- table for BT positions
lowbyte = nil
highbyte = nil
-- My attempt at 64 bit multiplication with 16 bit math
-- https://tasvideos.org/UserFiles/ForUser/TKG
-- The original code is available below.
-- If you have any complaints about publication, please use discord.
function bt_rand()
    -- BTlowHi_aLo = higher 16 bits of BT's lowbyte * lowbyte of multiplier "a"
    -- BTlowLo_aLo = lower 16 bits of BT's lowbyte * lowbyte of multiplier "a"
    BTlowHi_aLo = bit.rshift(lowbyte, 16) * 0x6C078965
    BTlowLo_aLo = bit.band(lowbyte, 0xFFFF) * 0x6C078965
 
    -- total_1 = lowest 16 bits of BTlowLo_aLo + lower 16 bits of increment "c"
    -- total_2 = carry from total_1 + lower 16 bits of BTlowHi_aLo + middle 16 bits of BTlowLo_aLo + higher 16 bits of increment "c"
    -- total_3 = carry from total_2 + middle 16 bits of BTlowHi_aLo + highest 16 bits of BTlowLo_aLo
    -- total_4 = carry from total_3 + highest 16 bits of BTlowHi_aLo
    total_1 = bit.band(BTlowLo_aLo, 0xFFFF) + 0x9EC3
    total_2 = bit.rshift(total_1, 16) + bit.band(BTlowHi_aLo, 0xFFFF) + bit.rshift(BTlowLo_aLo, 16) + 0x0026
    total_3 = bit.rshift(total_2, 16) + bit.rshift(BTlowHi_aLo, 16) + math.floor(BTlowLo_aLo / 0xFFFFFFFF)
    total_4 = bit.rshift(total_3, 16) + math.floor(BTlowHi_aLo / 0xFFFFFFFF)
 
    -- BTlowHi_aHi = higher 16 bits of BT's lowbyte * highbyte of multiplier "a"
    -- BTlowLo_aHi = lower 16 bits of BT's lowbyte * highbyte of multiplier "a"
    -- BTlow_aHi = combine higher and lower results
    BTlowHi_aHi = bit.rshift(lowbyte, 16) * 0x5D588B65
    BTlowLo_aHi = bit.band(lowbyte, 0xFFFF) * 0x5D588B65
    BTlow_aHi = bit.lshift(BTlowHi_aHi, 16) + BTlowLo_aHi
 
    -- BThighHi_aLo = higher 16 bits of BT's highbyte * lowbyte of multiplier "a"
    -- BThighLo_aLo = lower 16 bits of BT's highbyte * lowbyte of multiplier "a"
    -- BThigh_aLo = combine higher and lower results
    BThighHi_aLo = bit.rshift(highbyte, 16) * 0x6C078965
    BThighLo_aLo = bit.band(highbyte, 0xFFFF) * 0x6C078965
    BThigh_aLo = bit.lshift(BThighHi_aLo, 16) + BThighLo_aLo
 
    -- total_5 = lower 16 bits of BThigh_aLo + lower 16 bits of BTlow_aHi + lower 16 bits of total_3
    -- total_6 = carry from total_5 + higher 16 bits of BThigh_aLo + higher 16 bits of BTlow_aHi + total_4
    total_5 = bit.band(BThigh_aLo, 0xFFFF) + bit.band(BTlow_aHi, 0xFFFF) + bit.band(total_3, 0xFFFF)
    total_6 = bit.rshift(total_5, 16) + bit.rshift(BThigh_aLo, 16) + bit.rshift(BTlow_aHi, 16) + total_4
 
    -- combine higher and lower 16 bits to complete the next highbyte/lowbyte
    lowbyte = bit.bor(bit.lshift(bit.band(total_2, 0xFFFF), 16), bit.band(total_1, 0xFFFF))
    highbyte = bit.bor(bit.lshift(total_6, 16), bit.band(total_5, 0xFFFF))
 
    return highbyte
 
 end

 -- getResult: calculate the percentage/healing value from the output
-- rand = BT output
-- ratio = 100 for percentage or 10 for heal/hoimi spell
function getResult(rand, ratio)

    result = rand / ((2 ^ 32) / ratio)
 
    if result < 0 then result = result + ratio end -- signed to unsigned
 
    if ratio == 100 then
       return result
    elseif ratio == 10 then
       return math.floor(result + 0.5) + 30 -- base hoimi = 30 (rounded to nearest whole number)
    end
 
 end

 --FUN_02075488
 function getPercent(position, max)
    return math.floor(getResult(BT[position], 100) / 100 * max)
 end
 
 -- This is a function to simplify "((value << lshift) & 0xFFFFFFFF) >> rshift"
 function extractNumbers(value, lshift, rshift)
    return bit.rshift(bit.band(bit.lshift(value, lshift), 0xFFFFFFFF), rshift)
 end

function processEnc(monsterId, encTable_, spawnedTable)
    -- printhex("encTable_", encTable_)
    -- printhex("spawnedTable", spawnedTable)
    result1 = {}
    --  Searches memory for encounter information that matches the encounter table and monster ID.
    encAddr = getEncTable_FUN_0209d64c(encTableBaseAddr, monsterId,spawnedTable)
    if encAddr == 0x0 then
        return "error"
    end
    -- Reads the encounter information from memory, which includes 1G probability, 2G probability, 3G probability, minimum number, maximum number, and monster id. This is of the form 0x019D101F.
    encdata = read32(encAddr)
    
    -- Extract the probability of 1G
    probability2G = extractNumbers(encdata, 0xb, 0x1d)
    -- Extract the probability of 2G
    probability3Gdiff = extractNumbers(encdata, 0x8, 0x1d)
    -- 3G probability
    probability3G = probability2G + probability3Gdiff
    -- Extract the probability of 3G
    probabilityMaxdiff = extractNumbers(encdata, 0x5, 0x1d)
    -- maximum random number
    probabilityMax = probability3G + probabilityMaxdiff
    
    -- Extract the minimum number of 1G
    minimum1G = extractNumbers(encdata, 0x11, 0x1d)
    -- Extract the maximum number of 1G
    maximum1G = extractNumbers(encdata, 0xe, 0x1d)


    -- 1 = current location, 2F next current location
	position = 2
    -- Calculate the number how many 1G
    count1G = getPercent(position, maximum1G - minimum1G + 1)
    position = position + 1
    -- 0 + 1 = 1
    count1G = count1G + minimum1G
    result1[1] = {monsterId, count1G}
    -- Calculate the total as it will be used to check if the number of people exceeds the capacity.
    total = count1G

    -- Determines if the encounter is 2G or higher
    groupProbability = getPercent(position, probability2G + probability3Gdiff + probabilityMaxdiff) + 1
    position = position + 1

    -- Determine the number of groups.
    group = 1
    -- 13 > 14
    if groupProbability > probability2G then
        -- 7 < 13
        if probability3G < groupProbability then
            -- 13 <= 14
            if groupProbability <= probabilityMax then
                group = 3
            end
        else
            group = 2
        end
    end


    -- 2G
    if group ~= 1 then
        table, position = processCompanion(encTable_, position)
        if table == "error" then
            print("error no 2!!")
            return"error"
        end
        result1[2] = table
        total = total + table[2]
        
        -- 3G
        if group ~= 2 then
            table, position = processCompanion(encTable_, position)
            if table == "error" then
                print("error no 3!!")
                return "error"
            end
            result1[3] = table
            total = total + table[2]
        end
    end

    -- Remove monsters that exceed the limit on the feed.
    -- Find and read the maximum count from memory.
    fieldMax = 0x5
    fieldMaxaddr = FUN_0209db0c(0x20FDAAC + 0x5c, encTable_)
    if fieldMax ~= 0 then
        fieldMax = extractNumbers(read32(fieldMaxaddr + 0x4), 0x13, 0x1d)
    end

    -- Processing to remove overcapacity
    overCapacity = total - fieldMax;
    if 0 < overCapacity then
        reduce = math.floor(overCapacity / 3)
        if reduce == 0 then
            reduce = 1
        end
        i = 1
        -- Main loop for removing overcapacity.
        while 0 < overCapacity do
            backup = result1[i][2]
            result1[i][2] = result1[i][2] - reduce
            if result1[i][2] <= 0 then
                result1[i][2] = 0
            end
            if i == 1 and result1[i][2] == 0 then
                result1[i][2] = 1
            end
            overCapacity = overCapacity - (backup - result1[i][2])
            i = i + 1
            if result1[i] == nil then
                i = 1
            end
            -- if i == 4 then
            --     i = 1
            -- end
        end
    end
    -- There is BT consumption whose purpose is still unknown.
	if group == 3 then
		-- Swap monsters.
		rand = getPercent(position, 6)
		position = position + 1
		result1 = swapArray(result1, rand)
	elseif group ~= 1 then
    	position = position + 1
	end

	tmpTable = {}
	groupCounter = 0;
	-- Get unique monsters from encounter results.
	for k, encounter in pairs(result1) do
		targetMonsterId, NumberOfMonsters = unpack(encounter)
		if NumberOfMonsters ~= 0 then
			tmpTable[targetMonsterId] = groupCounter
			groupCounter = groupCounter + 1
		end
	end

	-- Calculate the total cost and flag the monster if it exceeds the cost.
	removeMonster = nil
	cost = 0
	for targetMonsterId, counter1 in pairs(tmpTable) do
		cost = cost + costTable[targetMonsterId]
		if cost > 157200 then
			removeMonster = targetMonsterId
		end
	end

	-- Delete all of those monsters.	
	if removeMonster ~= nil then
		for k, encounter in pairs(result1) do
			targetMonsterId, NumberOfMonsters = unpack(encounter)
			if removeMonster == targetMonsterId then
				result1[k][2] = 0
			end
		end
	end
	

    -- To summarize the process, a monster's HP is calculated as "HP * 0.01 * 0.2 + 0.8".
    -- The original processing is "floor(hp * float_rand(0.8, 1.0) + 0.5)", and the optimized expression is used here.
    hps = {}
    for k, encounter in pairs(result1) do
        targetMonsterId, NumberOfMonsters = unpack(encounter)
		i = 0
		hps[k] = {}
		if NumberOfMonsters ~= 0 then
			while i < NumberOfMonsters do
				hps[k][i+1] = math.floor((monstersHp[targetMonsterId] * (getResult(BT[position], 100) * 0.01 * 0.2 + 0.8)) + 0.5)
				position = position + 1
				i = i + 1
			end
		else
			hps[k][i+1] = 0;
			i = i + 1
		end
	end

    

    return result1, position-2, hps
end

-- 入れ替えテーブルの定義
local swapTable = {
    [0] = {1, 2, 3},
    [1] = {1, 3, 2},
    [2] = {1, 2, 3},
    [3] = {1, 3, 2},
    [4] = {1, 3, 2},
    [5] = {1, 2, 3}
}

-- Array swapping function
function swapArray(inputArray, rand)
    -- Select a swap table based on a random number
    local swaps = swapTable[rand % 6]

    -- A new array to store the swap results
    local swappedResult = {}
    for i, swapIndex in ipairs(swaps) do
        swappedResult[i] = inputArray[swapIndex]
    end
    
    return swappedResult
end

-- Calculate companions from BT and encounter table. FUN_0209cd4c has two identical processes that are not converted into functions, so we will convert them into functions here.
-- This is part of FUN_0209cd4c (probably folded by the compiler)
-- enctable_: Current field encounter table
-- position: Now BT Position
-- result: {monsterId, monsterCount}, Now BT Position
function processCompanion(enctable_, position)
    -- Find the base address of the Companion data
    baseaddr = getCompanionTable_FUN_0209d75c(enctable_)
    -- Computes the total probability of Companion
    totalprobability = preAnalysisCompanionTable(baseaddr, encTable_)
    if CompanionTable == 0 then
        return "error", position
    end
    probability = getPercent(position, totalprobability) + 1
    position = position + 1
    -- Finds the address of a companion based on the selected number
    addr = searchCompanionTableByProbability(baseaddr, probability)
    if addr == nil then
        print("error errno 4")
        return "error", position
    end
    -- Read selected Companion data from memory
    data = read32(addr)
    
    monsterId = bit.band(data, 0xfff)
    minimumCount = extractNumbers(data, 0xe, 0x1d)
    maximumCount = extractNumbers(data, 0xb, 0x1d)
    count = getPercent(position, maximumCount - minimumCount + 1)
    position = position + 1
    count = count + minimumCount

    return {monsterId, count}, position
end

-- Calculate the total value by adding up all the appearance rates of each companion. Use this as is as the maximum value for getpercent.
-- This is part of FUN_0209cd4c (probably folded by the compiler)
-- baseaddr: result of getCompanionTable_FUN_0209d75c
-- return: Total probability (int)
function preAnalysisCompanionTable(baseaddr)
    probability = 0
    i = 0
    baseAddr = baseaddr + 0x34
    while i < 6 do
        addr = baseAddr + i * 4
        data = read32(addr)
        -- Probability of this companion
        probability = probability + extractNumbers(data, 0x11, 0x1d)
        i = i + 1
    end
    return probability
end

-- From the selection results, search for the address of matching companion encounter information.
-- see: preAnalysisCompanionTable
-- baseaddr: result of getCompanionTable_FUN_0209d75c
-- need: probability
-- return: Requested companion information
function searchCompanionTableByProbability(baseaddr, need)
    probability = 0
    i = 0
    baseAddr = baseaddr + 0x34
    while i < 6 do
        addr = baseAddr + i * 4
        data = read32(addr)
        -- Probability of this companion
        probability = probability + extractNumbers(data, 0x11, 0x1d)
        if probability >= need then
            return addr
        end
        i = i + 1
    end
    return nil
end

-- I don't quite understand, but it looks for the address of the specified table id from feed related memory
-- field0x5c: 0x20FDAAC + 0x5c
-- requestedTable: Current field encounter table
-- return: Memory address containing monster upper limit information
function FUN_0209db0c(field0x5c, requestedTable)
	counter = 0
	max = read32(field0x5c + 0xc0)
	while true do
		if max <= counter then
			return 0
        end
		address = field0x5c + bit.lshift(counter, 5)
		if requestedTable == read16(address) then
			return address
        end
		counter = counter + 1
	end
end



-- Search for the address of matching information from the base address, monster ID, and spawned table ID.
-- address: 0x020FDBCC
-- need: Encountered monster Id
-- nanikaTableId: spawned Encounter tableId
-- return: Encounter table start address
function getEncTable_FUN_0209d64c(address, need, nanikaTableId)
    counter = 0
    while counter <= 5 do
		now_address = address + counter * 0x4c;
		tableId = read16(now_address)
		if nanikaTableId == tableId then
			base_address = now_address + 0x4;
            i = 0
            while i < 6 do
				target_address = base_address + i * 8;
				lr = read32(target_address);
				tmp = bit.band(lr, 0xfff)
				if need == tmp then
					return target_address;
                end
                i = i + 1
			end
		end
        counter = counter + 1
	end
	return 0
end


-- Finds the specified companion encounter table
-- companionTable: encounter table id
-- return: companion encounter table
function getCompanionTable_FUN_0209d75c(companionTable)
	counter = 0
    while counter <= 5 do
		address = encTableBaseAddr + counter * 0x4c;
		r3 = read16(address)
		if companionTable == r3 then
			return address
        end
        counter = counter + 1
    end
	return 0
end

-- Finds all monster structure start addresses in memory.
-- no arguments
function getMonStructure_FUN_021a321c()
    i=0
    -- if param2 < 1 then
    --     return 0
    -- end
    dynamicArray = {}
    while i <= 0x2f do
        addr = read32(0x020F33D8 + (i + 0x70) * 4 + 8) -- = 0x22F0E58
        if addr ~= 0 then
            id = read16(addr + 0x16a) -- = [0x22f0fc2] = 0x4
            if id ~= 0 then
                dynamicArray[id] = addr
            end
            -- val
            -- --!printhex("a ", val)
            -- if val == param2 then
            -- return addr
            -- end
        end
        i = i + 1
    end
    return dynamicArray
end

-- Conditionally reads data from memory.
-- no arguments
-- return: data
function FUN_0200fc38()
    param1 = 0x020F33D8
    param2 = 0x020F33D8 + 0x371c
    addr1 = read8(param2)
    if -1 < addr1 and addr1 < 0xe9 then
        return read32(param1 + addr1 * 4 + 8)
        
    else
        return 0
    end
end

-- calculate something Required to read field encounter information
-- param1: address
-- return 0xffff etc
function FUN_0204cb9c(param1)
    param1 = read16(param1)
    r0_var5 = bit.band(param1, 0x1f) * 100;
    r0_var7 = r0_var5 + 0x530;
    r3_var9 = r0_var7 + 0x7000
    r0_var10 = bit.rshift(bit.band(bit.lshift(bit.band(param1, 0x3e0), 0xb), 0xFFFFFFFF), 0x10)
    r1_var11 = bit.band((bit.band((r0_var10 * 0xa), 0xFFFFFFFF) + r3_var9),0xFFFFFFFF)
    r0_var14 = r1_var11 + bit.rshift(bit.band(bit.lshift(bit.band(param1, 0x7c00),0x6), 0xFFFFFFFF) ,0x10)
    r0_var16 = bit.rshift(bit.band(bit.lshift(r0_var14,0x10), 0xFFFFFFFF), 0x10)
    return r0_var16
end


function FUN_0209b79c(param1, param2)
    base = read32(param1)
    i = 0
    while i <= read32(param1 + 4) do
        addr = base + i * 0x10
        var2 = read16(addr)
        if param2 == var2 then
            r1_var5 = bit.rshift(bit.band(bit.lshift(read8(addr + 0xe), 0x1a), 0xFFFFFFFF), 0x1c);
            if r1_var5 == 0x8 then
                return 0
            else
                return bit.band(bit.lshift(0x1, r1_var5), 0xFFFFFFFF)
            end
        end
       
        i = i + 1
    end
    return 0
end

function FUN_0209db40(param1, param2, param3)
    -- printhex("p1", param1)
    -- printhex("p2", param2)
    -- printhex("p3", param3)

    if param2 == 0x0 then
        lr_var1 = 0x1;
    else
        lr_var1 = 0x0;
    end
    r3_var3 = 0x0;
    r1_var14 = read32(param1 + 0xc0);
    while r3_var3 < r1_var14 do
        --print(r3_var3)
        r12_var4 = param1 + r3_var3 * 0x20 --020FDB08
       
        r1_var5 = read32(r12_var4 + 0x4) --00807120
        --printhex("p7", r1_var5)
        r1_var7 = bit.rshift(bit.band(bit.lshift(r1_var5, 0x1d), 0xFFFFFFFF), 0x1d)
        if lr_var1 == r1_var7 or r1_var7 == 0x2 then
            --if  then
                r1_var8 = read32(r12_var4 + 0x4)
                --printhex("l", bit.band(bit.lshift(r1_var8, 0xb), 0xFFFFFFFF))
                tmp = bit.band(bit.rshift(bit.band(bit.lshift(r1_var8, 0xb), 0xFFFFFFFF), 0x18), param3)
                --printhex("a", tmp)
                if tmp ~= 0 then
                    return r12_var4
                end
            --end
        end
        r3_var3 = r3_var3 + 0x1;
    end
    return 0;
end


-- Calculate the difference between chunks, taking into account that ffff returns to 0.
-- Generated by chatGPT3.5
-- input1: 0xFFFF
-- input2: 0
-- return: 1
function calculateTimeDifference(input1, input2)
    local maxCounter = 65536
    local counterDiff = input2 - input1

    if counterDiff >= maxCounter / 2 then
        counterDiff = counterDiff - maxCounter
    elseif counterDiff < -maxCounter / 2 then
        counterDiff = counterDiff + maxCounter
    end

    return counterDiff
end

-- Calculates the relative X and Z distances for the given player and monster, considering the chunks.
-- playerX: player position X 0-16
-- playerZ: player position Z 0-16
-- monsterX: monster position X 0-16
-- monsterZ: monster position Z 0-16
-- chunkDiffX: Difference between chunks X
-- chunkDiffZ: Difference between chunks Z
-- 
-- return: basetestX: calculated X distance
-- return: basetestZ: calculated Z distance
function calculateRelativeDistance(playerX, playerZ, monsterX, monsterZ, chunkDiffX, chunkDiffZ)
    basetestX = playerx-monsterx
    basetestZ = playerz-monsterz
    -- チャンク座標をブロック座標に変換
    -- if chunkDiffX > 0 then
    --     basetestX = 16 - playerX + monsterX
    -- elseif chunkDiffX < 0 then
    --     basetestX = playerX - monsterX
    -- end
    -- if chunkDiffZ > 0 then
    --     basetestZ = 16 - playerz + monsterZ
    -- elseif chunkDiffZ < 0 then
    --     basetestZ = playerz + monsterZ
    -- end
    if chunkDiffX > 0 then
        basetestX = -(16 - playerX + monsterX)
    elseif chunkDiffX < 0 then
        basetestX = (16 + playerX - monsterX)
    end
    if chunkDiffZ > 0 then
        basetestZ = -(16 - playerz + monsterZ)
    elseif chunkDiffZ < 0 then
        basetestZ = (16 + playerz - monsterZ)
    end

    if chunkDiffX > 1 then
        basetestX = basetestX + 16*(-diffchunkx+1)
    elseif chunkDiffX < -1 then
       basetestX = basetestX + 16*(-diffchunkx-1)
    end

    if chunkDiffZ > 1 then
        basetestZ = basetestZ + 16*(-diffchunkz-1)
    elseif chunkDiffZ < -1 then
       basetestZ = basetestZ + 16*(-diffchunkz+1)
    end

    return basetestX, basetestZ
end


-- The value is rounded to 4 decimal places and displayed on the console. For debugging
-- number: float
function print_four_digits(number)
    printf("%.4f", number)
end

-- remnants of debugging
-- var1 = FUN_0200fc38() + 0x114
-- var2 = FUN_0204cb9c(var1)
-- var3 = FUN_0209b79c(0x020F33D8 + 0x468, var2)

-- r0 = FUN_0209db40(0x20FDAAC + 0x5c, read32(0x02107874 + 0x98), var3)
-- printhex("ret2", var3)
-- printhex("020FDB08", r0) -- 020FDB28
-- enc_table = read16(r0)
-- printhex("table", enc_table)
-- table = getMonStructure_FUN_021a321c()

-- for i, value in pairs(table) do
--     --!printhex("value", value)
--     if value ~= 0x0 then
--         enc_table = read16(value+ 0x168)
--     else
--         enc_table = read16(r0)
--     end
--     --!printhex("ret", enc_table)
-- end

-- Converts a number to hex and displays it on the console, superseded by printhex.
-- Generated by chatGPT3.5
-- decimal: 100
-- return: 0x64
function decimalToHex(decimal)
    return string.format("%x", decimal)
end

--!print(read16(0x022bbe48)/4096)
--!print(read16(0x022bbe54)/4096)
--!print(read16(0x022bbe50)/4096)

--!printhex("chunk x",read16(0x022bbe48+2))
--!printhex("chunk y",read16(0x022bbe54+2))
--!printhex("chunk z",read16(0x022bbe50+2))

-- Round to one decimal place and return. It was used in the coordinate display process.
-- number: 1.00001
-- return: 1
function print_digits(number)
    return string.format("%.1f", number)
end

local toggle = true

-- Automatically disable the function when encounters
memory.registerexec(0x0209cd4c, function()
    --enc gen
    toggle = false
end)

-- Automatically enabled when flee succeeds
memory.registerexec(0x021DDE8C, function()
    if reg("r0") == 1 then
        toggle = true
    end
end)

-- Limits the entered value within the specified range.
-- It is used in the number display process
-- Generated by chatGPT3.5
-- input: Number to limit
-- minValue: minimum value
-- maxValue: maximum value
-- return: minValue-maxValue
function restrictInput(input, minValue, maxValue)
    local restrictedInput = math.max(minValue, math.min(maxValue, input))
    return restrictedInput
end
-- Trim the margins
-- Generated by chatGPT3.5
-- s: input string
-- return: Trimmed string
function trim(s)
    return s:match'^%s*(.*%S)' or ''
end
-- Encount table for the current field. It is cached because calculating every frame is too heavy
local enc_table = nil
-- Counter that measures the time it takes to reacquire a field id after the location id has been replaced
local counter = 0
-- Variable to verify that the location id has changed
local previousLocationId = nil
-- Flag to remember that location id is nil
local skipFieldenc = false

-- Main loop of gui processing
-- It is executed at a high frequency.
-- no argument
function main()
    
    buttonInput = bit.band(memory.readbyte(0x04000130), 0xF)

    if buttonInput == 7 then
        count = count + 1
        if count == 1 then toggle = not toggle end
     else
        count = 0
     end
  
     if not toggle then
        return
     end

     highbyte = memory.readdword(0x02108D24) -- read the address for BT's highbyte (32 bits)
     lowbyte = memory.readdword(0x02108D20)  -- read the address for BT's lowbyte (32 bits)
     BT[1] = highbyte                        -- add the current highbyte value to the table as position 0
     BT[2] = bt_rand(highbyte, lowbyte)      -- calculate and add position 1 to the table

     for i = 3, 90 do BT[i] = bt_rand() end -- calculate and add positions 2-89 to the table

     -- Check to see if the location id has changed, and if so, schedule a reacquisition.
     locationId = read16(FUN_0200fc38() + 0x114)
     if previousLocationId ~= locationId then
        previousLocationId = locationId
        enc_table = nil
        counter = 100
        skipFieldenc = false
     end
     -- Decrements the reservation counter
     counter = counter - 1

     -- If the retrieval counter is less than or equal to 0, the field id is nil, and the current field id is not flagged as always nil, perform a retrieval of the field id.
     if skipFieldenc == false and enc_table == nil and counter < 0 then
        var1 = FUN_0200fc38() + 0x114
        var2 = FUN_0204cb9c(var1)
        var3 = FUN_0209b79c(0x020F33D8 + 0x468, var2)
        r0 = FUN_0209db40(0x20FDAAC + 0x5c, read32(0x02107874 + 0x98), var3)
        if r0 ~= 0 then
            enc_table = read16(r0)
        else
            skipFieldenc = true
        end
     end
    
    -- Fills the upper screen with black
    gui.box(-10, -256, 256, 192, 255, 0)
    -- Get player coordinates
    playerx = read16(0x022bbe48)/4096
    playery = read16(0x022bbe4c)/4096
    playerz = read16(0x022bbe50)/4096

    -- Get player chunk coordinates
    playerchunkx = read16(0x022bbe48+2)
    playerchunky = read16(0x022bbe4c+2)
    playerchunkz = read16(0x022bbe50+2)

    -- Draws the current field id to the screen.
    tmp = enc_table
    if enc_table ~= nil then
        tmp = decimalToHex(enc_table)
    end

	fieldMax = nil
	if enc_table ~= nil then
		fieldMax = 0x5
		fieldMaxaddr = FUN_0209db0c(0x20FDAAC + 0x5c, enc_table)
		if fieldMax ~= 0 then
			fieldMax = extractNumbers(read32(fieldMaxaddr + 0x4), 0x13, 0x1d)
		end
	end

    gui.text(160, -10,"max: ".. tostring(fieldMax) ..", L: " .. tostring(tmp),"#CCCCCC", "clear")

    outofRange = {}
    x = 0
    y = -190
    -- Get all starting positions of monster structures
    table = getMonStructure_FUN_021a321c()
    for i, value in pairs(table) do
        -- Get the monster's coordinates.
        monsterx = read16(value+0x44)/4096
        monstery = read16(value+0x54)/4096
        monsterz = read16(value+0x4c)/4096

        -- Get the monster's id
        monsterId = read16(value+0x2)
        -- Get the spawned table of monsters
        spawnedTable = read16(value+0x168)

        px = 125
        py = 100
        -- Calculate the difference between the chunks.
        diffchunkx = calculateTimeDifference(playerchunkx, read16(value+0x46))
        diffchunky = calculateTimeDifference(playerchunky, read16(value+0x56))
        diffchunkz = calculateTimeDifference(playerchunkz, read16(value+0x4E))
        -- Calculates the relative X and Z distances between a player and a monster
        relativeDistanceX, relativeDistanceZ = calculateRelativeDistance(playerx,playerz,monsterx,monsterz,diffchunkx,diffchunkz)
        -- Flag to keep off-screen or on-screen
        outofRange = false
        -- Only monsters in the surrounding 8 chunks are processed. For some reason removing this causes a bug.
		diffx = relativeDistanceX
		diffz = relativeDistanceZ

		-- The magnification varies depending on the screen position, so process them individually.
		offsetX = (diffx*40)
		offsetZ = (diffz*11)
		if diffz < -12 then
			offsetX = (diffx*45)
			offsetZ = (diffz*20)
			--!print(i .. ", 1")
		elseif diffz < -9 then
			offsetX = (diffx*40)
			offsetZ = (diffz*17)
			--!print(i .. ", 2")
		elseif diffz < -4 then
			offsetX = (diffx*40)
			offsetZ = (diffz*17)
			--!print(i .. ", 3")
		elseif diffz < -2 then
			offsetX = (diffx*35)
			offsetZ = (diffz*14)
			--!print(i .. ", 4")
		elseif diffz < -1 then
			offsetX = (diffx*26)
			offsetZ = (diffz*10)
			--!print(i .. ", 5")
		elseif diffz < 0 then
			offsetX = (diffx*26)
			offsetZ = (diffz*10)
			--!print(i .. ", 6")
		elseif diffz < 2 then
			offsetX = (diffx*25)
			offsetZ = (diffz*16)
			--!print(i .. ", 6")
		elseif diffz < 4 then
			offsetX = (diffx*20)
			offsetZ = (diffz*14)
			--!print(i .. ", 7")
		elseif diffz < 5 then
			offsetX = (diffx*22)
			offsetZ = (diffz*12)
			--!print(i .. ", 8")
		elseif diffz < 7 then
			offsetX = (diffx*20)
			offsetZ = (diffz*10)
			--!print(i .. ", 9")
		elseif diffz < 9 then
			offsetX = (diffx*18)
			offsetZ = (diffz*10)
			--!print(i .. ", 10")
		elseif diffz < 12 then
			offsetX = (diffx*16)
			offsetZ = (diffz*9)
			--!print(i .. ", 11")
		elseif diffz < 16 then
			offsetX = (diffx*14)
			offsetZ = (diffz*8)
			--!print(i .. ", 12")
		elseif diffz < 20 then
			offsetX = (diffx*18)
			offsetZ = (diffz*7)
			--!print(i .. ", 13")
		elseif diffz < 32 then
			offsetX = (diffx*18)
			offsetZ = (diffz*6)
			--!print(i .. ", 13")
		end

		-- Calculate the monster position on the display by subtracting the calculated offset from the player's location at X125, Y100
		baseGuix = 125-offsetX
		baseGuiz = 100-offsetZ
		-- Limits the value so that monsters that are off the screen fit within the screen
		guix = restrictInput(baseGuix,0,240)
		guiz = restrictInput(baseGuiz,0,180)
		-- Determine if it is off-screen
		outofRange = false
		if baseGuix == guix and baseGuiz == guiz then
			outofRange = true
		end
		-- Displays only monsters on the screen while taking into account overflow settings
		if overflow or outofRange then
			gui.text(guix, guiz, tostring(i), "#CCCCCC", "clear")
		end
		-- Encounter emulation will be performed only for monsters on the screen.
		if outofRange then
			-- If the field encounter id is nil (e.g. cave), pass the spawned table; otherwise, pass the field encounter table as the table for mate determination
			if enc_table == nil then
				table, position, hps = processEnc(monsterId, spawnedTable, spawnedTable)
			else
				table, position, hps = processEnc(monsterId, enc_table, spawnedTable)
			end

			-- error handling
			if table == "error" then
				print("error")
				return
			end

			-- Process the results to build a string to display in the gui
			string = ""
			bool = false
			addY = 20
			for k, encounter in pairs(table) do
				targetMonsterId, NumberOfMonsters = unpack(encounter)
				
				string = string .. monsters[targetMonsterId] .. " x" .. NumberOfMonsters .. " "
				
				hpstring = "( "
				for j, hp in pairs(hps[k]) do
					hpstring = hpstring .. tostring(hp) .. " "
				end
				hpstring = trim(hpstring) .. " )"
				string = string .. hpstring .. "\n     "
				addY = addY + 10
				-- if not bool and #string > 15 then
					
				--     addY = addY + 10
				--     bool = true
				-- end
			end
			string = string .. "BT Consumed: " .. position .. " ( " .. (position + 4) .." )"
			--print(string)
			gui.text(x, y, i..": "..string,"#CCCCCC", "clear")
			y = y + addY
		end
    end
end

gui.register(main)

