const TARGET_REPS = 50;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const MIN_VISIBILITY = 0.55;

const POSE = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
};

const HAND = {
  WRIST: 0,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  PINKY_MCP: 17,
};

const GAME_META = {
  wipe: {
    title: "窓ふきゲーム",
    tracking: "手のひら",
    status: "手のひらを大きく動かして窓を拭いてください",
  },
  step: {
    title: "足踏みゲーム",
    tracking: "膝",
    status: "左右の膝を交互に上げて雪原を埋めてください",
  },
  jump: {
    title: "ジャンプゲーム",
    tracking: "踵",
    status: "ジャンプして正面の階段を1段ずつ登りましょう",
  },
};

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function createRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function smoothLandmarks(previous, next, alpha) {
  if (!next) {
    return previous;
  }
  if (!previous) {
    return next.map((point) => ({ ...point }));
  }
  return next.map((point, index) => {
    const prev = previous[index] || point;
    return {
      ...point,
      x: lerp(prev.x, point.x, alpha),
      y: lerp(prev.y, point.y, alpha),
      z: lerp(prev.z || 0, point.z || 0, alpha),
      visibility:
        typeof point.visibility === "number"
          ? lerp(prev.visibility ?? point.visibility, point.visibility, alpha)
          : prev.visibility,
    };
  });
}

function getVisiblePoint(landmarks, index) {
  if (!landmarks || !landmarks[index]) {
    return null;
  }
  const point = landmarks[index];
  if (typeof point.visibility === "number" && point.visibility < MIN_VISIBILITY) {
    return null;
  }
  return point;
}

function averagePoints(points) {
  if (!points.length) {
    return null;
  }
  const total = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      acc.z += point.z || 0;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

function getPalmCenter(handLandmarks) {
  if (!handLandmarks) {
    return null;
  }
  const points = [
    handLandmarks[HAND.WRIST],
    handLandmarks[HAND.INDEX_MCP],
    handLandmarks[HAND.MIDDLE_MCP],
    handLandmarks[HAND.PINKY_MCP],
  ].filter(Boolean);
  return averagePoints(points);
}

class SoundEngine {
  constructor() {
    this.audioContext = null;
    this.enabled = false;
  }

  async enable() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    this.enabled = this.audioContext.state === "running";
  }

  tone(frequency, duration, type, volume, delay = 0) {
    if (!this.enabled || !this.audioContext) {
      return;
    }
    const start = this.audioContext.currentTime + delay;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  playProgress() {
    this.tone(520, 0.08, "triangle", 0.08);
  }

  playStep() {
    this.tone(190, 0.1, "square", 0.05);
  }

  playJump() {
    this.tone(300, 0.12, "triangle", 0.06);
  }

  playSuccess() {
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.tone(frequency, 0.22, "triangle", 0.08, index * 0.1);
    });
  }
}

class WipeGame {
  constructor() {
    this.type = "wipe";
    this.reset();
  }

  reset() {
    this.count = 0;
    this.completed = false;
    this.movementBudget = 0;
    this.lastPalm = null;
    this.lastAxis = null;
    this.lastDirection = 0;
    this.reversalCharge = 0;
    this.clearTrail = [];
    this.sparkles = [];
    const random = createRandom(31);
    this.dirtSpots = Array.from({ length: 260 }, () => ({
      x: 0.19 + random() * 0.62,
      y: 0.18 + random() * 0.58,
      radius: 10 + random() * 24,
      alpha: 0.16 + random() * 0.18,
    }));
  }

  getPalm(results) {
    const left = getPalmCenter(results.leftHandLandmarks);
    const right = getPalmCenter(results.rightHandLandmarks);
    if (!left) {
      return right;
    }
    if (!right) {
      return left;
    }
    return left.y < right.y ? left : right;
  }

  clearAroundPalm(palm, strength) {
    const radius = 0.05 + Math.min(strength, 0.032);
    this.dirtSpots = this.dirtSpots.filter((spot) => {
      const dx = spot.x - palm.x;
      const dy = spot.y - palm.y;
      return dx * dx + dy * dy > radius * radius;
    });
    this.clearTrail.push({
      x: palm.x,
      y: palm.y,
      radius: 36 + strength * 850,
      life: 1,
    });
    if (this.clearTrail.length > 24) {
      this.clearTrail.shift();
    }
    if (strength > 0.012) {
      this.sparkles.push({
        x: palm.x,
        y: palm.y,
        life: 1,
      });
    }
    if (this.sparkles.length > 20) {
      this.sparkles.shift();
    }
  }

  update(results) {
    if (this.completed) {
      this.clearTrail.forEach((trail) => {
        trail.life *= 0.94;
      });
      this.sparkles.forEach((sparkle) => {
        sparkle.life *= 0.94;
      });
      return;
    }

    const palm = this.getPalm(results);
    this.clearTrail.forEach((trail) => {
      trail.life *= 0.92;
    });
    this.clearTrail = this.clearTrail.filter((trail) => trail.life > 0.08);
    this.sparkles.forEach((sparkle) => {
      sparkle.life *= 0.9;
    });
    this.sparkles = this.sparkles.filter((sparkle) => sparkle.life > 0.08);

    if (!palm) {
      this.lastPalm = null;
      this.lastAxis = null;
      this.lastDirection = 0;
      this.reversalCharge = 0;
      return;
    }

    const insideGlass =
      palm.x > 0.17 && palm.x < 0.83 &&
      palm.y > 0.16 && palm.y < 0.78;

    if (!insideGlass) {
      this.lastPalm = palm;
      this.lastAxis = null;
      this.lastDirection = 0;
      this.reversalCharge = 0;
      return;
    }

    if (this.lastPalm) {
      const dx = palm.x - this.lastPalm.x;
      const dy = palm.y - this.lastPalm.y;
      const distance = Math.hypot(dx, dy);
      const dominantAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      const axisAmount = dominantAxis === "x" ? dx : dy;
      const orthogonalAmount = dominantAxis === "x" ? Math.abs(dy) : Math.abs(dx);
      const energeticMotion =
        distance > 0.012 &&
        Math.abs(axisAmount) > 0.01 &&
        orthogonalAmount < 0.04;

      if (energeticMotion) {
        this.clearAroundPalm(palm, distance);
        const direction = axisAmount > 0 ? 1 : -1;

        if (this.lastAxis === dominantAxis && this.lastDirection !== 0 && direction !== this.lastDirection) {
          this.reversalCharge += Math.abs(axisAmount);
        } else if (this.lastAxis === dominantAxis && direction === this.lastDirection) {
          this.reversalCharge = Math.min(this.reversalCharge + Math.abs(axisAmount) * 0.2, 0.02);
        } else {
          this.reversalCharge = 0;
        }

        if (this.reversalCharge >= 0.018) {
          this.movementBudget += this.reversalCharge * 1.5;
          this.reversalCharge = 0;
        }

        this.lastAxis = dominantAxis;
        this.lastDirection = direction;
      }

      while (this.movementBudget >= 0.028 && this.count < TARGET_REPS) {
        this.movementBudget -= 0.028;
        this.count += 1;
      }
    }

    this.lastPalm = palm;

    if (this.count >= TARGET_REPS) {
      this.count = TARGET_REPS;
      this.completed = true;
      this.dirtSpots = [];
    }
  }

  draw(ctx, width, height) {
    const frameX = width * 0.15;
    const frameY = height * 0.12;
    const frameW = width * 0.7;
    const frameH = height * 0.66;

    const wall = ctx.createLinearGradient(0, 0, 0, height);
    wall.addColorStop(0, "#d7c8b4");
    wall.addColorStop(1, "#bca689");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#b48453";
    ctx.fillRect(frameX - 22, frameY - 22, frameW + 44, frameH + 44);
    ctx.fillStyle = "#8b5d33";
    ctx.fillRect(frameX - 10, frameY - 10, frameW + 20, frameH + 20);

    const glass = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    glass.addColorStop(0, "#b5dbef");
    glass.addColorStop(1, "#e8f8ff");
    ctx.fillStyle = glass;
    ctx.fillRect(frameX, frameY, frameW, frameH);

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 6;
    ctx.strokeRect(frameX, frameY, frameW, frameH);
    ctx.beginPath();
    ctx.moveTo(frameX + frameW * 0.52, frameY);
    ctx.lineTo(frameX + frameW * 0.52, frameY + frameH);
    ctx.moveTo(frameX, frameY + frameH * 0.48);
    ctx.lineTo(frameX + frameW, frameY + frameH * 0.48);
    ctx.stroke();

    this.clearTrail.forEach((trail) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.18 * trail.life})`;
      ctx.arc(trail.x * width, trail.y * height, trail.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    this.dirtSpots.forEach((spot) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(96, 72, 44, ${spot.alpha})`;
      ctx.arc(spot.x * width, spot.y * height, spot.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    this.sparkles.forEach((sparkle) => {
      const x = sparkle.x * width;
      const y = sparkle.y * height;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * sparkle.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
    });
  }
}

class StepGame {
  constructor() {
    this.type = "step";
    this.reset();
  }

  reset() {
    this.count = 0;
    this.completed = false;
    this.lastCountedLeg = null;
    this.lastCountAt = 0;
    this.legState = {
      left: "down",
      right: "down",
    };
    const random = createRandom(77);
    this.footprints = Array.from({ length: TARGET_REPS }, (_, index) => {
      const lane = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      return {
        x: 0.14 + (row % 5) * 0.17 + random() * 0.02 + (lane < 0 ? 0.02 : 0.09),
        y: 0.82 - Math.floor(row / 5) * 0.17 + (row % 5) * 0.01 + random() * 0.01,
        rotation: lane * (0.34 + random() * 0.1),
        side: lane < 0 ? "left" : "right",
      };
    });
  }

  countStep(leg, time) {
    if (this.completed) {
      return;
    }
    const allowingSameLeg = time - this.lastCountAt > 950;
    if (!allowingSameLeg && this.lastCountedLeg === leg) {
      return;
    }
    this.lastCountedLeg = leg;
    this.lastCountAt = time;
    this.count += 1;
    if (this.count >= TARGET_REPS) {
      this.count = TARGET_REPS;
      this.completed = true;
    }
  }

  updateLeg(leg, lift, time) {
    const isLifted = lift > 0.06;
    const isLowered = lift < 0.045;
    const state = this.legState[leg];
    if (state === "down" && isLifted) {
      this.legState[leg] = "up";
      return;
    }
    if (state === "up" && isLowered) {
      this.legState[leg] = "down";
      this.countStep(leg, time);
    }
  }

  update(results, time) {
    if (this.completed) {
      return;
    }
    const pose = results.poseLandmarks;
    const leftHip = getVisiblePoint(pose, POSE.LEFT_HIP);
    const rightHip = getVisiblePoint(pose, POSE.RIGHT_HIP);
    const leftKnee = getVisiblePoint(pose, POSE.LEFT_KNEE);
    const rightKnee = getVisiblePoint(pose, POSE.RIGHT_KNEE);
    const leftAnkle = getVisiblePoint(pose, POSE.LEFT_ANKLE);
    const rightAnkle = getVisiblePoint(pose, POSE.RIGHT_ANKLE);
    const leftHeel = getVisiblePoint(pose, POSE.LEFT_HEEL);
    const rightHeel = getVisiblePoint(pose, POSE.RIGHT_HEEL);

    if (
      !leftHip || !rightHip || !leftKnee || !rightKnee ||
      !leftAnkle || !rightAnkle || !leftHeel || !rightHeel
    ) {
      return;
    }

    const leftFootY = (leftAnkle.y + leftHeel.y) / 2;
    const rightFootY = (rightAnkle.y + rightHeel.y) / 2;

    const leftLift = (leftHip.y - leftKnee.y) + (leftFootY - leftKnee.y) * 0.42;
    const rightLift = (rightHip.y - rightKnee.y) + (rightFootY - rightKnee.y) * 0.42;
    this.updateLeg("left", leftLift, time);
    this.updateLeg("right", rightLift, time);
  }

  drawFootprint(ctx, x, y, rotation, side, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = side === "left" ? "#8aa8c1" : "#6f8da6";
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    [[-12, -34], [-2, -41], [8, -38], [16, -29]].forEach(([px, py], index) => {
      ctx.beginPath();
      ctx.arc(px, py, 4 + index * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  draw(ctx, width, height) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#cfe9fb");
    sky.addColorStop(1, "#eef8ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#f8fcff";
    ctx.fillRect(0, height * 0.16, width, height * 0.84);

    for (let x = 0; x < width; x += 48) {
      for (let y = 130; y < height; y += 42) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.arc(x + ((y / 42) % 2) * 14, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.footprints.slice(0, this.count).forEach((foot) => {
      this.drawFootprint(ctx, foot.x * width, foot.y * height, foot.rotation, foot.side, 0.88);
    });

    if (this.completed) {
      for (let i = 0; i < 10; i += 1) {
        this.drawFootprint(
          ctx,
          (0.08 + (i % 5) * 0.18) * width,
          (0.22 + Math.floor(i / 5) * 0.18) * height,
          i % 2 === 0 ? -0.28 : 0.28,
          i % 2 === 0 ? "left" : "right",
          0.28
        );
      }
    }
  }
}

class JumpGame {
  constructor() {
    this.type = "jump";
    this.reset();
  }

  reset() {
    this.count = 0;
    this.completed = false;
    this.state = "grounded";
    this.baselineHeelY = null;
    this.baselineHipY = null;
    this.lastJumpAt = 0;
    this.peakMetric = 0;
  }

  update(results, time) {
    if (this.completed) {
      return;
    }
    const pose = results.poseLandmarks;
    const leftHeel = getVisiblePoint(pose, POSE.LEFT_HEEL);
    const rightHeel = getVisiblePoint(pose, POSE.RIGHT_HEEL);
    const leftHip = getVisiblePoint(pose, POSE.LEFT_HIP);
    const rightHip = getVisiblePoint(pose, POSE.RIGHT_HIP);

    if (!leftHeel || !rightHeel || !leftHip || !rightHip) {
      return;
    }

    const heelY = (leftHeel.y + rightHeel.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;

    if (this.baselineHeelY === null) {
      this.baselineHeelY = heelY;
      this.baselineHipY = hipY;
      return;
    }

    if (this.state === "grounded") {
      this.baselineHeelY = lerp(this.baselineHeelY, heelY, 0.06);
      this.baselineHipY = lerp(this.baselineHipY, hipY, 0.06);
    }

    const heelRise = this.baselineHeelY - heelY;
    const hipRise = this.baselineHipY - hipY;
    const jumpMetric = heelRise + hipRise * 0.82;

    if (this.state === "grounded" && jumpMetric > 0.065 && time - this.lastJumpAt > 420) {
      this.state = "airborne";
      this.peakMetric = jumpMetric;
      return;
    }

    if (this.state === "airborne") {
      this.peakMetric = Math.max(this.peakMetric, jumpMetric);
      if (jumpMetric < 0.02) {
        if (this.peakMetric > 0.07) {
          this.count += 1;
          this.lastJumpAt = time;
        }
        this.state = "grounded";
        this.peakMetric = 0;
      }
    }

    if (this.count >= TARGET_REPS) {
      this.count = TARGET_REPS;
      this.completed = true;
    }
  }

  draw(ctx, width, height) {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#e9eff8");
    bg.addColorStop(1, "#cfd9e8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const currentStep = Math.min(this.count + 1, TARGET_REPS);
    const topY = height * 0.18;
    const topH = height * 0.14;
    const faceY = topY + topH;
    const faceH = height * 0.58;

    ctx.fillStyle = "#bcc7d8";
    ctx.fillRect(width * 0.04, topY - 18, width * 0.92, 10);
    ctx.fillRect(width * 0.08, topY - 40, width * 0.84, 8);

    const topGrad = ctx.createLinearGradient(0, topY, 0, faceY);
    topGrad.addColorStop(0, "#fff2c9");
    topGrad.addColorStop(1, "#f1bf65");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, topY, width, topH);

    const faceGrad = ctx.createLinearGradient(0, faceY, 0, faceY + faceH);
    faceGrad.addColorStop(0, "#d79643");
    faceGrad.addColorStop(1, "#b97630");
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, faceY, width, faceH);

    ctx.strokeStyle = "rgba(126, 75, 26, 0.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, topY, width, topH);
    ctx.strokeRect(0, faceY, width, faceH);

    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.fillRect(0, topY + 12, width, 10);

    const remaining = TARGET_REPS - currentStep;
    if (remaining > 0) {
      const nextScale = 0.78;
      const nextW = width * nextScale;
      const nextX = (width - nextW) / 2;
      const nextTopY = topY - 112;
      const nextTopH = topH * 0.8;
      const nextFaceH = 82;

      ctx.fillStyle = "#f0cf8f";
      ctx.fillRect(nextX, nextTopY, nextW, nextTopH);
      ctx.fillStyle = "#c98a3c";
      ctx.fillRect(nextX, nextTopY + nextTopH, nextW, nextFaceH);
      ctx.strokeStyle = "rgba(126, 75, 26, 0.18)";
      ctx.strokeRect(nextX, nextTopY, nextW, nextTopH + nextFaceH);
    }

    ctx.fillStyle = "#173d53";
    ctx.font = "700 44px 'Hiragino Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${currentStep} 段目`, width / 2, faceY + faceH * 0.45);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 26px 'Hiragino Sans', sans-serif";
    ctx.fillText("ジャンプすると次の段が前にせり上がります", width / 2, faceY + faceH * 0.62);

    const progress = this.count / TARGET_REPS;
    ctx.fillStyle = "rgba(23,61,83,0.12)";
    ctx.fillRect(width * 0.14, height * 0.88, width * 0.72, 16);
    ctx.fillStyle = "#173d53";
    ctx.fillRect(width * 0.14, height * 0.88, width * 0.72 * progress, 16);
  }
}

class WarmUpApp {
  constructor() {
    this.video = document.getElementById("inputVideo");
    this.canvas = document.getElementById("outputCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.gameButtons = [...document.querySelectorAll(".game-button")];
    this.gameTitle = document.getElementById("gameTitle");
    this.trackingTarget = document.getElementById("trackingTarget");
    this.statusText = document.getElementById("statusText");
    this.countValue = document.getElementById("countValue");
    this.hudTitle = document.getElementById("hudTitle");
    this.hudCount = document.getElementById("hudCount");
    this.progressBar = document.getElementById("progressBar");
    this.startButton = document.getElementById("startButton");
    this.resetButton = document.getElementById("resetButton");
    this.bgmAudio = document.getElementById("bgmAudio");

    this.games = {
      wipe: new WipeGame(),
      step: new StepGame(),
      jump: new JumpGame(),
    };
    this.activeGame = this.games.wipe;
    this.sound = new SoundEngine();
    this.soundEnabledNoticeShown = false;
    this.completionFlash = 0;
    this.isGameStarted = false;
    this.cameraReady = false;

    this.smoothedResults = {
      poseLandmarks: null,
      leftHandLandmarks: null,
      rightHandLandmarks: null,
    };

    this.bindEvents();
  }

  bindEvents() {
    this.gameButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.selectGame(button.dataset.game);
      });
    });

    this.startButton.addEventListener("click", async () => {
      await this.startGame();
    });

    this.resetButton.addEventListener("click", async () => {
      this.activeGame.reset();
      this.isGameStarted = false;
      this.completionFlash = 0;
      this.updateHud();
      this.updateStartButton();
      this.stopBgm();
      this.setStatus("リセットしました。スタートを押すとゲームが始まります。");
      this.render();
    });
  }

  selectGame(gameType) {
    this.activeGame = this.games[gameType];
    this.activeGame.reset();
    this.isGameStarted = false;
    this.stopBgm();
    this.gameButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.game === gameType);
    });
    this.completionFlash = 0;
    this.updateHud();
    this.updateStartButton();
    this.setStatus("スタートを押すとゲームが始まります。");
    this.render();
  }

  updateStartButton() {
    this.startButton.textContent = this.isGameStarted ? "プレイ中" : "スタート";
    this.startButton.classList.toggle("ready", !this.isGameStarted);
  }

  async startGame() {
    if (!this.cameraReady) {
      this.setStatus("カメラの準備ができるまで少し待ってください。");
      return;
    }

    await this.sound.enable();
    this.activeGame.reset();
    this.isGameStarted = true;
    this.completionFlash = 0;
    this.updateHud();
    this.updateStartButton();
    await this.playBgm();
    this.setStatus(`${GAME_META[this.activeGame.type].status} ゲーム開始です。`);
    this.render();
  }

  async playBgm() {
    if (!this.bgmAudio) {
      return;
    }
    this.bgmAudio.currentTime = 0;
    try {
      await this.bgmAudio.play();
    } catch (error) {
      console.error(error);
      this.setStatus("fitnes.mp3 を再生できませんでした。ファイル配置を確認してください。");
    }
  }

  stopBgm() {
    if (!this.bgmAudio) {
      return;
    }
    this.bgmAudio.pause();
    this.bgmAudio.currentTime = 0;
  }

  updateHud() {
    const meta = GAME_META[this.activeGame.type];
    const count = this.activeGame.count;
    const progress = (count / TARGET_REPS) * 100;
    this.gameTitle.textContent = meta.title;
    this.trackingTarget.textContent = meta.tracking;
    this.countValue.textContent = String(count);
    this.hudTitle.textContent = meta.title;
    this.hudCount.textContent = `${count} / ${TARGET_REPS}`;
    this.progressBar.style.width = `${progress}%`;
  }

  setStatus(message) {
    this.statusText.textContent = message;
  }

  async start() {
    this.updateHud();
    this.updateStartButton();
    this.render();
    this.setStatus("カメラを初期化しています…");

    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
      selfieMode: true,
    });

    holistic.onResults((results) => this.onResults(results));
    this.holistic = holistic;

    try {
      this.camera = new Camera(this.video, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        onFrame: async () => {
          await this.holistic.send({ image: this.video });
        },
      });
      await this.camera.start();
      this.cameraReady = true;
      this.setStatus("スタートを押すとゲームが始まります。画面にはゲームだけを表示しています。");
    } catch (error) {
      console.error(error);
      this.setStatus("カメラを開始できませんでした。HTTPS または localhost で開いてください。");
    }
  }

  onResults(results) {
    this.smoothedResults.poseLandmarks = smoothLandmarks(
      this.smoothedResults.poseLandmarks,
      results.poseLandmarks,
      0.45
    );
    this.smoothedResults.leftHandLandmarks = smoothLandmarks(
      this.smoothedResults.leftHandLandmarks,
      results.leftHandLandmarks,
      0.42
    );
    this.smoothedResults.rightHandLandmarks = smoothLandmarks(
      this.smoothedResults.rightHandLandmarks,
      results.rightHandLandmarks,
      0.42
    );

    const processed = {
      poseLandmarks: this.smoothedResults.poseLandmarks,
      leftHandLandmarks: this.smoothedResults.leftHandLandmarks,
      rightHandLandmarks: this.smoothedResults.rightHandLandmarks,
    };

    if (!this.isGameStarted) {
      this.render();
      return;
    }

    const beforeCount = this.activeGame.count;
    const wasCompleted = this.activeGame.completed;
    this.activeGame.update(processed, performance.now());

    if (this.activeGame.count > beforeCount) {
      if (this.activeGame.type === "wipe") {
        this.sound.playProgress();
      } else if (this.activeGame.type === "step") {
        this.sound.playStep();
      } else {
        this.sound.playJump();
      }
    }

    if (!wasCompleted && this.activeGame.completed) {
      this.sound.playSuccess();
      this.stopBgm();
      this.isGameStarted = false;
      this.completionFlash = 1;
      this.updateStartButton();
      this.setStatus(`${GAME_META[this.activeGame.type].title} クリア！ もう一度遊ぶにはリセットしてください。`);
    }

    if (this.completionFlash > 0) {
      this.completionFlash *= 0.94;
    }

    this.updateHud();
    this.render();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.activeGame.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.drawTrackingHint();
    if (!this.isGameStarted && !this.activeGame.completed) {
      this.drawStartOverlay();
    }
    if (this.activeGame.completed) {
      this.drawCompletionOverlay();
    }
  }

  drawStartOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(22, 32, 48, 0.34)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 62px 'Hiragino Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("START", this.canvas.width / 2, this.canvas.height / 2 - 10);
    ctx.font = "600 26px 'Hiragino Sans', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("左のスタートボタンを押すと fitnes.mp3 と一緒に始まります", this.canvas.width / 2, this.canvas.height / 2 + 42);
    ctx.restore();
  }

  drawTrackingHint() {
    const ctx = this.ctx;
    const labels = {
      wipe: "検出中: 手のひら",
      step: "検出中: 膝",
      jump: "検出中: 踵",
    };
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.strokeStyle = "rgba(70,55,40,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(22, this.canvas.height - 82, 188, 42, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#594532";
    ctx.font = "600 20px 'Hiragino Sans', sans-serif";
    ctx.fillText(labels[this.activeGame.type], 38, this.canvas.height - 54);
    ctx.restore();
  }

  drawCompletionOverlay() {
    const ctx = this.ctx;
    const alpha = 0.72 + this.completionFlash * 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(19, 36, 56, ${alpha})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 68px 'Hiragino Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CLEAR!", this.canvas.width / 2, this.canvas.height / 2 - 22);

    const messages = {
      wipe: "窓がピカピカになりました",
      step: "雪原が足跡でいっぱいです",
      jump: "頂上に到着しました",
    };
    ctx.font = "600 30px 'Hiragino Sans', sans-serif";
    ctx.fillText(messages[this.activeGame.type], this.canvas.width / 2, this.canvas.height / 2 + 34);

    ctx.font = "500 22px 'Hiragino Sans', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("リセットボタンでもう一度遊べます", this.canvas.width / 2, this.canvas.height / 2 + 86);

    for (let i = 0; i < 22; i += 1) {
      const angle = (Math.PI * 2 * i) / 22;
      const radius = 182 + Math.sin(this.completionFlash * 10 + i) * 18;
      const x = this.canvas.width / 2 + Math.cos(angle) * radius;
      const y = this.canvas.height / 2 + Math.sin(angle) * radius * 0.55;
      ctx.beginPath();
      ctx.fillStyle = i % 2 === 0 ? "#ffd45f" : "#ff8c63";
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

window.addEventListener("load", async () => {
  const app = new WarmUpApp();
  await app.start();
});
