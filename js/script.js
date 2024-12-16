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
let loadCount = 0;
let totalFiles = Object.values(categoryFileCounts).reduce((a, b) => a + b, 0);

let meters = {}; // To store a meter for each category

document.addEventListener("DOMContentLoaded", () => {
  preloadAudio();
  setupInterface();
});

function preloadAudio() {
  categories.forEach((category) => {
    players[category] = [];
    for (let i = 0; i < categoryFileCounts[category]; i++) {
      let player = new Tone.Player({
        url: `./audio/${category}${i}.ogg`,
        loop: true,
        onload: () => {
          loadCount++;
          if (loadCount === totalFiles) {
            document.getElementById("loading-text").style.display = "none";
            document.getElementById("audio-container").style.display = "flex";
            console.log("All audio files loaded!");
          }
        },
        onerror: (e) => {
          console.error(`Error loading ${category}${i}:`, e);
        },
      }).connect(mainGain);
      players[category].push(player);
    }
  });
}

function setupInterface() {
  const audioContainer = document.getElementById("audio-container");

  categories.forEach((category) => {
    // Initialize mute and solo states
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
    categoryDisplayNames[category].forEach((name, index) => {
      const option = document.createElement("option");
      option.textContent = name;
      option.value = index;
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

    // Set default stem
    currentPlayers[category] = players[category][0];

    // Create a meter and connect the player to it
    meters[category] = new Tone.Meter({ normalRange: true });
    currentPlayers[category].connect(meters[category]);

    // Event Listeners
    select.addEventListener("change", () => {
      const index = select.selectedIndex;
      const currentTime = Tone.Transport.seconds;

      // Stop Previous Player
      if (currentPlayers[category]) {
        currentPlayers[category].stop();
      }

      // Start New Player at Relative Time
      currentPlayers[category] = players[category][index];
      // Connect the new player to the meter
      currentPlayers[category].connect(meters[category]);

      if (isPlaying) {
        const relativePosition =
          currentTime % currentPlayers[category].buffer.duration;
        currentPlayers[category].start(Tone.now(), relativePosition);
        console.log(
          `Playing ${category} stem ${index} at relative position ${relativePosition}`
        );
      }

      // Update Card Image
      cardImage.src = `./cards/${category}${index}.jpg`;
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
            // revert to mute state before solo
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
    console.log("Playback started.");
    Object.values(currentPlayers).forEach((player) => {
      if (player) {
        const relativePosition =
          Tone.Transport.seconds % player.buffer.duration;
        player.start(Tone.now(), relativePosition);
      }
    });
    isPlaying = true;
  });

  stopButton.addEventListener("click", () => {
    Tone.Transport.stop();
    console.log("Playback stopped.");
    Object.values(currentPlayers).forEach((player) => player?.stop());
    isPlaying = false;
  });
}
