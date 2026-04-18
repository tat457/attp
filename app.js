
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
};
  wipe: {
    title: "窓ふきゲーム",
    tracking: "手のひら",
    status: "手のひらを窓の中で左右に動かしてください",
    status: "手のひらを大きく動かして窓を拭いてください",
  },
  step: {
    title: "足踏みゲーム",
    tracking: "膝",
    status: "左右の膝を交互に上げて足踏みしてください",
    status: "左右の膝を交互に上げて雪原を埋めてください",
  },
  jump: {
    title: "ジャンプゲーム",
    tracking: "踵",
    status: "軽くジャンプして階段をのぼりましょう",
    status: "ジャンプして正面の階段を1段ずつ登りましょう",
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
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
    this.completed = false;
    this.movementBudget = 0;
    this.lastPalm = null;
    this.lastMotionAt = 0;
    this.clearTrail = [];
    this.sparkles = [];
    const random = createRandom(31);
    this.dirtSpots = Array.from({ length: 240 }, () => ({
      x: 0.17 + random() * 0.66,
      y: 0.17 + random() * 0.62,
      radius: 6 + random() * 18,
      alpha: 0.18 + random() * 0.24,
    this.dirtSpots = Array.from({ length: 260 }, () => ({
      x: 0.19 + random() * 0.62,
      y: 0.18 + random() * 0.58,
      radius: 10 + random() * 24,
      alpha: 0.16 + random() * 0.18,
    }));
  }

  }

  clearAroundPalm(palm, strength) {
    const radius = 0.05 + Math.min(strength, 0.03);
    const radius = 0.05 + Math.min(strength, 0.032);
    this.dirtSpots = this.dirtSpots.filter((spot) => {
      const dx = spot.x - palm.x;
      const dy = spot.y - palm.y;
    this.clearTrail.push({
      x: palm.x,
      y: palm.y,
      radius: 30 + strength * 900,
      radius: 36 + strength * 850,
      life: 1,
    });
    if (this.clearTrail.length > 18) {
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

  update(results, time) {
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
      trail.life *= 0.93;
      trail.life *= 0.92;
    });
    this.clearTrail = this.clearTrail.filter((trail) => trail.life > 0.08);
    this.sparkles.forEach((sparkle) => {
      sparkle.life *= 0.9;
    });
    this.sparkles = this.sparkles.filter((sparkle) => sparkle.life > 0.08);

    if (!palm) {
      this.lastPalm = null;
    }

    const insideGlass =
      palm.x > 0.14 && palm.x < 0.86 &&
      palm.y > 0.14 && palm.y < 0.84;
      palm.x > 0.17 && palm.x < 0.83 &&
      palm.y > 0.16 && palm.y < 0.78;

    if (!insideGlass) {
      this.lastPalm = palm;
      const dx = palm.x - this.lastPalm.x;
      const dy = palm.y - this.lastPalm.y;
      const distance = Math.hypot(dx, dy);
      const energeticMotion = distance > 0.008 && (Math.abs(dx) > 0.006 || Math.abs(dy) > 0.006);
      const energeticMotion = distance > 0.008 && (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005);

      if (energeticMotion) {
        this.movementBudget += distance;
        this.lastMotionAt = time;
        this.clearAroundPalm(palm, distance);
      }

  }

  draw(ctx, width, height) {
    const frameX = width * 0.12;
    const frameX = width * 0.15;
    const frameY = height * 0.12;
    const frameW = width * 0.76;
    const frameH = height * 0.76;
    const frameW = width * 0.7;
    const frameH = height * 0.66;

    ctx.save();
    ctx.fillStyle = "rgba(192, 229, 240, 0.18)";
    ctx.fillRect(frameX, frameY, frameW, frameH);
    const wall = ctx.createLinearGradient(0, 0, 0, height);
    wall.addColorStop(0, "#d7c8b4");
    wall.addColorStop(1, "#bca689");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);

    const gloss = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    gloss.addColorStop(0, "rgba(255,255,255,0.18)");
    gloss.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = gloss;
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
      ctx.fillStyle = `rgba(255,255,255,${0.12 * trail.life})`;
      ctx.fillStyle = `rgba(255,255,255,${0.18 * trail.life})`;
      ctx.arc(trail.x * width, trail.y * height, trail.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    this.dirtSpots.forEach((spot) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(110, 90, 72, ${spot.alpha})`;
      ctx.fillStyle = `rgba(96, 72, 44, ${spot.alpha})`;
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

      const lane = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      return {
        x: 0.23 + (row % 6) * 0.1 + random() * 0.03,
        y: 0.8 - row * 0.03 + random() * 0.01,
        rotation: lane * (0.32 + random() * 0.12),
        x: 0.14 + (row % 5) * 0.17 + random() * 0.02 + (lane < 0 ? 0.02 : 0.09),
        y: 0.82 - Math.floor(row / 5) * 0.17 + (row % 5) * 0.01 + random() * 0.01,
        rotation: lane * (0.34 + random() * 0.1),
        side: lane < 0 ? "left" : "right",
      };
    });
    if (this.completed) {
      return;
    }
    const allowingSameLeg = time - this.lastCountAt > 1000;
    const allowingSameLeg = time - this.lastCountAt > 950;
    if (!allowingSameLeg && this.lastCountedLeg === leg) {
      return;
    }
    this.updateLeg("right", rightLift, time);
  }

  drawFootprint(ctx, x, y, rotation, side) {
  drawFootprint(ctx, x, y, rotation, side, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = side === "left" ? "rgba(66, 97, 130, 0.34)" : "rgba(44, 78, 112, 0.34)";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = side === "left" ? "#8aa8c1" : "#6f8da6";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 34, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 0, 20, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    [-14, -6, 2, 10].forEach((offset, index) => {
    [[-12, -34], [-2, -41], [8, -38], [16, -29]].forEach(([px, py], index) => {
      ctx.beginPath();
      ctx.arc(-12 + index * 8, -28 + offset * 0.05, 4 + index * 0.4, 0, Math.PI * 2);
      ctx.arc(px, py, 4 + index * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  draw(ctx, width, height) {
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "rgba(215, 235, 255, 0.28)");
    sky.addColorStop(1, "rgba(255,255,255,0.06)");
    sky.addColorStop(0, "#cfe9fb");
    sky.addColorStop(1, "#eef8ff");
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
      this.drawFootprint(ctx, foot.x * width, foot.y * height, foot.rotation, foot.side);
      this.drawFootprint(ctx, foot.x * width, foot.y * height, foot.rotation, foot.side, 0.88);
    });

    if (this.completed) {
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "bold 34px 'Hiragino Sans', sans-serif";
      ctx.fillText("雪原が足跡でいっぱい！", width * 0.28, height * 0.13);
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
    ctx.restore();
  }
}


    const heelRise = this.baselineHeelY - heelY;
    const hipRise = this.baselineHipY - hipY;
    const jumpMetric = heelRise + hipRise * 0.8;
    const jumpMetric = heelRise + hipRise * 0.82;

    if (this.state === "grounded" && jumpMetric > 0.065 && time - this.lastJumpAt > 420) {
      this.state = "airborne";
    }
  }

  draw(ctx, width, height) {
    const progress = this.count / TARGET_REPS;
    const stairWidth = width * 0.11;
    const stairHeight = height * 0.048;
    const stairs = 8;
  drawCharacter(ctx, x, y) {
    ctx.fillStyle = "#18435a";
    ctx.beginPath();
    ctx.arc(x, y - 36, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#18435a";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y + 24);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x - 18, y + 12);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 18, y - 16);
    ctx.moveTo(x, y + 24);
    ctx.lineTo(x - 18, y + 54);
    ctx.moveTo(x, y + 24);
    ctx.lineTo(x + 20, y + 50);
    ctx.stroke();
  }

    ctx.save();
  draw(ctx, width, height) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "rgba(255, 235, 197, 0.24)");
    sky.addColorStop(0.55, "rgba(255,255,255,0.05)");
    sky.addColorStop(1, "rgba(168, 206, 255, 0.18)");
    sky.addColorStop(0, "#c3e5ff");
    sky.addColorStop(1, "#eff7ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(133, 170, 200, 0.28)";
    ctx.fillStyle = "#dcecff";
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.9);
    ctx.lineTo(width * 0.38, height * 0.46);
    ctx.lineTo(width * 0.64, height * 0.9);
    ctx.moveTo(0, height * 0.86);
    ctx.lineTo(width * 0.22, height * 0.72);
    ctx.lineTo(width * 0.78, height * 0.72);
    ctx.lineTo(width, height * 0.86);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    for (let index = 0; index < stairs; index += 1) {
      const x = width * 0.24 + stairWidth * index;
      const y = height * 0.84 - stairHeight * index;
      ctx.fillStyle = index % 2 === 0 ? "#d8a86e" : "#bf874f";
    const stairCount = TARGET_REPS;
    const startX = width * 0.18;
    const startY = height * 0.9;
    const stairWidth = width * 0.0135;
    const stairHeight = height * 0.0082;

    for (let i = 0; i < stairCount; i += 1) {
      const x = startX + i * stairWidth;
      const y = startY - i * stairHeight;
      ctx.fillStyle = i < this.count ? "#efb25b" : "#d6d9e0";
      ctx.fillRect(x, y, stairWidth + 2, stairHeight + 2);
      ctx.strokeStyle = "rgba(101, 60, 29, 0.24)";
      ctx.strokeStyle = i < this.count ? "rgba(135, 79, 26, 0.26)" : "rgba(120, 130, 150, 0.18)";
      ctx.strokeRect(x, y, stairWidth + 2, stairHeight + 2);
    }

    const climberX = lerp(width * 0.29, width * 0.92, progress);
    const climberY = lerp(height * 0.82, height * 0.48, progress);
    ctx.fillStyle = "#214c65";
    const currentStep = Math.min(this.count, stairCount - 1);
    const climberX = startX + currentStep * stairWidth + stairWidth * 0.5;
    const climberY = startY - currentStep * stairHeight - 14;
    this.drawCharacter(ctx, climberX, climberY);

    ctx.fillStyle = "#ff7044";
    ctx.fillRect(startX + stairCount * stairWidth + 26, startY - stairCount * stairHeight - 30, 6, 84);
    ctx.beginPath();
    ctx.arc(climberX, climberY - 36, 16, 0, Math.PI * 2);
    ctx.moveTo(startX + stairCount * stairWidth + 32, startY - stairCount * stairHeight - 30);
    ctx.lineTo(startX + stairCount * stairWidth - 36, startY - stairCount * stairHeight - 10);
    ctx.lineTo(startX + stairCount * stairWidth + 32, startY - stairCount * stairHeight + 8);
    ctx.closePath();
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

      jump: new JumpGame(),
    };
    this.activeGame = this.games.wipe;
    this.sound = new SoundEngine();
    this.soundEnabledNoticeShown = false;
    this.completionFlash = 0;

    this.smoothedResults = {
      poseLandmarks: null,

  bindEvents() {
    this.gameButtons.forEach((button) => {
      button.addEventListener("click", () => {
      button.addEventListener("click", async () => {
        await this.sound.enable();
        this.selectGame(button.dataset.game);
      });
    });
    this.resetButton.addEventListener("click", () => {

    this.resetButton.addEventListener("click", async () => {
      await this.sound.enable();
      this.activeGame.reset();
      this.completionFlash = 0;
      this.updateHud();
      this.setStatus(GAME_META[this.activeGame.type].status);
      this.render();
    });

    window.addEventListener(
      "pointerdown",
      async () => {
        await this.sound.enable();
        if (!this.soundEnabledNoticeShown && this.sound.enabled) {
          this.soundEnabledNoticeShown = true;
          this.setStatus(`${GAME_META[this.activeGame.type].status} 音も有効になりました。`);
        }
      },
      { once: true }
    );
  }

  selectGame(gameType) {
    this.gameButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.game === gameType);
    });
    this.completionFlash = 0;
    this.updateHud();
    this.setStatus(GAME_META[gameType].status);
    this.render();
  }

  updateHud() {

  async start() {
    this.updateHud();
    this.render();
    this.setStatus("カメラを初期化しています…");

    const holistic = new Holistic({
        },
      });
      await this.camera.start();
      this.setStatus(GAME_META[this.activeGame.type].status);
      this.setStatus(`${GAME_META[this.activeGame.type].status} 画面にはゲームだけを表示しています。`);
    } catch (error) {
      console.error(error);
      this.setStatus("カメラを開始できませんでした。HTTPS または localhost で開いてください。");
      rightHandLandmarks: this.smoothedResults.rightHandLandmarks,
    };

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
      this.completionFlash = 1;
      this.setStatus(`${GAME_META[this.activeGame.type].title} クリア！ もう一度遊ぶにはリセットしてください。`);
    }

    if (this.completionFlash > 0) {
      this.completionFlash *= 0.94;
    }

    this.updateHud();
    this.render(results.image, processed);
    this.render();
  }

  render(image, processed) {
    this.ctx.save();
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "rgba(255, 250, 245, 0.08)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.activeGame.draw(this.ctx, this.canvas.width, this.canvas.height);
    this.drawGuides(processed);

    this.ctx.restore();
    this.drawTrackingHint();
    if (this.activeGame.completed) {
      this.drawCompletionOverlay();
    }
  }

  drawGuides(processed) {
  drawTrackingHint() {
    const ctx = this.ctx;
    const labels = {
      wipe: "検出中: 手のひら",
      step: "検出中: 膝",
      jump: "検出中: 踵",
    };
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

  highlightTrackingTarget(processed) {
  drawCompletionOverlay() {
    const ctx = this.ctx;
    const gameType = this.activeGame.type;
    const alpha = 0.72 + this.completionFlash * 0.18;
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255, 214, 125, 0.95)";
    ctx.fillStyle = "rgba(255, 214, 125, 0.32)";
    ctx.fillStyle = `rgba(19, 36, 56, ${alpha})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 68px 'Hiragino Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CLEAR!", this.canvas.width / 2, this.canvas.height / 2 - 22);

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
