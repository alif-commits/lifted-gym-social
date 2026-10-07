import type { Equipment, MuscleGroup, TrackingMode } from "../../src/lib/constants";

type Row = [name: string, primary: MuscleGroup, equipment: Equipment, mode: TrackingMode, secondary: MuscleGroup[], difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"];

const W: TrackingMode = "WEIGHT_REPS";
const BW: TrackingMode = "BODYWEIGHT_REPS";
const T: TrackingMode = "DURATION";
const C: TrackingMode = "DISTANCE_DURATION";

export const EXERCISES: Row[] = [
  // Chest
  ["Barbell Bench Press", "CHEST", "BARBELL", W, ["TRICEPS", "SHOULDERS"], "INTERMEDIATE"],
  ["Incline Barbell Bench Press", "CHEST", "BARBELL", W, ["SHOULDERS", "TRICEPS"], "INTERMEDIATE"],
  ["Dumbbell Bench Press", "CHEST", "DUMBBELL", W, ["TRICEPS", "SHOULDERS"], "BEGINNER"],
  ["Incline Dumbbell Press", "CHEST", "DUMBBELL", W, ["SHOULDERS", "TRICEPS"], "BEGINNER"],
  ["Dumbbell Fly", "CHEST", "DUMBBELL", W, [], "BEGINNER"],
  ["Cable Crossover", "CHEST", "CABLE", W, [], "INTERMEDIATE"],
  ["Machine Chest Press", "CHEST", "MACHINE", W, ["TRICEPS"], "BEGINNER"],
  ["Pec Deck", "CHEST", "MACHINE", W, [], "BEGINNER"],
  ["Push-Up", "CHEST", "BODYWEIGHT", BW, ["TRICEPS", "SHOULDERS", "CORE"], "BEGINNER"],
  ["Chest Dip", "CHEST", "BODYWEIGHT", BW, ["TRICEPS", "SHOULDERS"], "INTERMEDIATE"],
  // Back
  ["Deadlift", "BACK", "BARBELL", W, ["HAMSTRINGS", "GLUTES", "FOREARMS"], "ADVANCED"],
  ["Barbell Row", "BACK", "BARBELL", W, ["BICEPS", "FOREARMS"], "INTERMEDIATE"],
  ["Pendlay Row", "BACK", "BARBELL", W, ["BICEPS"], "ADVANCED"],
  ["Dumbbell Row", "BACK", "DUMBBELL", W, ["BICEPS"], "BEGINNER"],
  ["Pull-Up", "BACK", "BODYWEIGHT", BW, ["BICEPS", "FOREARMS"], "INTERMEDIATE"],
  ["Chin-Up", "BACK", "BODYWEIGHT", BW, ["BICEPS"], "INTERMEDIATE"],
  ["Lat Pulldown", "BACK", "CABLE", W, ["BICEPS"], "BEGINNER"],
  ["Seated Cable Row", "BACK", "CABLE", W, ["BICEPS"], "BEGINNER"],
  ["T-Bar Row", "BACK", "BARBELL", W, ["BICEPS"], "INTERMEDIATE"],
  ["Machine Row", "BACK", "MACHINE", W, ["BICEPS"], "BEGINNER"],
  ["Straight-Arm Pulldown", "BACK", "CABLE", W, [], "INTERMEDIATE"],
  ["Back Extension", "BACK", "BODYWEIGHT", BW, ["GLUTES", "HAMSTRINGS"], "BEGINNER"],
  // Shoulders
  ["Overhead Press", "SHOULDERS", "BARBELL", W, ["TRICEPS"], "INTERMEDIATE"],
  ["Dumbbell Shoulder Press", "SHOULDERS", "DUMBBELL", W, ["TRICEPS"], "BEGINNER"],
  ["Arnold Press", "SHOULDERS", "DUMBBELL", W, ["TRICEPS"], "INTERMEDIATE"],
  ["Lateral Raise", "SHOULDERS", "DUMBBELL", W, [], "BEGINNER"],
  ["Cable Lateral Raise", "SHOULDERS", "CABLE", W, [], "INTERMEDIATE"],
  ["Front Raise", "SHOULDERS", "DUMBBELL", W, [], "BEGINNER"],
  ["Rear Delt Fly", "SHOULDERS", "DUMBBELL", W, ["BACK"], "BEGINNER"],
  ["Face Pull", "SHOULDERS", "CABLE", W, ["BACK"], "BEGINNER"],
  ["Machine Shoulder Press", "SHOULDERS", "MACHINE", W, ["TRICEPS"], "BEGINNER"],
  ["Barbell Shrug", "SHOULDERS", "BARBELL", W, ["BACK"], "BEGINNER"],
  // Biceps
  ["Barbell Curl", "BICEPS", "BARBELL", W, ["FOREARMS"], "BEGINNER"],
  ["Dumbbell Curl", "BICEPS", "DUMBBELL", W, ["FOREARMS"], "BEGINNER"],
  ["Hammer Curl", "BICEPS", "DUMBBELL", W, ["FOREARMS"], "BEGINNER"],
  ["Incline Dumbbell Curl", "BICEPS", "DUMBBELL", W, [], "INTERMEDIATE"],
  ["Preacher Curl", "BICEPS", "MACHINE", W, [], "BEGINNER"],
  ["Cable Curl", "BICEPS", "CABLE", W, [], "BEGINNER"],
  // Triceps
  ["Close-Grip Bench Press", "TRICEPS", "BARBELL", W, ["CHEST", "SHOULDERS"], "INTERMEDIATE"],
  ["Triceps Pushdown", "TRICEPS", "CABLE", W, [], "BEGINNER"],
  ["Overhead Triceps Extension", "TRICEPS", "DUMBBELL", W, [], "BEGINNER"],
  ["Skull Crusher", "TRICEPS", "BARBELL", W, [], "INTERMEDIATE"],
  ["Triceps Dip", "TRICEPS", "BODYWEIGHT", BW, ["CHEST", "SHOULDERS"], "INTERMEDIATE"],
  ["Bench Dip", "TRICEPS", "BODYWEIGHT", BW, ["SHOULDERS"], "BEGINNER"],
  // Quads
  ["Barbell Back Squat", "QUADS", "BARBELL", W, ["GLUTES", "HAMSTRINGS", "CORE"], "INTERMEDIATE"],
  ["Front Squat", "QUADS", "BARBELL", W, ["GLUTES", "CORE"], "ADVANCED"],
  ["Goblet Squat", "QUADS", "DUMBBELL", W, ["GLUTES", "CORE"], "BEGINNER"],
  ["Leg Press", "QUADS", "MACHINE", W, ["GLUTES", "HAMSTRINGS"], "BEGINNER"],
  ["Hack Squat", "QUADS", "MACHINE", W, ["GLUTES"], "INTERMEDIATE"],
  ["Leg Extension", "QUADS", "MACHINE", W, [], "BEGINNER"],
  ["Walking Lunge", "QUADS", "DUMBBELL", W, ["GLUTES", "HAMSTRINGS"], "INTERMEDIATE"],
  ["Bulgarian Split Squat", "QUADS", "DUMBBELL", W, ["GLUTES"], "INTERMEDIATE"],
  ["Smith Machine Squat", "QUADS", "SMITH_MACHINE", W, ["GLUTES"], "BEGINNER"],
  ["Bodyweight Squat", "QUADS", "BODYWEIGHT", BW, ["GLUTES"], "BEGINNER"],
  // Hamstrings / glutes
  ["Romanian Deadlift", "HAMSTRINGS", "BARBELL", W, ["GLUTES", "BACK"], "INTERMEDIATE"],
  ["Dumbbell Romanian Deadlift", "HAMSTRINGS", "DUMBBELL", W, ["GLUTES"], "BEGINNER"],
  ["Lying Leg Curl", "HAMSTRINGS", "MACHINE", W, [], "BEGINNER"],
  ["Seated Leg Curl", "HAMSTRINGS", "MACHINE", W, [], "BEGINNER"],
  ["Good Morning", "HAMSTRINGS", "BARBELL", W, ["BACK", "GLUTES"], "ADVANCED"],
  ["Hip Thrust", "GLUTES", "BARBELL", W, ["HAMSTRINGS"], "INTERMEDIATE"],
  ["Glute Bridge", "GLUTES", "BODYWEIGHT", BW, ["HAMSTRINGS"], "BEGINNER"],
  ["Cable Kickback", "GLUTES", "CABLE", W, [], "BEGINNER"],
  ["Step-Up", "GLUTES", "DUMBBELL", W, ["QUADS"], "BEGINNER"],
  // Calves
  ["Standing Calf Raise", "CALVES", "MACHINE", W, [], "BEGINNER"],
  ["Seated Calf Raise", "CALVES", "MACHINE", W, [], "BEGINNER"],
  ["Bodyweight Calf Raise", "CALVES", "BODYWEIGHT", BW, [], "BEGINNER"],
  // Core
  ["Plank", "CORE", "BODYWEIGHT", T, ["SHOULDERS"], "BEGINNER"],
  ["Side Plank", "CORE", "BODYWEIGHT", T, [], "BEGINNER"],
  ["Hanging Leg Raise", "CORE", "BODYWEIGHT", BW, ["FOREARMS"], "INTERMEDIATE"],
  ["Cable Crunch", "CORE", "CABLE", W, [], "BEGINNER"],
  ["Crunch", "CORE", "BODYWEIGHT", BW, [], "BEGINNER"],
  ["Russian Twist", "CORE", "BODYWEIGHT", BW, [], "BEGINNER"],
  ["Ab Wheel Rollout", "CORE", "OTHER", BW, ["SHOULDERS"], "ADVANCED"],
  ["Dead Bug", "CORE", "BODYWEIGHT", BW, [], "BEGINNER"],
  // Forearms
  ["Wrist Curl", "FOREARMS", "BARBELL", W, [], "BEGINNER"],
  ["Farmer's Carry", "FOREARMS", "DUMBBELL", C, ["CORE", "SHOULDERS"], "BEGINNER"],
  // Full body
  ["Kettlebell Swing", "FULL_BODY", "KETTLEBELL", W, ["GLUTES", "HAMSTRINGS", "CORE"], "INTERMEDIATE"],
  ["Power Clean", "FULL_BODY", "BARBELL", W, ["BACK", "QUADS", "SHOULDERS"], "ADVANCED"],
  ["Thruster", "FULL_BODY", "BARBELL", W, ["QUADS", "SHOULDERS"], "ADVANCED"],
  ["Burpee", "FULL_BODY", "BODYWEIGHT", BW, ["CHEST", "QUADS"], "INTERMEDIATE"],
  ["Turkish Get-Up", "FULL_BODY", "KETTLEBELL", W, ["CORE", "SHOULDERS"], "ADVANCED"],
  // Cardio
  ["Treadmill Run", "CARDIO", "CARDIO_MACHINE", C, [], "BEGINNER"],
  ["Outdoor Run", "CARDIO", "OTHER", C, [], "BEGINNER"],
  ["Stationary Bike", "CARDIO", "CARDIO_MACHINE", C, [], "BEGINNER"],
  ["Rowing Machine", "CARDIO", "CARDIO_MACHINE", C, ["BACK"], "BEGINNER"],
  ["Elliptical", "CARDIO", "CARDIO_MACHINE", C, [], "BEGINNER"],
  ["Stair Climber", "CARDIO", "CARDIO_MACHINE", C, ["QUADS", "GLUTES"], "BEGINNER"],
  ["Jump Rope", "CARDIO", "OTHER", T, ["CALVES"], "BEGINNER"],
  ["Cycling (Outdoor)", "CARDIO", "OTHER", C, ["QUADS"], "BEGINNER"],
  ["Swimming", "CARDIO", "OTHER", C, ["BACK", "SHOULDERS"], "INTERMEDIATE"],
  ["Walking", "CARDIO", "OTHER", C, [], "BEGINNER"],
];
