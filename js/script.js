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
let volumeSliders = {};
let soloStates = {};
let muteStates = {};
let isPlaying = false;

const mainGain = new Tone.Gain(2.4);
const limiter = new Tone.Limiter(-1);
mainGain.connect(limiter);
limiter.toDestination();

let meters = {}; // To store a meter for each category

document.addEventListener("DOMContentLoaded", () => {
  setupInterface();
  // After setting up the interface, load default stems for each category (index 0)
  categories.forEach((category) => {
    loadStem(category, 0).then((player) => {
      currentPlayers[category] = player;
      meters[category] = new Tone.Meter({ normalRange: true });
      currentPlayers[category].connect(meters[category]);
    }).catch((err) => console.error(err));
  });
  document.getElementById("audio-container").style.display = "flex";
});

async function loadStem(category, index) {
  const loadingText = document.getElementById("loading-text");
  loadingText.style.display = "block";

  if (!players[category]) {
    players[category] = [];
  }

  // If already loaded, just return it
  if (players[category][index]) {
    loadingText.style.display = "none";
    return players[category][index];
  }

  return new Promise((resolve, reject) => {
    let player = new Tone.Player({
      url: `./audio/${category}${index}.mp3`,
      loop: true,
      onload: () => {
        loadingText.style.display = "none";
        player.connect(mainGain);
        players[category][index] = player;
        resolve(player);
      },
      onerror: (e) => {
        console.error(`Error loading ${category}${index}:`, e);
        loadingText.style.display = "none";
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

    // Category Label
    const label = document.createElement("p");
    label.textContent = category;
    label.className = "label";
    categoryDiv.appendChild(label);

    // Dropdown Selector
    const select = document.createElement("select");
    categoryDisplayNames[category].forEach((name, idx) => {
      const option = document.createElement("option");
      option.textContent = name;
      option.value = idx;
      select.appendChild(option);
    });
    categoryDiv.appendChild(select);

    // Volume Slider
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

    // Mute and Solo Buttons
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

    // Card Image
    const cardImage = document.createElement("img");
    cardImage.className = "card-image";
    cardImage.src = `./cards/${category}0.jpg`;
    cardImage.alt = `${category} card image`;
    categoryDiv.appendChild(cardImage);

    select.addEventListener("change", async () => {
      const index = parseInt(select.value, 10);
      const oldPlayer = currentPlayers[category];
    
      // Stop Old Player
      if (oldPlayer) {
        oldPlayer.stop();
      }
    
      try {
        const newPlayer = await loadStem(category, index);
        currentPlayers[category] = newPlayer;
    
        if (!meters[category]) {
          meters[category] = new Tone.Meter({ normalRange: true });
        }
    
        newPlayer.disconnect();
        newPlayer.connect(meters[category]);
        newPlayer.connect(mainGain);
    
        // Compute currentTime after the stem is fully loaded
        const currentTime = Tone.Transport.seconds;
    
        if (isPlaying && newPlayer.buffer) {
          const relativePosition = currentTime % newPlayer.buffer.duration;
          newPlayer.start(Tone.now(), relativePosition);
        }
    
        // Update Card Image
        cardImage.src = `./cards/${category}${index}.jpg`;
    
        // Dispose of old player if it exists and is different from the new one
        if (oldPlayer && oldPlayer !== newPlayer) {
          oldPlayer.dispose();
    
          // Find the old player in players[category] and remove it
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
      const volume = volumeSlider.value;
      if (currentPlayers[category]) {
        currentPlayers[category].volume.value = volume;
      }
    });

    soloButton.addEventListener("click", () => {
      const isSolo = soloStates[category];
      soloStates[category] = !isSolo;

      if (soloStates[category]) {
        // Solo the category
        categories.forEach((cat) => {
          if (cat !== category) {
            if (currentPlayers[cat]) {
              currentPlayers[cat].mute = true;
            }
          }
        });
        soloButton.textContent = "Unsolo";
      } else {
        // Unsolo
        categories.forEach((cat) => {
          if (currentPlayers[cat]) {
            currentPlayers[cat].mute = muteStates[cat];
          }
        });
        soloButton.textContent = "Solo";
      }
    });

    muteButton.addEventListener("click", () => {
      const isMuted = muteStates[category];
      muteStates[category] = !isMuted;

      if (isMuted) {
        if (currentPlayers[category]) {
          currentPlayers[category].mute = false;
        }
        muteButton.textContent = "Mute";
      } else {
        if (currentPlayers[category]) {
          currentPlayers[category].mute = true;
        }
        muteButton.textContent = "Unmute";
      }
    });
  });

  // Play/Stop Buttons
  const playButton = document.querySelector(".playButton");
  const stopButton = document.querySelector(".stopButton");

  playButton.addEventListener("click", async () => {
    await Tone.start();
    Tone.Transport.start();
    Object.values(currentPlayers).forEach((player) => {
      if (player && player.buffer) {
        const relativePosition = Tone.Transport.seconds % player.buffer.duration;
        player.start(Tone.now(), relativePosition);
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