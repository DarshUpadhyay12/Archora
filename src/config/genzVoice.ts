/**
 * Archora Studio — Gen-Z Architectural Voice & Microcopy System
 * 
 * Creative Balance: 75% Premium Architectural Rigor + 25% Relatable Gen-Z Studio Humor.
 * Designed to provide an authentic, humorous, and empathetic digital companion
 * for architecture students navigating all-nighters, jury roasts, and revision fatigue.
 */

export interface GenZVoiceConfig {
  taglines: {
    heroKicker: string;
    heroHeadline: string;
    heroSubtitle: string;
    heroPills: string[];
    model3dTitle: string;
    model3dSubtitle: string;
    model3dAction: string;
  };
  pageHeaders: {
    tutor: { title: string; subtitle: string; kicker: string };
    concepts: { title: string; subtitle: string; kicker: string };
    jury: { title: string; subtitle: string; kicker: string };
    vastu: { title: string; subtitle: string; kicker: string };
    projects: { title: string; subtitle: string; kicker: string };
    files: { title: string; subtitle: string; kicker: string };
    history: { title: string; subtitle: string; kicker: string };
    drive: { title: string; subtitle: string; kicker: string };
    profile: { title: string; subtitle: string; kicker: string };
    login: { title: string; subtitle: string; kicker: string };
    about: { title: string; subtitle: string; kicker: string };
    features: { title: string; subtitle: string; kicker: string };
    howItWorks: { title: string; subtitle: string; kicker: string };
    gallery: { title: string; subtitle: string; kicker: string };
    contact: { title: string; subtitle: string; kicker: string };
  };
  loadingMessages: {
    general: string;
    tutor: string;
    concept: string;
    jury: string;
    vastu: string;
    exportPdf: string;
    syncDrive: string;
    files: string;
  };
  emptyStates: {
    projects: { title: string; message: string; action: string };
    files: { title: string; message: string; action: string };
    chat: { title: string; message: string; action: string };
    history: { title: string; message: string; action: string };
    search: { title: string; message: string };
    vastu: { title: string; message: string; action: string };
  };
  toasts: {
    saved: string;
    exported: string;
    copied: string;
    uploaded: string;
    deleted: string;
    error: string;
    quotaExceeded: string;
    offline: string;
  };
  juryCritiques: Array<{
    name: string;
    role: string;
    vibe: string;
    catchphrase: string;
    description: string;
  }>;
  promptChips: {
    tutor: string[];
    concept: string[];
    jury: string[];
    vastu: string[];
  };
  studioMoods: string[];
}

export const GENZ_VOICE: GenZVoiceConfig = {
  taglines: {
    heroKicker: 'STUDIO SURVIVAL WORKSPACE · NO PROFESSOR SIDE-EYE',
    heroHeadline: 'Bro has a concept. Now explain it to the jury. 💀',
    heroSubtitle:
      'From questionable first sketches to final jury presentations, Archora helps you turn architectural chaos into actual buildable design without losing your sanity.',
    heroPills: [
      'Zero-Cost Gemini AI',
      'Local SQLite Vault',
      'No Revit Crashes',
      'Vedic VastuVision',
      'Jury Roast Simulator',
    ],
    model3dTitle: 'Touch grass? Nah. Rotate this building.',
    model3dSubtitle:
      'Orbit the massing, toggle isometric wireframes, or inspect structural glass slabs before your laptop fans hit supersonic jet mode.',
    model3dAction: 'Spin the Monolith',
  },

  pageHeaders: {
    tutor: {
      kicker: 'AI STUDIO TUTOR · 24/7 OFFICE HOURS',
      title: 'Architecture explained without the professor side-eye.',
      subtitle:
        'Ask the questions you were too intimidated to ask in studio review. Grounded in Vitruvian triad, Frampton tectonics, and passive solar physics.',
    },
    concepts: {
      kicker: 'CONCEPT GENERATOR · MAIN CHARACTER ENERGY',
      title: 'No concept? We listen and we don’t judge.',
      subtitle:
        'Feed us your chaotic site parameters, confusing brief requirements, and vague inspirations. We turn them into spatial programs and structural logic.',
    },
    jury: {
      kicker: 'JURY DEFENSE ACCELERATOR · TRIAL BY FIRE',
      title: 'Let’s prepare for your academic interrogation. 💀',
      subtitle:
        'Simulate ruthless studio juries before actual presentation day. Anticipate tough questions, roast-proof your circulation, and nail your defense speech.',
    },
    vastu: {
      kicker: 'VASTUVISION · VEDIC SPATIAL ENGINE',
      title: 'Bestie, first check the north direction. 🧭',
      subtitle:
        'Harmonize your floor plan with traditional Vastu Purusha Mandala principles and the 5 elemental zones (Pancha Bhuta) without sacrificing clean modern architecture.',
    },
    projects: {
      kicker: 'STUDIO REPOSITORY · REVISION VAULT',
      title: 'All your Final_Final_v27 files, finally organised.',
      subtitle:
        'Every semester, every site analysis, every design statement stored locally in your private SQLite vault with zero cloud dependency.',
    },
    files: {
      kicker: 'DOCUMENT VAULT · SAFE STORAGE',
      title: 'Your drawings are safe. Your deadlines aren’t.',
      subtitle:
        'Store blueprints, CAD exports, site photos, and render passes securely on Drive D:. No coffee spills or corrupted flash drives can reach them.',
    },
    history: {
      kicker: 'STUDIO LOGS · ARCHIVE',
      title: 'Remember that idea you had at 3 AM?',
      subtitle:
        'Browse every past AI tutoring dialogue, concept draft, and saved output. Filter by module or resurrect an old thesis thread.',
    },
    drive: {
      kicker: 'GOOGLE DRIVE CLOUD SYNC',
      title: 'Cloud backup because losing your project is not character development.',
      subtitle:
        'One-click encrypted cloud backups to your personal Google Drive. Keep your portfolio safe before submission day panic.',
    },
    profile: {
      kicker: 'ARCHITECT IDENTITY & PREFERENCES',
      title: 'Your studio credentials & architectural sanity settings.',
      subtitle:
        'Manage your profile, adjust parchment warmth, check AI token quotas, and keep your local SQLite database healthy.',
    },
    login: {
      kicker: 'PORTAL AUTHENTICATION',
      title: 'Welcome back, future starchitect.',
      subtitle:
        'Sign in to access your local workspace, project library, and jury preparation archives.',
    },
    about: {
      kicker: 'STUDIO ORIGINS · THE ARCHORA ETHOS',
      title: 'Built by architecture students who survived the studio trenches.',
      subtitle:
        'We combined the timeless craft of classic treatises with modern Gen-Z AI tools to make architecture education inspiring, accessible, and 100% free.',
    },
    features: {
      kicker: 'STUDIO CAPABILITIES · ZERO COST',
      title: 'Every tool you need to cook up an award-winning project.',
      subtitle:
        'From parametric 3D massing and Vastu directional grids to jury defense rehearsals and 1-click Google Drive backups.',
    },
    howItWorks: {
      kicker: 'WORKFLOW EXPLAINER · STEP BY STEP',
      title: 'How Archora turns studio panic into portfolio gold.',
      subtitle:
        'No convoluted setup. Just 1-click Windows launching, zero billing surprises, and intelligent studio companionship.',
    },
    gallery: {
      kicker: 'PORTFOLIO SHOWCASE · DESIGN EXCELLENCE',
      title: 'Curated studio sheets and tectonic precedents.',
      subtitle:
        'Explore copperplate architectural linework, classical orders, and student project precedents crafted within Archora.',
    },
    contact: {
      kicker: 'STUDIO DISPATCH · COMMUNITY',
      title: 'Have feedback, feature requests, or studio trauma to share?',
      subtitle:
        'We read every dispatch from fellow architecture students. Let us know how we can make Archora even more legendary.',
    },
  },

  loadingMessages: {
    general: 'Cooking up the architectural response... let him cook. 🔥',
    tutor: 'Consulting Vitruvius and Frampton at 2 AM... hang tight, bestie.',
    concept: 'Generating structural logic from your chaotic sketch vibes...',
    jury: 'Simulating 3 harsh professors sharpening their red pens... 💀',
    vastu: 'Calculating Mandala quadrants and elemental energy balances...',
    exportPdf: 'Generating presentation portfolio PDF... please do not crash, Acrobat.',
    syncDrive: 'Backing up drawings... character development safeguarded.',
    files: 'Reading drawing vault... keeping blueprints safe and sound.',
  },

  emptyStates: {
    projects: {
      title: 'Nothing here yet. The plot starts with your first project.',
      message:
        'You have not logged any studio projects yet. Create your first project to organize your concepts, files, and jury defenses.',
      action: '+ Start First Project',
    },
    files: {
      title: 'Zero files uploaded. Even your physical tracing paper bin has more.',
      message:
        'Upload your CAD exports, floor plans, section sketches, and 3D renders to keep them safely linked to your projects.',
      action: 'Upload Drawing / File',
    },
    chat: {
      title: 'Silence in the studio. Ask a question or drop a prompt.',
      message:
        'Ask about structural spans, climatic facades, Corbusier’s Five Points, or cantilever physics.',
      action: 'Try Starter Question',
    },
    history: {
      title: 'No 3 AM brainstorms recorded yet.',
      message:
        'Your saved AI tutor sessions and generated concepts will show up here as you work through your design studio.',
      action: 'Launch Studio Tutor',
    },
    search: {
      title: 'No architectural artifacts found.',
      message:
        'We searched your projects, files, and tutor conversations. Try another search term or check spelling.',
    },
    vastu: {
      title: 'No floor plan mapped yet.',
      message:
        'Upload an architectural plan image or click "Design on Blank Vastu Grid" to place room zones and check directional compliance.',
      action: 'Start Vastu Layout',
    },
  },

  toasts: {
    saved: 'Your project has been saved. Character development! 💾',
    exported: 'PDF exported successfully! Look at you, starchitect. 📄',
    copied: 'Copied to clipboard. Ready for WhatsApp or presentation slides.',
    uploaded: 'File vaulted safely. No coffee spills can touch it here. 🛡️',
    deleted: 'Purged cleanly from local database. Rip to that iteration. 💀',
    error: 'A slight structural hiccup occurred. Check console or try again.',
    quotaExceeded:
      'AI quota reached. Even the robot needs a break! (Resets shortly on free tier)',
    offline:
      'Offline mode active. Time to sketch by hand like the ancient masters.',
  },

  juryCritiques: [
    {
      name: 'Prof. Miller',
      role: 'Strict Pragmatist',
      vibe: 'Where do the pipes go, bro? 💀',
      catchphrase: 'Show me the HVAC shaft or this whole cantilever is fictional.',
      description:
        'Demands structural engineering logic, MEP coordination, egress safety, and budget reality.',
    },
    {
      name: 'Ar. Sarah Vance',
      role: 'Sustainable Theorist',
      vibe: 'Is the sun angle passive or are you baking the occupants?',
      catchphrase: 'Glass box in a desert climate? You are cooking the users alive.',
      description:
        'Focuses on daylighting factors, embodied carbon, local vernacular materials, and thermal comfort.',
    },
    {
      name: 'Dean Sterling',
      role: 'Poetic Formalist',
      vibe: 'Is the void breathing or are you just crying? 😭',
      catchphrase: 'The phenomenological threshold feels disconnected from the urban fabric.',
      description:
        'Interrogates poetic spatial narrative, tectonic expression, experiential journey, and light.',
    },
  ],

  promptChips: {
    tutor: [
      'Why does my cantilever look like it is giving up? 💀',
      'Explain Le Corbusier’s 5 Points like I have 5 mins before jury',
      'How to justify a skylight without sounding pretentious',
      'HVAC shaft sizing rules for a 4-story studio project',
      'Frampton’s Tectonic Culture explained simply with examples',
    ],
    concept: [
      'High-density student housing with rooftop micro-gardens',
      'Brutalist cultural library with dramatic lightwells',
      'Passive climatic art museum in hot-dry climate',
      'Timber community center with modular timber joinery',
    ],
    jury: [
      'How do I defend having zero columns in the main hall?',
      'Defend a glass facade against solar heat gain questions',
      'What if the jury says my concept is too literal?',
      'Prepare 2-minute elevator pitch for thesis opening',
    ],
    vastu: [
      'Is placing kitchen in North-East a major dosha?',
      'Ideal location for underground vs overhead water tank',
      'Traditional remedies for South-Facing main entrance',
      'Brahmasthan open courtyard benefits in hot climate',
    ],
  },

  studioMoods: [
    '☕ Caffeine Level: Dangerous',
    '💀 Final_Final_v27_print.pdf',
    '📐 Traced Paper: 120 Meters',
    '💻 Revit Status: Not Crashing (Yet)',
    '🔥 Jury Defense: Locked In',
    '🌙 3:42 AM Studio Energy',
  ],
};

/**
 * Returns a deterministic mood badge based on current hour/minute
 */
export function getStudioMood(): string {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) return '🌙 3:42 AM Studio Energy';
  if (hour >= 5 && hour < 9) return '☕ Caffeine Level: Critical';
  if (hour >= 9 && hour < 14) return '📐 Traced Paper: 120 Meters';
  if (hour >= 14 && hour < 18) return '🔥 Jury Defense: Locked In';
  if (hour >= 18 && hour < 22) return '💀 Final_Final_v27_print.pdf';
  return '💻 Revit Status: Not Crashing (Yet)';
}
