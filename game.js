// 游戏主类
class BreakoutGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false; // 像素风格
        
        // 游戏状态
        this.gameState = 'playing'; // playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        
        // 游戏对象
        this.paddle = new Paddle(this.canvas.width / 2 - 50, this.canvas.height - 30, 100, 15);
        this.ball = new Ball(this.canvas.width / 2, this.canvas.height - 100, 8);
        this.bricks = [];
        this.powerUps = [];
        this.particles = [];
        
        // 输入管理
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        // 初始化
        this.initLevel();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    initLevel() {
        this.bricks = [];
        const rows = 5 + Math.floor(this.level / 3);
        const cols = 10;
        const brickWidth = 70;
        const brickHeight = 20;
        const padding = 5;
        const offsetTop = 60;
        const offsetLeft = (this.canvas.width - (cols * (brickWidth + padding) - padding)) / 2;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetLeft + col * (brickWidth + padding);
                const y = offsetTop + row * (brickHeight + padding);
                const color = this.getBrickColor(row);
                const hits = Math.min(row + 1, 3); // 砖块耐久度
                this.bricks.push(new Brick(x, y, brickWidth, brickHeight, color, hits));
            }
        }
    }
    
    getBrickColor(row) {
        const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];
        return colors[row % colors.length];
    }
    
    setupEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // 鼠标事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // 更新挡板
        this.paddle.update(this.keys, this.mouse, this.canvas.width, this.canvas.height);
        
        // 更新球
        this.ball.update();
        
        // 球与边界碰撞
        if (this.ball.x <= this.ball.radius || this.ball.x >= this.canvas.width - this.ball.radius) {
            this.ball.vx = -this.ball.vx;
            this.createParticles(this.ball.x, this.ball.y, '#00ffff');
        }
        if (this.ball.y <= this.ball.radius) {
            this.ball.vy = -this.ball.vy;
            this.createParticles(this.ball.x, this.ball.y, '#00ffff');
        }
        
        // 球掉落
        if (this.ball.y > this.canvas.height) {
            this.lives--;
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.resetBall();
            }
        }
        
        // 球与挡板碰撞
        if (this.checkCollision(this.ball, this.paddle)) {
            const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
            const angle = (hitPos - 0.5) * Math.PI / 3; // -60度到60度
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            this.ball.vx = Math.sin(angle) * speed;
            this.ball.vy = -Math.abs(Math.cos(angle) * speed);
            this.createParticles(this.ball.x, this.ball.y, '#00ff00');
        }
        
        // 球与砖块碰撞
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];
            if (this.checkCollision(this.ball, brick)) {
                // 计算碰撞方向
                const ballCenterX = this.ball.x;
                const ballCenterY = this.ball.y;
                const brickCenterX = brick.x + brick.width / 2;
                const brickCenterY = brick.y + brick.height / 2;
                
                const dx = ballCenterX - brickCenterX;
                const dy = ballCenterY - brickCenterY;
                
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.ball.vx = -this.ball.vx;
                } else {
                    this.ball.vy = -this.ball.vy;
                }
                
                // 砖块受损
                brick.hits--;
                if (brick.hits <= 0) {
                    this.bricks.splice(i, 1);
                    this.score += 10 * this.level;
                    this.createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color);
                    
                    // 随机掉落道具
                    if (Math.random() < 0.1) {
                        this.powerUps.push(new PowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2));
                    }
                } else {
                    // 砖块变色表示受损
                    brick.color = this.getDamagedColor(brick.color);
                }
                
                break;
            }
        }
        
        // 更新道具
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.update();
            
            // 道具与挡板碰撞
            if (this.checkCollision(powerUp, this.paddle)) {
                this.applyPowerUp(powerUp.type);
                this.powerUps.splice(i, 1);
            } else if (powerUp.y > this.canvas.height) {
                this.powerUps.splice(i, 1);
            }
        }
        
        // 更新粒子效果
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // 检查关卡完成
        if (this.bricks.length === 0) {
            this.level++;
            this.initLevel();
            this.resetBall();
            this.score += 100 * this.level;
        }
        
        // 更新UI
        this.updateUI();
    }
    
    checkCollision(obj1, obj2) {
        if (obj1.radius !== undefined) {
            // 圆形与矩形碰撞
            const closestX = Math.max(obj2.x, Math.min(obj1.x, obj2.x + obj2.width));
            const closestY = Math.max(obj2.y, Math.min(obj1.y, obj2.y + obj2.height));
            const distance = Math.sqrt((obj1.x - closestX) ** 2 + (obj1.y - closestY) ** 2);
            return distance < obj1.radius;
        } else {
            // 矩形与矩形碰撞
            return obj1.x < obj2.x + obj2.width &&
                   obj1.x + obj1.width > obj2.x &&
                   obj1.y < obj2.y + obj2.height &&
                   obj1.y + obj1.height > obj2.y;
        }
    }
    
    getDamagedColor(color) {
        const colorMap = {
            '#ff0000': '#800000',
            '#ff8800': '#804400',
            '#ffff00': '#808000',
            '#00ff00': '#008000',
            '#0088ff': '#004480',
            '#8800ff': '#440080'
        };
        return colorMap[color] || '#404040';
    }
    
    applyPowerUp(type) {
        switch (type) {
            case 'expand':
                this.paddle.width = Math.min(this.paddle.width * 1.5, 200);
                break;
            case 'speed':
                this.ball.vx *= 1.2;
                this.ball.vy *= 1.2;
                break;
            case 'life':
                this.lives++;
                break;
        }
    }
    
    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    resetBall() {
        this.ball.x = this.canvas.width / 2;
        this.ball.y = this.canvas.height - 100;
        this.ball.vx = (Math.random() - 0.5) * 3;
        this.ball.vy = 2;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
    }
    
    render() {
        // 清空画布
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 渲染游戏对象
        this.paddle.render(this.ctx);
        this.ball.render(this.ctx);
        
        this.bricks.forEach(brick => brick.render(this.ctx));
        this.powerUps.forEach(powerUp => powerUp.render(this.ctx));
        this.particles.forEach(particle => particle.render(this.ctx));
        
        // 渲染暂停提示
        if (this.gameState === 'paused') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '48px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('暂停', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 挡板类
class Paddle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = 8;
    }
    
    update(keys, mouse, canvasWidth, canvasHight) {
        // 键盘控制
        if (keys["ArrowLeft"] || keys["KeyA"]) {
            this.x -= this.speed;
        }
        if (keys["ArrowRight"] || keys["KeyD"]) {
            this.x += this.speed;
        }
		if (keys["ArrowUp"] || keys["KeyW"]) {
            this.y -= this.speed;
        }
        if (keys["ArrowDown"] || keys["KeyS"]) {
            this.y += this.speed;
        }
        
        // 边界限制
        // const playAreaWidth = canvasWidth * 0.8; // 挡板可移动区域的宽度，例如画布宽度的80%
        // const minX = (canvasWidth - playAreaWidth) / 2; // 移动区域的左边界
        // const maxX = minX + playAreaWidth - this.width; // 移动区域的右边界
        const playAreaWidth = canvasWidth; // 挡板可移动区域的宽度，例如画布宽度的80%
        const minX = 0; // 移动区域的左边界
        const maxX = minX + playAreaWidth - this.width; // 移动区域的右边界
        this.x = Math.max(minX, Math.min(this.x, maxX));

		const playAreaHight = canvasHight * 0.2; // 挡板可移动区域的宽度，例如画布宽度的80%
        const minY = canvasHight - playAreaHight; // 移动区域的左边界
        const maxY = canvasHight - this.height; // 移动区域的右边界
        this.y = Math.max(minY, Math.min(this.y, maxY));
    }
    
    render(ctx) {
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 像素风格边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

// 球类
class Ball {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = 2;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    
    render(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 像素风格效果
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    }
}

// 砖块类
class Brick {
    constructor(x, y, width, height, color, hits) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.hits = hits;
        this.maxHits = hits;
    }
    
    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 像素风格边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // 显示耐久度
        if (this.hits > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(this.hits.toString(), this.x + this.width / 2, this.y + this.height / 2 + 4);
        }
    }
}

// 道具类
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.vy = 2;
        this.type = this.getRandomType();
    }
    
    getRandomType() {
        const types = ['expand', 'speed', 'life'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    update() {
        this.y += this.vy;
    }
    
    render(ctx) {
        const colors = {
            'expand': '#00ff00',
            'speed': '#ff0000',
            'life': '#ff00ff'
        };
        
        ctx.fillStyle = colors[this.type];
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        
        // 道具图标
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        const symbols = { 'expand': 'E', 'speed': 'S', 'life': 'L' };
        ctx.fillText(symbols[this.type], this.x, this.y + 4);
    }
}

// 粒子类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.color = color;
        this.life = 30;
        this.maxLife = 30;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // 重力
        this.life--;
    }
    
    render(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(this.x - 1, this.y - 1, 2, 2);
    }
}

// 重新开始游戏
function restartGame() {
    document.getElementById('gameOver').style.display = 'none';
    new BreakoutGame();
}

// 启动游戏
window.addEventListener('load', () => {
    new BreakoutGame();
});

