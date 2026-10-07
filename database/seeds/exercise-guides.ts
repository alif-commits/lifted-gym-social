/** Licensed movement notes + media for core global lifts. Seeded additively; custom exercises are untouched. */

export type Guide = {
  setup?: string;
  steps: string[];
  breathing?: string;
  mistakes: string[];
  media?: { provider: string; mediaType: "IMAGE" | "GIF" | "VIDEO"; sourceUrl: string; license: string; attribution: string };
};

export const EXERCISE_GUIDES: Record<string, Guide> = {
  "Barbell Bench Press": {
    setup: "Lie on a flat bench with eyes under the bar. Feet planted. Unrack with straight wrists and a stable upper back.",
    steps: [
      "Lower the bar under control to the mid-chest, elbows about 45–70° from the torso.",
      "Pause briefly without bouncing.",
      "Press the bar back to lockout over the shoulders.",
    ],
    breathing: "Inhale on the way down, brace, and exhale as you press.",
    mistakes: ["Bouncing off the chest", "Flaring elbows to 90°", "Feet lifting or hips bridging every rep"],
    media: {
      provider: "wikimedia",
      mediaType: "IMAGE",
      sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Bench_press_1.jpg?width=640",
      license: "CC BY-SA 3.0",
      attribution: "Wikimedia Commons / public demonstration photo",
    },
  },
  "Dumbbell Bench Press": {
    setup: "Sit, rest the dumbbells on your thighs, then lie back and press them to lockout above the chest.",
    steps: ["Lower until elbows are just below the bench line.", "Press up and slightly inward without clanging the bells."],
    breathing: "Inhale down, exhale up.",
    mistakes: ["Excessive arch", "Uneven lockout"],
  },
  Deadlift: {
    setup: "Bar over mid-foot. Hinge, grab just outside the shins, chest up, lats tight, slack pulled out of the bar.",
    steps: ["Push the floor away and stand up in one piece.", "Hips and shoulders rise together.", "Lock out tall, then hinge back to the floor."],
    breathing: "Big breath and brace before the pull. Exhale at lockout or hold through the set if bracing.",
    mistakes: ["Rounding the lower back", "Jerking the bar", "Hips shooting up first"],
    media: {
      provider: "wikimedia",
      mediaType: "IMAGE",
      sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Deadlift.jpg?width=640",
      license: "CC BY-SA 2.0",
      attribution: "Wikimedia Commons / deadlift demonstration",
    },
  },
  "Barbell Back Squat": {
    setup: "Bar on the upper back, hands even, brace, walk out to a stable stance.",
    steps: ["Sit between the hips while knees track over the toes.", "Reach a consistent depth.", "Drive up without collapsing the chest."],
    breathing: "Inhale and brace at the top, hold through the hole, exhale as you stand.",
    mistakes: ["Knees caving", "Heels lifting", "Cutting depth inconsistently"],
    media: {
      provider: "wikimedia",
      mediaType: "IMAGE",
      sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Squat.jpg?width=640",
      license: "CC BY-SA 3.0",
      attribution: "Wikimedia Commons / squat demonstration",
    },
  },
  "Front Squat": {
    setup: "Bar on the front delts with a clean or cross grip. Elbows high.",
    steps: ["Sit down while keeping the torso upright.", "Stand without letting the elbows drop."],
    breathing: "Brace before you descend.",
    mistakes: ["Elbows collapsing", "Turning it into a good-morning"],
  },
  "Overhead Press": {
    setup: "Bar at the upper chest, wrists stacked, glutes and abs tight.",
    steps: ["Press the bar up and slightly back so it finishes over the mid-foot.", "Lock out overhead without overextending the ribs."],
    breathing: "Inhale at the chest, press, exhale at lockout.",
    mistakes: ["Leaning back into a standing bench press", "Flared ribs"],
  },
  "Barbell Row": {
    setup: "Hinge to a strong torso angle. Bar hangs below the shoulders.",
    steps: ["Row the bar to the lower ribs.", "Lower under control without bouncing."],
    breathing: "Exhale as you row.",
    mistakes: ["Using too much hip drive", "Shrugging instead of rowing"],
    media: {
      provider: "wikimedia",
      mediaType: "IMAGE",
      sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Barbell_row.jpg?width=640",
      license: "CC BY-SA 3.0",
      attribution: "Wikimedia Commons / barbell row demonstration",
    },
  },
  "Pull-Up": {
    setup: "Hang with a grip just outside shoulder width. Scapulae set.",
    steps: ["Pull the chest toward the bar.", "Lower to a full hang without losing shoulder position."],
    breathing: "Exhale on the pull.",
    mistakes: ["Kipping when you meant strict", "Half reps"],
  },
  "Lat Pulldown": {
    setup: "Sit tall, thighs under the pad, grip slightly wider than shoulders.",
    steps: ["Pull the bar to the upper chest.", "Control the return."],
    breathing: "Exhale as you pull.",
    mistakes: ["Leaning too far back", "Yanking with the arms only"],
  },
  "Push-Up": {
    setup: "Hands under the shoulders, body in a straight line from head to heels.",
    steps: ["Lower the chest close to the floor.", "Press back to a locked plank."],
    breathing: "Inhale down, exhale up.",
    mistakes: ["Hips sagging", "Flaring elbows hard"],
    media: {
      provider: "wikimedia",
      mediaType: "IMAGE",
      sourceUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Push-up.jpg?width=640",
      license: "CC BY-SA 3.0",
      attribution: "Wikimedia Commons / push-up demonstration",
    },
  },
  "Romanian Deadlift": {
    setup: "Soft knees, bar against the thighs, lats on.",
    steps: ["Hinge until you feel a hamstring stretch.", "Stand by driving the hips forward."],
    breathing: "Brace at the top.",
    mistakes: ["Squatting the movement", "Rounding the back"],
  },
  "Walking Lunge": {
    setup: "Stand tall with dumbbells or a bar. Take a controlled step.",
    steps: ["Lower until the back knee is close to the floor.", "Step through to the next lunge."],
    breathing: "Steady breathing; don't rush.",
    mistakes: ["Tiny steps", "Front knee collapsing inward"],
  },
  Plank: {
    setup: "Elbows under shoulders, body in a straight line.",
    steps: ["Squeeze glutes and abs.", "Breathe while holding still."],
    breathing: "Slow nasal breaths if you can.",
    mistakes: ["Hips piked or sagging"],
  },
};
