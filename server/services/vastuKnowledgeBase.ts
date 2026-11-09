/**
 * ARCHORA VASTUVISION KNOWLEDGE BASE
 * 
 * Sourced classical Indian Vastu Shastra principles compiled with historical
 * attribution and modern bioclimatic/architectural rationales.
 * 
 * Sources:
 * - Manasara (Treatise on Architecture and Sculpture, ca. 5th-7th century CE)
 * - Mayamata (Treatise of Housing, Architecture and Iconography)
 * - Brihat Samhita (Varahamihira, 6th century CE, Vastu-vidya chapters)
 * - Samarangana Sutradhara (King Bhoja of Dhar, 11th century CE)
 * - Vishvakarma Prakash (Classical Craftsman and Builder's Manual)
 */

export interface VastuRule {
  id: string;
  rule_id: string;
  topic: string;
  direction: 'North' | 'North-East' | 'East' | 'South-East' | 'South' | 'South-West' | 'West' | 'North-West' | 'Center';
  space_type: string;
  recommendation: string;
  explanation: string;
  source_reference: string;
  tradition: 'Manasara' | 'Mayamata' | 'Brihat Samhita' | 'Samarangana Sutradhara' | 'Vishvakarma Prakash' | 'General Classical';
  variations?: string;
  confidence_level: 'Traditional Classical' | 'Common Practice' | 'Unverified/Modern Extension';
  architectural_rationale: string;
  favorable_directions: string[];
  unfavorable_directions: string[];
}

export const VASTU_DIRECTIONS = [
  {
    id: 'North',
    name: 'North (Uttara)',
    deity: 'Kubera (Lord of Wealth & Prosperity)',
    element: 'Water / Space (Jala / Akasha)',
    degrees: 0,
    sectorAngleStart: 337.5,
    sectorAngleEnd: 22.5,
    color: '#0284c7', // sky
    qualities: 'Receptivity, financial prosperity, cool ambient light, calmness',
    bioclimatic: 'In northern hemisphere, provides consistent, indirect, cool daylight without excessive heat gain or thermal glare.',
    favorableSpaces: ['Main entrance', 'Living room', 'Study room', 'Balcony / Veranda', 'Treasury / Office']
  },
  {
    id: 'North-East',
    name: 'North-East (Ishanya)',
    deity: 'Ishana (Aspect of Shiva / Supreme Consciousness)',
    element: 'Water (Jala) / Pure Ether',
    degrees: 45,
    sectorAngleStart: 22.5,
    sectorAngleEnd: 67.5,
    color: '#0d9488', // teal
    qualities: 'Spiritual clarity, intellect, purity, highest sanctity, morning serenity',
    bioclimatic: 'Captures early morning infrared and gentle ultraviolet sunlight, fostering natural sterilization and high psychological alertness.',
    favorableSpaces: ['Prayer room', 'Meditation space', 'Underground water sump', 'Study room', 'Open porch / Veranda']
  },
  {
    id: 'East',
    name: 'East (Purva)',
    deity: 'Indra (Ruler of Heavens) & Surya (Sun)',
    element: 'Fire / Solar Light (Agni / Tejas)',
    degrees: 90,
    sectorAngleStart: 67.5,
    sectorAngleEnd: 112.5,
    color: '#f59e0b', // amber
    qualities: 'Vitality, beginnings, physical health, clarity of purpose',
    bioclimatic: 'First diurnal solar exposure; ideal for daylighting living quarters and study spaces before intense afternoon heat accumulates.',
    favorableSpaces: ['Main entrance', 'Living room', 'Study room', 'Dining area', 'Balcony']
  },
  {
    id: 'South-East',
    name: 'South-East (Agneya)',
    deity: 'Agni (Lord of Fire)',
    element: 'Fire (Agni / Tejas)',
    degrees: 135,
    sectorAngleStart: 112.5,
    sectorAngleEnd: 157.5,
    color: '#ea580c', // orange
    qualities: 'Thermal transformation, digestive metabolic energy, kinetic vigor',
    bioclimatic: 'In South Asia, prevailing microclimatic winds generally disperse smoke and cooking odors away from the living core; morning sun dries dampness.',
    favorableSpaces: ['Kitchen', 'Electrical room / Meter', 'Inverter / Generator', 'Heating installations']
  },
  {
    id: 'South',
    name: 'South (Dakshina)',
    deity: 'Yama (Lord of Order & Justice)',
    element: 'Earth / Heavy Mass (Prithvi)',
    degrees: 180,
    sectorAngleStart: 157.5,
    sectorAngleEnd: 202.5,
    color: '#b45309', // warm bronze
    qualities: 'Stability, discipline, retention, endurance',
    bioclimatic: 'High solar insolation in the northern hemisphere; functions best as thermal buffer zone with thicker masonry walls or storage.',
    favorableSpaces: ['Bedroom', 'Staircase', 'Storage room', 'Office']
  },
  {
    id: 'South-West',
    name: 'South-West (Nairutya)',
    deity: 'Nirrti (Guardian of Earth & Strength)',
    element: 'Earth (Prithvi) / Densest Mass',
    degrees: 225,
    sectorAngleStart: 202.5,
    sectorAngleEnd: 247.5,
    color: '#78350f', // deep earth espresso
    qualities: 'Authority, grounding, load-bearing mastery, permanence, rest',
    bioclimatic: 'Highest afternoon thermal heat loading (south-west sun); requires maximum structural mass, heavy storage, or overhead tanks to buffer the home.',
    favorableSpaces: ['Master bedroom', 'Heavy storage', 'Overhead water tank', 'Principal office / Workspace']
  },
  {
    id: 'West',
    name: 'West (Pashchima)',
    deity: 'Varuna (Lord of Cosmic Waters & Twilight)',
    element: 'Water / Atmospheric Air',
    degrees: 270,
    sectorAngleStart: 247.5,
    sectorAngleEnd: 292.5,
    color: '#6366f1', // indigo
    qualities: 'Reflection, harvest, nourishment, introspection',
    bioclimatic: 'Late afternoon sun; suitable for gathering, dining, children’s study, or service access with appropriate shading louvers.',
    favorableSpaces: ['Dining area', "Children's bedroom", 'Study room', 'Overhead storage', 'Staircase']
  },
  {
    id: 'North-West',
    name: 'North-West (Vayavya)',
    deity: 'Vayu (Lord of Wind & Movement)',
    element: 'Air (Vayu)',
    degrees: 315,
    sectorAngleStart: 292.5,
    sectorAngleEnd: 337.5,
    color: '#059669', // emerald
    qualities: 'Mobility, circulation, transition, communication, exchange',
    bioclimatic: 'Dynamic airflow zone; excellent for active cross-ventilation, transitional guests, auxiliary kitchens, and utilities.',
    favorableSpaces: ['Guest bedroom', "Children's bedroom", 'Auxiliary kitchen / Pantry', 'Bathroom / Toilet', 'Vehicular parking']
  },
  {
    id: 'Center',
    name: 'Center (Brahmasthan)',
    deity: 'Brahma (The Cosmic Creator)',
    element: 'Space / Ether (Akasha)',
    degrees: 0,
    sectorAngleStart: 0,
    sectorAngleEnd: 360,
    color: '#854d0e', // gold/ochre
    qualities: 'Equilibrium, expansion, central axis, luminous core',
    bioclimatic: 'The central courtyard (angan) promotes the stack ventilation effect, pulling hot air upward and circulating cool air into all surrounding rooms.',
    favorableSpaces: ['Central open courtyard', 'Lobby / Atrium', 'Meditation hall (unobstructed)']
  }
];

export const VASTU_RULES_CATALOG: VastuRule[] = [
  // 1. MAIN ENTRANCE
  {
    id: 'vr_ent_01',
    rule_id: 'VR-ENTRANCE-NE-E',
    topic: 'Main Entrance & Threshold',
    direction: 'North-East',
    space_type: 'Main entrance',
    recommendation: 'Position main entrance toward North, North-East, or East sectors (specifically auspicious Padas like Jayanta, Indra, or Mukhya).',
    explanation: 'The primary threshold serves as the main gateway for prana (vital environmental energy) and welcomes morning solar radiation.',
    source_reference: 'Manasara, Chapter 9 ("Dvara-Lakshana"); Brihat Samhita, Chapter 53, Verse 70',
    tradition: 'Manasara',
    variations: 'Southern entrance is traditionally restrained for residential use in Manasara, but Mayamata permits regulated southern entry when aligned with Vitatha/Pushpaka padas for civic buildings.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'East and North entries avoid harsh western afternoon glare while optimizing natural morning lighting and welcoming entry temperatures.',
    favorable_directions: ['North-East', 'East', 'North'],
    unfavorable_directions: ['South-West', 'South']
  },

  // 2. KITCHEN
  {
    id: 'vr_kit_01',
    rule_id: 'VR-KITCHEN-SE',
    topic: 'Cooking & Fire Apparatus',
    direction: 'South-East',
    space_type: 'Kitchen',
    recommendation: 'Locate the principal kitchen cooking station in the South-East (Agni sector) facing East while cooking.',
    explanation: 'The South-East is governed by Agni (Fire). Cooking here aligns the culinary hearth with the solar-thermal quadrant of the building.',
    source_reference: 'Mayamata, Chapter 12 ("Dwelling Layouts"); Vishvakarma Prakash, Chapter 2, Verse 45',
    tradition: 'Mayamata',
    variations: 'North-West (Vayu quadrant) is recognized as an acceptable secondary alternative when South-East is constrained by site boundaries.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'In Indian climates, morning sun in the East-South-East sterilizes moisture and mold, while prevailing winds carry kitchen combustion and cooking aromas away from the living core.',
    favorable_directions: ['South-East', 'North-West'],
    unfavorable_directions: ['North-East', 'South-West', 'Center']
  },

  // 3. MASTER BEDROOM
  {
    id: 'vr_bed_master_01',
    rule_id: 'VR-MASTER-BED-SW',
    topic: 'Master Bedroom & Head of Household',
    direction: 'South-West',
    space_type: 'Master bedroom',
    recommendation: 'Place the master bedroom in the South-West quadrant (Nairutya), with the bed headboard positioned towards South or East.',
    explanation: 'The South-West represents stability, mass, and earth energy, imparting sound restful sleep and structural stewardship.',
    source_reference: 'Brihat Samhita, Chapter 53 ("Vastu-Vidya"); Samarangana Sutradhara, Chapter 24',
    tradition: 'Brihat Samhita',
    variations: 'Some later manuals permit South or West sectors if the South-West corner is dedicated to heavy wardrobe or storage masonry.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'South-West bedrooms benefit from heavy thermal mass which absorbs daytime heat and releases it slowly at night in cooler seasons, providing privacy away from active public entrances.',
    favorable_directions: ['South-West', 'South'],
    unfavorable_directions: ['North-East', 'South-East', 'Center']
  },

  // 4. CHILDREN'S BEDROOM
  {
    id: 'vr_bed_child_01',
    rule_id: 'VR-CHILD-BED-W-NW',
    topic: "Children's Quarters & Youth",
    direction: 'West',
    space_type: "Children's bedroom",
    recommendation: "Locate children's bedrooms in the West or North-West quadrant, maintaining clear natural light for studying.",
    explanation: 'West represents intellectual cultivation and Varuna’s balance, while North-West supports healthy movement and active learning.',
    source_reference: 'Vishvakarma Prakash, Chapter 5, Sloka 18; Manasara, Chapter 11',
    tradition: 'Vishvakarma Prakash',
    variations: 'East quadrant is also favorable for young students during foundational years.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'West quarters provide ample late-afternoon illumination for homework and separate children’s dynamic activity from master sleeping quarters.',
    favorable_directions: ['West', 'North-West', 'East'],
    unfavorable_directions: ['South-West', 'Center']
  },

  // 5. GUEST BEDROOM
  {
    id: 'vr_bed_guest_01',
    rule_id: 'VR-GUEST-BED-NW',
    topic: 'Guest Quarters & Hospitality',
    direction: 'North-West',
    space_type: 'Guest bedroom',
    recommendation: 'Situate guest quarters in the North-West (Vayavya) direction.',
    explanation: 'The wind deity Vayu promotes non-attachment, transitional stays, dynamic hospitality, and timely turnover.',
    source_reference: 'Samarangana Sutradhara, Chapter 28, Verse 12',
    tradition: 'Samarangana Sutradhara',
    variations: 'North-East guest rooms are discouraged as guests should not overlook sanctified private shrines.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Allows distinct circulation paths for visitors without disturbing the private core zones of family members.',
    favorable_directions: ['North-West', 'North'],
    unfavorable_directions: ['South-West', 'Center']
  },

  // 6. PRAYER ROOM (PUJA)
  {
    id: 'vr_puj_01',
    rule_id: 'VR-PUJA-NE',
    topic: 'Sacred Sanctuary & Meditation',
    direction: 'North-East',
    space_type: 'Prayer room',
    recommendation: 'Position the prayer or meditation space in the North-East (Ishanya) corner, keeping the area uncluttered, quiet, and well-lit.',
    explanation: 'Ishanya is the cosmic directional node linking heavenly celestial influence with worldly dwellings; the deity Ishana presides here.',
    source_reference: 'Manasara, Chapter 9; Brihat Samhita, Chapter 53, Verse 72',
    tradition: 'Manasara',
    variations: 'If North-East is unavailable, East or North orientation for the altar is accepted in Mayamata.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'North-East is the quietest sector in morning hours, receiving dawn sunlight without afternoon thermal load or kitchen aromas.',
    favorable_directions: ['North-East', 'East', 'North'],
    unfavorable_directions: ['South-West', 'South', 'South-East', 'Below Staircase', 'Adjacent to Toilet']
  },

  // 7. LIVING ROOM / RECEPTION
  {
    id: 'vr_liv_01',
    rule_id: 'VR-LIVING-NE-N-E',
    topic: 'Living Room & Public Gathering',
    direction: 'North',
    space_type: 'Living room',
    recommendation: 'Locate the formal living and reception space in North, North-East, or East zones.',
    explanation: 'Public gathering spaces welcome social vitality and daylight, making them ideal interfaces between the exterior and interior.',
    source_reference: 'Mayamata, Chapter 14 ("Civic and Domestic Halls")',
    tradition: 'Mayamata',
    variations: 'Large homes may feature living spaces in the West zone when opening onto sunset verandas.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Easy access from main entrance, high natural ventilation, and optimal illumination for social interactions.',
    favorable_directions: ['North', 'North-East', 'East', 'North-West'],
    unfavorable_directions: ['South-West']
  },

  // 8. DINING AREA
  {
    id: 'vr_din_01',
    rule_id: 'VR-DINING-W-E',
    topic: 'Dining Space & Sustenance',
    direction: 'West',
    space_type: 'Dining area',
    recommendation: 'Place the dining space in the West (Varuna sector) or East sector adjacent to the kitchen.',
    explanation: 'Varuna governs bodily sustenance and equilibrium; dining in the West or East fosters peaceful digestion.',
    source_reference: 'Vishvakarma Prakash, Chapter 4, Verse 22',
    tradition: 'Vishvakarma Prakash',
    variations: 'Southern dining is accepted if visually buffered from the entrance.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Direct functional proximity to kitchen, minimizing circulation distance for food handling while avoiding direct view from outside guests.',
    favorable_directions: ['West', 'East', 'South-East'],
    unfavorable_directions: ['South-West corner']
  },

  // 9. STUDY ROOM / LIBRARY
  {
    id: 'vr_stu_01',
    rule_id: 'VR-STUDY-NE-E-N',
    topic: 'Study Room, Library & Studio',
    direction: 'North-East',
    space_type: 'Study room',
    recommendation: 'Locate study spaces, library desks, and architectural drafting stations in North-East, North, or East quadrants.',
    explanation: 'These directions facilitate memory, intellectual clarity, and sustained focus under the blessings of Saraswati and Kubera.',
    source_reference: 'Brihat Samhita, Chapter 53, Verse 85; Manasara, Chapter 15',
    tradition: 'Brihat Samhita',
    variations: 'West is also favored for senior scholars pursuing contemplative writing.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Provides glare-free northern ambient light, eliminating eye strain during drafting, reading, and computer monitor use.',
    favorable_directions: ['North-East', 'North', 'East', 'West'],
    unfavorable_directions: ['South-West', 'South-East']
  },

  // 10. BATHROOM & WATER CLOSET
  {
    id: 'vr_bat_01',
    rule_id: 'VR-BATHROOM-NW-W',
    topic: 'Sanitation, Waste & Ablution',
    direction: 'North-West',
    space_type: 'Bathroom',
    recommendation: 'Position bathrooms and water closets in the North-West (Vayavya) or West sectors; strictly avoid North-East, South-West, and Center.',
    explanation: 'Waste elimination belongs to dynamic cleansing air (Vayu); locating toilets in Ishanya (sacred) or Nairutya (heavy earth) disrupts purity and health.',
    source_reference: 'Mayamata, Chapter 12; Samarangana Sutradhara, Chapter 25',
    tradition: 'Mayamata',
    variations: 'East is permitted for bathing only (Snana-griha with morning sun) provided wastewater drains properly away from sanctified rooms.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'North-West orientation allows sanitary plumbing stacks on external perimeter walls, enabling cross-ventilation and preventing sewer gas ingress into living quarters.',
    favorable_directions: ['North-West', 'West', 'South'],
    unfavorable_directions: ['North-East', 'South-West', 'Center']
  },

  // 11. STAIRCASE
  {
    id: 'vr_str_01',
    rule_id: 'VR-STAIRCASE-S-SW-W',
    topic: 'Vertical Circulation & Structural Load',
    direction: 'South-West',
    space_type: 'Staircase',
    recommendation: 'Construct staircases in the South, South-West, or West sectors, rising in a clockwise (pradakshina) direction.',
    explanation: 'Staircases represent heavy structural dead weight and vertical movement, which belongs in the heavy, grounding earth sectors.',
    source_reference: 'Vishvakarma Prakash, Chapter 7, Verse 14; Manasara, Chapter 13',
    tradition: 'Vishvakarma Prakash',
    variations: 'North-West is acceptable as a secondary staircase location for service and fire egress.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Concentrating heavy concrete/masonry staircases on the South-West provides essential seismic bracing and sun shading against the harsh afternoon sun.',
    favorable_directions: ['South-West', 'South', 'West'],
    unfavorable_directions: ['North-East', 'Center']
  },

  // 12. WATER STORAGE (UNDERGROUND VS OVERHEAD)
  {
    id: 'vr_wat_01',
    rule_id: 'VR-WATER-STORAGE',
    topic: 'Hydrological Systems & Reservoirs',
    direction: 'North-East',
    space_type: 'Water storage',
    recommendation: 'Underground sumps, borewells, and rainwater harvesting cisterns should be in North-East; overhead tanks must be in South-West.',
    explanation: 'Underground depression belongs to light, sacred water sectors (Ishanya). Heavy elevated overhead weight belongs to the heavy earth quadrant (Nairutya).',
    source_reference: 'Brihat Samhita, Chapter 54 ("Dakargala" - Ground water divination & storage); Mayamata, Chapter 10',
    tradition: 'Brihat Samhita',
    variations: 'North-West is an acceptable secondary site for utility septic tanks, never North-East.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Overhead tanks on the South-West roof cast long cooling shadows across the roof slab, significantly reducing the residential cooling load in tropical regions.',
    favorable_directions: ['North-East', 'South-West', 'North'],
    unfavorable_directions: ['South-East', 'Center']
  },

  // 13. CENTRAL OPEN COURTYARD (BRAHMASTHAN)
  {
    id: 'vr_bra_01',
    rule_id: 'VR-BRAHMASTHAN-CORE',
    topic: 'The Sacred Core & Courtyard',
    direction: 'Center',
    space_type: 'Garden and open spaces',
    recommendation: 'Preserve the central Brahmasthan (central 1/9th of the plan) as an open, unencumbered space free of heavy columns, toilets, or kitchens.',
    explanation: 'The Brahmasthan is the navel of the Vastu Purusha, where space energy circulates freely to feed all surrounding quadrants.',
    source_reference: 'Manasara, Chapter 7; Brihat Samhita, Chapter 53, Verse 64',
    tradition: 'Manasara',
    variations: 'In compact modern apartments where a full central open courtyard is impossible, keeping the central hallway clear, light, and well-ventilated fulfills the intention.',
    confidence_level: 'Traditional Classical',
    architectural_rationale: 'Central courtyards are the hallmark of vernacular passive cooling, creating a microclimatic chimney effect that evacuates warm air while funneling daylight into interior rooms.',
    favorable_directions: ['Center', 'North', 'East'],
    unfavorable_directions: ['South-West', 'Heavy columns in center']
  }
];
