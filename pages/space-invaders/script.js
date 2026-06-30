// Space Invaders Game
const gameState = {
  canvas: null,
  ctx: null,

  running: false,
  paused: false,
  score: 0,
  level: 1,
  lives: 3,

  player: {
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    speed: 5,
    dx: 0
  },

  bullets: [],
  enemies: [],
  enemyBullets: [],
  bulletSpeed: 7,
  enemySpeed: 2,

  keys: {},

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.player.x = this.canvas.width / 2 - this.player.width / 2;
    this.player.y = this.canvas.height - 60;

    this.attachEventListeners();
    this.loop();
  },

  attachEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (e.key === ' ') {
        e.preventDefault();
        this.shoot();
      }
      if (e.key.toLowerCase() === 'p') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
  },

  shoot() {
    if (this.running && !this.paused) {
      this.bullets.push({
        x: this.player.x + this.player.width / 2 - 2,
        y: this.player.y,
        width: 4,
        height: 15
      });
    }
  },

  createEnemies() {
    this.enemies = [];
    const rows = 3;
    const cols = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.enemies.push({
          x: 60 + c * 100,
          y: 40 + r * 70,
          width: 30,
          height: 25
        });
      }
    }
  },

  drawPlayer() {
    const p = this.player;
    this.ctx.fillStyle = '#3be9ff';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = '#3be9ff';

    this.ctx.beginPath();
    this.ctx.moveTo(p.x + p.width / 2, p.y);
    this.ctx.lineTo(p.x + p.width, p.y + p.height);
    this.ctx.lineTo(p.x, p.y + p.height);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
  },

  drawEnemies() {
    this.ctx.fillStyle = '#ff4fcf';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#ff4fcf';

    this.enemies.forEach(enemy => {
      this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      this.ctx.strokeStyle = '#ffd5ff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(enemy.x + 5, enemy.y + 5, enemy.width - 10, enemy.height - 10);
    });

    this.ctx.shadowBlur = 0;
  },

  drawBullets() {
    this.ctx.fillStyle = '#ffb36b';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = '#ffb36b';

    this.bullets.forEach(bullet => {
      this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    this.ctx.shadowBlur = 0;
  },

  drawEnemyBullets() {
    this.ctx.fillStyle = '#ff5e93';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = '#ff5e93';

    this.enemyBullets.forEach(bullet => {
      this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    this.ctx.shadowBlur = 0;
  },

  updatePlayer() {
    this.player.dx = 0;

    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.player.dx = -this.player.speed;
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.player.dx = this.player.speed;
    }

    this.player.x += this.player.dx;

    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x + this.player.width > this.canvas.width) {
      this.player.x = this.canvas.width - this.player.width;
    }
  },

  updateBullets() {
    this.bullets.forEach(b => { b.y -= this.bulletSpeed; });
    this.bullets = this.bullets.filter(b => b.y + b.height > 0);
  },

  updateEnemies() {
    let changeDirection = false;

    this.enemies.forEach(enemy => {
      enemy.x += this.enemySpeed;
      if (enemy.x <= 0 || enemy.x + enemy.width >= this.canvas.width) {
        changeDirection = true;
      }
    });

    if (changeDirection) {
      this.enemySpeed *= -1;
      this.enemies.forEach(enemy => {
        enemy.y += 30;
        enemy.x += this.enemySpeed;
      });
    }

    if (Math.random() < 0.02 && this.enemies.length > 0) {
      const randomEnemy = this.enemies[Math.floor(Math.random() * this.enemies.length)];
      this.enemyBullets.push({
        x: randomEnemy.x + randomEnemy.width / 2 - 2,
        y: randomEnemy.y + randomEnemy.height,
        width: 4,
        height: 12,
        dy: 4
      });
    }
  },

  updateEnemyBullets() {
    this.enemyBullets.forEach(b => { b.y += b.dy; });
    this.enemyBullets = this.enemyBullets.filter(b => b.y < this.canvas.height);
  },

  checkCollisions() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const b = this.bullets[i];
        const e = this.enemies[j];
        if (b && e &&
            b.x < e.x + e.width &&
            b.x + b.width > e.x &&
            b.y < e.y + e.height &&
            b.y + b.height > e.y) {
          this.score += 10;
          this.bullets.splice(i, 1);
          this.enemies.splice(j, 1);
          break;
        }
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      const p = this.player;
      if (b.x < p.x + p.width &&
          b.x + b.width > p.x &&
          b.y < p.y + p.height &&
          b.y + b.height > p.y) {
        this.lives--;
        this.enemyBullets.splice(i, 1);
        if (this.lives <= 0) {
          this.endGame();
        }
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.y + enemy.height >= this.canvas.height) {
        this.lives = 0;
        this.endGame();
        break;
      }
    }
  },

  endGame() {
    this.running = false;
    document.getElementById('gameOverMessage').textContent = `GAME OVER! SCORE: ${this.score}`;
    document.getElementById('gameOverMessage').style.display = 'block';
  },

  updateUI() {
    document.getElementById('score').textContent = this.score;
    document.getElementById('lives').textContent = this.lives;
    document.getElementById('level').textContent = this.level;
  },

  loop() {
    const ctx = this.ctx;
    ctx.fillStyle = '#08031a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.strokeStyle = 'rgba(59, 233, 255, 0.16)';
    ctx.lineWidth = 1;
    for (let y = this.canvas.height * 0.58; y < this.canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }

    if (this.running && !this.paused) {
      this.updatePlayer();
      this.updateBullets();
      this.updateEnemies();
      this.updateEnemyBullets();
      this.checkCollisions();

      if (this.enemies.length === 0) {
        this.level++;
        const dir = this.enemySpeed > 0 ? 1 : -1;
        this.enemySpeed = dir * (2 + this.level);
        this.createEnemies();
        this.score += 100;
      }
    }

    this.drawEnemies();
    this.drawBullets();
    this.drawEnemyBullets();
    this.drawPlayer();
    this.updateUI();

    if (!this.running && !document.getElementById('gameOverMessage').style.display.includes('block')) {
      ctx.fillStyle = '#3be9ff';
      ctx.font = '700 22px "Cabinet Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#3be9ff';
      ctx.fillText('PREMI "NUOVA PARTITA" PER INIZIARE', this.canvas.width / 2, this.canvas.height / 2);
      ctx.shadowBlur = 0;
    }

    if (this.paused) {
      ctx.fillStyle = 'rgba(8, 4, 22, 0.65)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#ffb36b';
      ctx.font = '700 40px "Cabinet Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffb36b';
      ctx.fillText('PAUSA', this.canvas.width / 2, this.canvas.height / 2);
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(() => this.loop());
  },

  start() {
    this.running = true;
    this.paused = false;
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemySpeed = 2;
    this.player.x = this.canvas.width / 2 - this.player.width / 2;
    document.getElementById('gameOverMessage').style.display = 'none';
    this.createEnemies();
  },

  togglePause() {
    if (this.running) {
      this.paused = !this.paused;
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => gameState.init());
} else {
  gameState.init();
}
