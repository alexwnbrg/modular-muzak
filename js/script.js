let players = {};
let categories = [
  "Lead",
  "Bass",
  "Drums",
  "Chords",
  "Accent",
  "EFX",
  "Breakdown",
];

let categoryFileCounts = {
  Lead: 5,
  Bass: 4,
  Drums: 5,
  Chords: 6,
  Accent: 6,
  EFX: 7,
  Breakdown: 8,
};

let categoryDisplayNames = {
  Lead: [ "Whistler", "The Visitor","The Traveler", "Sonic Voyage", "The Bull"],
  Bass: ["Bridge Plucker", "Subpumper", "Fat Bottom", "Bass Pusher"],
  Drums: ["Tambist", "The Slomo", "Heartbeat", "House Drummer", "8bit Drummer"],
  Chords: [
    "Pump It Up",
    "The Vibist",
    "The Cheesist",
    "Mr Smooth",
    "Feedback Loop",
    "The Rhodes Trip",
  ],
  Accent: [
    "Synth Poker",
    "Airhead",
    "Synth Flight",
    "The Dubber",
    "The Skank",
    "The Jumper",
  ],
  EFX: [
    "The Polygraph",
    "Emergency",
    "The Arcade",
    "The Radio",
    "The Airhorn",
    "Transmitter",
    "The Cyborg",
  ],
  Breakdown: [
    "The Lab",
    "The Gospel",
    "Ascender",
    "Shredders",
    "The Shepherd",
    "70s Vibez",
    "The Stairway",
    "The Comic",
  ],
};

let currentPlayers = {};
let currentIndices = {};
let volumeSliders = {};
let soloStates = {};
let muteStates = {};
let isPlaying = false;
let smoothedLevels = {};

// One analyser per category — reads actual live audio output,
// no position calculation needed so it can never freeze or drift
let analysers = {};

Tone.context.lookAhead = 0;

const mainGain = new Tone.Gain(2.4);
const limiter = new Tone.Limiter(-1);
mainGain.connect(limiter);
limiter.toDestination();

document.addEventListener("DOMContentLoaded", () => {
  // Create one analyser per category and wire it into the signal chain:
  // player → analyser → mainGain → limiter → destination
  categories.forEach((cat) => {
    smoothedLevels[cat] = 0;
    const analyser = new Tone.Analyser("waveform", 256);
    analyser.smoothing = 0; // no built-in smoothing; we do our own
    analyser.connect(mainGain);
    analysers[cat] = analyser;
  });

  setupInterface();

  const playButton = document.querySelector(".playButton");
  const loadingText = document.getElementById("loading-text");
  playButton.disabled = true;
  playButton.style.opacity = "0.4";
  playButton.style.cursor = "not-allowed";

  let loadedCount = 0;
  loadingText.textContent = `Loading stems... (0 / ${categories.length})`;
  loadingText.style.display = "block";

  const loadPromises = categories.map((category) => {
    return loadStem(category, 0).then((player) => {
      currentPlayers[category] = player;
      currentIndices[category] = 0;
      loadedCount++;
      loadingText.textContent = `Loading stems... (${loadedCount} / ${categories.length})`;
    });
  });

  Promise.all(loadPromises).then(() => {
    loadingText.style.display = "none";
    playButton.disabled = false;
    playButton.style.opacity = "1";
    playButton.style.cursor = "pointer";
  }).catch((err) => console.error(err));

  startVisualization();

  const dice = document.getElementById("dice");
  if (dice) {
    dice.style.cursor = "pointer";
    dice.addEventListener("click", () => {
      randomizeStems();
    });
  }
});

function randomizeStems() {
  categories.forEach((category) => {
    const maxIndex = categoryFileCounts[category];
    const randomIndex = Math.floor(Math.random() * maxIndex);
    const categoryDiv = document.querySelector(`.category[data-category="${category}"]`);
    if (categoryDiv) {
      const select = categoryDiv.querySelector("select");
      if (select) {
        select.value = randomIndex;
        select.dispatchEvent(new Event("change"));
      }
    }
  });
}

async function loadStem(category, index) {
  if (!players[category]) {
    players[category] = [];
  }

  if (players[category][index]) {
    return players[category][index];
  }

  return new Promise((resolve, reject) => {
    let player = new Tone.Player({
      url: `./audio/${category}${index}.mp3`,
      loop: true,
      onload: () => {
        // Route through this category's analyser so visualization
        // reads actual live output for this stem
        player.connect(analysers[category]);
        players[category][index] = player;
        resolve(player);
      },
      onerror: (e) => {
        console.error(`Error loading ${category}${index}:`, e);
        reject(e);
      },
    });
  });
}

function setupInterface() {
  const audioContainer = document.getElementById("audio-container");

  categories.forEach((category) => {
    soloStates[category] = false;
    muteStates[category] = false;

    const categoryDiv = document.createElement("div");
    categoryDiv.className = "category";
    categoryDiv.setAttribute("data-category", category);
    audioContainer.appendChild(categoryDiv);

    const label = document.createElement("p");
    label.textContent = category;
    label.className = "label";
    categoryDiv.appendChild(label);

    const select = document.createElement("select");
    categoryDisplayNames[category].forEach((name, idx) => {
      const option = document.createElement("option");
      option.textContent = name;
      option.value = idx;
      select.appendChild(option);
    });
    categoryDiv.appendChild(select);

    const volumeWrapper = document.createElement("div");
    volumeWrapper.className = "volume-wrapper";
    const volumeSlider = document.createElement("input");
    volumeSlider.type = "range";
    volumeSlider.min = -40;
    volumeSlider.max = 0;
    volumeSlider.value = 0;
    volumeSlider.className = "volume-slider";
    volumeWrapper.appendChild(volumeSlider);
    categoryDiv.appendChild(volumeWrapper);
    volumeSliders[category] = volumeSlider;

    const soloMuteWrapper = document.createElement("div");
    soloMuteWrapper.className = "solo-mute-wrapper";

    const soloButton = document.createElement("button");
    soloButton.textContent = "Solo";
    soloButton.className = "soloButton";
    soloMuteWrapper.appendChild(soloButton);

    const muteButton = document.createElement("button");
    muteButton.textContent = "Mute";
    muteButton.className = "muteButton";
    soloMuteWrapper.appendChild(muteButton);

    categoryDiv.appendChild(soloMuteWrapper);

    select.addEventListener("change", async () => {
      const index = parseInt(select.value, 10);
      const oldPlayer = currentPlayers[category];

      if (oldPlayer) {
        oldPlayer.stop();
      }

      try {
        const newPlayer = await loadStem(category, index);
        currentPlayers[category] = newPlayer;
        currentIndices[category] = index;

        // Reconnect through the category analyser
        newPlayer.disconnect();
        newPlayer.connect(analysers[category]);

        if (isPlaying && newPlayer.buffer) {
          const relativePosition = Tone.Transport.seconds % newPlayer.buffer.duration;
          newPlayer.start(Tone.now(), relativePosition);
        }

        if (oldPlayer && oldPlayer !== newPlayer) {
          oldPlayer.dispose();
          const oldIndex = players[category].indexOf(oldPlayer);
          if (oldIndex !== -1) {
            players[category][oldIndex] = null;
          }
        }

      } catch (error) {
        console.error("Failed to load stem:", error);
      }
    });

    volumeSlider.addEventListener("input", () => {
      if (currentPlayers[category]) {
        currentPlayers[category].volume.value = volumeSlider.value;
      }
    });

    soloButton.addEventListener("click", () => {
      soloStates[category] = !soloStates[category];

      if (soloStates[category]) {
        categories.forEach((cat) => {
          if (cat !== category && currentPlayers[cat]) {
            currentPlayers[cat].mute = true;
          }
        });
        soloButton.textContent = "Unsolo";
      } else {
        categories.forEach((cat) => {
          if (currentPlayers[cat]) {
            currentPlayers[cat].mute = muteStates[cat];
          }
        });
        soloButton.textContent = "Solo";
      }
    });

    muteButton.addEventListener("click", () => {
      muteStates[category] = !muteStates[category];
      if (currentPlayers[category]) {
        currentPlayers[category].mute = muteStates[category];
      }
      muteButton.textContent = muteStates[category] ? "Unmute" : "Mute";
    });
  });

  const playButton = document.querySelector(".playButton");
  const stopButton = document.querySelector(".stopButton");

  playButton.addEventListener("click", async () => {
    await Tone.start();
    Tone.Transport.start();
    Object.values(currentPlayers).forEach((player) => {
      if (player && player.buffer) {
        player.start(Tone.now(), 0);
      }
    });
    isPlaying = true;
  });

  stopButton.addEventListener("click", () => {
    Tone.Transport.stop();
    Object.values(currentPlayers).forEach((player) => player?.stop());
    isPlaying = false;
  });
}

function startVisualization() {
  // Cache DOM refs once — no need to query every frame
  const categoryDivs = {};
  categories.forEach((cat) => {
    categoryDivs[cat] = document.querySelector(`.category[data-category="${cat}"]`);
  });

  // Reusable buffer so we don't allocate on every frame
  const waveformBuffers = {};
  categories.forEach((cat) => {
    waveformBuffers[cat] = new Float32Array(256);
  });

  function animate() {
    categories.forEach((category) => {
      const categoryDiv = categoryDivs[category];
      if (!categoryDiv) return;

      let level = 0;

      if (isPlaying && analysers[category]) {
        // getValue() returns the actual waveform data being output right now —
        // no timing calculation, no position drift, no freezing
        const data = analysers[category].getValue();
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);

        // Boost and shape the level
        level = Math.min(1, rms * 55);
        level = Math.pow(level, 0.5);
      }

      // Fast attack, snappy decay
      const alpha = level > smoothedLevels[category] ? 0.8 : 0.45;
      smoothedLevels[category] = smoothedLevels[category] * (1 - alpha) + level * alpha;
      const s = smoothedLevels[category];

      // Interpolate border: cyan (#02e1e8) → magenta (#f708f7)
      const r = Math.round(2   + s * 245);
      const g = Math.round(225 - s * 217);
      const b = Math.round(232 + s *  15);
      const color = `rgb(${r}, ${g}, ${b})`;
      categoryDiv.style.borderColor = color;
      categoryDiv.style.boxShadow = `0 0 ${(5 + s * 15).toFixed(1)}px ${color}`;
    });

  }

  // setInterval instead of requestAnimationFrame — avoids rAF throttling
  // that GitHub Pages and some CDN environments apply to the rendering pipeline
  setInterval(animate, 16);
}
