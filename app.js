const TARGET_REPS = 50;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const MIN_VISIBILITY = 0.55;

const POSE = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
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
    status: "手のひらを窓の中で左右に動かしてください",
  },
  step: {
    title: "足踏みゲーム",
    tracking: "膝",
    status: "左右の膝を交互に上げて足踏みしてください",
  },
  jump: {
    title: "ジャンプゲーム",
    tracking: "踵",
    status: "軽くジャンプして階段をのぼりましょう",
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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
    this.lastMotionAt = 0;
    this.clearTrail = [];
    const random = createRandom(31);
    this.dirtSpots = Array.from({ length: 240 }, () => ({
      x: 0.17 + random() * 0.66,
      y: 0.17 + random() * 0.62,
      radius: 6 + random() * 18,
      alpha: 0.18 + random() * 0.24,
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
    const radius = 0.05 + Math.min(strength, 0.03);
    this.dirtSpots = this.dirtSpots.filter((spot) => {
      const dx = spot.x - palm.x;
      const dy = spot.y - palm.y;
      return dx * dx + dy * dy > radius * radius;
    });
    this.clearTrail.push({
      x: palm.x,
      y: palm.y,
      radius: 30 + strength * 900,
      life: 1,
    });
    if (this.clearTrail.length > 18) {
      this.clearTrail.shift();
    }
  }

  update(results, time) {
    if (this.completed) {
      return;
    }
    const palm = this.getPalm(results);
    this.clearTrail.forEach((trail) => {
      trail.life *= 0.93;
    });
    this.clearTrail = this.clearTrail.filter((trail) => trail.life > 0.08);

    if (!palm) {
      this.lastPalm = null;
      return;
    }

    const insideGlass =
      palm.x > 0.14 && palm.x < 0.86 &&
      palm.y > 0.14 && palm.y < 0.84;

    if (!insideGlass) {
      this.lastPalm = palm;
      return;
    }

    if (this.lastPalm) {
      const dx = palm.x - this.lastPalm.x;
      const dy = palm.y - this.lastPalm.y;
      const distance = Math.hypot(dx, dy);
      const energeticMotion = distance > 0.008 && (Math.abs(dx) > 0.006 || Math.abs(dy) > 0.006);

      if (energeticMotion) {
        this.movementBudget += distance;
        this.lastMotionAt = time;
        this.clearAroundPalm(palm, distance);
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
    const frameX = width * 0.12;
    const frameY = height * 0.12;
    const frameW = width * 0.76;
    const frameH = height * 0.76;

    ctx.save();
    ctx.fillStyle = "rgba(192, 229, 240, 0.18)";
    ctx.fillRect(frameX, frameY, frameW, frameH);

    const gloss = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    gloss.addColorStop(0, "rgba(255,255,255,0.18)");
    gloss.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = gloss;
    ctx.fillRect(frameX, frameY, frameW, frameH);

    this.clearTrail.forEach((trail) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.12 * trail.life})`;
      ctx.arc(trail.x * width, trail.y * height, trail.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    this.dirtSpots.forEach((spot) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(110, 90, 72, ${spot.alpha})`;
      ctx.arc(spot.x * width, spot.y * height, spot.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.lineWidth = 24;
    ctx.strokeStyle = "rgba(105, 72, 45, 0.88)";
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(246, 220, 191, 0.85)";
    ctx.strokeRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20);

    if (this.completed) {
      for (let index = 0; index < 7; index += 1) {
        const x = frameX + 90 + index * 100;
        const y = frameY + 110 + (index % 2) * 70;
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.moveTo(x - 16, y);
        ctx.lineTo(x + 16, y);
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
      }
    }
    ctx.restore();
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
        x: 0.23 + (row % 6) * 0.1 + random() * 0.03,
        y: 0.8 - row * 0.03 + random() * 0.01,
        rotation: lane * (0.32 + random() * 0.12),
        side: lane < 0 ? "left" : "right",
      };
    });
  }

  countStep(leg, time) {
    if (this.completed) {
      return;
    }
    const allowingSameLeg = time - this.lastCountAt > 1000;
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
    const isLifted = lift > 0.075;
    const isLowered = lift < 0.04;
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

    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
      return;
    }

    const leftLift = leftHip.y - leftKnee.y;
    const rightLift = rightHip.y - rightKnee.y;
    this.updateLeg("left", leftLift, time);
    this.updateLeg("right", rightLift, time);
  }

  drawFootprint(ctx, x, y, rotation, side) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = side === "left" ? "rgba(66, 97, 130, 0.34)" : "rgba(44, 78, 112, 0.34)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    [-14, -6, 2, 10].forEach((offset, index) => {
      ctx.beginPath();
      ctx.arc(-12 + index * 8, -28 + offset * 0.05, 4 + index * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  draw(ctx, width, height) {
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "rgba(215, 235, 255, 0.28)");
    sky.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(244, 250, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.78);
    ctx.quadraticCurveTo(width * 0.25, height * 0.68, width * 0.5, height * 0.78);
    ctx.quadraticCurveTo(width * 0.76, height * 0.88, width, height * 0.74);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    this.footprints.slice(0, this.count).forEach((foot) => {
      this.drawFootprint(ctx, foot.x * width, foot.y * height, foot.rotation, foot.side);
    });

    if (this.completed) {
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "bold 34px 'Hiragino Sans', sans-serif";
      ctx.fillText("雪原が足跡でいっぱい！", width * 0.28, height * 0.13);
    }
    ctx.restore();
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
    const jumpMetric = heelRise + hipRise * 0.8;

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
    const progress = this.count / TARGET_REPS;
    const stairWidth = width * 0.11;
    const stairHeight = height * 0.048;
    const stairs = 8;

    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "rgba(255, 235, 197, 0.24)");
    sky.addColorStop(0.55, "rgba(255,255,255,0.05)");
    sky.addColorStop(1, "rgba(168, 206, 255, 0.18)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(133, 170, 200, 0.28)";
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.9);
    ctx.lineTo(width * 0.38, height * 0.46);
    ctx.lineTo(width * 0.64, height * 0.9);
    ctx.closePath();
    ctx.fill();

    for (let index = 0; index < stairs; index += 1) {
      const x = width * 0.24 + stairWidth * index;
      const y = height * 0.84 - stairHeight * index;
      ctx.fillStyle = index % 2 === 0 ? "#d8a86e" : "#bf874f";
      ctx.fillRect(x, y, stairWidth + 2, stairHeight + 2);
      ctx.strokeStyle = "rgba(101, 60, 29, 0.24)";
      ctx.strokeRect(x, y, stairWidth + 2, stairHeight + 2);
    }

    const climberX = lerp(width * 0.29, width * 0.92, progress);
    const climberY = lerp(height * 0.82, height * 0.48, progress);
    ctx.fillStyle = "#214c65";
    ctx.beginPath();
    ctx.arc(climberX, climberY - 36, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#214c65";
    ctx.beginPath();
    ctx.moveTo(climberX, climberY - 18);
    ctx.lineTo(climberX, climberY + 26);
    ctx.moveTo(climberX, climberY - 4);
    ctx.lineTo(climberX - 20, climberY + 10);
    ctx.moveTo(climberX, climberY - 4);
    ctx.lineTo(climberX + 18, climberY - 14);
    ctx.moveTo(climberX, climberY + 24);
    ctx.lineTo(climberX - 18, climberY + 56);
    ctx.moveTo(climberX, climberY + 24);
    ctx.lineTo(climberX + 24, climberY + 48);
    ctx.stroke();

    if (this.completed) {
      ctx.fillStyle = "#e15f3b";
      ctx.fillRect(width * 0.91, height * 0.31, 6, 68);
      ctx.beginPath();
      ctx.moveTo(width * 0.917, height * 0.31);
      ctx.lineTo(width * 0.84, height * 0.34);
      ctx.lineTo(width * 0.917, height * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = "bold 34px 'Hiragino Sans', sans-serif";
      ctx.fillText("頂上に到着！", width * 0.64, height * 0.16);
    }
    ctx.restore();
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
    this.resetButton = document.getElementById("resetButton");

    this.games = {
      wipe: new WipeGame(),
      step: new StepGame(),
      jump: new JumpGame(),
    };
    this.activeGame = this.games.wipe;

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
    this.resetButton.addEventListener("click", () => {
      this.activeGame.reset();
      this.updateHud();
      this.setStatus(GAME_META[this.activeGame.type].status);
    });
  }

  selectGame(gameType) {
    this.activeGame = this.games[gameType];
    this.activeGame.reset();
    this.gameButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.game === gameType);
    });
    this.updateHud();
    this.setStatus(GAME_META[gameType].status);
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
      this.setStatus(GAME_META[this.activeGame.type].status);
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

    this.activeGame.update(processed, performance.now());
    this.updateHud();
    this.render(results.image, processed);
  }

  render(image, processed) {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "rgba(255, 250, 245, 0.08)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.activeGame.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.drawGuides(processed);

    this.ctx.restore();
  }

  drawGuides(processed) {
    const ctx = this.ctx;
    ctx.save();

    if (processed.poseLandmarks) {
      drawConnectors(ctx, processed.poseLandmarks, POSE_CONNECTIONS, {
        color: "rgba(38, 76, 106, 0.45)",
        lineWidth: 4,
      });
      drawLandmarks(ctx, processed.poseLandmarks, {
        color: "rgba(255, 255, 255, 0.75)",
        fillColor: "rgba(38, 76, 106, 0.75)",
        radius: 3,
      });
    }

    if (processed.leftHandLandmarks) {
      drawConnectors(ctx, processed.leftHandLandmarks, HAND_CONNECTIONS, {
        color: "rgba(219, 123, 79, 0.72)",
        lineWidth: 3,
      });
      drawLandmarks(ctx, processed.leftHandLandmarks, {
        color: "rgba(255,255,255,0.9)",
        fillColor: "rgba(219, 123, 79, 0.86)",
        radius: 3,
      });
    }

    if (processed.rightHandLandmarks) {
      drawConnectors(ctx, processed.rightHandLandmarks, HAND_CONNECTIONS, {
        color: "rgba(219, 123, 79, 0.72)",
        lineWidth: 3,
      });
      drawLandmarks(ctx, processed.rightHandLandmarks, {
        color: "rgba(255,255,255,0.9)",
        fillColor: "rgba(219, 123, 79, 0.86)",
        radius: 3,
      });
    }

    this.highlightTrackingTarget(processed);
    ctx.restore();
  }

  highlightTrackingTarget(processed) {
    const ctx = this.ctx;
    const gameType = this.activeGame.type;
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255, 214, 125, 0.95)";
    ctx.fillStyle = "rgba(255, 214, 125, 0.32)";

    if (gameType === "wipe") {
      const palm =
        getPalmCenter(processed.leftHandLandmarks) || getPalmCenter(processed.rightHandLandmarks);
      if (palm) {
        ctx.beginPath();
        ctx.arc(palm.x * this.canvas.width, palm.y * this.canvas.height, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (gameType === "step") {
      ["LEFT_KNEE", "RIGHT_KNEE"].forEach((key) => {
        const point = getVisiblePoint(processed.poseLandmarks, POSE[key]);
        if (!point) {
          return;
        }
        ctx.beginPath();
        ctx.arc(point.x * this.canvas.width, point.y * this.canvas.height, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    if (gameType === "jump") {
      ["LEFT_HEEL", "RIGHT_HEEL"].forEach((key) => {
        const point = getVisiblePoint(processed.poseLandmarks, POSE[key]);
        if (!point) {
          return;
        }
        ctx.beginPath();
        ctx.arc(point.x * this.canvas.width, point.y * this.canvas.height, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }
}

window.addEventListener("load", async () => {
  const app = new WarmUpApp();
  await app.start();
});
