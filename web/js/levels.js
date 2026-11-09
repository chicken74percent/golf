/**
 * Level data ported 1:1 from src/main.py (app.levelData).
 *
 * Coordinate space is the original 400 x 400 canvas. Every polygon point,
 * wall segment, ball start, hole position, bounce pad and time limit is
 * unchanged. `name` is a presentation-only addition used on the win screen.
 */

export const LEVELS = {
  1: {
    name: 'The Dogleg',
    courseMap: [
      [85, 90], [85, 255], [130, 305], [130, 330],
      [250, 330], [250, 280], [325, 280], [325, 120],
      [250, 120], [250, 90],
    ],
    ballCenter: [230, 310],
    holeCenter: [300, 250],
    innerWalls: [],
    timeLimit: 20,
  },
  2: {
    name: 'Diamond Cut',
    courseMap: [
      [100, 200], [200, 100], [300, 200], [200, 300],
    ],
    ballCenter: [110, 200],
    holeCenter: [285, 200],
    innerWalls: [
      [170, 170, 230, 170],
      [230, 170, 230, 230],
      [230, 230, 170, 230],
      [170, 230, 170, 170],
    ],
    timeLimit: 20,
  },
  3: {
    name: 'Switchback',
    courseMap: [
      [80, 320], [80, 250], [160, 250],
      [160, 180], [240, 180], [240, 110],
      [320, 110], [320, 320],
    ],
    ballCenter: [100, 300],
    holeCenter: [300, 130],
    innerWalls: [
      [260, 200, 290, 150],
      [220, 230, 300, 260],
      [190, 220, 210, 300],
    ],
    timeLimit: 25,
  },
  4: {
    name: 'The Hook',
    courseMap: [
      [100, 300], [100, 100], [300, 100], [300, 200],
      [200, 200], [200, 300],
    ],
    ballCenter: [120, 280],
    holeCenter: [280, 120],
    innerWalls: [
      [160, 190, 250, 175],
      [120, 180, 250, 120],
      [275, 190, 250, 140],
      [120, 230, 180, 240],
    ],
    timeLimit: 20,
  },
  5: {
    name: 'Pinball Alley',
    courseMap: [
      [100, 300], [100, 100], [300, 100], [300, 300],
    ],
    ballCenter: [120, 280],
    holeCenter: [280, 120],
    innerWalls: [
      [170, 200, 230, 200],
      [170, 200, 170, 270],
      [230, 200, 230, 115],

      [130, 130, 190, 180],

      [200, 250, 250, 270],

      [140, 260, 160, 290],

      [260, 140, 280, 250],
    ],
    timeLimit: 25,
  },
  6: {
    name: 'Bullseye',
    courseMap: [
      [100, 100], [300, 100], [300, 300], [100, 300],
    ],
    ballCenter: [120, 280],
    holeCenter: [280, 120],
    innerWalls: [],
    bounceCircle: {
      center: [200, 200],
      radius: 50,
      color: 'khaki',
    },
    timeLimit: 12,
  },
  7: {
    name: 'Twin Pads',
    courseMap: [
      [120, 80], [280, 80], [340, 160], [320, 300],
      [200, 340], [100, 260], [80, 180],
    ],
    ballCenter: [130, 250],
    holeCenter: [280, 120],
    innerWalls: [],
    bounceCircle: [
      { center: [180, 160], radius: 60, color: 'khaki' },
      { center: [250, 260], radius: 50, color: 'khaki' },
    ],
    timeLimit: 15,
  },
  8: {
    name: 'The Octagon',
    courseMap: [
      [150, 80], [250, 80], [320, 150], [320, 250],
      [250, 320], [150, 320], [80, 250], [80, 150],
    ],
    ballCenter: [95, 215],
    holeCenter: [290, 145],
    innerWalls: [
      [150, 180, 100, 170],
      [250, 230, 300, 200],
      [200, 255, 200, 300],
      [200, 100, 200, 140],
    ],
    bounceCircle: {
      center: [200, 200],
      radius: 45,
      color: 'khaki',
    },
    timeLimit: 20,
  },
  9: {
    name: 'Serpentine',
    courseMap: [
      [80, 100], [120, 100], [160, 130], [190, 110],
      [220, 210], [250, 130], [280, 160], [300, 140],
      [320, 180], [310, 220], [270, 190], [230, 240],
      [200, 250], [120, 160], [140, 150], [110, 270],
      [90, 240],
    ],
    ballCenter: [100, 200],
    holeCenter: [290, 180],
    innerWalls: [
      [200, 210, 160, 150],
    ],
    timeLimit: 25,
  },
  10: {
    name: 'The Groove',
    courseMap: [
      [80, 150], [110, 120], [150, 100], [200, 130],
      [250, 110], [290, 140], [310, 180], [280, 220],
      [240, 250], [200, 230], [160, 260], [120, 240],
      [90, 200],
    ],
    ballCenter: [100, 160],
    holeCenter: [260, 200],
    innerWalls: [
      [220, 130, 230, 200],
      [200, 150, 180, 240],
    ],
    bounceCircle: {
      center: [150, 160],
      radius: 30,
      color: 'khaki',
    },
    timeLimit: 25,
  },
  11: {
    name: 'Grand Circuit',
    courseMap: [
      [100, 300], [80, 220], [120, 140], [160, 100], [220, 110],
      [300, 150], [350, 200], [330, 260], [280, 310], [200, 330],
      [130, 320],
    ],
    ballCenter: [110, 290],
    holeCenter: [310, 180],
    innerWalls: [
      [280, 140, 280, 200],
      [300, 200, 290, 300],
      [260, 240, 295, 240],
    ],
    bounceCircle: [
      { center: [155, 170], radius: 35, color: 'khaki' },
      { center: [210, 255], radius: 45, color: 'khaki' },
      { center: [230, 170], radius: 30, color: 'khaki' },
    ],
    timeLimit: 30,
  },
  12: {
    name: 'The Gauntlet',
    courseMap: [
      [100, 100], [300, 100], [300, 300], [100, 300],
    ],
    ballCenter: [120, 280],
    holeCenter: [280, 120],
    innerWalls: [],
    bounceCircle: {
      center: [200, 200],
      radius: 89.2,
      color: 'khaki',
    },
    timeLimit: 50,
  },
};

export const LEVEL_COUNT = Object.keys(LEVELS).length;
export const UNLOCKED_LEVELS = LEVEL_COUNT; // Matches app.unlockedLevels = 12
