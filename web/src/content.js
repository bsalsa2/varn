import { CONTACT_EMAIL, FORM_ENDPOINT } from './config.js';

// ---------------------------------------------------------------------------
//  VARN SITE CONTENT
//
//  Every word on the page lives in this file. Edit the text between the
//  quotes, commit, and the site rebuilds itself.
//
//  Status labels: use exactly 'DONE', 'IN PROGRESS', or 'NEXT'.
//  The colour and icon of each row follow the label automatically.
//
//  Tip: if your text needs an apostrophe, keep the outer quotes as
//  backticks (`like this`) so you don't have to escape anything.
//
//  Every build checks this file first (scripts/check-content.mjs). If you
//  make a typo, the check names the line and what's wrong.
// ---------------------------------------------------------------------------

export const content = {
  meta: {
    title: 'Varn | Watch the sky',
    description:
      'A research prototype exploring a camera-based approach to observing and logging objects in the sky. Recorded-video evaluation only. Physical hardware validation pending.',
    // The primary domain. Every build (GitHub Pages and any mirror) points
    // canonical links and share images here; set SITE_URL to override.
    url: process.env.SITE_URL || 'https://tryvarn.com/',
  },

  // VISIT COUNTER (GoatCounter: free, no cookies, nothing personal stored).
  // Off while empty. Sign up at goatcounter.com, pick a code (for example
  // 'varn'), and put that code here. The privacy page updates itself.
  analytics: {
    goatcounter: 'bsalsa2',
  },

  // Four destinations, no more. "Platform" scrolls to the dashboard section
  // of the home page; the rest are pages. The last one is the demo button.
  nav: {
    brand: 'VARN',
    links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Research', href: './research.html' },
      { label: 'About', href: './about.html' },
    ],
    cta: { label: 'Explore Demo', href: './demo.html' },
  },

  // SECTION 1: the hero. One image, one headline, one sentence, one status.
  hero: {
    eyebrow: 'PASSIVE VISUAL AWARENESS / RESEARCH PROTOTYPE',
    headline: 'Watch the sky.',
    sub: 'Exploring a camera-based approach to observing and logging objects in the sky.',
    explain: 'Passive visual awareness: a camera that only watches. It never transmits, jams or interferes.',
    status: 'RESEARCH PROTOTYPE · HARDWARE VALIDATION PENDING',
    demo: { label: 'Explore the demo', href: './demo.html' },
    results: { label: 'View research results', href: './research.html#results' },
    scroll: 'Scroll',
  },

  // SECTION 2: the process, in three stages along one line. Each stage says
  // exactly how far it has been tested. Keep the status words honest.
  process: {
    label: 'The process',
    heading: 'Observe. Log. Validate.',
    stages: [
      {
        name: 'Observe',
        text: 'A camera on a pan-tilt mount watches a patch of sky, and a detection model labels what it sees as drone or aircraft.',
        status: 'Tested on recorded video',
        state: 'tested',
      },
      {
        name: 'Log',
        text: 'Each sighting is saved with its time, class, confidence and where the camera was pointing.',
        status: 'Tested in simulation',
        state: 'tested',
      },
      {
        name: 'Validate',
        text: 'Sightings are compared with real flight data and outdoor tests to produce accuracy numbers.',
        status: 'Pending · needs the physical node',
        state: 'pending',
      },
    ],
    note: '',
    link: { label: 'See all five steps', href: './research.html#story' },
  },

  // SECTION 3: the platform. The window is the real dashboard demo, in small.
  platform: {
    label: 'The platform',
    heading: 'The dashboard, in simulation.',
    sub: 'An interactive demonstration of the VARN dashboard, running on generated sample data.',
    badge: 'SIMULATED',
    banner: 'SIMULATED · Sample data generated in your browser. No physical node is connected.',
    window: 'VARN dashboard',
    node: 'Node-01 · Not connected',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'events', label: 'Events' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'system', label: 'System' },
    ],
    cta: { label: 'Explore the demo', href: './demo.html' },
    // A small CAD render of the PLANNED pan-tilt mount, drawn from the STL
    // files in /hardware. It must always say so: nothing is built.
    concept: {
      src: './models/hero-mount-1400.webp',
      small: './models/hero-mount-700.webp',
      width: 1400,
      height: 1871,
      alt: 'Concept render of the planned VARN pan-tilt mount: a base holding the pan servo, a yoke on top and a camera arm between its uprights. Not a photograph; the hardware is not built.',
      caption: 'CONCEPT RENDER · UNBUILT HARDWARE',
    },
    noscript: 'The dashboard preview needs JavaScript. The full demo does too; the measured results are on the Research page.',
  },

  // SECTION 4: a restrained snapshot of the published v2 results. The numbers
  // come from `results` below, so there is only one place to edit them.
  snapshot: {
    label: 'The research',
    heading: 'What the recorded video shows.',
    intro: 'Model v2 was evaluated on 43 real-world video clips of planes, military jets and drones. The drone result is weak, and it is shown as it is.',
    disclaimer: 'Recorded-video evaluation only. Physical hardware validation pending.',
    figures: [
      {
        value: '14.9%',
        number: 14.9,
        kind: 'drone',
        label: 'of drone clips correctly labeled',
        unit: 'Per clip. Higher is better.',
      },
      {
        value: '7.5%',
        number: 7.5,
        kind: 'aircraft',
        label: 'of aircraft video frames wrongly classified as drones',
        unit: 'Per frame. Lower is better.',
      },
    ],
    notComparable: 'These two figures use different units, per clip and per frame, so they are not directly comparable.',
    link: { label: 'Read the full research', href: './research.html' },
  },

  // SECTION 5: the close.
  close: {
    heading: 'Built in the open. Measured honestly.',
    text: 'VARN is a research prototype. Every result is published with its limits, and every simulation is labeled as one.',
    disclosure: 'Research prototype. Software has been tested on recorded video and in simulation. The physical hardware node has not been built or validated. Images marked CONCEPT or SIMULATED are not footage and not live detections.',
    copyright: 'Copyright 2026 Varn Labs. Source code released under the MIT License.',
  },

  // WHAT WE'VE TESTED: the short version, near the top. Three columns:
  // software tests, recorded-video results (with their limits beside them),
  // and hardware tests still pending. Keep it in step with status and results.
  tested: {
    heading: "What we've tested",
    columns: [
      {
        tag: 'DONE · SOFTWARE',
        title: 'Software tests',
        items: [
          'Detection, tracking and pan-tilt control loop, in simulation',
          'Sighting logger and live dashboard, in simulation',
          'Pico servo firmware, tested in software',
        ],
      },
      {
        tag: 'MEASURED · RECORDED VIDEO',
        title: 'Recorded-video results',
        items: [
          'Model v2 on 43 real-world clips',
          '14.9% of drone clips labeled correctly: v2 is weak at drones',
          '7.5% of aircraft video frames wrongly called a drone (a different unit)',
        ],
      },
      {
        tag: 'PENDING · HARDWARE',
        title: 'Hardware tests',
        items: [
          'Physical node not built yet',
          'No outdoor test yet',
          'No comparison against real flight data (ADS-B) yet',
        ],
      },
    ],
  },

  // The step-by-step explainer. Each stage has its own animated scene in the
  // panel (see SCENES in render.js); the visitor picks the step. Everything
  // in the panel is a simulation and is labelled SAMPLE.
  story: {
    kicker: 'How it works',
    heading: 'From sky to sighting',
    intro: 'Five steps turn a patch of sky into a logged record.',
    // Shown only when JavaScript is on and the steps are selectable.
    hint: 'Pick a step to watch it happen.',
    device: 'SAMPLE · NODE-01 · SIMULATED',
    note: 'SAMPLE: everything in this panel is a simulation, not footage.',
    stages: [
      {
        number: '01',
        title: 'SEE',
        fact: 'Passive · receives light only',
        body: 'A webcam on a pan-tilt mount looks at the sky. Varn is passive: it only receives light. It never jams, never transmits on aircraft or drone frequencies, and carries no payload.',
      },
      {
        number: '02',
        title: 'DETECT',
        fact: 'YOLO · ONNX model',
        body: 'Every frame goes through a YOLO object-detection model. For each thing it finds, it returns a class (drone or aircraft), a confidence score and a box. Today that is model v2, which is weak at drones. Model v3 is in training.',
      },
      {
        number: '03',
        title: 'TRACK',
        fact: 'Pico · two servos',
        body: 'The tracker picks one target and stays locked on it from frame to frame. A small controller turns how far off-centre the target is into new pan and tilt angles, and a Raspberry Pi Pico drives the two servos.',
      },
      {
        number: '04',
        title: 'LOG',
        fact: 'Time · class · confidence · direction',
        body: 'Every sighting is saved with its time, what it was, how confident the model was and which way the camera was pointing, plus a snapshot of its best moment. An hourly sky-clear check records the quiet too.',
      },
      {
        number: '05',
        title: 'CHECK',
        fact: 'ADS-B · built, not yet run on a real feed',
        body: 'Planes publicly broadcast their positions (ADS-B). Varn can line its sightings up with a log of the real flights overhead, which is how real accuracy numbers will be measured. That comparison is written but has not run against a real feed yet.',
      },
    ],
  },

  // How to read the three status labels.
  labels: {
    kicker: 'Reading the screen',
    heading: 'Three labels, three shapes',
    intro: 'Colour is never the only signal. Every label pairs a colour with a shape and a word, so it reads the same in greyscale and for colour-blind eyes.',
    items: [
      {
        kind: 'aircraft',
        title: 'Confirmed aircraft',
        shape: 'Filled circle',
        rule: 'The model sees an aircraft and a matching ADS-B broadcast is nearby.',
      },
      {
        kind: 'drone',
        title: 'Possible drone',
        shape: 'Filled square',
        rule: 'The model says drone. It is always only possible: a model can be wrong, and Varn says so.',
      },
      {
        kind: 'no-adsb',
        title: 'No ADS-B match',
        shape: 'Hollow ring',
        rule: 'Looks like an aircraft, but no matching broadcast was found. It may be a plane that does not broadcast, or a misread.',
      },
    ],
    note: 'The ADS-B comparison is written but has not yet been run against a real feed, so these labels are shown here as a design, not as measured results.',
  },

  math: {
    heading: 'The cost goal',
    // Words inside [square brackets] light up white; the rest stay grey.
    statement: 'The goal is a sensing layer [cheap enough to put almost anywhere.] One node\'s estimated parts come to [about $113.]',
    stats: [
      { label: 'Estimated sensing-hardware parts, one node', value: '~$113', highlight: true },
      { label: 'Not in that total', value: 'Computer' },
      { label: 'Already owned, not priced', value: 'Pico + breadboard' },
    ],
    // Printed under the numbers so they can't be read as a capability claim.
    statsNote: 'A parts estimate from the bill of materials (bom.csv in the repo), before shipping. It says nothing about capability: the node is not built, and nothing has run on real hardware. No comparison with other detection systems is made here.',
    body: 'Varn is a first step toward making that sensing layer cheap enough to put anywhere.',
    useCases: {
      tag: 'USE CASES',
      text: `Early use cases I'm exploring: farms, small airports, stadiums, and power substations. First hypothesis to test: small general-aviation airfields. None of these is tested yet.`,
    },
  },

  how: {
    kicker: 'Under the hood',
    heading: 'The hardware and the view',
    summary: 'Three views, all of them simulations or CAD renders and none of them footage: what the camera overlay will look like, a sky picture of sightings, and a 3D model of the pan-tilt mount.',
    toggle: 'Show the overlay, sky picture and 3D mount',
    // 3D viewer of the pan-tilt mount, built from the STL files in /hardware.
    mount: {
      label: 'PAN-TILT MOUNT',
      caption:
        'Rendered live from the CAD files in this repo, with the two servos drawn as outlines, and moved through its pan and tilt axes. The physical build is next.',
      parts: [
        { name: 'BASE', text: 'Holds the pan servo, shaft up, and screws down with four M3 screws.' },
        { name: 'YOKE', text: 'Sits on the pan horn, holds the tilt servo, and carries the M3 pivot.' },
        { name: 'CAMERA ARM', text: 'Webcam cradle on the tilt horn and pivot.' },
      ],
    },
    // Simulated sensor view: what the node's on-screen overlay will look like.
    sensor: {
      label: 'SAMPLE · SENSOR VIEW · SIMULATED',
      caption:
        'SAMPLE: a simulation of the overlay the node draws on its camera feed (brain/overlay.py). The locked target gets the bold box and a solid label; anything else gets a thin box. The camera turns to keep the lock in the centre ring.',
    },
    // Simulated radar sweep beside the sensor view (radar.js). Must say SAMPLE.
    radar: {
      label: 'SAMPLE · SKY PICTURE · SIMULATED',
      caption:
        'SAMPLE: made-up blips showing how sightings could be plotted around the node. Circle = aircraft, square = possible drone. Varn has no radar; this is a map of what the camera reports.',
    },
    note: 'The test range is free: real air traffic passes overhead all day. Planes publicly broadcast their positions (ADS-B), so once the node is built I can compare what the camera saw with what actually flew over. That comparison is written but has not been run, so there are no accuracy numbers from it yet.',
  },

  status: {
    kicker: 'Where it stands',
    heading: 'Status',
    items: [
      { label: 'DONE', text: 'Pico servo firmware: smooth motion, calibration, command protocol' },
      { label: 'DONE', text: 'Detection and tracking loop, working in simulation, 243 automated tests' },
      { label: 'DONE', text: 'Pan-tilt mount designed in CAD, with STEP and STL files' },
      { label: 'DONE', text: 'Wiring diagram and bill of materials' },
      { label: 'DONE', text: 'Sighting logger (built and tested in simulation)' },
      { label: 'DONE', text: 'Live dashboard (built and tested in simulation)' },
      { label: 'IN PROGRESS', text: 'Detection model v3 with drone and aircraft classes (in training)' },
      { label: 'NEXT', text: 'Run the logger and dashboard on real hardware' },
      { label: 'NEXT', text: 'Build the physical hardware' },
      { label: 'NEXT', text: 'Outdoor test' },
      { label: 'NEXT', text: 'Test against real flight data (ADS-B) and publish accuracy results' },
      { label: 'NEXT', text: 'Pi 4 + solar deployment' },
    ],
  },

  // ACCURACY RESULTS: this section stays hidden until charts has entries.
  // Only add numbers you have actually measured, and fill in source with how
  // and when they were measured. The build refuses numbers without a source.
  //
  // Each chart is one measurement, drawn as bars on a 0 to 100% scale.
  //   kind:   'aircraft' or 'drone' (sets the bar colour and its shape)
  //   unit:   what the percentage is a share of, and which way is better
  //   bars:   value is a plain number (7.5 means 7.5%). detail is optional.
  //           part: true indents a bar as a breakdown of the one above it.
  // caveats are printed next to the charts: what this test does NOT show.
  results: {
    heading: 'Results so far',
    intro: 'The v2 model, run on 43 real-world videos of planes, military jets and drones. This tests the model on recorded video. It is not a hardware test.',
    tag: 'MEASURED · RECORDED VIDEO',
    sample: '43 real-world videos · model v2',
    charts: [
      {
        kind: 'aircraft',
        title: 'Aircraft wrongly called a drone',
        unit: 'Share of aircraft frames. Lower is better.',
        bars: [
          { label: 'All aircraft', value: 7.5, detail: '798 of 10,657 frames' },
          { label: 'Civilian planes', value: 0.8, part: true },
          { label: 'Military jets', value: 10.8, detail: 'Mostly distant F-35s', part: true },
        ],
      },
      {
        kind: 'drone',
        title: 'Drones labeled correctly',
        unit: 'Share of drone clips. Higher is better.',
        bars: [{ label: 'Drone clips', value: 14.9, detail: 'The number of drone clips is not listed here. v2 is weak at drones, and v3 is training to improve this.' }],
      },
    ],
    caveats: [
      'Recorded video only. Nothing has run on the physical node yet.',
      'One model, v2. v3 is in training and has no results yet.',
      'Not yet checked against real flight data (ADS-B).',
      'The two charts use different units (frames of aircraft video, and drone clips), so their percentages are not comparable with each other.',
    ],
    source: 'Model v2, 43 real-world videos. v3 (drone and aircraft classes, 960 px input) is in training. There are no v3 results yet.',
  },

  // KNOWN LIMITS: what Varn can't do, stated plainly.
  limits: {
    kicker: 'Honest limits',
    heading: 'Known limits',
    items: [
      {
        tag: 'RANGE · ESTIMATE',
        text: 'A wide-lens webcam detects small drones only at short range, likely tens of meters (an estimate, still to be measured). Aircraft are detectable much farther.',
      },
      {
        tag: 'CONDITIONS',
        text: 'Visual sensing is weaker in darkness, fog and rain.',
      },
      {
        tag: 'NOT REMOTE ID',
        text: 'It can see drones that broadcast nothing, unlike Remote ID, but it does not replace Remote ID or RF sensors.',
      },
      {
        tag: 'NOT BUILT YET',
        text: 'Nothing has run on real hardware yet.',
      },
    ],
  },

  build: {
    heading: 'About me',
    body: `I'm Braden, and I like building things that work in the real world. I started with Sunnode, a small server that runs entirely on solar power from a panel on my fence. Then I got curious about drones, trained my first detection model, and Varn was the next step. I've run a backyard gardening business, and I shelved a software startup after learning how hard it is to sell to companies when you're young. I'm interested in how technology can make shared airspace safer, and Varn is where I'm starting.`,
  },

  roadmap: {
    kicker: 'Roadmap',
    heading: 'From one node to a network',
    // The long-term vision lives here, not in the hero.
    intro: 'This is Phase 1. The long-term goal is affordable, passive airspace awareness: knowing what is flying overhead, openly measured and documented.',
    phases: [
      {
        phase: 'PHASE 1 · NOW',
        title: 'One working node',
        body: 'A camera that detects, tracks, and logs aircraft and drones, with real accuracy numbers.',
      },
      {
        phase: 'PHASE 2',
        title: 'A network of nodes',
        body: 'Several nodes working together can work out where a drone is and where it is heading.',
      },
      {
        phase: 'PHASE 3',
        title: 'Wider awareness',
        body: 'Low-cost passive sensing for places that need to know what is in their airspace, like small airfields, with published accuracy at every step.',
      },
    ],
    closing:
      'Phase 1 is passive by design. It carries no payloads, never jams, and never transmits on aircraft or drone frequencies. It only watches.',
  },

  // RESEARCH PAGE (research.html): everything the home page leaves out.
  // The measured numbers themselves live in `results`; the status list, limits
  // and roadmap below are reused here as they are.
  researchPage: {
    title: 'Research',
    description: 'VARN research: test methodology, measured results with their limits, model versions, hardware and parts cost, validation status, roadmap and references.',
    kicker: 'Research',
    heading: 'Research and engineering detail',
    intro: 'Everything the home page leaves out: how the model was tested, what the numbers do and do not show, what the hardware is, and what is still pending. Recorded-video evaluation only. Physical hardware validation pending.',
    contentsLabel: 'On this page',
    sections: [
      { id: 'methodology', label: 'Test methodology' },
      { id: 'results', label: 'Measured results' },
      { id: 'models', label: 'Model versions and limits' },
      { id: 'hardware', label: 'Hardware and parts' },
      { id: 'validation', label: 'Validation status' },
      { id: 'roadmap', label: 'Roadmap' },
      { id: 'references', label: 'References' },
    ],
    methodology: {
      heading: 'Test methodology',
      paragraphs: [
        'Model v2 is a custom two-class YOLOv8n detector (classes drone and aircraft). It was trained on a 28,526-image aircraft and drone dataset whose labels were merged into those two classes.',
        'It was then run on 43 real-world videos of planes, military jets and drones. Aircraft videos are scored per frame: each frame where the model called the aircraft a drone counts as one error. Drone videos are scored per clip: a clip counts as correct when the model labeled the drone correctly.',
        'This is a test of the model on recorded video. It is not a test of the camera, the mount, the servos or any outdoor setup, none of which has been built.',
      ],
      unitsHeading: 'Two metrics, two units',
      units: [
        { term: 'Aircraft wrongly called a drone', text: 'Share of aircraft video frames. 798 of 10,657 frames, 7.5%. Lower is better.' },
        { term: 'Drones labeled correctly', text: 'Share of drone clips, 14.9%. Higher is better. The number of drone clips is not listed in the source.' },
      ],
      unitsNote: 'A per-frame error rate and a per-clip hit rate measure different things. Do not read one against the other.',
    },
    resultsNote: 'The drone result is weak and stays visible here. Model v3 has no results yet.',
    models: {
      heading: 'Model versions and limitations',
      rows: [
        { model: 'v2', state: 'Measured', text: 'Two-class YOLOv8n (drone, aircraft). Scored on 43 recorded videos. Weak at drones.' },
        { model: 'v3', state: 'Testing', text: 'Drone and aircraft classes, 960 px input, resumed from v2. In training. Not yet scored against the same 43 clips, so it has no results to report.' },
      ],
      limitsHeading: 'Known limits',
    },
    hardware: {
      heading: 'Hardware and bill of materials',
      intro: 'The planned node is a webcam on a two-servo pan-tilt mount, driven by a Raspberry Pi Pico WH, with the model running on a laptop first and a Raspberry Pi 4 later. Nothing has been built. The renders and models on this page are CAD.',
      costHeading: 'Estimated parts cost',
      costNote: 'A parts estimate from bom.csv in the repository, before shipping. It excludes the computer that runs the model, and the Pico WH and breadboard, which are already owned. It is not evidence of performance: the node is not built and nothing has run on real hardware.',
      bomHeading: 'Bill of materials',
      bomNote: 'Costs are rough USD estimates for the whole line, before shipping. The source is bom.csv.',
      viewsHeading: 'Simulations and CAD',
    },
    validation: {
      heading: 'Validation status',
      intro: 'What has been tested, what has been measured, and what is pending. Software and recorded-video results do not stand in for hardware validation.',
      statusHeading: 'Status of each part',
    },
    references: {
      heading: 'Technical references',
      intro: 'Source documentation in the repository. Everything on this site is drawn from it.',
      items: [
        { label: 'README', href: 'https://github.com/bsalsa2/varn/blob/main/README.md', text: 'Status, results, model, bill of materials, wiring and roadmap.' },
        { label: 'Brain: detection, tracking, logging', href: 'https://github.com/bsalsa2/varn/blob/main/brain/README.md', text: 'The detection and tracking loop, the sighting logger, the dashboard and demo mode.' },
        { label: 'Training', href: 'https://github.com/bsalsa2/varn/blob/main/training/README.md', text: 'How models are trained and scored, and what the scores mean.' },
        { label: 'Hardware', href: 'https://github.com/bsalsa2/varn/blob/main/hardware/README.md', text: 'The parametric pan-tilt mount, with STEP and STL files.' },
        { label: 'Pico firmware', href: 'https://github.com/bsalsa2/varn/blob/main/pico/README.md', text: 'Servo firmware and the command protocol.' },
        { label: 'Bill of materials', href: 'https://github.com/bsalsa2/varn/blob/main/bom.csv', text: 'Parts, quantities and estimated costs as a CSV.' },
        { label: 'Source code', href: 'https://github.com/bsalsa2/varn', text: 'The whole repository, including this website.' },
      ],
    },
  },

  // ABOUT PAGE (about.html)
  about: {
    title: 'About',
    description: 'About VARN: who is building it, and what it is and is not.',
    kicker: 'About',
    heading: 'Who is building this',
    scopeHeading: 'What VARN is, and is not',
    scope: [
      'A research prototype for passive visual sensing: a camera that watches the sky and a model that labels what it sees.',
      'Passive by design. It carries no payload, never jams, and never transmits on aircraft or drone frequencies.',
      'Not a product, and not deployed anywhere. The physical hardware node has not been built or validated.',
    ],
    contactText: 'Questions about the project, the hardware or the code are welcome.',
    contactCta: { label: 'Contact', href: './contact.html' },
  },

  // DASHBOARD DEMO (demo.html): an interactive version of the dashboard.
  // The events, counts and charts are SIMULATED, generated in the visitor's
  // browser (src/demo-data.js). The measured results on the Analytics tab come
  // from `results` above and are labelled as measured. Keep that line clear.
  demo: {
    title: 'Dashboard demo',
    description: 'An interactive demo of the Varn dashboard with simulated sample data: overview, event explorer, analytics and system status.',
    kicker: 'Dashboard demo',
    heading: 'Explore the dashboard',
    intro: 'Click through the same views the real dashboard has. Every event, count and chart here is simulated sample data. Measured results are kept apart, on the Analytics tab.',
    banner: 'SIMULATED · Sample data generated in your browser. No physical node is connected, and nothing here was detected by a camera.',
    noscript: 'The dashboard demo needs JavaScript. The measured results are on the main page, under Results.',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'events', label: 'Events' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'system', label: 'System' },
    ],
    // System tab. State is one of: Verified, Measured, Testing, Simulated, Not connected, Pending.
    system: {
      heading: 'System status',
      intro: 'What exists, what has been tested, and what is not built yet.',
      rows: [
        { area: 'Software', name: 'Detection and tracking loop', state: 'Verified', text: 'Tested in simulation, with 243 automated tests.' },
        { area: 'Software', name: 'Sighting logger', state: 'Verified', text: 'Built and tested in simulation.' },
        { area: 'Software', name: 'Live dashboard', state: 'Verified', text: 'Built and tested in simulation. This page is a web demo of it.' },
        { area: 'Model', name: 'Detection model v2', state: 'Measured', text: 'Scored on 43 recorded videos. See the Analytics tab for the numbers and their limits.' },
        { area: 'Model', name: 'Detection model v3', state: 'Testing', text: 'In training. There are no v3 results yet.' },
        { area: 'Data', name: 'Events shown in this demo', state: 'Simulated', text: 'Generated in your browser from a fixed pattern. Not recorded by any sensor.' },
        { area: 'Data', name: 'Comparison with real flight data (ADS-B)', state: 'Not connected', text: 'The comparison is written but has never been run against a real feed.' },
        { area: 'Hardware', name: 'Camera', state: 'Not connected', text: 'The physical node is not built yet.' },
        { area: 'Hardware', name: 'Pan-tilt mount and Pico controller', state: 'Pending', text: 'Designed in CAD, and the firmware is tested in software. The physical build is next.' },
        { area: 'Hardware', name: 'Outdoor test', state: 'Pending', text: 'Not started.' },
      ],
    },
    // Short definitions, shown on the Analytics tab.
    definitions: [
      { term: 'Aircraft', text: 'The model called it an aircraft (a sage circle). The label is the model\'s guess, not a confirmed fact.' },
      { term: 'Possible drone', text: 'The model called it a drone (an amber square). Not confirmed by anything else.' },
      { term: 'ADS-B match', text: 'A real flight-data record matches the sighting. In this demo the matches are simulated; the real comparison has never been run.' },
      { term: 'No ADS-B match', text: 'No flight-data record matches (a hollow ring). Drones never broadcast ADS-B, and neither do some small aircraft.' },
      { term: 'Confidence', text: 'How sure the model is, from 0 to 1. It is not the chance that the label is right.' },
    ],
  },

  // Contact form, shown above the sister-project card.
  contact: {
    kicker: 'Contact',
    title: 'Contact',
    description: 'Questions about Varn? Send a message to Varn Labs.',
    heading: 'Questions about Varn?',
    intro: 'Ask about the project, the hardware, or the code. I read every message.',
    email: CONTACT_EMAIL,
    endpoint: FORM_ENDPOINT,
    nameLabel: 'Name',
    emailLabel: 'Your email',
    messageLabel: 'Message',
    submitLabel: 'Send message',
    sendingLabel: 'Sending',
    mailtoNote: 'Sending opens your email app with this message ready to go.',
    successText: 'Thanks, your message is on its way. I will reply by email.',
    mailtoText: 'Your email app should now be open with your message. Press send there to finish.',
    errorText: 'That did not send. Please email the address above directly.',
  },

  // Card linking to the sister project, shown above the footer.
  sister: {
    label: 'Sister project',
    name: 'Sunnode',
    description: '', // optional: one sentence about what Sunnode is
    href: 'https://github.com/bsalsa2/sunnode',
    linkLabel: 'View on GitHub',
  },

  footer: {
    brand: 'VARN LABS',
    // Platform, Research, About, Contact and the source, in that order.
    links: [
      { label: 'Platform', href: './#platform' },
      { label: 'Research', href: './research.html' },
      { label: 'About', href: './about.html' },
      { label: 'Contact', href: './contact.html' },
      { label: 'Source code', href: 'https://github.com/bsalsa2/varn' },
    ],
    legal: [
      { label: 'Dashboard demo', href: './demo.html' },
      { label: 'Privacy', href: './privacy.html' },
    ],
    contactLabel: 'Contact',
    email: CONTACT_EMAIL,
  },

  // ---- Privacy policy page (privacy.html) ---------------------------------
  // Update the date whenever you change this page.
  privacy: {
    title: 'Privacy policy',
    updated: 'October 21, 2026',
    intro: `This site has no accounts, cookies, ads, or trackers. Reading it sends nothing about you anywhere. The contact form sends only what you type in it, and goes through a form service (see Contact form below).`,
    // Used instead of intro when the visit counter is on.
    introWithAnalytics: `This site has no accounts, cookies, ads, or tracking beyond an anonymous visit counter, explained below. The contact form sends only what you type in it, and goes through a form service (see Contact form below).`,
    sections: [
      {
        heading: 'What the site loads',
        text: 'Everything on this site, including the fonts, scripts, and 3D models, is served from the site itself. Your browser makes no requests to other companies while you read it.',
        textWithAnalytics: 'Everything on this site, including the fonts, scripts, and 3D models, is served from the site itself. The one exception is the visit counter described below.',
      },
      {
        // Only shown when the visit counter is on.
        onlyWithAnalytics: true,
        heading: 'Visit counts',
        text: `To see how many people visit, this site uses GoatCounter, a privacy-friendly counter. It records which page was viewed, the site you came from, your browser, screen size, and country. It uses no cookies and doesn't store your IP address or anything that identifies you.`,
        link: { label: `GoatCounter's privacy policy`, href: 'https://www.goatcounter.com/help/privacy' },
      },
      {
        heading: 'Hosting',
        text: `The site is hosted on GitHub Pages. Like any web host, GitHub's servers handle each visit and may keep standard technical logs, such as IP addresses and browser type, to run and protect the service. This site adds no tracking on top of that.`,
        link: { label: `GitHub's privacy statement`, href: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement' },
      },
      {
        heading: 'Contact form',
        text: `If you use the contact form, the name, email address, and message you type are sent to Formspree, a form service, which forwards them to hello@tryvarn.com and may keep a copy under its own policy. They are used only to reply to you. Nothing is stored on this site. The form loads nothing from Formspree until you press send. If the form is unavailable, you can email hello@tryvarn.com directly.`,
        link: { label: `Formspree's privacy policy`, href: 'https://formspree.io/legal/privacy-policy/' },
      },
      {
        heading: 'Links to other sites',
        text: 'Links to GitHub take you to GitHub, which has its own privacy policy.',
      },
      {
        heading: 'How this site is made',
        text: 'I design the system, train the model, and am building the hardware. Most of the code, including this website, is written with Claude Code, an AI coding tool, working from my designs. I say so everywhere I share this project.',
      },
      {
        heading: 'Changes',
        text: 'If anything here changes, this page will be updated, along with the date at the top.',
      },
    ],
    contactText: 'Questions about this page? Email',
  },
};
