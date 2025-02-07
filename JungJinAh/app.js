// <목표>
// 무한히 적이 생성되는 게임 만들기
// 특정 점수 달성 시 Meteor가 생성되고 해당 Meteor와 충돌하면 GameOver
// 무한히 적이 생성되는 환경이라면 player가 움직이는 동안에도 공격이 가능해야 편할 듯
// 추가로 우주선을 뚫어서 길을 만든다는 개념으로 만들고 싶다.
// 우주선에 부딫히는 경우를 제외한 상황에서는 life가 감소되지 않도록 설정하자!!!

// @ts-check
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(message, listener) {
    if (!this.listeners[message]) {
      this.listeners[message] = [];
    }
    this.listeners[message].push(listener);
  }

  emit(message, payload = null) {
    if (this.listeners[message]) {
      this.listeners[message].forEach((l) => l(message, payload));
    }
  }
}

class GameObject {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dead = false;
    this.type = "";
    this.width = 0;
    this.height = 0;
    this.img = undefined;
  }

  draw(ctx) {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }

  rectFromGameObject() {
    return {
      top: this.y,
      left: this.x,
      bottom: this.y + this.height,
      right: this.x + this.width,
    };
  }
}

class Hero extends GameObject {
  constructor(x, y) {
    super(x, y);
    (this.width = 99), (this.height = 75);
    this.type = "Hero";
    this.speed = { x: 0, y: 0 };
  }
}

class Laser extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.width = 9;
    this.height = 33;
    this.type = "Laser";
    let id = setInterval(() => {
      if (!this.dead) {
        this.y = this.y > 0 ? this.y - 20 : this.y;
        if (this.y <= 0) {
          this.dead = true;
        }
      } else {
        clearInterval(id);
      }
    }, 100);
  }
}

class Explosion extends GameObject {
  constructor(x, y, img) {
    super(x, y);
    this.img = img;
    this.type = "Explosion";
    (this.width = 56 * 2), (this.height = 54 * 2);
    setTimeout(() => {
      this.dead = true;
    }, 300);
  }
}

class Monster extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.type = "Monster";
    (this.width = 98), (this.height = 50);
    let id = setInterval(() => {
      if (!this.dead) {
        this.y = this.y < HEIGHT ? this.y + 30 : this.y;
        // 해당 if문이 설정한 height 범위 벗어나면 player 죽이는 코드
        if (this.y >= HEIGHT - this.height) {
          // this.dead = true;
          // eventEmitter.emit("MONSTER_OUT_OF_BOUNDS");
        }
      } else {
        clearInterval(id);
      }
    }, 1500);
  }
}

// Meteor 클래스 선언
class Meteor extends GameObject {}

// 방향키로 이동 도중 space키를 눌렀을 때 이동이 멈추지 않게 하기 위해 수정한 부분
const Messages = {
  MONSTER_OUT_OF_BOUNDS: "MONSTER_OUT_OF_BOUNDS",
  HERO_SPEED_LEFT: "HERO_MOVING_LEFT",
  HERO_SPEED_RIGHT: "HERO_MOVING_RIGHT",
  HERO_SPEED_ZERO: "HERO_SPEED_ZERO",
  HERO_FIRE: "HERO_FIRE",
  GAME_END_LOSS: "GAME_END_LOSS",
  GAME_END_WIN: "GAME_END_WIN",
  COLLISION_MONSTER_LASER: "COLLISION_MONSTER_LASER",
  COLLISION_MONSTER_HERO: "COLLISION_MONSTER_HERO",
  COLLISION_MONSTER_METEOR: "COLLISION_MONSTER_METEOR",
  KEY_EVENT_UP: "KEY_EVENT_UP",
  KEY_EVENT_DOWN: "KEY_EVENT_DOWN",
  KEY_EVENT_LEFT: "KEY_EVENT_LEFT",
  KEY_EVENT_RIGHT: "KEY_EVENT_RIGHT",
  GAME_START: "GAME_START",
};

class Game {
  constructor() {
    this.points = 0;
    this.life = 3;
    this.end = false;
    this.ready = false;

    // 어 이거다. 이 부분 코드가 monster가 boundary 범위 밖으로 나가면 player life 감소시키는 부분인거 같은데
    eventEmitter.on(Messages.MONSTER_OUT_OF_BOUNDS, () => {
      hero.dead = true;
    });
    eventEmitter.on(Messages.HERO_SPEED_LEFT, () => {
      hero.speed.x = -10;
      hero.img = heroImgLeft;
    });
    eventEmitter.on(Messages.HERO_SPEED_RIGHT, () => {
      hero.speed.x = 10;
      hero.img = heroImgRight;
    });
    eventEmitter.on(Messages.HERO_SPEED_ZERO, () => {
      hero.speed = { x: 0, y: 0 };
      if (game.life === 3) {
        hero.img = heroImg;
      } else {
        hero.img = heroImgDamaged;
      }
    });
    eventEmitter.on(Messages.HERO_FIRE, () => {
      if (coolDown === 0) {
        let l = new Laser(hero.x + 45, hero.y - 30);
        l.img = laserRedImg;
        gameObjects.push(l);
        cooling();
      }
    });
    eventEmitter.on(Messages.GAME_END_LOSS, (_, gameLoopId) => {
      game.end = true;
      displayMessage(
        "You died... - Press [Enter] to start the game Captain Pew Pew"
      );
      clearInterval(gameLoopId);
    });

    eventEmitter.on(Messages.GAME_END_WIN, (_, gameLoopId) => {
      game.end = true;
      displayMessage(
        "Victory!!! Pew Pew... - Press [Enter] to start a new game Captain Pew Pew",
        "green"
      );
      clearInterval(gameLoopId);
    });
    eventEmitter.on(
      Messages.COLLISION_MONSTER_LASER,
      (_, { first: laser, second: monster }) => {
        laser.dead = true;
        monster.dead = true;
        this.points += 100;

        gameObjects.push(new Explosion(monster.x, monster.y, laserRedShot));
      }
    );
    // 아래 코드가 몬스터 충돌 시 life 감소하는 코드
    // 해당 부분 활용해서 Meteor 추가하면 될 듯 하는디?
    eventEmitter.on(
      Messages.COLLISION_MONSTER_HERO,
      (_, { monster: m, id }) => {
        game.life--;
        if (game.life === 0) {
          hero.dead = true;
          eventEmitter.emit(Messages.GAME_END_LOSS, id);
          gameObjects.push(new Explosion(hero.x, hero.y, laserGreenShot));
        }
        hero.img = heroImgDamaged;
        m.dead = true;
        gameObjects.push(new Explosion(m.x, m.y, laserRedShot));
      }
    );
    // Meteor 충돌 관련 코드
    // 충돌 시 바로 game over
    eventEmitter.on(
      Messages.COLLISION_MONSTER_METEOR,
      // {monster: m, id}가 뭐를 의미하는지 알아야 코드 수정 가능할 듯?
      // 이 부분 해결되면 수정하고 for으로 랜덤한 타이밍에 spawn되게 구현하면 성공!
      (_, { monster: m, id }) => {
        game.life = 0;
        if (game.life === 0) {
          hero.dead = true;
          eventEmitter.emit(Messages.GAME_END_LOSS, id);
          gameObjects.push(new Explosion(hero.x, hero.y, laserGreenShot));
        }
        hero.img = heroImgDamaged;
        m.dead = true;
        gameObjects.push(new Explosion(m.x, m.y, laserRedShot));
      }
    );
    eventEmitter.on(Messages.KEY_EVENT_UP, () => {
      hero.y = hero.y > 0 ? hero.y - 5 : hero.y;
    });
    eventEmitter.on(Messages.KEY_EVENT_DOWN, () => {
      hero.y = hero.y < HEIGHT ? hero.y + 5 : hero.y;
    });
    eventEmitter.on(Messages.KEY_EVENT_LEFT, () => {
      hero.x = hero.x > 0 ? hero.x - 10 : hero.x;
    });
    eventEmitter.on(Messages.KEY_EVENT_RIGHT, () => {
      hero.x = hero.x < WIDTH ? hero.x + 10 : hero.x;
    });
    eventEmitter.on(Messages.GAME_START, () => {
      if (game.ready && game.end) {
        // assets loaded
        runGame();
      }
    });
  }
}

const eventEmitter = new EventEmitter();
const hero = new Hero(0, 0);
const WIDTH = 1024;
const HEIGHT = 768;
let gameObjects = [];
let laserRedImg;
let laserRedShot;
let laserGreenShot;
let canvas;
let ctx;
let heroImg;
let heroImgLeft;
let heroImgRight;
let heroImgDamaged;
let lifeImg;
let monsterImg;
let meteorImg;

let coolDown = 0;

const game = new Game();

function loadTexture(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = path;
    img.onload = () => {
      resolve(img);
    };
  });
}

function rectFromGameObject(go) {
  return {
    top: go.y,
    left: go.x,
    bottom: go.y + go.height,
    right: go.x + go.width,
  };
}

function intersectRect(r1, r2) {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
}

function draw(ctx, objects) {
  objects.forEach((obj) => {
    obj.draw(ctx);
  });
}

let onKeyDown = function (e) {
  console.log(e.keyCode);
  switch (e.keyCode) {
    case 37:
    case 39:
    case 38:
    case 40: // Arrow keys
      e.preventDefault();
      break; // Space
    // case 32:
    // 	e.preventDefault();
    // 	break; // Space
    default:
      break; // do not block other keys
  }
};

// 방향키로 이동 도중 space키를 눌렀을 때 이동이 멈추지 않게 하기 위해 수정한 부분
window.addEventListener("keydown", (e) => {
  switch (e.keyCode) {
    case 37:
      // if left
      eventEmitter.emit(Messages.HERO_SPEED_LEFT);
      break;
    case 39:
      eventEmitter.emit(Messages.HERO_SPEED_RIGHT);
      break;
  }
});

// TODO make message driven
// 방향키로 이동 도중 space키를 눌렀을 때 이동이 멈추지 않게 하기 위해 수정한 부분
window.addEventListener("keyup", (evt) => {
  // 해당 코드 주석처리
  // 이벤트 처리 시 hero가 무조건 정지하게 됨
  // eventEmitter.emit(Messages.HERO_SPEED_ZERO);
  if (evt.key === "ArrowUp") {
    eventEmitter.emit(Messages.KEY_EVENT_UP);
  } else if (evt.key === "ArrowDown") {
    eventEmitter.emit(Messages.KEY_EVENT_DOWN);
  } else if (evt.key === "ArrowLeft") {
    eventEmitter.emit(Messages.KEY_EVENT_LEFT);
    eventEmitter.emit(Messages.HERO_SPEED_ZERO); // 방향키를 떼었을 때도 멈추도록 추가
  } else if (evt.key === "ArrowRight") {
    eventEmitter.emit(Messages.KEY_EVENT_RIGHT);
    eventEmitter.emit(Messages.HERO_SPEED_ZERO); // 방향키를 떼었을 때도 멈추도록 추가
  } else if (evt.keyCode === 32) {
    // space
    eventEmitter.emit(Messages.HERO_FIRE);
  } else if (evt.key === "Enter") {
    eventEmitter.emit(Messages.GAME_START);
  }
});

function cooling() {
  coolDown = 500;
  let id = setInterval(() => {
    coolDown -= 100;
    if (coolDown === 0) {
      clearInterval(id);
    }
  }, 100);
}

function displayGameScore(message) {
  ctx.font = "30px Arial";
  ctx.fillStyle = "red";
  ctx.textAlign = "right";
  ctx.fillText(message, canvas.width - 90, canvas.height - 30);
}

function displayLife() {
  // should show tree ships.. 94 * 3
  const START_X = canvas.width - 150 - 30;
  for (let i = 0; i < game.life; i++) {
    ctx.drawImage(lifeImg, START_X + (i + 1) * 35, canvas.height - 90);
  }
}

function displayMessage(message, color = "red") {
  ctx.font = "30px Arial";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

// monster가 무한하게 스폰되게 하기 위해 수정해야 하는 부분
function createMonsters(monsterImg) {
  // 98 * 5     canvas.width - (98*5 /2)
  const MONSTER_TOTAL = 5;
  const MONSTER_WIDTH = MONSTER_TOTAL * 98;
  const START_X = (canvas.width - MONSTER_WIDTH) / 2;
  const STOP_X = START_X + MONSTER_WIDTH;

  for (let x = START_X; x < STOP_X; x += 98) {
    for (let y = 0; y < 50 * 7; y += 50) {
      gameObjects.push(new Monster(x, y - 200));
    }
  }

  gameObjects.forEach((go) => {
    go.img = monsterImg;
  });
}

// 새로 추가하는 장애물 관련 코드
// 메테오 생성 코드
function createMeteor(meteorImg) {}

function createHero(heroImg) {
  hero.dead = false;
  hero.img = heroImg;
  hero.y = (canvas.height / 4) * 3;
  hero.x = canvas.width / 2;
  gameObjects.push(hero);
}

function checkGameState(gameLoopId) {
  const monsters = gameObjects.filter((go) => go.type === "Monster");
  if (hero.dead) {
    eventEmitter.emit(Messages.GAME_END_LOSS, gameLoopId);
  } else if (monsters.length === 0) {
    eventEmitter.emit(Messages.GAME_END_WIN);
  }

  // update hero position
  if (hero.speed.x !== 0) {
    hero.x += hero.speed.x;
  }

  const lasers = gameObjects.filter((go) => go.type === "Laser");
  // laser hit something
  lasers.forEach((l) => {
    monsters.forEach((m) => {
      if (intersectRect(l.rectFromGameObject(), m.rectFromGameObject())) {
        eventEmitter.emit(Messages.COLLISION_MONSTER_LASER, {
          first: l,
          second: m,
        });
      }
    });
  });

  // hero hit monster
  monsters.forEach((m) => {
    if (intersectRect(m.rectFromGameObject(), hero.rectFromGameObject())) {
      eventEmitter.emit(Messages.COLLISION_MONSTER_HERO, {
        monster: m,
        id: gameLoopId,
      });
    }
  });

  gameObjects = gameObjects.filter((go) => !go.dead);
}

function runGame() {
  gameObjects = [];
  game.life = 3;
  game.points = 0;
  game.end = false;

  createMonsters(monsterImg);
  // Meteor 함수 추가 할 부분
  createMeteor(meteorImg);
  createHero(heroImg);

  let gameLoopId = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    displayGameScore("Score: " + game.points);
    displayLife();
    checkGameState(gameLoopId);
    draw(ctx, gameObjects);
  }, 100);
}

window.onload = async () => {
  canvas = document.getElementById("myCanvas");
  /** @type {CanvasRenderingContext2D} */
  ctx = canvas.getContext("2d");

  heroImg = await loadTexture("spaceArt/png/player.png");
  heroImgLeft = await loadTexture("spaceArt/png/playerLeft.png");
  heroImgRight = await loadTexture("spaceArt/png/playerRight.png");
  heroImgDamaged = await loadTexture("spaceArt/png/playerDamaged.png");
  monsterImg = await loadTexture("spaceArt/png/enemyShip.png");
  meteorImg = await loadTexture("spaceArt/png/meteorBig.png"); // meteor 이미지 추가 부분
  laserRedImg = await loadTexture("spaceArt/png/laserRed.png");
  laserRedShot = await loadTexture("spaceArt/png/laserRedShot.png");
  laserGreenShot = await loadTexture("spaceArt/png/laserGreenShot.png");
  lifeImg = await loadTexture("spaceArt/png/life.png");

  // 처음 시작 화면 canvas 설정 부분
  game.ready = true;
  game.end = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  displayMessage("Press [Enter] to start the game Captain Pew Pew", "blue");

  // CHECK  draw 5 * 5 monsters
  // CHECK move monsters down 1 step per 0.5 second
  // CHECK if monster collide with hero, destroy both, display loose text
  // CHECK if monster reach MAX, destroy hero, loose text
  // TODO add explosion when laser hits monster, should render for <=300ms
  // TODO add specific texture when moving left or right
  // TODO take damage when a meteor moves into you
  // TODO add meteor, meteors can damage ships
  // TODO add UFO after all monsters are down, UFO can fire back
  // TODO start random green laser from an enemy and have it go to HEIGHT, if collide with hero then deduct point

  // CHECK  draw bullet
  // CHECK , bullet should be destroyed at top
  // CHECK space should produce bullet, bullet should move 2 step per second
  // CHECK if bullet collide with monster, destroy both
  // CHECK if bullet rect intersect with monster rect then it is colliding..
};
