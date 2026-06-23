// Space Invaders Game
const gameState = {
  canvas: document.getElementById('gameCanvas'),
  ctx: null,

  // Game state
  running: false,
  paused: false,
  score: 0,
  level: 1,
  lives: 3,

  // Player
  player: {
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    speed: 5,
    dx: 0
  },

  // Game objects
  bullets: [],
  enemies: [],
  enemyBullets: [],
  bulletSpeed: 7,
  enemySpeed: 2,

  // Controls
  keys: {},

  init() {
    this.ctx = this.canvas.getContext('2d');
    this.player.x = this.canvas.width / 2 - this.player.width / 2;
    this.player.y = this.canvas.height - 40;

    this.attachEventListeners();
    this.gameLoop();
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
          height: 25,
          dx: this.enemySpeed
        });
      }
    }
  },

  drawPlayer() {
    this.ctx.fillStyle = '#00ff00';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#00ff00';

    this.ctx.beginPath();
    this.ctx.moveTo(this.player.x + this.player.width / 2, this.player.y);
    this.ctx.lineTo(this.player.x + this.player.width, this.player.y + this.player.height);
    this.ctx.lineTo(this.player.x, this.player.y + this.player.height);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
  },

  drawEnemies() {
    this.ctx.fillStyle = '#00ff00';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#00ff00';

    this.enemies.forEach(enemy => {
      this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(enemy.x + 5, enemy.y + 5, enemy.width - 10, enemy.height - 10);
    });

    this.ctx.shadowBlur = 0;
  },

  drawBullets() {
    this.ctx.fillStyle = '#00ff00';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = '#00ff00';

    this.bullets.forEach(bullet => {
      this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    this.ctx.shadowBlur = 0;
  },

  drawEnemyBullets() {
    this.ctx.fillStyle = '#ff0000';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = '#ff0000';

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
    this.bullets = this.bullets.filter(b => b.y > 0);
    this.bullets.forEach(bullet => {
      bullet.y -= this.bulletSpeed;
    });
  },

  updateEnemies() {
    let changeDirection = false;

    this.enemies.forEach(enemy => {
      enemy.x += enemy.dx;
      if (enemy.x < 0 || enemy.x + enemy.width > this.canvas.width) {
        changeDirection = true;
      }
    });

    if (changeDirection) {
      this.enemySpeed *= -1;
      this.enemies.forEach(enemy => {
        enemy.dx = this.enemySpeed;
        enemy.y += 30;
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
    this.enemyBullets = this.enemyBullets.filter(b => b.y < this.canvas.height);
    this.enemyBullets.forEach(bullet => {
      bullet.y += bullet.dy;
    });
  },

  checkCollisions() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        if (this.bullets[i] && this.enemies[j] &&
            this.bullets[i].x < this.enemies[j].x + this.enemies[j].width &&
            this.bullets[i].x + this.bullets[i].width > this.enemies[j].x &&
            this.bullets[i].y < this.enemies[j].y + this.enemies[j].height &&
            this.bullets[i].y + this.bullets[i].height > this.enemies[j].y) {
          this.score += 10;
          this.bullets.splice(i, 1);
          this.enemies.splice(j, 1);
          break;
        }
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      if (this.enemyBullets[i].x < this.player.x + this.player.width &&
          this.enemyBullets[i].x + this.enemyBullets[i].width > this.player.x &&
          this.enemyBullets[i].y < this.player.y + this.player.height &&
          this.enemyBullets[i].y + this.enemyBullets[i].height > this.player.y) {
        this.lives--;
        this.enemyBullets.splice(i, 1);
        break;
      }
    }

    this.enemies.forEach(enemy => {
      if (enemy.y > this.canvas.height) {
        this.lives = 0;
      }
    });
  },

  updateUI() {
    document.getElementById('score').textContent = this.score;
    document.getElementById('lives').textContent = this.lives;
    document.getElementById('level').textContent = this.level;
  },

  gameLoop = () => {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.running && !this.paused) {
      this.updatePlayer();
      this.updateBullets();
      this.updateEnemies();
      this.updateEnemyBullets();
      this.checkCollisions();

      if (this.enemies.length === 0) {
        this.level++;
        this.enemySpeed += 1;
        this.createEnemies();
        this.score += 100;
      }

      if (this.lives <= 0) {
        this.running = false;
        document.getElementById('gameOverMessage').textContent = `GAME OVER! SCORE: ${this.score}`;
        document.getElementById('gameOverMessage').style.display = 'block';
      }
    }

    this.drawEnemies();
    this.drawBullets();
    this.drawEnemyBullets();
    this.drawPlayer();

    this.updateUI();

    if (this.paused) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#00ff00';
      this.ctx.font = 'bold 40px Courier New';
      this.ctx.textAlign = 'center';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#00ff00';
      this.ctx.fillText('PAUSA', this.canvas.width / 2, this.canvas.height / 2);
    }

    requestAnimationFrame(() => this.gameLoop());
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
    document.getElementById('gameOverMessage').style.display = 'none';
    this.createEnemies();
  },

  togglePause() {
    if (this.running) {
      this.paused = !this.paused;
    }
  }
};

// Initialize game
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => gameState.init());
} else {
  gameState.init();
}
